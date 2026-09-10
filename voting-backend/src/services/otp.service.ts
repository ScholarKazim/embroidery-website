import { prisma } from '../lib/prisma.js';
import { generateNumericOtp, hashOtp, verifyOtpHash } from '../lib/otp-hash.js';
import { generateToken } from '../lib/jwt.js';
import { getSmsProvider } from './sms/sms-factory.js';
import { config } from '../config/index.js';

export class OtpService {
  /**
   * Request an OTP for a representative phone number.
   * Finds or creates representative, generates and bcrypt-hashes OTP,
   * sets short expiration, and dispatches via active SMS provider.
   */
  static async requestOtp(phoneNumber: string) {
    // 1. Find or create representative record
    const representative = await prisma.representative.upsert({
      where: { phoneNumber },
      update: {},
      create: {
        phoneNumber,
        isVerified: false,
      },
    });

    // 2. Invalidate any active, non-expired OTP codes for this representative
    await prisma.otpCode.deleteMany({
      where: {
        representativeId: representative.id,
      },
    });

    // 3. Generate secure 6-digit numeric OTP & bcrypt hash
    const rawOtp = generateNumericOtp();
    const codeHash = await hashOtp(rawOtp);
    const expiresAt = new Date(Date.now() + config.otp.expirationSeconds * 1000);

    // 4. Save hashed OTP record
    await prisma.otpCode.create({
      data: {
        representativeId: representative.id,
        codeHash,
        expiresAt,
        attempts: 0,
      },
    });

    // 5. Send via pluggable SMS Provider
    const smsProvider = getSmsProvider();
    const smsResult = await smsProvider.sendOtp(
      phoneNumber,
      rawOtp,
      'إبرة وخيط - رمز التحقق لتصويت ألوان دفعتك هو: {code}. صالح لمدة 5 دقائق.'
    );

    if (!smsResult.success) {
      console.error(`[OTP Service] Failed to send SMS via ${smsProvider.name}:`, smsResult.error);
      // In development / mock mode, return success regardless
      if (config.nodeEnv !== 'production' && smsProvider.name === 'mock') {
        return {
          success: true,
          message: 'تم إرسال رمز التحقق بنجاح (بيئة التطوير: تم عرض الرمز في وحدة التحكم)',
          expiresInSeconds: config.otp.expirationSeconds,
          devCode: rawOtp,
        };
      }
      throw new Error(`فشل إرسال رسالة التحقق SMS: ${smsResult.error || 'خطأ في المزود'}`);
    }

    return {
      success: true,
      message: 'تم إرسال رمز التحقق إلى رقم هاتفك بنجاح.',
      expiresInSeconds: config.otp.expirationSeconds,
      ...(config.nodeEnv === 'development' ? { devCode: rawOtp } : {}),
    };
  }

  /**
   * Verify representative OTP code, enforce max attempts, and issue JWT session.
   */
  static async verifyOtp(phoneNumber: string, inputCode: string) {
    // 1. Fetch representative
    const representative = await prisma.representative.findUnique({
      where: { phoneNumber },
    });

    if (!representative) {
      throw new Error('لم يتم العثور على حساب مرتبط بهذا الرقم، يرجى طلب رمز جديد.');
    }

    // 2. Fetch latest OTP code
    const otpRecord = await prisma.otpCode.findFirst({
      where: { representativeId: representative.id },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      throw new Error('لا يوجد رمز تحقق نشط لهذا الرقم، يرجى طلب رمز جديد.');
    }

    // 3. Check expiration
    if (new Date() > otpRecord.expiresAt) {
      await prisma.otpCode.delete({ where: { id: otpRecord.id } });
      throw new Error('انتهت صلاحية رمز التحقق، يرجى طلب رمز جديد.');
    }

    // 4. Check max attempts (prevent brute-force)
    if (otpRecord.attempts >= config.otp.maxAttempts) {
      await prisma.otpCode.delete({ where: { id: otpRecord.id } });
      throw new Error('تجاوزت الحد الأقصى لمحاولات إدخال الرمز، تم إبطال الرمز للأمان.');
    }

    // 5. Verify hashed code
    const isMatch = await verifyOtpHash(inputCode, otpRecord.codeHash);

    if (!isMatch) {
      // Increment attempt counter
      await prisma.otpCode.update({
        where: { id: otpRecord.id },
        data: { attempts: { increment: 1 } },
      });
      const remainingAttempts = config.otp.maxAttempts - (otpRecord.attempts + 1);
      throw new Error(`رمز التحقق غير صحيح. تبقى لك ${Math.max(0, remainingAttempts)} محاولات.`);
    }

    // 6. Success: mark representative as verified & remove consumed OTP
    const updatedRep = await prisma.representative.update({
      where: { id: representative.id },
      data: { isVerified: true },
    });

    await prisma.otpCode.delete({ where: { id: otpRecord.id } });

    // 7. Issue JWT Session Token
    const token = generateToken({
      representativeId: updatedRep.id,
      phoneNumber: updatedRep.phoneNumber,
    });

    return {
      token,
      representative: {
        id: updatedRep.id,
        phoneNumber: updatedRep.phoneNumber,
        isVerified: updatedRep.isVerified,
        createdAt: updatedRep.createdAt,
      },
    };
  }
}
