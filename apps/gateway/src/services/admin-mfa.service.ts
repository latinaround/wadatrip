import { BadRequestException, ConflictException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHmac, randomBytes, timingSafeEqual } from 'crypto';
import jwt from 'jsonwebtoken';
import { adminSessionHash } from '@wadatrip/common/admin-proof';
import { getJwtSecret } from '@wadatrip/common/security';

const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function base32(bytes: Buffer) {
  let bits = 0, value = 0, result = '';
  for (const byte of bytes) { value = (value << 8) | byte; bits += 8; while (bits >= 5) { result += alphabet[(value >>> (bits - 5)) & 31]; bits -= 5; } }
  if (bits) result += alphabet[(value << (5 - bits)) & 31];
  return result;
}
export function totp(secret: Buffer, counter: bigint, digits = 6) {
  const buffer = Buffer.alloc(8); buffer.writeBigUInt64BE(counter);
  const hash = createHmac('sha1', secret).update(buffer).digest();
  const value = hash.readUInt32BE(hash[hash.length - 1] & 15) & 0x7fffffff;
  return String(value % (10 ** digits)).padStart(digits, '0');
}
function encryptionKey() {
  const encoded = String(process.env.ADMIN_MFA_ENCRYPTION_KEY || '');
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32 || key.toString('base64') !== encoded) throw new ServiceUnavailableException('Admin second factor is not configured');
  return key;
}
export function encryptSecret(secret: Buffer, userId: string) {
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  cipher.setAAD(Buffer.from(`wadatrip:admin-mfa:${userId}`));
  return Buffer.concat([iv, cipher.update(secret), cipher.final(), cipher.getAuthTag()]).toString('base64');
}
export function decryptSecret(encoded: string, userId: string) {
  const bytes = Buffer.from(encoded, 'base64');
  if (bytes.length !== 48) throw new ServiceUnavailableException('Admin second factor requires recovery');
  try {
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), bytes.subarray(0, 12));
    decipher.setAAD(Buffer.from(`wadatrip:admin-mfa:${userId}`)); decipher.setAuthTag(bytes.subarray(-16));
    return Buffer.concat([decipher.update(bytes.subarray(12, -16)), decipher.final()]);
  } catch { throw new ServiceUnavailableException('Admin second factor requires recovery'); }
}

export async function setupAdminMfa(prisma: any, actor: any) {
  encryptionKey();
  return prisma.$transaction(async (tx: any) => {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${actor.id} FOR NO KEY UPDATE`;
    const current = await tx.admin_mfa.findUnique({ where: { user_id: actor.id } });
    if (current?.enabled_at) throw new ConflictException('Second factor is already enabled');
    const now = new Date();
    if (current?.locked_until && current.locked_until > now) throw new ForbiddenException('Too many attempts. Try again in 15 minutes');
    // Resume the same enrollment rather than permitting unlimited counter resets.
    const secret = current && current.setup_expires_at > now ? decryptSecret(current.secret_encrypted, actor.id) : randomBytes(20);
    const expires = current && current.setup_expires_at > now ? current.setup_expires_at : new Date(+now + 15 * 60000);
    await tx.admin_mfa.upsert({ where: { user_id: actor.id }, create: { user_id: actor.id, secret_encrypted: encryptSecret(secret, actor.id), setup_expires_at: expires },
      update: { secret_encrypted: encryptSecret(secret, actor.id), setup_expires_at: expires } });
    await tx.admin_audit_log.create({ data: { actor_id: actor.id, action: 'mfa.enrollment_started', result: 'success' } });
    return { secret: base32(secret), expires_at: expires.toISOString(), issuer: 'Wadatrip', account: actor.email };
  });
}

export async function verifyAdminMfa(prisma: any, actor: any, req: any, code: unknown, now = new Date()) {
  if (typeof code !== 'string' || !/^\d{6}$/.test(code)) throw new BadRequestException('Enter the six-digit authenticator code');
  const outcome = await prisma.$transaction(async (tx: any) => {
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${actor.id} FOR NO KEY UPDATE`;
    const record = await tx.admin_mfa.findUnique({ where: { user_id: actor.id } });
    if (!record) return { error: 'Set up your authenticator first' };
    if (record.locked_until && record.locked_until > now) return { error: 'Too many attempts. Try again in 15 minutes' };
    if (!record.enabled_at && record.setup_expires_at <= now) return { error: 'Setup expired. Start authenticator setup again' };
    const secret = decryptSecret(record.secret_encrypted, actor.id), counter = BigInt(Math.floor(+now / 30000));
    let accepted: bigint | null = null;
    for (const offset of [0n, -1n, 1n]) {
      const candidate = counter + offset;
      if (candidate >= 0n && candidate > BigInt(record.last_counter)
        && timingSafeEqual(Buffer.from(totp(secret, candidate)), Buffer.from(code))) { accepted = candidate; break; }
    }
    if (accepted === null) {
      const failures = record.locked_until && record.locked_until <= now ? 1 : record.failures + 1;
      await tx.admin_mfa.update({ where: { user_id: actor.id }, data: { failures, locked_until: failures >= 5 ? new Date(+now + 15 * 60000) : null } });
      await tx.admin_audit_log.create({ data: { actor_id: actor.id, action: 'mfa.verification', result: 'rejected' } });
      return { error: 'Authenticator code is invalid or has already been used' };
    }
    await tx.admin_mfa.update({ where: { user_id: actor.id }, data: { enabled_at: record.enabled_at || now, last_counter: accepted, failures: 0, locked_until: null } });
    await tx.admin_audit_log.create({ data: { actor_id: actor.id, action: 'mfa.verification', result: 'success' } });
    return { version: record.version };
  });
  // Failed attempts must COMMIT before the response is rejected.
  if (outcome.error) throw new ForbiddenException(outcome.error);
  return { proof: jwt.sign({ purpose: 'admin_step_up', session_hash: adminSessionHash(req), credential_version: outcome.version }, getJwtSecret(),
    { algorithm: 'HS256', subject: actor.id, audience: 'wadatrip-admin', issuer: 'wadatrip', expiresIn: 15 * 60 }), expires_in_seconds: 15 * 60 };
}
