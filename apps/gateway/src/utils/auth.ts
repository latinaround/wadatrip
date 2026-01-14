import { BadRequestException } from '@nestjs/common';
import jwt from 'jsonwebtoken';

export function getJwtSecret() {
  const secret = process.env.JWT_SECRET || process.env.AUTH_JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV !== 'production') return 'dev-secret';
  throw new BadRequestException('JWT_SECRET is not configured');
}

export function getClaimsFromAuth(req: any): any | null {
  const auth = String(req?.headers?.authorization || '');
  if (!auth.startsWith('Bearer ')) return null;
  const token = auth.slice('Bearer '.length).trim();
  if (!token) return null;
  try {
    return jwt.verify(token, getJwtSecret());
  } catch {
    return null;
  }
}

export function getUserIdFromAuth(req: any): string | null {
  const claims = getClaimsFromAuth(req);
  if (!claims?.sub) return null;
  return String(claims.sub);
}
