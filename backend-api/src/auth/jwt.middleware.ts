import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface JwtPayload {
  sub: string;
  roleId: string;
  exp: number;
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function authenticateJwt(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: 'Authentication required.' });
    return;
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, config.jwt.secret) as JwtPayload;
    req.user = payload;
    next();
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      res.status(401).json({ success: false, error: 'Access token expired.' });
      return;
    }
    res.status(401).json({ success: false, error: 'Invalid access token.' });
  }
}

export function signAccessToken(userId: string, roleId: string): string {
  const payload = { sub: userId, roleId };
  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.accessExpiry as string | number,
  } as jwt.SignOptions);
}
