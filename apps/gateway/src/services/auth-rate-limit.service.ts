import { HttpException, ServiceUnavailableException } from '@nestjs/common';
import { createHmac } from 'crypto';
import { isIP } from 'net';

function positive(env: NodeJS.ProcessEnv, key: string, fallback: number, max: number) {
  const value = env[key] === undefined ? fallback : Number(env[key]);
  if (!Number.isSafeInteger(value) || value < 1 || value > max) throw new ServiceUnavailableException('Sign-in protection is not configured correctly');
  return value;
}

export function authRequestPeer(req: any) {
  // Express req.ip only honors forwarding after an explicit trusted-proxy setup.
  // Never read caller-supplied Forwarded/X-Forwarded-For headers here.
  let value = String(req?.socket?.remoteAddress || req?.ip || '');
  const hops = Number(process.env.AUTH_TRUSTED_PROXY_HOPS || 0);
  if (!Number.isInteger(hops) || hops < 0 || hops > 4) throw new ServiceUnavailableException('Sign-in proxy configuration is invalid');
  if (hops > 0) {
    // Opt-in only after live spoof probes confirm the Render chain. Never trust
    // caller prefixes, Forwarded, or an arbitrary req.ip set by other middleware.
    if (process.env.RENDER !== 'true' || !process.env.RENDER_SERVICE_ID) throw new ServiceUnavailableException('Trusted proxy mode requires the Render runtime');
    value = trustedForwardedPeer(req, hops);
  }
  if (value.startsWith('::ffff:') && isIP(value.slice(7)) === 4) value = value.slice(7);
  return isIP(value) ? value : 'unknown-peer';
}

export function trustedForwardedPeer(req: any, hops: number) {
  const peer = String(req?.socket?.remoteAddress || '');
  const normalized = peer.startsWith('::ffff:') ? peer.slice(7) : peer;
  if (!/^(?:127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(normalized) && normalized !== '::1') {
    throw new ServiceUnavailableException('Unverified proxy peer');
  }
  const header = req?.headers?.['x-forwarded-for'];
  if (typeof header !== 'string' || header.length > 1024) throw new ServiceUnavailableException('Invalid proxy chain');
  const parts = header.split(',').map(value => value.trim());
  const selected = parts[parts.length - hops];
  if (parts.length < hops || !isIP(selected)) throw new ServiceUnavailableException('Incomplete proxy chain');
  return selected;
}

let probeCount = 0;
export function logAuthProxyProbe(req: any) {
  if (process.env.AUTH_PROXY_DIAGNOSTICS !== 'true' || probeCount >= 6) return;
  const label = String(req?.headers?.['x-wadatrip-proxy-probe'] || '');
  if (!['baseline', 'prefix-a', 'prefix-b'].includes(label)) return;
  probeCount++;
  const secret = process.env.AUTH_RATE_LIMIT_SECRET;
  if (!secret) return;
  const values: Record<string, string> = {};
  for (let hops = 1; hops <= 4; hops++) {
    try { values[String(hops)] = createHmac('sha256', secret).update(trustedForwardedPeer(req, hops)).digest('hex'); }
    catch { values[String(hops)] = 'unavailable'; }
  }
  console.log(JSON.stringify({operation:'beta_proxy_probe',label,chain_depth:String(req?.headers?.['x-forwarded-for']||'').split(',').filter(Boolean).length,candidates:values}));
}

export async function reserveAuthCodeRequest(prisma: any, email: string, req: any, env: NodeJS.ProcessEnv = process.env) {
  const secret = env.AUTH_RATE_LIMIT_SECRET || env.JWT_SECRET || env.AUTH_JWT_SECRET;
  if (!secret) throw new ServiceUnavailableException('Sign-in protection is unavailable');
  const limits = [
    { scope: 'email-cooldown', subject: email, seconds: positive(env, 'AUTH_CODE_COOLDOWN_SECONDS', 60, 3600), count: 1 },
    { scope: 'email-hour', subject: email, seconds: 3600, count: positive(env, 'AUTH_CODE_LIMIT_EMAIL_HOUR', 6, 100) },
    { scope: 'ip-hour', subject: authRequestPeer(req), seconds: 3600, count: positive(env, 'AUTH_CODE_LIMIT_IP_HOUR', 30, 10000) },
    { scope: 'global-hour', subject: 'all', seconds: 3600, count: positive(env, 'AUTH_CODE_LIMIT_GLOBAL_HOUR', 300, 100000) },
    { scope: 'global-day', subject: 'all', seconds: 86400, count: positive(env, 'AUTH_CODE_LIMIT_GLOBAL_DAY', 2000, 1000000) },
  ].map(limit => ({ ...limit, key: createHmac('sha256', secret).update(JSON.stringify(['auth-request-v1', limit.scope, limit.subject])).digest('hex') }))
    .sort((a, b) => a.key.localeCompare(b.key));
  try {
    await prisma.$transaction(async (tx: any) => {
      const [clock] = await tx.$queryRaw`SELECT CURRENT_TIMESTAMP AS now`;
      const now = new Date(clock.now);
      if (!Number.isFinite(+now)) throw Error('Missing database clock');
      for (const limit of limits) {
        const cutoff = new Date(+now - limit.seconds * 1000), expires = new Date(+now + limit.seconds * 2000);
        const rows = await tx.$queryRaw`INSERT INTO "auth_request_limits" ("key", "window_started_at", "attempts", "expires_at")
          VALUES (${limit.key}, ${now}, 1, ${expires})
          ON CONFLICT ("key") DO UPDATE SET
            "window_started_at" = CASE WHEN "auth_request_limits"."window_started_at" <= ${cutoff} THEN ${now} ELSE "auth_request_limits"."window_started_at" END,
            "attempts" = CASE WHEN "auth_request_limits"."window_started_at" <= ${cutoff} THEN 1 ELSE "auth_request_limits"."attempts" + 1 END,
            "expires_at" = CASE WHEN "auth_request_limits"."window_started_at" <= ${cutoff} THEN ${expires} ELSE "auth_request_limits"."expires_at" END
          WHERE "auth_request_limits"."window_started_at" <= ${cutoff} OR "auth_request_limits"."attempts" < ${limit.count}
          RETURNING "key"`;
        if (rows.length !== 1) throw new HttpException({ message: 'Too many sign-in code requests. Please try again later.', code: 'AUTH_CODE_RATE_LIMITED', retry_after_seconds: limit.seconds }, 429);
      }
      // Bound retained bucket rows without an external queue or unbounded delete.
      await tx.$executeRaw`DELETE FROM "auth_request_limits" WHERE "key" IN
        (SELECT "key" FROM "auth_request_limits" WHERE "expires_at" <= ${now} ORDER BY "expires_at" LIMIT 100 FOR UPDATE SKIP LOCKED)`;
    }, { isolationLevel: 'ReadCommitted', maxWait: 3000, timeout: 5000 });
  } catch (error: any) {
    if (error instanceof HttpException && error.getStatus() === 429) throw error;
    // Never expose ORM query arguments or send unprotected mail after a DB failure.
    throw new ServiceUnavailableException('Sign-in protection is temporarily unavailable. Please try again later.');
  }
}
