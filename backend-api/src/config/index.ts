import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const config = {
  port: parseInt(process.env.PORT || '3000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production',

  database: {
    url: requireEnv('DATABASE_URL'),
  },

  jwt: {
    secret: requireEnv('JWT_SECRET'),
    accessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    refreshExpiryDays: parseInt(process.env.JWT_REFRESH_EXPIRY_DAYS || '7', 10),
    refreshAbsoluteCeilingDays: parseInt(process.env.JWT_REFRESH_ABSOLUTE_CEILING_DAYS || '30', 10),
    refreshGraceWindowSeconds: parseInt(process.env.JWT_REFRESH_GRACE_WINDOW_SECONDS || '10', 10),
  },

  tokenHashSecret: requireEnv('TOKEN_HASH_SECRET'),

  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',

  seed: {
    testPassword: process.env.SEED_TEST_PASSWORD,
  },
};
