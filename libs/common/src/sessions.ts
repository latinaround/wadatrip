import { ConflictException, ForbiddenException, HttpException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'crypto';
import jwt from 'jsonwebtoken';
import { webCookies, requireWebRequest, webReference, verifyCsrf, webPolicy } from './web-security';

export const credentialHash = (value: string) => createHash('sha256').update(value).digest('hex');
export function getJwtSecret() {
  const secret = process.env.JWT_SECRET || process.env.AUTH_JWT_SECRET;
  if (!secret) throw new ServiceUnavailableException('Authentication is unavailable');
  return secret;
}
export function bearerCredential(req: any) {
  const value = req?.headers?.authorization;
  return typeof value === 'string' && /^Bearer [A-Za-z0-9_.-]{1,8192}$/.test(value) ? value.slice(7) : null;
}
export function getClaimsFromAuth(req: any): jwt.JwtPayload | null {
  const token = bearerCredential(req);if (!token) return null;
  const secret = getJwtSecret(); // Configuration failure is 503, not an invalid-token 401.
  try { const claims = jwt.verify(token, secret, { algorithms: ['HS256'] });
    return typeof claims === 'object' && typeof claims.sub === 'string' && claims.sub.length > 0
      && claims.purpose !== 'admin_step_up' && claims.aud !== 'wadatrip-admin' && typeof claims.exp === 'number' ? claims : null;
  } catch { return null; }
}
function integer(name: string, fallback: number, min: number, max: number) {
  const n = Number(process.env[name] ?? fallback);
  if (!Number.isSafeInteger(n) || n < min || n > max) throw new ServiceUnavailableException('Session policy is not configured correctly');
  return n;
}
export async function databaseNow(db: any): Promise<Date> {
  const [row] = await db.$queryRaw`SELECT clock_timestamp() AS now`;
  const now = new Date(row?.now);if (!Number.isFinite(+now)) throw new ServiceUnavailableException('Authentication is unavailable');return now;
}
export async function sessionTransaction<T>(db: any, operation: (tx: any) => Promise<T>): Promise<T> {
  try { return await db.$transaction(operation, { isolationLevel: 'ReadCommitted', maxWait: 3000, timeout: 5000 }); }
  catch (error) { if (error instanceof HttpException) throw error;throw new ServiceUnavailableException('Session service is temporarily unavailable'); }
}
export async function lockAuthAccount(tx: any, email: string) {
  // Same ordering as SEC-1 OTP: email advisory lock, user row, then session row.
  await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${`wadatrip:otp:${email}`}, 0))`;
  await tx.$queryRaw`SELECT id FROM users WHERE email = ${email} FOR NO KEY UPDATE`;
}
export type FlowContext = { token: string; generation: number };
export function flowContext(req: any): FlowContext | null {
  const token = req?.headers?.['x-wada-auth-flow'], generation = req?.headers?.['x-wada-auth-generation'];
  if (token === undefined && generation === undefined) return null;
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token) || typeof generation !== 'string' || !/^\d{1,9}$/.test(generation)) throw new UnauthorizedException('Invalid authentication flow');
  return { token, generation: Number(generation) };
}
export async function startSessionFlow(db: any) {
  return sessionTransaction(db, async tx => {
    const now = await databaseNow(tx), token = randomBytes(32).toString('hex'), expires = new Date(+now + 1800000);
    await tx.auth_sessions.create({ data: { id:randomBytes(32).toString('hex'),kind: 'web', flow_hash: credentialHash(token), created_at: now, last_seen_at: now, expires_at: expires } });
    return { flow_token: token, generation: 0, expires_at: expires.toISOString() };
  });
}
export type AuthMethod = 'password' | 'email_code' | 'google' | 'firebase';
export type SessionIdentity = { id: string; generation: number; user_epoch: number; kind: string; auth_method: string; authenticated_at: Date | null; expires_at: Date; email_verified_at: Date | null };
export type ResolvedSession = { user: any; session: SessionIdentity };
const resolved = new WeakMap<object, ResolvedSession>();
const credentials = new WeakMap<object,{value:string;origin?:string}>();
export function sessionForwarding(req:any):Record<string,string> {
  const known=resolved.get(req),secret=credentials.get(req);
  return known?.session.kind==='web'&&secret?{'x-wada-session-credential':secret.value,'x-session-version':`${known.session.id}:${known.session.generation}`,
    'x-wada-actor-origin':secret.origin||'', 'x-csrf-token':String(req.headers['x-csrf-token']||'')}:{};
}
export async function selectedWebFlow(db:any,req:any) {
  const jar=webCookies(req);if(!jar.flows.length)return{jar,row:null,cookie:null};
  try {
    const rows=await db.auth_sessions.findMany({where:{kind:'web',flow_hash:{in:jar.flows.map(c=>credentialHash(c.value))}},orderBy:[{created_at:'desc'},{id:'desc'}]});
    const row=rows.find((r:any)=>jar.flows.some(c=>c.id===r.id&&credentialHash(c.value)===r.flow_hash))||null;
    return{jar,row,cookie:row?jar.flows.find(c=>c.id===row.id&&credentialHash(c.value)===row.flow_hash)!:null};
  }catch{throw new ServiceUnavailableException('Web session verification is temporarily unavailable');}
}
export function currentSession(req: any) {
  const value = req && resolved.get(req);
  if (!value) throw new UnauthorizedException('A verified server session is required');return value.session;
}
export function sessionProjection(session: SessionIdentity) {
  return { id: session.id, generation: session.generation, expires_at: session.expires_at.toISOString(), kind: session.kind };
}
async function createRegisteredSession(tx: any, userId: string, method: AuthMethod, verified: boolean,
  proofAt: Date | null, flow: FlowContext | null, previousCredential: string | null, kind:'web'|'native') {
  const before = await tx.users.findUnique({ where: { id: userId } });
  if (!before) throw new UnauthorizedException('Account is unavailable');
  await lockAuthAccount(tx, before.email);
  const user = await tx.users.findUnique({ where: { id: userId } }), now = await databaseNow(tx);
  if (!user || user.status !== 'active') throw new UnauthorizedException('Account is inactive');
  if (proofAt && (!Number.isFinite(+proofAt) || +proofAt > +now + 30000)) throw new UnauthorizedException('Invalid authentication time');
  if (user.reauth_after && (!proofAt || +proofAt <= +user.reauth_after)) throw new UnauthorizedException({ code: 'AUTH_FRESH_PRIMARY_REQUIRED', message: 'Request a fresh email code or sign in again with a fresh identity proof' });
  let prior: any = null;
  if (flow) {
    await tx.$queryRaw`SELECT id FROM auth_sessions WHERE flow_hash = ${credentialHash(flow.token)} FOR UPDATE`;
    prior = await tx.auth_sessions.findUnique({ where: { flow_hash: credentialHash(flow.token) } });
    if (!prior || prior.revoked_at || +prior.expires_at <= +now || prior.generation !== flow.generation) throw new ConflictException('Authentication flow changed. Start sign-in again.');
  }
  const id = prior?.id || randomUUID(), generation = (prior?.generation || 0) + 1;
  const seconds = kind === 'web' ? integer('AUTH_SESSION_WEB_TTL_SECONDS', 28800, 60, 28800) : integer('JWT_TTL_SECONDS', 604800, 60, 604800);
  const issued = Math.floor(+now / 1000), expires = new Date((issued + seconds) * 1000);
  const token = kind==='web'?randomBytes(32).toString('hex'):jwt.sign({ sub: user.id, email: user.email, role: user.role, email_verified: verified,
    sid: id, sg: generation, ue: user.auth_epoch, iat: issued, exp: issued + seconds }, getJwtSecret(), { algorithm: 'HS256', jwtid: randomBytes(32).toString('hex') });
  const data = { user_id: user.id, credential_hash: credentialHash(token), generation, user_epoch: user.auth_epoch,
    auth_method: method, email_verified_at: verified ? now : null, authenticated_at: proofAt, last_seen_at: now, expires_at: expires };
  const row = prior ? await tx.auth_sessions.update({ where: { id }, data }) : await tx.auth_sessions.create({ data: { ...data, id, kind, created_at: now } });
  // A fresh browser flow after reload/account switching must also retire the old credential.
  if (previousCredential && credentialHash(previousCredential) !== row.credential_hash) await tx.auth_sessions.updateMany({
    where: { credential_hash: credentialHash(previousCredential), id: { not: id }, revoked_at: null },
    data: { revoked_at: now, revocation_reason: 'logout', generation: { increment: 1 } },
  });
  await tx.users.update({ where: { id: user.id }, data: { last_login_at: now } });
  return kind==='web'?{credential:token,user,session:sessionProjection(row)}:{token,user,session:sessionProjection(row)};
}
export async function createBearerSession(tx:any,userId:string,method:AuthMethod,verified:boolean,proofAt:Date|null,flow:FlowContext|null=null,previousCredential:string|null=null){
  if(flow)throw new ForbiddenException('Browser sessions require cookie transport');
  return createRegisteredSession(tx,userId,method,verified,proofAt,null,previousCredential,'native');
}
export async function createWebSession(tx:any,userId:string,method:AuthMethod,verified:boolean,proofAt:Date|null,flow:FlowContext){return createRegisteredSession(tx,userId,method,verified,proofAt,flow,null,'web');}

export async function resolveSession(db: any, req: any, options: { touch?: boolean } = {}): Promise<ResolvedSession> {
  req?.res?.setHeader?.('Cache-Control', 'no-store');
  const jar=webCookies(req),bearer=bearerCredential(req),delegated=req?.headers?.['x-wada-session-credential'];
  if((bearer&&jar.any)||(bearer&&delegated)||(delegated&&jar.any))throw new ForbiddenException('Mixed authentication transports');
  let claims:any,token:string|null=bearer,kind:'web'|'native'='native',origin:string|undefined;
  if(bearer){
    if(req?.headers?.origin!==undefined)throw new ForbiddenException('Browser Bearer authentication is disabled');
    claims=getClaimsFromAuth(req);
  }else if(delegated){
    const expected=process.env.INTERNAL_SERVICE_TOKEN||'',supplied=String(req?.headers?.['x-internal-service-token']||'');
    if(!expected||Buffer.byteLength(expected)!==Buffer.byteLength(supplied)||!timingSafeEqual(Buffer.from(expected),Buffer.from(supplied))||typeof delegated!=='string'||!/^[a-f0-9]{64}$/.test(delegated)||req?.headers?.['x-wada-actor-origin']!==webPolicy().web)throw new ForbiddenException('Invalid internal session delegation');
    let row:any;try{row=await db.auth_sessions.findUnique({where:{credential_hash:credentialHash(delegated)}});}catch{throw new ServiceUnavailableException('Session verification is temporarily unavailable');}const ref=webReference(req);
    if(!row||row.kind!=='web'||row.id!==ref.id||row.generation!==ref.generation)throw new UnauthorizedException('Delegated session is unavailable');
    if(!['GET','HEAD'].includes(req.method))verifyCsrf(req,row);
    token=delegated;kind='web';origin=webPolicy().web;claims={sid:row.id,sg:row.generation,ue:row.user_epoch,sub:row.user_id};
  }else if(jar.any){
    requireWebRequest(req,['POST','PUT','PATCH','DELETE'].includes(req.method));
    const {row}=await selectedWebFlow(db,req),ref=webReference(req);
    if(!row||!row.user_id)throw new UnauthorizedException('A current web session is required');
    if(ref.id!==row.id||ref.generation!==row.generation)throw new ConflictException('Session changed. Reload your account.');
    const cookie=jar.sessions.find(c=>c.id===row.id&&c.generation===row.generation);
    if(!cookie)throw new UnauthorizedException('A current web credential is required');
    if(!['GET','HEAD'].includes(req.method))verifyCsrf(req,row);
    kind='web';origin=webPolicy().web;token=cookie.value;claims={sid:row.id,sg:row.generation,ue:row.user_epoch,sub:row.user_id};
  }
  if (!token || !claims || typeof claims.sid !== 'string' || !Number.isSafeInteger(claims.sg) || claims.sg < 1 || !Number.isSafeInteger(claims.ue) || claims.ue < 0) throw new UnauthorizedException('A current server session is required');
  const idle = integer('AUTH_SESSION_WEB_IDLE_SECONDS', 1800, 60, 3600);
  const passive = ['GET','HEAD'].includes(req?.method) || ['/auth/me', '/auth/session', '/admin/session'].includes(String(req?.originalUrl || req?.url || '').split('?')[0]);
  const touch = options.touch !== false && !passive;
  try {
    const rows = await db.$queryRaw`UPDATE "auth_sessions" AS s SET "last_seen_at" = CASE WHEN ${touch} THEN GREATEST(s."last_seen_at", clock_timestamp()) ELSE s."last_seen_at" END
      FROM "users" AS u WHERE s."credential_hash" = ${credentialHash(token)} AND s."id" = ${claims.sid}
      AND s."generation" = ${claims.sg} AND s."user_id" = ${claims.sub} AND s."user_epoch" = ${claims.ue}
      AND u."id" = s."user_id" AND u."status" = 'active' AND u."auth_epoch" = s."user_epoch"
      AND s."revoked_at" IS NULL AND s."expires_at" > clock_timestamp()
      AND s."kind" = ${kind}
      AND (s."kind" <> 'web' OR s."last_seen_at" > clock_timestamp() - (${idle} * INTERVAL '1 second'))
      RETURNING s."id", s."generation", s."user_epoch", s."kind", s."auth_method", s."authenticated_at", s."expires_at", s."email_verified_at",
        u."id" AS "uid", u."email", u."name", u."role", u."status", u."auth_epoch"`;
    if (rows.length !== 1) throw new UnauthorizedException('Session is expired, revoked or unavailable');
    const row = rows[0], { uid, email, name, role, status, auth_epoch, ...session } = row;
    // Assurance is authoritative in the registered row; user epoch invalidates
    // credentials on email/password changes, independently of display JWT claims.
    const value = { user: { id: uid, email, name, role, status, auth_epoch }, session };
    if (req && typeof req === 'object') {resolved.set(req, value);credentials.set(req,{value:token,origin});}return value;
  } catch (error) { if (error instanceof HttpException) throw error;throw new ServiceUnavailableException('Session verification is temporarily unavailable'); }
}

export async function revokeSession(db: any, req: any, flow: FlowContext | null = null) {
  // Possession of a registered high-entropy credential can revoke that exact row
  // even after JWT expiry/key rotation. This never authorizes private data.
  const token = bearerCredential(req);
  if (!flow && !token) throw new UnauthorizedException('A registered credential is required');
  return sessionTransaction(db, async tx => {
    const hash = flow ? credentialHash(flow.token) : credentialHash(token!);
    await tx.$queryRaw`SELECT id FROM auth_sessions WHERE credential_hash = ${hash} OR flow_hash = ${hash} FOR UPDATE`;
    const row = await tx.auth_sessions.findUnique({ where: flow ? { flow_hash: hash } : { credential_hash: hash } });
    if (!row) throw new UnauthorizedException('Session is unavailable');
    if (flow && token) await tx.auth_sessions.updateMany({
      where: { id: { not: row.id }, credential_hash: credentialHash(token), revoked_at: null },
      data: { revoked_at: await databaseNow(tx), revocation_reason: 'logout', generation: { increment: 1 } },
    });
    if (row.revoked_at) return { ok: true };
    if (flow && row.generation > flow.generation + 1) throw new ConflictException('A newer session exists; sign out that session explicitly');
    const now = await databaseNow(tx);
    await tx.auth_sessions.update({ where: { id: row.id }, data: { revoked_at: now, revocation_reason: 'logout', generation: { increment: 1 } } });
    return { ok: true };
  });
}
export async function revokeAllSessions(db: any, req: any) {
  const initial = await resolveSession(db, req, { touch: false });
  return sessionTransaction(db, async tx => {
    await lockAuthAccount(tx, initial.user.email);
    const active = await resolveSession(tx, req, { touch: false }), now = await databaseNow(tx);
    if (!active.session.email_verified_at || !active.session.authenticated_at || +now - +active.session.authenticated_at > 600000) throw new ForbiddenException('Fresh verified primary authentication is required');
    await tx.users.update({ where: { id: active.user.id }, data: { auth_epoch: { increment: 1 }, reauth_after: now } });
    await tx.auth_sessions.updateMany({ where: { user_id: active.user.id, revoked_at: null }, data: { revoked_at: now, revocation_reason: 'logout_all', generation: { increment: 1 } } });
    await tx.auth_login_codes.updateMany({ where: { email: active.user.email, used_at: null }, data: { used_at: now } });
    return { ok: true };
  });
}
