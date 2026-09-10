import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';

export interface CreateVoteInput {
  collegeId: string;
  durationDays: number;
  colors: { colorHex: string; label?: string }[];
}

export class VoteService {
  /**
   * Create a new college colors vote.
   * Enforces verified representative check, automatic fixed_entity_id retrieval from college,
   * duration bounds (3-7 days), and cryptographically random share token.
   */
  static async createVote(representativeId: string, input: CreateVoteInput) {
    const { collegeId, durationDays, colors } = input;

    // 1. Verify representative status
    const rep = await prisma.representative.findUnique({
      where: { id: representativeId },
    });

    if (!rep || !rep.isVerified) {
      throw new Error('غير مصرح لك بإنشاء تصويت. يجب التحقق من رقم الهاتف أولاً عبر رمز OTP.');
    }

    // 2. Validate duration (3 to 7 days)
    if (durationDays < 3 || durationDays > 7) {
      throw new Error('مدة التصويت يجب أن تكون بين 3 أيام و 7 أيام فقط.');
    }

    // 3. Validate colors
    if (!colors || colors.length < 2) {
      throw new Error('يجب تحديد لونين على الأقل للتصويت.');
    }

    // 4. Retrieve college and automatically extract fixed_entity_id
    const college = await prisma.college.findUnique({
      where: { id: collegeId },
      include: { university: true },
    });

    if (!college) {
      throw new Error('الكلية المحددة غير موجودة في النظام.');
    }

    const fixedEntityId = college.fixedEntityId;

    // 5. Calculate timelines
    const startsAt = new Date();
    const endsAt = new Date(startsAt.getTime() + durationDays * 24 * 60 * 60 * 1000);

    // 6. Generate unguessable random share token
    const shareToken = crypto.randomBytes(16).toString('hex'); // 32 characters hex

    // 7. Atomic transaction: create vote & vote_colors
    const vote = await prisma.vote.create({
      data: {
        collegeId: college.id,
        representativeId: rep.id,
        fixedEntityId,
        durationDays,
        status: 'active',
        shareToken,
        startsAt,
        endsAt,
        colors: {
          create: colors.map((c) => ({
            colorHex: c.colorHex.toLowerCase(),
            label: c.label || null,
          })),
        },
      },
      include: {
        college: {
          include: { university: true },
        },
        colors: true,
      },
    });

    return {
      id: vote.id,
      college: {
        id: vote.college.id,
        name: vote.college.name,
        universityName: vote.college.university.name,
        fixedEntityId: vote.fixedEntityId,
      },
      durationDays: vote.durationDays,
      status: vote.status,
      shareToken: vote.shareToken,
      startsAt: vote.startsAt,
      endsAt: vote.endsAt,
      colors: vote.colors,
      shareUrl: `/vote/${vote.shareToken}`,
      createdAt: vote.createdAt,
    };
  }

  /**
   * End vote manually by representative (checks ownership before ending)
   */
  static async endVote(voteId: string, representativeId: string) {
    const vote = await prisma.vote.findUnique({
      where: { id: voteId },
      include: { college: true },
    });

    if (!vote) {
      throw new Error('التصويت المطلوب غير موجود.');
    }

    // Check ownership: only creator representative can end the vote
    if (vote.representativeId !== representativeId) {
      throw new Error('غير مصرح لك بإنهاء هذا التصويت. هذه الصلاحية خاصة بممثل الدفعة الذي أنشأ التصويت فقط.');
    }

    if (vote.status === 'ended') {
      return vote;
    }

    const updated = await prisma.vote.update({
      where: { id: voteId },
      data: {
        status: 'ended',
        endsAt: new Date(),
      },
      include: {
        college: true,
        colors: true,
      },
    });

    return updated;
  }

  /**
   * Fetch vote details by share_token for student view.
   * Auto-closes if endsAt has passed. Returns current student choice if identifier provided.
   */
  static async getVoteByToken(token: string, studentIdentifier?: string) {
    const vote = await prisma.vote.findUnique({
      where: { shareToken: token },
      include: {
        college: {
          include: { university: true },
        },
        colors: true,
      },
    });

    if (!vote) {
      throw new Error('رابط التصويت غير صالح أو تم حذفه.');
    }

    // Check auto-close on expired time
    let currentStatus = vote.status;
    if (currentStatus === 'active' && new Date() >= vote.endsAt) {
      await prisma.vote.update({
        where: { id: vote.id },
        data: { status: 'ended' },
      });
      currentStatus = 'ended';
    }

    // Find student's existing choice if any
    let studentChoice = null;
    if (studentIdentifier) {
      const choice = await prisma.voteChoice.findUnique({
        where: {
          vote_student_unique: {
            voteId: vote.id,
            studentIdentifier,
          },
        },
        include: { selectedColor: true },
      });
      if (choice) {
        studentChoice = {
          colorId: choice.selectedColorId,
          colorHex: choice.selectedColor.colorHex,
          label: choice.selectedColor.label,
          updatedAt: choice.updatedAt,
        };
      }
    }

    return {
      id: vote.id,
      shareToken: vote.shareToken,
      status: currentStatus,
      collegeName: vote.college.name,
      universityName: vote.college.university.name,
      fixedEntityId: vote.fixedEntityId,
      startsAt: vote.startsAt,
      endsAt: vote.endsAt,
      colors: vote.colors,
      studentChoice,
      isExpired: new Date() >= vote.endsAt,
    };
  }

  /**
   * Record or update (upsert) a student's vote choice.
   * Disallows voting if vote is ended or expired.
   */
  static async recordStudentChoice(token: string, studentIdentifier: string, selectedColorId: string) {
    const vote = await prisma.vote.findUnique({
      where: { shareToken: token },
      include: { colors: true },
    });

    if (!vote) {
      throw new Error('رابط التصويت غير صالح.');
    }

    // Enforce active status
    if (vote.status === 'ended' || new Date() >= vote.endsAt) {
      if (vote.status !== 'ended') {
        await prisma.vote.update({
          where: { id: vote.id },
          data: { status: 'ended' },
        });
      }
      throw new Error('التصويت مغلق، لا يمكن تسجيل أو تعديل الأصوات بعد انتهاء مدة التصويت.');
    }

    // Verify selected color belongs to this vote
    const colorExists = vote.colors.some((c) => c.id === selectedColorId);
    if (!colorExists) {
      throw new Error('اللون المختار غير موجود ضمن خيارات هذا التصويت.');
    }

    // Upsert choice based on (vote_id, student_identifier)
    const choice = await prisma.voteChoice.upsert({
      where: {
        vote_student_unique: {
          voteId: vote.id,
          studentIdentifier,
        },
      },
      update: {
        selectedColorId,
        updatedAt: new Date(),
      },
      create: {
        voteId: vote.id,
        studentIdentifier,
        selectedColorId,
      },
      include: {
        selectedColor: true,
      },
    });

    return {
      success: true,
      message: 'تم تسجيل اختيارك بنجاح.',
      choice: {
        colorId: choice.selectedColorId,
        colorHex: choice.selectedColor.colorHex,
        label: choice.selectedColor.label,
        updatedAt: choice.updatedAt,
      },
    };
  }

  /**
   * Get live results and aggregated vote counts per color.
   */
  static async getVoteResults(voteId: string) {
    const vote = await prisma.vote.findUnique({
      where: { id: voteId },
      include: {
        college: { include: { university: true } },
        colors: {
          include: {
            _count: {
              select: { choices: true },
            },
          },
        },
      },
    });

    if (!vote) {
      throw new Error('التصويت المطلوب غير موجود.');
    }

    const totalVotes = vote.colors.reduce((sum, c) => sum + c._count.choices, 0);

    const results = vote.colors.map((c) => {
      const count = c._count.choices;
      const percentage = totalVotes > 0 ? Math.round((count / totalVotes) * 1000) / 10 : 0;
      return {
        colorId: c.id,
        colorHex: c.colorHex,
        label: c.label,
        votesCount: count,
        percentage,
      };
    });

    // Sort descending by votes
    results.sort((a, b) => b.votesCount - a.votesCount);

    return {
      voteId: vote.id,
      collegeName: vote.college.name,
      universityName: vote.college.university.name,
      fixedEntityId: vote.fixedEntityId,
      status: vote.status,
      endsAt: vote.endsAt,
      totalVotes,
      results,
      winner: results.length > 0 && results[0].votesCount > 0 ? results[0] : null,
    };
  }

  /**
   * Background task: check and expire past votes
   */
  static async checkAndExpireVotesCron() {
    const now = new Date();
    const result = await prisma.vote.updateMany({
      where: {
        status: 'active',
        endsAt: { lte: now },
      },
      data: {
        status: 'ended',
      },
    });
    return result.count;
  }
}
