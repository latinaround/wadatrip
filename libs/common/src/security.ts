import { ForbiddenException, NotFoundException, UnauthorizedException } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { timingSafeEqual } from 'crypto';

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET || process.env.AUTH_JWT_SECRET;
  if (!secret) throw new UnauthorizedException('JWT authentication is not configured');
  return secret;
}

export function getClaimsFromAuth(req: any): jwt.JwtPayload | null {
  const authorization = String(req?.headers?.authorization || '');
  if (!authorization.startsWith('Bearer ')) return null;
  try {
    const claims = jwt.verify(authorization.slice(7).trim(), getJwtSecret(), { algorithms: ['HS256'] });
    return typeof claims === 'object' && typeof claims.sub === 'string' && claims.sub.length > 0
      && typeof claims.exp === 'number' ? claims : null;
  } catch { return null; }
}

export type Actor = { id: string; email: string; name: string | null; role: string; verified: boolean; admin: boolean };

export async function requireActor(req: any, prisma: any): Promise<Actor> {
  const claims = getClaimsFromAuth(req);
  if (!claims?.sub) throw new UnauthorizedException('not authenticated');
  const user = await prisma.users.findUnique({ where: { id: claims.sub } });
  if (!user || user.status !== 'active') throw new UnauthorizedException('account is inactive or missing');
  const email = String(user.email).trim().toLowerCase();
  const verified = claims.email_verified === true && claims.email === email;
  const ids = String(process.env.ADMIN_USER_IDS || '').split(',').map(v => v.trim()).filter(Boolean);
  const emails = String(process.env.ADMIN_EMAILS || '').split(',').map(v => v.trim().toLowerCase()).filter(Boolean);
  return { id: user.id, email, name: user.name, role: user.role, verified,
    admin: verified && (user.role === 'admin' || ids.includes(user.id) || emails.includes(email)) };
}

export function requireVerified(actor: Actor) {
  if (!actor.verified) throw new ForbiddenException('Sign in with a verified email code, Google, or Firebase to manage a provider or administer the platform');
}

export async function requireAdmin(req: any, prisma: any): Promise<Actor> {
  const actor = await requireActor(req, prisma);
  if (!actor.admin) throw new ForbiddenException('admin access is required');
  return actor;
}

export function requireInternalToken(req: any) {
  const expected = process.env.INTERNAL_SERVICE_TOKEN || '';
  const supplied = String(req?.headers?.['x-internal-service-token'] || '');
  if (!expected || !supplied || Buffer.byteLength(expected) !== Buffer.byteLength(supplied)
    || !timingSafeEqual(Buffer.from(expected), Buffer.from(supplied))) {
    throw new ForbiddenException('internal service authentication required');
  }
}

export function serviceHeaders(req?: any): Record<string, string> {
  const token = process.env.INTERNAL_SERVICE_TOKEN;
  if (!token) throw new ForbiddenException('internal service authentication is not configured');
  return { 'x-internal-service-token': token,
    ...(req?.headers?.authorization ? { Authorization: String(req.headers.authorization) } : {}) };
}

export async function requireProviderAccess(req: any, prisma: any, providerId: string) {
  const actor = await requireActor(req, prisma);
  requireVerified(actor);
  const provider = await prisma.providers.findUnique({ where: { id: String(providerId) } });
  if (!provider || (!actor.admin && provider.user_id !== actor.id)) throw new NotFoundException('provider not found');
  return { actor, provider };
}

// Claim only an unowned legacy record after proof of email ownership. Never transfer an existing tenant.
export async function findOwnedProvider(prisma: any, actor: Actor) {
  requireVerified(actor);
  const owned = await prisma.providers.findFirst({ where: { user_id: actor.id } });
  if (owned) return owned;
  const legacy = await prisma.providers.findFirst({ where: { email: actor.email, user_id: null } });
  if (!legacy) return null;
  const result = await prisma.providers.updateMany({
    where: { id: legacy.id, user_id: null, email: actor.email }, data: { user_id: actor.id },
  });
  if (result.count !== 1) throw new ForbiddenException('provider ownership changed; retry sign-in');
  return { ...legacy, user_id: actor.id };
}

export function bookingScope(actor: Actor, query: any = {}) {
  if (actor.admin && query.scope !== 'mine' && String(query.mine || '') !== '1') return {};
  if (query.provider_id) {
    requireVerified(actor);
    return { provider: { user_id: actor.id } };
  }
  return { user_id: actor.id };
}

export async function requireBookingAccess(req: any, prisma: any, id: string, mode: 'read' | 'manage' | 'pay' = 'read') {
  const actor = await requireActor(req, prisma);
  const booking = await prisma.bookings.findUnique({ where: { id }, include: { provider: true, listing: true } });
  const owner = booking?.user_id === actor.id;
  const providerOwner = actor.verified && booking?.provider?.user_id === actor.id;
  const allowed = actor.admin || (mode === 'pay' ? owner : mode === 'manage' ? providerOwner : owner || providerOwner);
  if (!booking || !allowed) throw new NotFoundException('booking not found');
  return { actor, booking };
}

export async function requireAlertAccess(req: any, prisma: any, id: string) {
  const actor = await requireActor(req, prisma);
  const alert = await prisma.alert_subscriptions.findUnique({ where: { id } });
  if (!alert || (!actor.admin && alert.user_id !== actor.id)) throw new NotFoundException('alert not found');
  return { actor, alert };
}
