import { ForbiddenException, NotFoundException, UnauthorizedException, ServiceUnavailableException } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { timingSafeEqual } from 'crypto';
import { hasAdminProof } from './admin-proof';

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
      && claims.purpose !== 'admin_step_up' && claims.aud !== 'wadatrip-admin'
      && typeof claims.exp === 'number' ? claims : null;
  } catch { return null; }
}

export type Actor = { id: string; email: string; name: string | null; role: string; verified: boolean; admin: boolean };

async function actorIdentity(req: any, prisma: any): Promise<Actor> {
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

// Only authentication/enrollment handlers may use eligibility without step-up.
export async function requireAdminIdentity(req: any, prisma: any): Promise<Actor> {
  const actor = await actorIdentity(req, prisma);
  if (!actor.admin) throw new ForbiddenException('admin access is required');
  return actor;
}

export async function requireActor(req: any, prisma: any): Promise<Actor> {
  const actor = await actorIdentity(req, prisma);
  if (actor.admin) {
    actor.admin = await hasAdminProof(req, prisma, actor.id, getJwtSecret());
  }
  if (actor.admin) req.adminAuditActorId = actor.id;
  return actor;
}

export function requireVerified(actor: Actor) {
  if (!actor.verified) throw new ForbiddenException('Sign in with a verified email code, Google, or Firebase to manage a provider or administer the platform');
}

// Small, revocable cohort by canonical user ID. Email/role/body fields are never invitations.
// No implicit country restriction: each operator still needs human/commercial review.
export function operatorBetaCapabilities(actor: Pick<Actor, 'id' | 'verified' | 'admin'>, env: NodeJS.ProcessEnv = process.env) {
  if (!actor.verified) throw new ForbiddenException('Verify your account before operator onboarding');
  const max = Number(env.OPERATOR_BETA_MAX_OPERATORS || 5);
  const parse = (value: string | undefined) => [...new Set(String(value || '').split(',').map(v => v.trim()).filter(Boolean))];
  const members = parse(env.OPERATOR_BETA_USER_IDS), publishers = parse(env.OPERATOR_BETA_PUBLICATION_USER_IDS);
  if (!Number.isInteger(max) || max < 1 || max > 25 || members.length > max
    || [...members, ...publishers].some(id => !/^[A-Za-z0-9_-]{1,128}$/.test(id))
    || publishers.some(id => !members.includes(id))) throw new ServiceUnavailableException('Operator beta configuration requires review');
  return { invitation_only: true, can_prepare: actor.admin || members.includes(actor.id),
    can_publish: actor.admin || publishers.includes(actor.id), preparation_only: env.OPERATOR_BETA_PREPARATION_ONLY !== 'false',
    image_uploads_enabled: false };
}

export function requireOperatorBetaAccess(actor: Pick<Actor, 'id' | 'verified' | 'admin'>) {
  const capabilities = operatorBetaCapabilities(actor);
  if (!capabilities.can_prepare) throw new ForbiddenException({ code: 'OPERATOR_BETA_INVITATION_REQUIRED', message: 'Operator beta is invitation-only. Contact Wadatrip to request access.' });
  return capabilities;
}

export function requireOperatorPublication(actor: Pick<Actor, 'id' | 'verified' | 'admin'>) {
  if (!requireOperatorBetaAccess(actor).can_publish) throw new ForbiddenException({ code: 'OPERATOR_PUBLICATION_REVIEW_REQUIRED', message: 'Save this tour as a draft. Public listing approval is separate from beta access and payment approval.' });
}

export async function requireAdmin(req: any, prisma: any): Promise<Actor> {
  const actor = await requireAdminIdentity(req, prisma);
  if (!await hasAdminProof(req, prisma, actor.id, getJwtSecret())) {
    throw new ForbiddenException({ message: 'Authenticator verification required', code: 'ADMIN_STEP_UP_REQUIRED' });
  }
  req.adminAuditActorId = actor.id;
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
    ...(req?.headers?.['x-admin-proof'] ? { 'x-admin-proof': String(req.headers['x-admin-proof']) } : {}),
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
  // A read must not turn a legacy email match into a new beta enrollment.
  if (!operatorBetaCapabilities(actor).can_prepare) return null;
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
