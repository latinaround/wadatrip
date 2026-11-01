import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { createHmac, randomUUID, timingSafeEqual } from 'crypto';

function otpSecret() {
  const secret = process.env.AUTH_CODE_HASH_SECRET ?? process.env.AUTH_RATE_LIMIT_SECRET;
  if (!secret || secret.length < 32) throw new ServiceUnavailableException('Email sign-in protection is unavailable');
  return secret;
}

function digest(secret: string, id: string, email: string, code: string) {
  return createHmac('sha256', secret).update(JSON.stringify(['auth-otp-v2', id, email, code])).digest('hex');
}

async function emailTransaction<T>(prisma: any, email: string, operation: (tx: any, now: Date) => Promise<T>): Promise<T> {
  try {
    return await prisma.$transaction(async (tx: any) => {
      // Issuance and consumption share the same cross-instance lock. No external IO
      // occurs under this lock; hash collisions only serialize unrelated addresses.
      await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${`wadatrip:otp:${email}`}, 0))`;
      // CURRENT_TIMESTAMP predates a lock wait; read the wall clock after the lock.
      const [clock] = await tx.$queryRaw`SELECT clock_timestamp() AS now`;
      const now = new Date(clock.now);
      if (!Number.isFinite(+now)) throw Error('Missing database clock');
      return operation(tx, now);
    }, { isolationLevel: 'ReadCommitted', maxWait: 3000, timeout: 5000 });
  } catch (error) {
    if (error instanceof UnauthorizedException || error instanceof ServiceUnavailableException) throw error;
    throw new ServiceUnavailableException('Email sign-in is temporarily unavailable. Please try again later.');
  }
}

export async function issueAuthCode(prisma: any, email: string, role: string, code: string, ttlMinutes: number) {
  const secret = otpSecret();
  return emailTransaction(prisma, email, async (tx, now) => {
    const latest = await tx.auth_login_codes.findFirst({ where: { email }, orderBy: [{ created_at: 'desc' }, { id: 'desc' }] });
    // Explicit millisecond ordering avoids equal timestamps or a clock correction
    // making an older challenge authoritative. Every older challenge is retired.
    const createdAt = new Date(Math.max(+now, latest ? +latest.created_at + 1 : 0));
    await tx.auth_login_codes.updateMany({ where: { email, used_at: null }, data: { used_at: now } });
    const user = await tx.users.findUnique({ where: { email } });
    const id = randomUUID();
    return tx.auth_login_codes.create({ data: { id, email, role,
      code_hash: 'hmac-sha256:v2:' + digest(secret, id, email, code),
      created_at: createdAt, expires_at: new Date(+now + ttlMinutes * 60000), user_id: user?.id || null } });
  });
}

export async function retireUndeliveredCode(prisma: any, email: string, id: string) {
  // Keep the latest tombstone: deleting it could reveal an old historical code.
  // Match only this send, so a late email failure cannot retire a newer code.
  return emailTransaction(prisma, email, (tx, now) => tx.auth_login_codes.updateMany({
    where: { id, email, used_at: null }, data: { used_at: now },
  }));
}

export async function consumeAuthCode<T>(prisma: any, email: string, code: string, name: string | null,
  maxAttempts: number, issueCredential: (user: any, tx: any, proofAt: Date) => Promise<T>): Promise<T> {
  const secret = otpSecret();
  const result = await emailTransaction(prisma, email, async (tx, now) => {
    // Deliberately include consumed/expired rows. Never search for an older unused one.
    const challenge = await tx.auth_login_codes.findFirst({ where: { email }, orderBy: [{ created_at: 'desc' }, { id: 'desc' }] });
    if (!challenge || challenge.used_at || +challenge.expires_at <= +now || challenge.attempts >= maxAttempts) return { denied: true } as const;
    if (!/^hmac-sha256:v2:[a-f0-9]{64}$/.test(challenge.code_hash)) return { denied: true } as const;
    const expected = digest(secret, challenge.id, email, code);
    const matches = timingSafeEqual(Buffer.from(challenge.code_hash.slice('hmac-sha256:v2:'.length), 'hex'), Buffer.from(expected, 'hex'));
    const updated = await tx.auth_login_codes.updateMany({
      where: { id: challenge.id, used_at: null, attempts: { lt: maxAttempts }, expires_at: { gt: now } },
      data: { attempts: { increment: 1 }, ...(matches ? { used_at: now } : {}) },
    });
    // Return denial instead of throwing so wrong-guess counters commit.
    if (updated.count !== 1 || !matches) return { denied: true } as const;
    let user = await tx.users.findUnique({ where: { email } });
    if (user && user.status !== 'active') return { denied: true } as const;
    if (user?.reauth_after && +challenge.created_at <= +user.reauth_after) return { denied: true } as const;
    if (!user) user = await tx.users.create({ data: { email, name,
      role: challenge.role === 'guide' ? 'guide' : 'traveler', status: 'active', last_login_at: now } });
    else user = await tx.users.update({ where: { id: user.id }, data: { name: user.name || name || undefined, last_login_at: now } });
    await tx.auth_login_codes.update({ where: { id: challenge.id }, data: { user_id: user.id } });
    // Token signing/user writes/consumption must all succeed before commit/return.
    return { denied: false, credential: await issueCredential(user, tx, challenge.created_at) } as const;
  });
  if (result.denied) throw new UnauthorizedException('code is invalid');
  return result.credential;
}
