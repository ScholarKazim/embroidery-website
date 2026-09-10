import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { config } from '../config/index.js';

/**
 * Generate a cryptographically secure 6-digit numeric OTP
 */
export function generateNumericOtp(): string {
  const buffer = crypto.randomBytes(4);
  const code = (buffer.readUInt32BE(0) % 900000) + 100000;
  return code.toString();
}

/**
 * Hash an OTP using bcrypt before persisting to DB
 */
export async function hashOtp(code: string): Promise<string> {
  return bcrypt.hash(code, config.otp.saltRounds);
}

/**
 * Compare plain OTP against stored hash
 */
export async function verifyOtpHash(code: string, hash: string): Promise<boolean> {
  return bcrypt.compare(code, hash);
}
