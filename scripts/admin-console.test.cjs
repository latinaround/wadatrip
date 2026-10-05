// Synthetic users/secrets only. All HTTP stays on loopback; no database/email/Stripe.
const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { Module } = require('node:module');
const jwt = require('jsonwebtoken');
process.env.JWT_SECRET = 'synthetic-admin-test-signing-key-not-a-production-secret';
process.env.ADMIN_MFA_ENCRYPTION_KEY = Buffer.alloc(32, 42).toString('base64');
process.env.ENABLE_ADMIN_CONSOLE = 'true'; process.env.ADMIN_REQUIRE_MFA = 'true';
delete process.env.ADMIN_EMAILS; delete process.env.ADMIN_USER_IDS;
let credential = null, audit = [], sourceUser = { id: 'synthetic-admin', email: 'admin@example.invalid', role: 'admin', status: 'active', name: 'Synthetic Admin' };
const select = (row, shape) => Object.fromEntries(Object.entries(shape).map(([key, value]) => [key, value === true ? row[key] : row[key] && select(row[key], value.select)]));
const userRows = [{ ...sourceUser, password_hash: 'never_return_hash', firebase_uid: 'never_return_uid', created_at: new Date(), last_login_at: null,
  _count: { bookings: 0, tour_date_requests: 0 }, provider_profile: null }];
const db = { $queryRaw: async () => [{ id: sourceUser.id }],
  users: { findUnique: async ({ where }) => where.id === sourceUser.id ? sourceUser : null, count: async () => 1, findMany: async ({ select: shape }) => userRows.map(row => select(row, shape)) },
  admin_mfa: { findUnique: async () => credential, upsert: async ({ create, update }) => credential = credential ? { ...credential, ...update } : { ...create, enabled_at: null, last_counter: -1n, failures: 0, locked_until: null, version: 1 },
    update: async ({ data }) => credential = { ...credential, ...data } },
  admin_audit_log: { create: async ({ data }) => { audit.push(data); return data }, count: async () => audit.length, findMany: async () => audit },
  bookings: { count: async () => 1, findMany: async () => [{ id: 'synthetic-booking', status: 'reconciliation_required', amount_cents: null, payment: null }] },
  tour_date_requests: { count: async () => 0, findMany: async () => [] },
};
let tail = Promise.resolve(); db.$transaction = fn => { const result = tail.then(() => fn(db)); tail = result.catch(() => {}); return result };
const originalLoad = Module._load;
Module._load = function(name, ...args) { if (name === '@wadatrip/db') return { getPrisma: () => db }; return originalLoad.call(this, name, ...args) };
const { AdminController, adminPagination, adminIssueSelect } = require('../apps/gateway/dist/apps/gateway/src/controllers/admin.controller.js');
const { totp, encryptSecret, decryptSecret, setupAdminMfa, verifyAdminMfa } = require('../apps/gateway/dist/apps/gateway/src/services/admin-mfa.service.js');
Module._load = originalLoad;
const { requireActor, requireAdminIdentity, serviceHeaders } = require('@wadatrip/common/security');
const { hasAdminProof, adminSessionHash } = require('@wadatrip/common/admin-proof');
let app, origin;
const token = (extra = {}) => jwt.sign({ email: sourceUser.email, email_verified: true, ...extra }, process.env.JWT_SECRET, { subject: sourceUser.id, expiresIn: 3600 });
const request = authorization => ({ headers: { authorization: `Bearer ${authorization}` } });
const actor = () => ({ ...sourceUser, verified: true, admin: true });
const code = offset => totp(decryptSecret(credential.secret_encrypted, sourceUser.id), BigInt(Math.floor(Date.now()/30000)) + BigInt(offset || 0));
async function http(path, bearer, proof, body) {
  const r = await fetch(origin + path, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(bearer ? { Authorization: 'Bearer '+bearer } : {}), ...(proof ? { 'X-Admin-Proof': proof } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  return { status: r.status, body: await r.json(), cache: r.headers.get('cache-control') };
}
before(async () => {
  require('reflect-metadata'); const { NestFactory } = require('@nestjs/core'); const { Module: NestModule } = require('@nestjs/common');
  class SyntheticModule {} NestModule({ controllers: [AdminController] })(SyntheticModule);
  app = await NestFactory.create(SyntheticModule, { logger: false }); await app.listen(0,'127.0.0.1'); origin = await app.getUrl();
});
after(async () => { await app?.close() });
test('RFC 6238 SHA-1 reference vectors match', () => {
  const secret = Buffer.from('12345678901234567890');
  for (const [seconds, expected] of [[59,'94287082'],[1111111109,'07081804'],[1111111111,'14050471'],[1234567890,'89005924'],[2000000000,'69279037'],[20000000000,'65353130']]) assert.equal(totp(secret,BigInt(Math.floor(seconds/30)),8),expected);
});
test('encrypted secrets are randomized, authenticated and bound to the user', () => {
  const secret = Buffer.alloc(20,9), encrypted = encryptSecret(secret,'synthetic-admin');
  assert.notEqual(encrypted,encryptSecret(secret,'synthetic-admin')); assert.deepEqual(decryptSecret(encrypted,'synthetic-admin'),secret);
  assert.throws(() => decryptSecret(encrypted,'another-user')); const broken=Buffer.from(encrypted,'base64');broken[15]^=1;
  assert.throws(() => decryptSecret(broken.toString('base64'),'synthetic-admin'));
});
test('anonymous requests cannot read any admin data or enroll a factor', async () => {
  for (const path of ['/admin/session','/admin/users','/admin/date-requests','/admin/payment-issues','/admin/audit']) assert.equal((await http(path)).status,401);
  assert.equal((await http('/admin/mfa/setup',null,null,{})).status,401);
});
test('client role and frontend email whitelist cannot create admin permissions', async () => {
  const role=sourceUser.role;sourceUser.role='traveler';
  try { assert.equal((await http('/admin/session',token({role:'admin'}))).status,403); assert.equal((await http('/admin/users',token({role:'admin'}))).status,403) }finally{sourceUser.role=role}
});
test('unverified primary identity cannot administer', async () => { assert.equal((await http('/admin/session',token({email_verified:false}))).status,403) });
test('server-admin eligibility never skips required second factor', async () => {
  const bearer=token();assert.equal((await http('/admin/session',bearer)).body.admin,true);
  const denied=await http('/admin/users',bearer);assert.equal(denied.status,403);assert.equal(denied.body.code,'ADMIN_STEP_UP_REQUIRED');
  assert.equal((await requireActor(request(bearer),db)).admin,false);
});
test('setup requires fresh primary authentication', async () => {
  assert.equal((await http('/admin/mfa/setup',token({iat:Math.floor(Date.now()/1000)-700}),null,{})).body.code,'ADMIN_PRIMARY_REAUTH_REQUIRED');
});
test('enrollment stores ciphertext and never grants permission without a valid authenticator', async () => {
  credential=null;audit=[];const r=await http('/admin/mfa/setup',token(),null,{});assert.equal(r.status,201);assert.equal(r.cache,'no-store');
  assert.match(r.body.secret,/^[A-Z2-7]{32}$/);assert.equal(credential.enabled_at,null);assert.notEqual(credential.secret_encrypted,r.body.secret);
  assert.equal((await http('/admin/users',token())).status,403);
});
test('failed code commits rate limiting and does not enable MFA', async () => {
  const bad = code() === '000000' ? '000001' : '000000';
  assert.equal((await http('/admin/mfa/verify',token(),null,{code:bad})).status,403);assert.equal(credential.failures,1);assert.equal(credential.enabled_at,null);
});
test('five failures lock the account and setup cannot reset the lock', async () => {
  const bad=code()==='000000'?'000001':'000000';
  for(let i=0;i<4;i++)await http('/admin/mfa/verify',token(),null,{code:bad});assert.ok(credential.locked_until>Date.now());
  assert.equal((await http('/admin/mfa/verify',token(),null,{code:code()})).status,403);assert.equal((await http('/admin/mfa/setup',token(),null,{})).status,403);
  credential.locked_until=new Date(Date.now()-1);credential.failures=0;
});
test('valid enrollment returns a session-bound proof and safe administrative projection', async () => {
  const bearer=token();const verified=await http('/admin/mfa/verify',bearer,null,{code:code()});assert.equal(verified.status,201);assert.ok(credential.enabled_at);
  const data=await http('/admin/users',bearer,verified.body.proof);assert.equal(data.status,200);assert.equal(data.cache,'no-store');assert.equal(data.body.items[0].email,'admin@example.invalid');
  assert.equal(Object.hasOwn(data.body.items[0],'password_hash'),false);assert.equal(Object.hasOwn(data.body.items[0],'firebase_uid'),false);
  assert.equal((await requireActor({...request(bearer),headers:{...request(bearer).headers,'x-admin-proof':verified.body.proof}},db)).admin,true);
});
test('consumed OTP cannot issue a second proof, including concurrent verification', async () => {
  const bearer=token();const one=code(1);const results=await Promise.all([http('/admin/mfa/verify',bearer,null,{code:one}),http('/admin/mfa/verify',bearer,null,{code:one})]);
  assert.deepEqual(results.map(x=>x.status).sort(),[201,403]);
});
test('proof cannot be reused with another primary session or after credential revocation', async () => {
  credential.last_counter=-1n;const bearer=token({jti:'synthetic-session-a'}),other=token({jti:'synthetic-session-b'});
  const result=await verifyAdminMfa(db,actor(),request(bearer),code());
  assert.equal(await hasAdminProof({...request(other),headers:{...request(other).headers,'x-admin-proof':result.proof}},db,sourceUser.id,process.env.JWT_SECRET),false);
  credential.version++;assert.equal((await http('/admin/users',bearer,result.proof)).status,403);
});
test('expired or forged administrative proof never reads data', async () => {
  const bearer=token();assert.equal((await http('/admin/users',bearer,'synthetic-invalid-proof')).status,403);
  const expired=jwt.sign({purpose:'admin_step_up',session_hash:adminSessionHash(request(bearer)),credential_version:credential.version},process.env.JWT_SECRET,{subject:sourceUser.id,audience:'wadatrip-admin',issuer:'wadatrip',expiresIn:-1});
  assert.equal((await http('/admin/users',bearer,expired)).status,403);
});
test('second-factor proof can never replace the primary authentication token', async () => {
  const bearer=token();
  const proof=jwt.sign({purpose:'admin_step_up',session_hash:adminSessionHash(request(bearer)),credential_version:1},process.env.JWT_SECRET,{subject:sourceUser.id,audience:'wadatrip-admin',issuer:'wadatrip',expiresIn:900});
  await assert.rejects(requireActor(request(proof),db),error=>error.getStatus()===401);
  assert.equal((await http('/admin/session',proof)).status,401);
});
test('existing actor privileges are rechecked against inactive accounts and revoked roles', async () => {
  const bearer=token();sourceUser.status='inactive';assert.equal((await http('/admin/session',bearer)).status,401);sourceUser.status='active';
  sourceUser.role='traveler';await assert.rejects(requireAdminIdentity(request(bearer),db));sourceUser.role='admin';
});
test('bounded pagination rejects invalid and oversized requests', () => {
  for(const query of [{limit:1000},{page:0},{page:-1},{limit:'NaN'},{page:1.5}])assert.throws(()=>adminPagination(query));
  assert.deepEqual(adminPagination({page:'2',limit:'20'}),{page:2,limit:20,skip:20});
});
test('payment issues projection omits processor payloads, secrets and customer identity', () => {
  const projection=JSON.stringify(adminIssueSelect);for(const key of ['payload','request_payload','client_secret','email','phone','password_hash'])assert.equal(projection.includes(key),false);
});
test('audit contains technical actions only, never enrollment keys or entered codes', () => {
  assert.ok(audit.length);for(const row of audit)assert.deepEqual(Object.keys(row).sort(),['action','actor_id','result']);
});
test('internal provider requests forward both existing identity and second-factor proof', () => {
  const previous=process.env.INTERNAL_SERVICE_TOKEN;process.env.INTERNAL_SERVICE_TOKEN='synthetic-internal-token';
  try { const headers=serviceHeaders({headers:{authorization:'Bearer synthetic-primary','x-admin-proof':'synthetic-proof'}});
    assert.equal(headers.Authorization,'Bearer synthetic-primary');assert.equal(headers['x-admin-proof'],'synthetic-proof');assert.equal(headers['x-internal-service-token'],'synthetic-internal-token');
  }finally{if(previous===undefined)delete process.env.INTERNAL_SERVICE_TOKEN;else process.env.INTERNAL_SERVICE_TOKEN=previous}
});
test('two primary sign-ins in the same second issue distinct session identities', async () => {
  const bcrypt=require('bcryptjs');const hash=await bcrypt.hash('synthetic-password-only',4);
  const find=db.users.findUnique,update=db.users.update,load=Module._load,clock=Date.now;
  try {
    db.users.findUnique=async()=>({...sourceUser,password_hash:hash});db.users.update=async()=>sourceUser;
    Module._load=function(name,...args){if(name==='@wadatrip/db')return {getPrisma:()=>db};return load.call(this,name,...args)};
    const {AuthController}=require('../apps/gateway/dist/apps/gateway/src/controllers/auth.controller.js');Module._load=load;
    const timestamp=Date.now();Date.now=()=>timestamp;const controller=new AuthController();
    const a=await controller.login({email:sourceUser.email,password:'synthetic-password-only'}),b=await controller.login({email:sourceUser.email,password:'synthetic-password-only'});
    const one=jwt.decode(a.token),two=jwt.decode(b.token);assert.equal(one.iat,two.iat);assert.ok(one.jti);assert.notEqual(one.jti,two.jti);assert.notEqual(a.token,b.token);
  }finally{db.users.findUnique=find;db.users.update=update;Module._load=load;Date.now=clock}
});
test('expired unfinished setup has a structured recovery error and never issues proof', async()=>{
 const saved=credential;credential=null;
 try{
  await setupAdminMfa(db,actor());credential.setup_expires_at=new Date(Date.now()-1);
  const r=await http('/admin/mfa/verify',token(),null,{code:code()});assert.equal(r.status,403);assert.equal(r.body.code,'ADMIN_MFA_SETUP_EXPIRED');assert.equal(r.body.proof,undefined);assert.equal(credential.enabled_at,null);
 }finally{credential=saved}
});
test('restarting expired unfinished enrollment changes the key without resetting failures', async()=>{
 const saved=credential;credential=null;
 try{
  const previous=await setupAdminMfa(db,actor());credential.setup_expires_at=new Date(Date.now()-1);credential.failures=2;
  const next=await setupAdminMfa(db,actor());assert.notEqual(next.secret,previous.secret);assert.ok(new Date(next.expires_at)>new Date());assert.equal(credential.failures,2);assert.equal(credential.enabled_at,null);
  await assert.rejects(verifyAdminMfa(db,actor(),request(token()),'123456',new Date(+credential.setup_expires_at+1)));
  const accepted=await verifyAdminMfa(db,actor(),request(token()),code());assert.ok(accepted.proof);assert.ok(credential.enabled_at);
 }finally{credential=saved}
});
test('enabled authenticator remains valid after its original setup deadline', async()=>{
 const saved=credential;credential=null;
 try{
  await setupAdminMfa(db,actor());credential.enabled_at=new Date();credential.setup_expires_at=new Date(Date.now()-1);
  const accepted=await verifyAdminMfa(db,actor(),request(token()),code());assert.ok(accepted.proof);
 }finally{credential=saved}
});
