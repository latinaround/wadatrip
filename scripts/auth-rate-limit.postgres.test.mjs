// Fresh, guarded disposable PostgreSQL only. No dotenv, email, processor or production.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {provision,deploy,client,verify,sql} from './postgres-test-target.mjs';
const require=createRequire(import.meta.url);
const {reserveAuthCodeRequest}=require('../apps/gateway/dist/apps/gateway/src/services/auth-rate-limit.service.js');
const name='wadatrip_p05_history_authlimit_'+Date.now().toString(36);
provision(name);const migration=deploy(name);assert.equal(migration.status,0,'Fresh migration chain must apply');
const a=client(name),b=client(name);await verify(a,name);await verify(b,name);
const peer={ip:'192.0.2.20',socket:{remoteAddress:'192.0.2.20'}};
const env=()=>({JWT_SECRET:'synthetic-'+randomUUID()});
const email=()=>randomUUID()+'@example.invalid';
let passed=0;const failures=[];
async function check(title,fn){try{await fn();passed++;console.log('PASS: '+title);}catch(error){failures.push(title);console.error('FAIL: '+title+' ['+(error.code||error.name)+']');}}
const snapshot=()=>a.$queryRaw`SELECT "key", "attempts", "window_started_at"::text AS starts, "expires_at"::text AS expires FROM "auth_request_limits" ORDER BY "key"`;
try{
 await check('full migration installs the bounded bucket contract and expiry index',async()=>{const constraints=await a.$queryRaw`SELECT conname FROM pg_constraint WHERE conrelid='auth_request_limits'::regclass`;assert.equal(constraints.length,4);const indexes=await a.$queryRaw`SELECT indexname FROM pg_indexes WHERE tablename='auth_request_limits'`;assert.equal(indexes.length,2);});
 await check('read-only preflight/postflight scripts execute on the fresh migrated database',async()=>{for(const kind of ['preflight','postflight']){const source=fs.readFileSync('scripts/auth-rate-limit-'+kind+'.sql','utf8');assert.equal(/\b(?:INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE|CREATE|GRANT|REVOKE)\b/i.test(source.replace(/--[^\n]*/g,'')),false);const output=sql(name,source);fs.writeFileSync('logs/security-beta-20261026/'+kind+'-result.log',output);}});
 await check('two independent pools admit exactly one concurrent email request',async()=>{const config=env(),address=email();const result=await Promise.allSettled(Array.from({length:12},(_,i)=>reserveAuthCodeRequest(i%2?a:b,address,peer,config)));assert.equal(result.filter(r=>r.status==='fulfilled').length,1);for(const r of result.filter(r=>r.status==='rejected'))assert.equal(r.reason.getStatus(),429);});
 await check('another instance cannot bypass a committed cooldown',async()=>{const config=env(),address=email();await reserveAuthCodeRequest(a,address,peer,config);await assert.rejects(reserveAuthCodeRequest(b,address,peer,config),e=>e.getStatus?.()===429);});
 await check('rejected requests roll back every budget increment and new bucket',async()=>{const config={...env(),AUTH_CODE_LIMIT_IP_HOUR:'1'};await reserveAuthCodeRequest(a,email(),peer,config);const before=await snapshot();await assert.rejects(reserveAuthCodeRequest(b,email(),peer,config),e=>e.getStatus?.()===429);assert.deepEqual(await snapshot(),before);});
 await check('the peer budget covers different emails and ignores forged forwarding headers',async()=>{const config={...env(),AUTH_CODE_LIMIT_IP_HOUR:'2'};await reserveAuthCodeRequest(a,email(),peer,config);await reserveAuthCodeRequest(b,email(),{...peer,headers:{'x-forwarded-for':'192.0.2.200'}},config);await assert.rejects(reserveAuthCodeRequest(a,email(),{...peer,headers:{'x-forwarded-for':'192.0.2.201'}},config),e=>e.getStatus?.()===429);});
 await check('a global budget prevents email and peer rotation from bypassing the cap',async()=>{const config={...env(),AUTH_CODE_LIMIT_GLOBAL_HOUR:'2'};await reserveAuthCodeRequest(a,email(),peer,config);await reserveAuthCodeRequest(b,email(),{ip:'192.0.2.21'},config);await assert.rejects(reserveAuthCodeRequest(a,email(),{ip:'192.0.2.22'},config),e=>e.getStatus?.()===429);});
 await check('database time resets elapsed buckets without relying on Gateway clocks',async()=>{const config=env(),address=email();await reserveAuthCodeRequest(a,address,peer,config);await a.$executeRaw`UPDATE "auth_request_limits" SET "window_started_at"=CURRENT_TIMESTAMP-INTERVAL '2 hours'`;await reserveAuthCodeRequest(b,address,peer,config);});
 await check('database constraints reject corrupt counters',async()=>{await assert.rejects(a.$executeRaw`INSERT INTO "auth_request_limits" VALUES ('invalid',CURRENT_TIMESTAMP,0,CURRENT_TIMESTAMP+INTERVAL '1 hour')`);});
 await check('expiry cleanup is bounded instead of scanning/deleting the whole table',async()=>{await a.$executeRaw`INSERT INTO "auth_request_limits" SELECT md5('synthetic-stale-'||n)||md5('synthetic-retention-'||n),CURRENT_TIMESTAMP-INTERVAL '5 days',1,CURRENT_TIMESTAMP-INTERVAL '1 day' FROM generate_series(1,150) n`;await reserveAuthCodeRequest(a,email(),peer,env());const[count]=await a.$queryRaw`SELECT count(*)::int AS count FROM "auth_request_limits" WHERE "expires_at"<=CURRENT_TIMESTAMP`;assert.equal(count.count,50);});
 await check('connection failure aborts safely without retaining a partial reservation',async()=>{const before=await snapshot();const broken={$transaction:fn=>a.$transaction(async tx=>{await tx.$queryRaw`SELECT pg_terminate_backend(pg_backend_pid())`;return fn(tx);})};await assert.rejects(reserveAuthCodeRequest(broken,email(),peer,env()),e=>e.getStatus?.()===503);assert.deepEqual(await snapshot(),before);});
 await check('authentication protection creates no booking, payment or inventory records',async()=>{assert.equal(await a.bookings.count(),0);assert.equal(await a.paymentRecord.count(),0);assert.equal(await a.listing_availability.count(),0);const rows=await snapshot();assert.ok(rows.every(r=>/^[a-f0-9]{64}$/.test(r.key)));});
}finally{await Promise.all([a.$disconnect(),b.$disconnect()]);}
const result={database:name,passed,failed:failures.length,failures,real_postgresql:true,production_calls:0,email_calls:0,processor_calls:0};
fs.writeFileSync('logs/security-beta-20261026/postgres-results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));if(failures.length)process.exitCode=1;
