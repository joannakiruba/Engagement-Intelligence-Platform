import crypto from 'crypto';
import { config } from '../config';

export function hashToken(rawToken: string): string {
  return crypto
    .createHmac('sha256', config.tokenHashSecret)
    .update(rawToken)
    .digest('hex');
}

export function generateRawToken(): string {
  return crypto.randomBytes(32).toString('hex');
}
