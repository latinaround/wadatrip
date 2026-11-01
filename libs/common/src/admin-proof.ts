import jwt from 'jsonwebtoken';
import { createHash } from 'crypto';
import { currentSession, resolveSession } from './sessions';
import { ServiceUnavailableException } from '@nestjs/common';

export function adminSessionHash(req: any) {
  const session = currentSession(req);
  return createHash('sha256').update(JSON.stringify([session.id, session.generation, session.user_epoch])).digest('hex');
}

// Short-lived step-up proof, bound to the existing authenticated session.
// This never replaces traveler identity or grants an administrative role.
export async function hasAdminProof(req: any, prisma: any, userId: string, secret: string): Promise<boolean> {
  const token = String(req?.headers?.['x-admin-proof'] || '');
  if (!token) return false;
  let claims: any;
  try { claims = jwt.verify(token, secret, { algorithms: ['HS256'], audience: 'wadatrip-admin', issuer: 'wadatrip' }); }
  catch { return false; }
  const primary = await resolveSession(prisma, req, { touch: false });
  if (primary.user.id !== userId) return false;
    if (typeof claims !== 'object' || claims.sub !== userId || claims.purpose !== 'admin_step_up'
      || typeof claims.exp !== 'number' || claims.session_hash !== adminSessionHash(req)) return false;
  try {
    const credential = await prisma.admin_mfa.findUnique({ where: { user_id: userId }, select: { enabled_at: true, version: true } });
    return Boolean(credential?.enabled_at && credential.version === claims.credential_version);
  } catch { throw new ServiceUnavailableException('Administrative session verification is unavailable'); }
}
