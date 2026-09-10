import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
  appUrl: process.env.APP_URL || 'http://localhost:4000',

  databaseUrl: process.env.DATABASE_URL || '',

  jwt: {
    secret: process.env.JWT_SECRET || 'fallback-dev-secret-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },

  otp: {
    expirationSeconds: parseInt(process.env.OTP_EXPIRATION_SECONDS || '300', 10),
    maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS || '3', 10),
    saltRounds: parseInt(process.env.OTP_HASH_SALT_ROUNDS || '10', 10),
  },

  sms: {
    provider: process.env.SMS_PROVIDER || 'mock',
    twilio: {
      accountSid: process.env.TWILIO_ACCOUNT_SID || '',
      authToken: process.env.TWILIO_AUTH_TOKEN || '',
      fromNumber: process.env.TWILIO_FROM_NUMBER || '',
    },
    localGateway: {
      apiUrl: process.env.LOCAL_SMS_API_URL || '',
      apiKey: process.env.LOCAL_SMS_API_KEY || '',
      senderId: process.env.LOCAL_SMS_SENDER_ID || 'EBRA-KHAYAT',
    },
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '600000', 10), // 10 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
    otpMax: parseInt(process.env.OTP_RATE_LIMIT_MAX || '5', 10),
  },
};
