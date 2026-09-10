import { Request, Response, NextFunction } from 'express';
import { verifyToken, TokenPayload } from '../lib/jwt.js';
import { prisma } from '../lib/prisma.js';

export interface AuthenticatedRequest extends Request {
  user?: TokenPayload & { isVerified?: boolean };
}

export async function authMiddleware(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'غير مصرح: يرجى تسجيل الدخول أو إرسال رمز المصادقة (Bearer Token)',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = verifyToken(token);

    // Verify representative still exists and is verified
    const representative = await prisma.representative.findUnique({
      where: { id: payload.representativeId },
      select: { id: true, isVerified: true, phoneNumber: true },
    });

    if (!representative) {
      return res.status(401).json({
        success: false,
        error: 'الحساب المرتبط برمز المصادقة غير موجود',
      });
    }

    req.user = {
      representativeId: representative.id,
      phoneNumber: representative.phoneNumber,
      isVerified: representative.isVerified,
    };

    next();
  } catch (err: any) {
    return res.status(401).json({
      success: false,
      error: 'رمز المصادقة غير صالح أو انتهت صلاحيته',
    });
  }
}
