// Dedicated guarded P05 disposable cluster. Synthetic data only; no production.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { client, verify, provision, deploy } from './postgres-test-target.mjs';
const require=createRequire(import.meta.url);
const {setupAdminMfa,verifyAdminMfa,decryptSecret,totp}=require('../apps/gateway/dist/apps/gateway/src/services/admin-mfa.service.js');
const {readAdminUsers}=require('../apps/gateway/dist/apps/gateway/src/services/admin-user-data.service.js');
const {hasAdminProof}=require('@wadatrip/common/admin-proof');
process.env.JWT_SECRET='synthetic-disposable-admin-key-not-production';
process.env.ADMIN_MFA_ENCRYPTION_KEY=Buffer.alloc(32,37).toString('base64');
const name=`wadatrip_p05_repair_admin_${Date.now()}`,legacyName=`wadatrip_p05_history_admin_${Date.now()}`;
const actor={id:'synthetic-admin',email:'admin@example.invalid',verified:true,admin:true};
const req={headers:{authorization:'Bearer synthetic-primary-session'}};
let db,second,historical;
const otp=()=>totp(decryptSecret(globalThis.syntheticCredential.secret_encrypted,actor.id),BigInt(Math.floor(Date.now()/30000)));
before(async()=>{provision(name);const d=deploy(name);assert.equal(d.status,0);db=client(name);second=client(name);await verify(db,name);await verify(second,name);await db.users.create({data:{id:actor.id,email:actor.email,role:'admin',status:'active'}})});
after(async()=>{await Promise.all([db?.$disconnect(),second?.$disconnect(),historical?.$disconnect()])});
test('real migrations create MFA and audit FKs, uniqueness and indexes',async()=>{
 const indexes=await db.$queryRaw`SELECT indexname FROM pg_indexes WHERE tablename IN ('admin_mfa','admin_audit_log')`;
 assert.ok(indexes.length>=4);await assert.rejects(db.admin_mfa.create({data:{user_id:'missing',secret_encrypted:'synthetic',setup_expires_at:new Date()}}));
 await assert.rejects(db.admin_audit_log.create({data:{actor_id:'missing',action:'synthetic',result:'success'}}));
});
test('two real connections enroll a single account without changing other user fields',async()=>{
 const before=await db.users.findUnique({where:{id:actor.id}});const [a,b]=await Promise.all([setupAdminMfa(db,actor),setupAdminMfa(second,actor)]);
 assert.equal(a.secret,b.secret);assert.equal(await db.admin_mfa.count(),1);assert.deepEqual(await db.users.findUnique({where:{id:actor.id}}),before);
 globalThis.syntheticCredential=await db.admin_mfa.findUnique({where:{user_id:actor.id}});
});
test('two real connections cannot use the same authenticator code twice',async()=>{
 const code=otp();const results=await Promise.allSettled([verifyAdminMfa(db,actor,req,code),verifyAdminMfa(second,actor,req,code)]);
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);
 const accepted=results.find(r=>r.status==='fulfilled').value;assert.equal(await hasAdminProof({headers:{...req.headers,'x-admin-proof':accepted.proof}},db,actor.id,process.env.JWT_SECRET),true);
 assert.equal(await hasAdminProof({headers:{authorization:'Bearer another-primary','x-admin-proof':accepted.proof}},db,actor.id,process.env.JWT_SECRET),false);
});
test('database rollback leaves no attempted audit record',async()=>{
 const before=await db.admin_audit_log.count();await assert.rejects(db.$transaction(async tx=>{await tx.admin_audit_log.create({data:{actor_id:actor.id,action:'synthetic.rollback',result:'success'}});throw Error('synthetic rollback')}));assert.equal(await db.admin_audit_log.count(),before);
});
test('rate-limit failures persist despite HTTP-style rejection',async()=>{
 const code=otp()==='000000'?'000001':'000000';for(let i=0;i<5;i++)await assert.rejects(verifyAdminMfa(db,actor,req,code));
 const record=await db.admin_mfa.findUnique({where:{user_id:actor.id}});assert.ok(record.locked_until>Date.now());await assert.rejects(setupAdminMfa(second,actor));
});
test('expired unfinished enrollment restarts safely against real PostgreSQL',async()=>{
 const pending={id:'synthetic-expired-admin',email:'expired@example.invalid',verified:true,admin:true};
 await db.users.create({data:{id:pending.id,email:pending.email,role:'admin',status:'active'}});
 const previous=await setupAdminMfa(db,pending);
 await db.admin_mfa.update({where:{user_id:pending.id},data:{setup_expires_at:new Date(Date.now()-1000),failures:2}});
 await assert.rejects(verifyAdminMfa(db,pending,req,'123456'),error=>error.getResponse().code==='ADMIN_MFA_SETUP_EXPIRED');
 const next=await setupAdminMfa(second,pending),record=await db.admin_mfa.findUnique({where:{user_id:pending.id}});
 assert.notEqual(next.secret,previous.secret);assert.equal(record.failures,2);assert.equal(record.enabled_at,null);
 const code=totp(decryptSecret(record.secret_encrypted,pending.id),BigInt(Math.floor(Date.now()/30000)));
 const result=await verifyAdminMfa(db,pending,req,code);assert.ok(result.proof);
 assert.ok((await db.admin_mfa.findUnique({where:{user_id:pending.id}})).enabled_at);
});
test('additive migration upgrades populated historical schema without altering accounts',async()=>{
 provision(legacyName);const baseline=deploy(legacyName,'recovered');assert.equal(baseline.status,0);historical=client(legacyName);await verify(historical,legacyName);
 await historical.$executeRaw`INSERT INTO users(id,email,role,status,created_at) VALUES('synthetic-legacy-user','legacy@example.invalid','traveler','active',CURRENT_TIMESTAMP)`;
 const [before]=await historical.$queryRaw`SELECT to_jsonb(u) AS row FROM users u WHERE id='synthetic-legacy-user'`;
 const upgrade=deploy(legacyName);assert.equal(upgrade.status,0);const [after]=await historical.$queryRaw`SELECT to_jsonb(u) AS row FROM users u WHERE id='synthetic-legacy-user'`;
 assert.deepEqual(after,before);assert.equal(await historical.admin_mfa.count(),0);assert.equal(await historical.admin_audit_log.count(),0);
});
test('real PostgreSQL applies classification before pagination and preserves user history',async()=>{
 const synthetic=[
  {id:'synthetic-classification-test',email:'test.classification@example.invalid',role:'guide'},
  {id:'synthetic-classification-user',email:'real.classification@example.invalid',role:'guide'},
  {id:'synthetic-classification-unknown',email:'guide-smoke-classification@example.invalid',role:'traveler'},
 ];
 await db.users.createMany({data:synthetic});const ids=synthetic.map(x=>x.id);
 const before=await db.users.findMany({where:{id:{in:ids}},orderBy:{id:'asc'}});
 const call=(query,page=1)=>readAdminUsers(db,actor,{q:'classification@example.invalid',...query},{page,limit:1,skip:page-1},{id:true,email:true},[synthetic[0].id]);
 const first=await call({}),secondPage=await call({},2);assert.equal(first.total,2);assert.equal(first.excluded_test_accounts,1);
 assert.equal(new Set([...first.items,...secondPage.items].map(x=>x.id)).size,2);assert.ok([...first.items,...secondPage.items].every(x=>x.id!==synthetic[0].id));
 const tests=await call({data_scope:'test'});assert.equal(tests.total,1);assert.equal(tests.items[0].data_category,'test');
 const all=await call({data_scope:'all'});assert.equal(all.total,3);
 const guides=await call({role:'guide'});assert.equal(guides.total,1);assert.equal(guides.items[0].id,synthetic[1].id);
 assert.deepEqual(await db.users.findMany({where:{id:{in:ids}},orderBy:{id:'asc'}}),before);
});
