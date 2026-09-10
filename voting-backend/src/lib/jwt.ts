import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';

export interface TokenPayload {
  representativeId: string;
  phoneNumber: string;
}

export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, config.jwt.secret) as TokenPayload;
}
