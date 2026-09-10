import rateLimit from 'express-rate-limit';
import { config } from '../config/index.js';

// General API rate limiter
export const generalLimiter = rateLimit({
  windowMs: config.rateLimit.windowMs,
  max: config.rateLimit.maxRequests,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'تم تجاوز الحد المسموح به من الطلبات، يرجى المحاولة لاحقاً بعد عدة دقائق.',
  },
});

// Strict rate limiter for requesting OTP
export const requestOtpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 3, // max 3 OTP requests per 10 mins per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'تجاوزت الحد المسموح به لإرسال رموز التحقق (3 طلبات كل 10 دقائق). يرجى الانتظار والمحاولة لاحقاً.',
  },
});

// Strict rate limiter for verifying OTP
export const verifyOtpLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: config.rateLimit.otpMax, // max 5 verification attempts per 10 mins
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'تجاوزت الحد المسموح به لمحاولات التحقق. يرجى الانتظار قبل المحاولة مرة أخرى.',
  },
});

// Rate limiter for student voting endpoint to prevent denial-of-service
export const votingLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: 'يرجى التمهل، يمكنك تعديل اختيارك بعد قليل.',
  },
});
