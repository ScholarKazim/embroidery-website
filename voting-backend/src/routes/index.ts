import { Router } from 'express';
import { authRouter } from './auth.routes.js';
import { universityRouter } from './university.routes.js';
import { voteRouter } from './vote.routes.js';

export const apiRouter = Router();

// Health check endpoint
apiRouter.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    service: 'college-colors-voting-api',
    timestamp: new Date().toISOString(),
  });
});

// Mount modules
apiRouter.use('/auth', authRouter);
apiRouter.use('/universities', universityRouter);
apiRouter.use('/votes', voteRouter);
