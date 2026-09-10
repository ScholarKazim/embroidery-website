import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import morgan from 'morgan';
import { env } from './config/index.js';
import { apiRouter } from './routes/index.js';
import { errorHandler } from './middlewares/error-handler.middleware.js';
import { generalLimiter } from './middlewares/rate-limiter.middleware.js';

export const app = express();

// Trust proxy headers (for accurate client IP detection behind proxies/load balancers)
app.set('trust proxy', 1);

// Security HTTP headers
app.use(helmet());

// Cross-Origin Resource Sharing
app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g., mobile apps, curl) or allowed origins
      if (!origin || env.CORS_ORIGIN === '*' || origin === env.CORS_ORIGIN) {
        callback(null, true);
      } else {
        callback(null, true); // Permissive default for dev/demo, configure via CORS_ORIGIN in prod
      }
    },
    credentials: true,
  })
);

// Cookie Parser
app.use(cookieParser());

// Request logging
if (env.NODE_ENV !== 'test') {
  app.use(morgan(env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// Body parsers
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Apply general rate limiter
app.use(generalLimiter);

// Mount API routes (versioned and root fallback)
app.use('/api/v1', apiRouter);
app.use('/api', apiRouter);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'NOT_FOUND',
    message: `المسار المطلوب غير موجود: ${req.method} ${req.originalUrl}`,
  });
});

// Centralized error handling
app.use(errorHandler);
