// Historical 29 -> 30 migration with synthetic business records and MFA ciphertext.
import assert from 'node:assert/strict';import fs from 'node:fs';import {provision,deploy,client,verify,sql} from './postgres-test-target.mjs';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),{verifyBetaRuntime}=require('../apps/gateway/dist/apps/gateway/src/services/beta-runtime.service.js');
const closed={OPERATOR_BETA_PREPARATION_ONLY:'true',PAYMENTS_ACCEPT_NEW:'false',PAYMENTS_LIVE_ENABLED:'false',AUTH_RATE_LIMIT_SECRET:'synthetic-migration-rate-secret-32-chars',INTERNAL_SERVICE_TOKEN:'synthetic-migration-internal-secret-32-chars',...Object.fromEntries(['ENABLE_OPERATOR_DOCUMENT_UPLOADS','ENABLE_OPERATOR_LEADS','ENABLE_OPERATOR_LEAD_SEARCH','ENABLE_OPERATOR_LEADS_PROXY','ENABLE_WADAGENT_PROXY','ENABLE_COMMUNITY','FF_PROVIDER_HUB'].map(k=>[k,'false']))};
const name='wadatrip_p05_history_sec2upgrade_'+Date.now().toString(36);provision(name);assert.equal(deploy(name,'sec1').status,0);
const db=client(name);await verify(db,name);let passed=0;
try{
 await db.$executeRaw`INSERT INTO users (id,email,password_hash,firebase_uid,name,status,role,created_at) VALUES ('historical-sec2','historical-sec2@example.invalid','synthetic-old-hash','synthetic-old-uid','Synthetic historical operator','active','guide',CURRENT_TIMESTAMP)`;
 const p=await db.providers.create({data:{id:'historical-provider',user_id:'historical-sec2',type:'guide',name:'Synthetic historical provider',email:'historical-provider@example.invalid',languages:['en','es'],base_city:'Cusco',country_code:'PE',status:'verified'}});
 const l=await db.listings.create({data:{id:'historical-listing',provider_id:p.id,operator_id:'historical-sec2',title:'Synthetic historical tour',category:'tour',city:'Cusco',country_code:'PE',tags:[],price_from:25,currency:'USD',status:'draft'}});
 const booking=await db.bookings.create({data:{id:'historical-booking',listing_id:l.id,provider_id:p.id,user_id:'historical-sec2',date:new Date('2026-12-01T12:00:00Z'),num_people:1,total_price:25,amount_cents:2500,operator_share_cents:2125,commission_cents:375,status:'confirmed',payment_status:'paid'}});
 await db.paymentRecord.create({data:{booking_id:booking.id,provider_id:p.id,amount_gross_cents:2500,commission_cents:375,amount_net_cents:2125,status:'paid',processor_mode:'test'}});
 await db.admin_mfa.create({data:{user_id:'historical-sec2',secret_encrypted:'synthetic-preserved-historical-ciphertext',enabled_at:new Date('2026-10-20'),setup_expires_at:new Date('2026-10-21'),last_counter:123n,version:3}});
 await db.community_threads.create({data:{user_id:'historical-sec2',country_code:'PE',city:'Cusco',destination_key:'c'.repeat(64),kind:'question',title:'Synthetic historical thread',message:'Synthetic retained Community content',client_request_id:'00000000-0000-4000-8000-000000000001',public_notice_version:'public_community_v1'}});
 const snapshot=async()=>{
  const users=await db.$queryRaw`SELECT id,email,password_hash,firebase_uid,name,status,role,created_at FROM users ORDER BY id`;
  return JSON.stringify({users,provider:await db.providers.findMany(),listings:await db.listings.findMany(),bookings:await db.bookings.findMany(),payments:await db.paymentRecord.findMany(),mfa:await db.admin_mfa.findMany(),community:await db.community_threads.findMany()},(_k,v)=>typeof v==='bigint'?String(v):v);
 };
 const before=await snapshot(),history=await db.$queryRaw`SELECT migration_name,checksum FROM _prisma_migrations ORDER BY migration_name`;assert.equal(history.length,29);passed++;
 await assert.rejects(verifyBetaRuntime(closed,db));passed++;
 await db.$transaction(async tx=>{await tx.$executeRaw`LOCK TABLE users IN ACCESS SHARE MODE`;assert.throws(()=>sql(name,fs.readFileSync('libs/db/prisma/migrations/20261030000000_auth_sessions/migration.sql','utf8')));},{timeout:10000});
 const [partial]=await db.$queryRaw`SELECT count(*)::int AS count FROM information_schema.columns WHERE table_name='users' AND column_name='auth_epoch'`;assert.equal(partial.count,0);assert.equal(await snapshot(),before);passed++;
 assert.equal(deploy(name).status,0);assert.equal(await snapshot(),before);passed++;
 await verifyBetaRuntime(closed,db);passed++;
 const after=await db.$queryRaw`SELECT migration_name,checksum FROM _prisma_migrations ORDER BY migration_name`;assert.deepEqual(after.slice(0,29),history);assert.equal(after.length,30);passed++;
 const u=await db.users.findUnique({where:{id:'historical-sec2'}});assert.equal(u.auth_epoch,0);assert.equal(u.reauth_after,null);assert.equal(await db.auth_sessions.count(),0);passed++;
 assert.equal(deploy(name).status,0);assert.equal(await snapshot(),before);passed++;
 console.log(JSON.stringify({database:name,passed,failed:0,upgrade:'29 -> 30',historical_checksums_unchanged:true,business_records_and_mfa_preserved:true,production_calls:0}));
}finally{await db.$disconnect();}
