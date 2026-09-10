import { Router, Request, Response, NextFunction } from 'express';
import { VoteService } from '../services/vote.service.js';
import { requireRepresentativeAuth } from '../middlewares/auth.middleware.js';
import { studentSessionMiddleware } from '../middlewares/student-session.middleware.js';
import { votingLimiter } from '../middlewares/rate-limiter.middleware.js';
import { CreateVoteSchema, CastVoteChoiceSchema } from '../validators/vote.validator.js';

export const voteRouter = Router();

/**
 * @route POST /api/v1/votes
 * @desc Create a new vote for college colors
 * @access Protected (Representative only)
 */
voteRouter.post(
  '/',
  requireRepresentativeAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedData = CreateVoteSchema.parse(req.body);
      const vote = await VoteService.createVote(req.representative!.id, validatedData);

      const baseUrl = `${req.protocol}://${req.get('host')}`;
      const shareUrl = `${baseUrl}/vote/${vote.shareToken}`;

      res.status(201).json({
        success: true,
        message: 'تم إنشاء التصويت بنجاح',
        data: {
          ...vote,
          shareUrl,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route POST /api/v1/votes/:id/end
 * @desc Manually end an active vote (owner only)
 * @access Protected (Representative owner only)
 */
voteRouter.post(
  '/:id/end',
  requireRepresentativeAuth,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const vote = await VoteService.endVoteManually(id, req.representative!.id);

      res.status(200).json({
        success: true,
        message: 'تم إنهاء التصويت بنجاح',
        data: vote,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route GET /api/v1/votes/:id/results
 * @desc Get vote aggregated results and percentage breakdown
 * @access Public
 */
voteRouter.get(
  '/:id/results',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const results = await VoteService.getVoteResults(id);

      res.status(200).json({
        success: true,
        data: results,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * Handler for retrieving vote by share token
 */
const handleGetVoteByToken = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.params;
    const data = await VoteService.getVoteByShareToken(token, req.studentIdentifier);

    res.status(200).json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Handler for casting or updating student vote
 */
const handleCastVoteChoice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token } = req.params;
    const validatedBody = CastVoteChoiceSchema.parse(req.body);

    const ipAddress =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      undefined;
    const userAgent = req.headers['user-agent'] || undefined;

    const choice = await VoteService.castOrUpdateVote(
      token,
      req.studentIdentifier!,
      validatedBody.colorId,
      ipAddress,
      userAgent
    );

    res.status(200).json({
      success: true,
      message: 'تم تسجيل اختيارك بنجاح',
      data: choice,
    });
  } catch (error) {
    next(error);
  }
};

// Student share-token routes supporting both /votes/token/:token and /votes/:token
voteRouter.get('/token/:token', studentSessionMiddleware, handleGetVoteByToken);
voteRouter.post('/token/:token/choice', studentSessionMiddleware, votingLimiter, handleCastVoteChoice);

voteRouter.get('/:token', studentSessionMiddleware, handleGetVoteByToken);
voteRouter.post('/:token/choice', studentSessionMiddleware, votingLimiter, handleCastVoteChoice);
