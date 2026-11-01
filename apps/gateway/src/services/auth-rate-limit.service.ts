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
  let value = String(req?.socket?.remoteAddress || '');
  const hops = Number(process.env.AUTH_TRUSTED_PROXY_HOPS || 0);
  if (!Number.isInteger(hops) || hops < 0 || hops > 4) throw new ServiceUnavailableException('Sign-in proxy configuration is invalid');
  if (hops > 0) {
    // Opt-in only after live spoof probes confirm the Render chain. Never trust
    // caller prefixes, Forwarded, or an arbitrary req.ip set by other middleware.
    if (process.env.RENDER !== 'true' || !process.env.RENDER_SERVICE_ID) throw new ServiceUnavailableException('Trusted proxy mode requires the Render runtime');
    value = trustedForwardedPeer(req, hops);
  }
  return isIP(value) ? canonicalPeer(value) : 'unknown-peer';
}

function canonicalPeer(value:string) {
  if(isIP(value)===4)return value;
  if(value.includes('%'))throw new ServiceUnavailableException('Invalid client address');
  // WHATWG URL parsing normalizes valid IPv6 compression/case without DNS or IO.
  const normalized=new URL('http://['+value+']/').hostname.slice(1,-1);
  const mapped=/^::ffff:([a-f0-9]{1,4}):([a-f0-9]{1,4})$/.exec(normalized);
  if(mapped){const high=parseInt(mapped[1],16),low=parseInt(mapped[2],16);return[high>>>8,high&255,low>>>8,low&255].join('.');}
  return normalized;
}

export function trustedForwardedPeer(req: any, hops: number) {
  const peer = String(req?.socket?.remoteAddress || '');
  if(!isIP(peer))throw new ServiceUnavailableException('Unverified proxy peer');
  const normalized = canonicalPeer(peer);
  if (!/^(?:127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(normalized) && normalized !== '::1') {
    throw new ServiceUnavailableException('Unverified proxy peer');
  }
  const header = req?.headers?.['x-forwarded-for'];
  if (typeof header !== 'string' || header.length > 1024) throw new ServiceUnavailableException('Invalid proxy chain');
  const parts = header.split(',').map(value => value.trim());
  const selected = parts[parts.length - hops];
  // Validate the entire configured trusted suffix, never use caller prefixes,
  // req.ip, Forwarded, CF-Connecting-IP or X-Real-IP as alternative authority.
  if (parts.length < hops || !parts.slice(-hops).every(value=>isIP(value))) throw new ServiceUnavailableException('Incomplete proxy chain');
  return selected;
}

type Budget = { scope: string; subject: string; seconds: number; count: number };

export async function reserveAuthCodeRequest(prisma: any, email: string, req: any, env: NodeJS.ProcessEnv = process.env) {
  const limits = [
    { scope: 'email-cooldown', subject: email, seconds: positive(env, 'AUTH_CODE_COOLDOWN_SECONDS', 60, 3600), count: 1 },
    { scope: 'email-hour', subject: email, seconds: 3600, count: positive(env, 'AUTH_CODE_LIMIT_EMAIL_HOUR', 6, 100) },
    { scope: 'ip-hour', subject: authRequestPeer(req), seconds: 3600, count: positive(env, 'AUTH_CODE_LIMIT_IP_HOUR', 30, 10000) },
    { scope: 'global-hour', subject: 'all', seconds: 3600, count: positive(env, 'AUTH_CODE_LIMIT_GLOBAL_HOUR', 300, 100000) },
    { scope: 'global-day', subject: 'all', seconds: 86400, count: positive(env, 'AUTH_CODE_LIMIT_GLOBAL_DAY', 2000, 1000000) },
  ];
  // Preserve the original purpose/scopes exactly; deployment must not reset budgets.
  await reserveBudgets(prisma, limits, 'auth-request-v1', req, env, 'AUTH_CODE_RATE_LIMITED');
}

export type AuthAttempt = 'login' | 'register' | 'verify' | 'federated' | 'flow';
const policies = {
  login: { seconds: 900, account: 10, ip: 30, hour: 300, day: 2000 },
  register: { seconds: 3600, account: 3, ip: 5, hour: 50, day: 250 },
  verify: { seconds: 600, account: 30, ip: 30, hour: 600, day: 3000 },
  federated: { seconds: 900, account: 0, ip: 30, hour: 300, day: 2000 },
  flow: { seconds: 900, account: 0, ip: 30, hour: 300, day: 2000 },
};

// Reservations count attempts, including successes. Failures and new instances
// cannot reset them; Google/Firebase deliberately share pre-proof budgets.
export async function reserveAuthAttempt(prisma: any, operation: AuthAttempt, email: string | null, req: any, env: NodeJS.ProcessEnv = process.env) {
  const policy = policies[operation];
  if (!policy) throw new ServiceUnavailableException('Sign-in protection is unavailable');
  const prefix = 'AUTH_' + operation.toUpperCase() + '_LIMIT_';
  const limits: Budget[] = [
    { scope: 'ip', subject: authRequestPeer(req), seconds: policy.seconds, count: positive(env, prefix + 'IP', policy.ip, 10000) },
    { scope: 'global-hour', subject: 'all', seconds: 3600, count: positive(env, prefix + 'GLOBAL_HOUR', policy.hour, 100000) },
    { scope: 'global-day', subject: 'all', seconds: 86400, count: positive(env, prefix + 'GLOBAL_DAY', policy.day, 1000000) },
  ];
  if (policy.account) {
    if (!email) throw new ServiceUnavailableException('Sign-in protection is unavailable');
    limits.push({ scope: 'account', subject: email, seconds: policy.seconds, count: positive(env, prefix + 'ACCOUNT', policy.account, 100) });
  }
  await reserveBudgets(prisma, limits, 'auth-attempt-v1:' + operation, req, env, 'AUTH_SIGN_IN_RATE_LIMITED');
}

async function reserveBudgets(prisma: any, budgets: Budget[], purpose: string, req: any, env: NodeJS.ProcessEnv, code: string) {
  const secret = env.AUTH_RATE_LIMIT_SECRET || env.JWT_SECRET || env.AUTH_JWT_SECRET;
  if (!secret) throw new ServiceUnavailableException('Sign-in protection is unavailable');
  const limits = budgets.map(limit => ({ ...limit, key: createHmac('sha256', secret).update(JSON.stringify([purpose, limit.scope, limit.subject])).digest('hex') }))
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
        if (rows.length !== 1) throw new HttpException({ message: 'Too many sign-in attempts. Please try again later.', code, retry_after_seconds: limit.seconds }, 429);
      }
      // Bound retained bucket rows without an external queue or unbounded delete.
      await tx.$executeRaw`DELETE FROM "auth_request_limits" WHERE "key" IN
        (SELECT "key" FROM "auth_request_limits" WHERE "expires_at" <= ${now} ORDER BY "expires_at" LIMIT 100 FOR UPDATE SKIP LOCKED)`;
    }, { isolationLevel: 'ReadCommitted', maxWait: 3000, timeout: 5000 });
  } catch (error: any) {
    if (error instanceof HttpException && error.getStatus() === 429) {
      const response: any = error.getResponse();
      req?.res?.setHeader?.('Retry-After', String(response.retry_after_seconds));
      throw error;
    }
    // Never expose ORM query arguments or send unprotected mail after a DB failure.
    throw new ServiceUnavailableException('Sign-in protection is temporarily unavailable. Please try again later.');
  }
}
