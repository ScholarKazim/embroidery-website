import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  // 1. Zod Validation Error
  if (err instanceof ZodError) {
    const issues = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return res.status(400).json({
      success: false,
      error: 'بيانات الإدخال غير صالحة',
      details: issues,
    });
  }

  // 2. Known standard business logic errors
  if (err?.message) {
    // Determine appropriate status code
    let status = 400;
    if (err.message.includes('غير مصرح')) status = 401;
    if (err.message.includes('غير موجود')) status = 404;
    if (err.message.includes('صلاحية خاصة بممثل')) status = 403;

    return res.status(status).json({
      success: false,
      error: err.message,
    });
  }

  console.error('[Unhandled Server Error]', err);

  return res.status(500).json({
    success: false,
    error: 'حدث خطأ داخلي في الخادم، يرجى المحاولة مرة أخرى لاحقاً.',
  });
}
