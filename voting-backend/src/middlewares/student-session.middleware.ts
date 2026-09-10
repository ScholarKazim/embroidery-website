import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

export interface StudentRequest extends Request {
  studentIdentifier?: string;
}

const COOKIE_NAME = 'ik_student_session';

export function studentSessionMiddleware(req: StudentRequest, res: Response, next: NextFunction) {
  // 1. Check custom client header first (e.g. from frontend localStorage)
  let identifier = (req.headers['x-student-identifier'] as string) || '';

  // 2. Fallback to HTTP-only cookie if header not passed
  if (!identifier && req.cookies && req.cookies[COOKIE_NAME]) {
    identifier = req.cookies[COOKIE_NAME];
  }

  // 3. If neither exists, generate a persistent secure random identifier
  if (!identifier) {
    identifier = `std_${crypto.randomUUID()}`;
    res.cookie(COOKIE_NAME, identifier, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });
  }

  req.studentIdentifier = identifier;
  res.setHeader('X-Student-Identifier', identifier);

  next();
}
