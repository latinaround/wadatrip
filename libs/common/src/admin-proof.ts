import jwt from 'jsonwebtoken';
import { createHash } from 'crypto';

export function adminSessionHash(req: any) {
  return createHash('sha256').update(String(req?.headers?.authorization || '')).digest('hex');
}

// Short-lived step-up proof, bound to the existing authenticated session.
// This never replaces traveler identity or grants an administrative role.
export async function hasAdminProof(req: any, prisma: any, userId: string, secret: string): Promise<boolean> {
  const token = String(req?.headers?.['x-admin-proof'] || '');
  if (!token) return false;
  try {
    const claims = jwt.verify(token, secret, { algorithms: ['HS256'], audience: 'wadatrip-admin', issuer: 'wadatrip' });
    if (typeof claims !== 'object' || claims.sub !== userId || claims.purpose !== 'admin_step_up'
      || typeof claims.exp !== 'number' || claims.session_hash !== adminSessionHash(req)) return false;
    const credential = await prisma.admin_mfa.findUnique({ where: { user_id: userId }, select: { enabled_at: true, version: true } });
    return Boolean(credential?.enabled_at && credential.version === claims.credential_version);
  } catch { return false; }
}
