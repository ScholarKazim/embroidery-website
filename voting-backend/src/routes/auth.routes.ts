import { Router, Request, Response, NextFunction } from 'express';
import { OtpService } from '../services/otp.service.js';
import { RequestOtpSchema, VerifyOtpSchema } from '../validators/auth.validator.js';
import { otpRequestLimiter, otpVerifyLimiter } from '../middlewares/rate-limiter.middleware.js';

export const authRouter = Router();

/**
 * @route POST /api/v1/auth/request-otp
 * @desc Generate and send an OTP code to representative's phone number
 * @access Public (Rate limited)
 */
authRouter.post(
  '/request-otp',
  otpRequestLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedData = RequestOtpSchema.parse(req.body);
      const result = await OtpService.requestOtp(validatedData.phone);
      
      res.status(200).json({
        success: true,
        message: result.message,
        expiresInSeconds: result.expiresInSeconds,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * @route POST /api/v1/auth/verify-otp
 * @desc Verify OTP code, mark representative as verified, issue JWT token
 * @access Public (Rate limited)
 */
authRouter.post(
  '/verify-otp',
  otpVerifyLimiter,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validatedData = VerifyOtpSchema.parse(req.body);
      const result = await OtpService.verifyOtp(
        validatedData.phone,
        validatedData.otp,
        validatedData.name
      );

      res.status(200).json({
        success: true,
        message: 'تم التحقق بنجاح',
        token: result.token,
        representative: result.representative,
      });
    } catch (error) {
      next(error);
    }
  }
);
