// SEC-1: real disposable PostgreSQL, actual compiled controllers, synthetic identity/email only.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {randomUUID, createHash} from 'node:crypto';
import {provision, deploy, client, verify} from './postgres-test-target.mjs';
for (const key of Object.keys(process.env)) if (/STRIPE|RESEND|SENDGRID|JWT|AUTH_|FIREBASE|GOOGLE|RENDER|OPERATOR_|PAYMENTS_|DOTENV|NODE_OPTIONS/.test(key)) delete process.env[key];
Object.assign(process.env,{NODE_ENV:'test',JWT_SECRET:'synthetic-sec1-jwt-secret-for-local-tests',AUTH_RATE_LIMIT_SECRET:'synthetic-sec1-rate-secret-for-local-tests',AUTH_CODE_HASH_SECRET:'synthetic-sec1-otp-secret-for-local-tests',GOOGLE_CLIENT_ID:'synthetic-google-client',FF_PROVIDER_HUB:'false'});
const require=createRequire(import.meta.url), Module=require('node:module'), original=Module._load;
require('reflect-metadata');
const jwt=require('jsonwebtoken'), axios=require('axios'), bcrypt=require('bcryptjs');
const name='wadatrip_p05_history_sec1_'+Date.now().toString(36);
provision(name);assert.equal(deploy(name).status,0,'Complete migration chain must apply');
const a=client(name),b=client(name);await verify(a,name);await verify(b,name);
let pool=0,sends=[],delivery=true,external=0,databaseFailure=false,identity=null;
const peer={headers:{},socket:{remoteAddress:'192.0.2.12'}};
const email=()=>randomUUID()+'@example.invalid';
const status=n=>e=>e.getStatus?.()===n;
const reset=()=>{process.env.AUTH_RATE_LIMIT_SECRET='synthetic-'+randomUUID();sends=[];delivery=true;external=0;databaseFailure=false;identity=null;};
const originalGet=axios.get;
axios.get=async()=>{external++;if(identity)return{data:{email:identity.email,name:identity.name,email_verified:'true',aud:process.env.GOOGLE_CLIENT_ID,iss:'https://accounts.google.com',exp:Math.floor(Date.now()/1000)+300}};throw Error('Synthetic invalid Google proof');};
Module._load=function(id,parent,main){
 if(id==='@wadatrip/db')return{getPrisma:()=>databaseFailure?{$transaction:async()=>{throw Error('synthetic unavailable database');}}:++pool%2?a:b};
 if(id.endsWith('/email.service'))return{sendTransactionalEmail:async message=>{sends.push(message);return{sent:delivery,reason:delivery?undefined:'email_failed'};}};
 if(id.endsWith('/firebase-auth'))return{verifyFirebaseIdToken:async()=>{external++;if(identity)return identity;throw Error('Synthetic invalid Firebase proof');}};
 return original.call(this,id,parent,main);
};
const dist='../apps/gateway/dist/apps/gateway/src/controllers/';
const {AuthController}=require(dist+'auth.controller.js'),{TripsController}=require(dist+'trips.controller.js'),{DevicesController}=require(dist+'devices.controller.js');
const auth=new AuthController();
const {reserveAuthAttempt}=require('../apps/gateway/dist/apps/gateway/src/services/auth-rate-limit.service.js');
const {sessionTransaction,createBearerSession}=require('@wadatrip/common/sessions');
const registered=async user=>({headers:{authorization:'Bearer '+(await sessionTransaction(a,tx=>createBearerSession(tx,user.id,'email_code',true,new Date()))).token}});
async function issue(address){await auth.requestCode({email:address,role:'guide'},peer);const code=sends.at(-1).text.match(/\b\d{6}\b/)[0];return code;}
async function lapse(address){await a.$executeRaw`UPDATE auth_request_limits SET window_started_at=CURRENT_TIMESTAMP-INTERVAL '2 hours'`;}
const passed=[],failed=[];
async function check(title,fn){reset();try{await fn();passed.push(title);console.log('PASS: '+title);}catch(error){failed.push({title,error:error.name,message:String(error.message).replace(/postgres(?:ql)?:\/\/\S+/g,'[redacted]').slice(0,300)});console.error('FAIL: '+title+' ['+error.name+']');}}
try{
 await check('inactive and deleted users cannot read/write trips or register devices',async()=>{
  const user=await a.users.create({data:{email:email(),status:'active',role:'traveler'}});
  const request=await registered(user);await a.users.update({where:{id:user.id},data:{status:'inactive'}});
  const trips=new TripsController(),devices=new DevicesController();
  for(const run of [()=>trips.list(request),()=>trips.create({destination:'Synthetic'},request),()=>trips.get('missing',request),()=>trips.saveExperience('missing',{listing_id:'missing'},request),()=>devices.registerPushToken(request,{token:'ExpoPushToken[sec1-inactive]'})])await assert.rejects(run(),status(401));
  await assert.rejects(a.users.delete({where:{id:user.id}})); // Registry ownership uses RESTRICT.
  await a.auth_sessions.deleteMany({where:{user_id:user.id}});await a.users.delete({where:{id:user.id}});await assert.rejects(trips.list(request),status(401));await assert.rejects(devices.registerPushToken(request,{token:'ExpoPushToken[sec1-deleted]'}),status(401));
  assert.equal(await a.push_devices.count(),0);
 });
 await check('active trips/device ownership and response contracts remain usable',async()=>{
  const user=await a.users.create({data:{email:email(),status:'active',role:'traveler'}}),other=await a.users.create({data:{email:email(),status:'active',role:'traveler'}});
  const requests=new Map([[user.id,await registered(user)],[other.id,await registered(other)]]),req=id=>requests.get(id);
  const trip=await new TripsController().create({destination:'Synthetic Peru',startDate:'2026-12-01',endDate:'2026-12-02'},req(user.id));
  assert.equal((await new TripsController().list(req(user.id))).items.length,1);assert.equal((await new TripsController().list(req(other.id))).items.length,0);
  await assert.rejects(new TripsController().get(trip.id,req(other.id)),status(400));
  const device=await new DevicesController().registerPushToken(req(user.id),{token:'ExpoPushToken[sec1-active]',platform:'android'});assert.equal(device.ok,true);assert.equal(typeof device.id,'string');
 });
 await check('issuing a new OTP retires every prior unused challenge immediately',async()=>{
  const address=email(),older=await issue(address);await lapse(address);const newer=await issue(address);
  const rows=await a.auth_login_codes.findMany({where:{email:address},orderBy:{created_at:'desc'}});assert.equal(rows.length,2);assert.ok(rows[1].used_at);assert.equal(rows[0].used_at,null);
  if(older!==newer)await assert.rejects(auth.verifyCode({email:address,code:older},peer),status(401));
  const result=await auth.verifyCode({email:address,code:newer,role:'admin'},peer);assert.equal(result.user.role,'guide');assert.equal(jwt.verify(result.token,process.env.JWT_SECRET).email_verified,true);
 });
 await check('a consumed latest challenge never falls back to a legacy older challenge',async()=>{
  const address=email();await a.auth_login_codes.create({data:{email:address,role:'traveler',code_hash:createHash('sha256').update('123456').digest('hex'),created_at:new Date(Date.now()-60000),expires_at:new Date(Date.now()+600000)}});
  const current=await issue(address);await auth.verifyCode({email:address,code:current},peer);
  // Simulate a historical or mixed-version leftover; latest must be authoritative even if used.
  await a.auth_login_codes.updateMany({where:{email:address,code_hash:createHash('sha256').update('123456').digest('hex')},data:{used_at:null}});
  await assert.rejects(auth.verifyCode({email:address,code:'123456'},peer),status(401));
 });
 await check('OTP hashes are keyed and bound to the challenge, not a six-digit SHA dictionary',async()=>{
  const address=email(),code=await issue(address),row=await a.auth_login_codes.findFirst({where:{email:address}});assert.match(row.code_hash,/^hmac-sha256:v2:[a-f0-9]{64}$/);assert.notEqual(row.code_hash,createHash('sha256').update(code).digest('hex'));
  const different=email();await a.auth_login_codes.create({data:{email:different,role:'guide',code_hash:row.code_hash,expires_at:row.expires_at}});await assert.rejects(auth.verifyCode({email:different,code},peer),status(401));
 });
 await check('two independent pools allow exactly one JWT under concurrent OTP consumption',async()=>{
  const address=email(),code=await issue(address),results=await Promise.allSettled(Array.from({length:12},()=>new AuthController().verifyCode({email:address,code},peer)));
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);for(const r of results.filter(r=>r.status==='rejected'))assert.equal(r.reason.getStatus(),401);
  assert.equal(await a.users.count({where:{email:address}}),1);assert.ok((await a.auth_login_codes.findFirst({where:{email:address}})).used_at);
 });
 await check('concurrent wrong guesses commit exactly five attempts and block the correct code',async()=>{
  const address=email(),code=await issue(address),wrong=code==='999999'?'888888':'999999';
  const results=await Promise.allSettled(Array.from({length:9},()=>auth.verifyCode({email:address,code:wrong},peer)));assert.ok(results.every(r=>r.status==='rejected'&&r.reason.getStatus()===401));
  assert.equal((await a.auth_login_codes.findFirst({where:{email:address}})).attempts,5);await assert.rejects(auth.verifyCode({email:address,code},peer),status(401));
 });
 await check('signing failure rolls back OTP consumption and account creation atomically',async()=>{
  const address=email(),code=await issue(address),secret=process.env.JWT_SECRET;delete process.env.JWT_SECRET;
  try{await assert.rejects(auth.verifyCode({email:address,code},peer));}finally{process.env.JWT_SECRET=secret;}
  assert.equal(await a.users.count({where:{email:address}}),0);assert.equal((await a.auth_login_codes.findFirst({where:{email:address}})).used_at,null);assert.ok((await auth.verifyCode({email:address,code},peer)).token);
 });
 await check('failed email delivery retains a retired latest challenge and cannot revive an old code',async()=>{
  const address=email(),old=await issue(address);await lapse(address);delivery=false;await assert.rejects(issue(address),status(503));
  const rows=await a.auth_login_codes.findMany({where:{email:address}});assert.equal(rows.length,2);assert.ok(rows.every(r=>r.used_at));await assert.rejects(auth.verifyCode({email:address,code:old},peer),status(401));
 });
 await check('inactive OTP users get no token or successful-login timestamp',async()=>{
  const address=email(),u=await a.users.create({data:{email:address,role:'guide',status:'inactive'}}),code=await issue(address);await assert.rejects(auth.verifyCode({email:address,code},peer),status(401));assert.equal((await a.users.findUnique({where:{id:u.id}})).last_login_at,null);
 });
 await check('expired and unkeyed legacy OTPs fail closed',async()=>{
  for(const expires_at of [new Date(Date.now()-60000),new Date(Date.now()+600000)]){const address=email();await a.auth_login_codes.create({data:{email:address,code_hash:createHash('sha256').update('123456').digest('hex'),role:'guide',expires_at}});await assert.rejects(auth.verifyCode({email:address,code:'123456'},peer),status(401));}
 });
 await check('password login rate limits persist across controllers and canonical email spelling',async()=>{
  process.env.AUTH_LOGIN_LIMIT_ACCOUNT='2';try{const address=email();for(let i=0;i<2;i++)await assert.rejects(new AuthController().login({email:address,password:'incorrect'},peer),status(401));await assert.rejects(auth.login({email:' '+address.toUpperCase()+' ',password:'incorrect'},peer),status(429));}finally{delete process.env.AUTH_LOGIN_LIMIT_ACCOUNT;}
 });
 await check('registration reserves quota before password hashing/user writes and caps concurrent abuse',async()=>{
  process.env.AUTH_REGISTER_LIMIT_IP='2';try{const results=await Promise.allSettled(Array.from({length:8},()=>auth.register({email:email(),password:'synthetic-local-password',role:'guide'},peer)));assert.equal(results.filter(r=>r.status==='fulfilled').length,2);for(const r of results.filter(r=>r.status==='rejected'))assert.equal(r.reason.getStatus(),429);for(const r of results.filter(r=>r.status==='fulfilled')){assert.equal(typeof r.value.token,'string');assert.equal(jwt.verify(r.value.token,process.env.JWT_SECRET).email_verified,false);}}finally{delete process.env.AUTH_REGISTER_LIMIT_IP;}
 });
 await check('verification requests are persistently limited even for unknown emails',async()=>{
  process.env.AUTH_VERIFY_LIMIT_IP='2';try{for(let i=0;i<2;i++)await assert.rejects(auth.verifyCode({email:email(),code:'123456'},peer),status(401));await assert.rejects(auth.verifyCode({email:email(),code:'123456'},peer),status(429));}finally{delete process.env.AUTH_VERIFY_LIMIT_IP;}
 });
 for(const operation of ['login','register','verify','federated']){
  await check(operation+' quotas admit exactly two concurrent attempts across two pools',async()=>{
   const key='AUTH_'+operation.toUpperCase()+'_LIMIT_IP';process.env[key]='2';
   try{const results=await Promise.allSettled(Array.from({length:12},(_,i)=>reserveAuthAttempt(i%2?a:b,operation,operation==='federated'?null:email(),peer)));assert.equal(results.filter(r=>r.status==='fulfilled').length,2);for(const r of results.filter(r=>r.status==='rejected'))assert.equal(r.reason.getStatus(),429);}finally{delete process.env[key];}
  });
  await check(operation+' global quotas stop account and peer rotation',async()=>{
   const key='AUTH_'+operation.toUpperCase()+'_LIMIT_GLOBAL_HOUR';process.env[key]='2';
   try{for(let i=0;i<2;i++)await reserveAuthAttempt(i%2?a:b,operation,operation==='federated'?null:email(),{socket:{remoteAddress:'192.0.2.'+(20+i)}});await assert.rejects(reserveAuthAttempt(b,operation,operation==='federated'?null:email(),{socket:{remoteAddress:'192.0.2.33'}}),status(429));}finally{delete process.env[key];}
  });
 }
 await check('verified Render proxy depth ignores spoofed left prefixes under concurrent abuse',async()=>{
  Object.assign(process.env,{RENDER:'true',RENDER_SERVICE_ID:'synthetic-local-service',AUTH_TRUSTED_PROXY_HOPS:'2',AUTH_LOGIN_LIMIT_IP:'2'});
  try{const results=await Promise.allSettled(Array.from({length:10},(_,i)=>reserveAuthAttempt(i%2?a:b,'login',email(),{socket:{remoteAddress:'10.0.0.8'},headers:{'x-forwarded-for':`198.51.100.${i+1}, 192.0.2.77, 10.0.0.9`}})));assert.equal(results.filter(r=>r.status==='fulfilled').length,2);for(const r of results.filter(r=>r.status==='rejected'))assert.equal(r.reason.getStatus(),429);
   await assert.rejects(reserveAuthAttempt(a,'login',email(),{socket:{remoteAddress:'198.51.100.44'},headers:{'x-forwarded-for':'192.0.2.77, 10.0.0.9'}}),status(503));
  }finally{for(const key of ['RENDER','RENDER_SERVICE_ID','AUTH_TRUSTED_PROXY_HOPS','AUTH_LOGIN_LIMIT_IP'])delete process.env[key];}
 });
 await check('Google and Firebase share persistent pre-verification budgets',async()=>{
  process.env.AUTH_FEDERATED_LIMIT_IP='2';try{await assert.rejects(auth.google({idToken:'synthetic-google'},peer));await assert.rejects(auth.firebase({id_token:'synthetic-firebase'},peer));await assert.rejects(new AuthController().google({idToken:'different'},peer),status(429));assert.equal(external,2);}finally{delete process.env.AUTH_FEDERATED_LIMIT_IP;}
 });
 await check('all new auth operations fail closed on rate-limit database uncertainty',async()=>{
  databaseFailure=true;
  for(const [method,body]of [['requestCode',{email:email()}],['login',{email:email(),password:'incorrect'}],['register',{email:email(),password:'synthetic'}],['verifyCode',{email:email(),code:'123456'}],['google',{idToken:'synthetic'}],['firebase',{idToken:'synthetic'}]])await assert.rejects(auth[method](body,peer),status(503));
  assert.equal(sends.length,0);assert.equal(external,0);databaseFailure=false;
 });
 await check('password, Google and Firebase preserve native token/user and verification contracts',async()=>{
  const address=email(),registered=await auth.register({email:address,password:'synthetic-local-password'},peer);
  const login=await auth.login({email:address,password:'synthetic-local-password'},peer);assert.equal(login.user.id,registered.user.id);assert.equal(jwt.verify(login.token,process.env.JWT_SECRET).email_verified,false);assert.equal(login.user.password_hash,undefined);
  identity={uid:'synthetic-firebase-'+randomUUID(),email:email(),name:'Synthetic operator'};
  const google=await auth.google({id_token:'synthetic-proof',role:'guide'},peer),firebase=await auth.firebase({idToken:'synthetic-proof'},peer);
  assert.equal(google.user.id,firebase.user.id);for(const result of [google,firebase]){assert.equal(jwt.verify(result.token,process.env.JWT_SECRET).email_verified,true);assert.equal(result.user.password_hash,undefined);}
  await a.users.update({where:{id:google.user.id},data:{status:'inactive'}});await assert.rejects(auth.google({idToken:'synthetic-proof'},peer),status(401));await assert.rejects(auth.firebase({idToken:'synthetic-proof'},peer),status(401));
 });
 await check('a correctly hashed but expired OTP cannot be consumed',async()=>{
  const address=email(),code=await issue(address);await a.auth_login_codes.updateMany({where:{email:address},data:{expires_at:new Date(Date.now()-1000)}});await assert.rejects(auth.verifyCode({email:address,code},peer),status(401));assert.equal(await a.users.count({where:{email:address}}),0);
 });
 await check('HTTP routes preserve registration, OTP, me, device and rate-limit responses',async()=>{
  const {Module:Decorator}=require('@nestjs/common'),{NestFactory}=require('@nestjs/core');class FixtureModule{}Decorator({controllers:[AuthController,TripsController,DevicesController]})(FixtureModule);
  const app=await NestFactory.create(FixtureModule,{logger:false});await app.listen(0,'127.0.0.1');const base=await app.getUrl();
  const post=(url,body,token)=>fetch(base+url,{method:'POST',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(5000)});
  try{
   const address=email(),signup=await post('/auth/register',{email:address,password:'synthetic-local-password',role:'guide'});assert.equal(signup.status,201);const account=await signup.json();assert.equal(typeof account.token,'string');
   const codeResponse=await post('/auth/request-code',{email:address,role:'guide'});assert.equal(codeResponse.status,201);const code=sends.at(-1).text.match(/\b\d{6}\b/)[0];
   const verified=await post('/auth/verify-code',{email:address,code});assert.equal(verified.status,201);const session=await verified.json();assert.equal(session.user.id,account.user.id);
   const me=await fetch(base+'/auth/me',{headers:{Authorization:'Bearer '+session.token}});assert.equal(me.status,200);assert.equal((await me.json()).id,account.user.id);
   const device=await post('/devices/push-token',{token:'ExpoPushToken[synthetic-sec1-http]'},session.token);assert.equal(device.status,201);assert.equal((await device.json()).ok,true);
   const replay=await post('/auth/verify-code',{email:address,code});assert.equal(replay.status,401);await replay.arrayBuffer();
   process.env.AUTH_LOGIN_LIMIT_ACCOUNT='1';reset();await(await post('/auth/login',{email:address,password:'incorrect'})).arrayBuffer();const limited=await post('/auth/login',{email:address,password:'incorrect'});assert.equal(limited.status,429);assert.equal(limited.headers.get('retry-after'),'900');assert.equal((await limited.json()).code,'AUTH_SIGN_IN_RATE_LIMITED');
  }finally{delete process.env.AUTH_LOGIN_LIMIT_ACCOUNT;await app.close();}
 });
 await check('auth remediation creates no bookings, payments, inventory or external communications',async()=>{assert.equal(await a.bookings.count(),0);assert.equal(await a.paymentRecord.count(),0);assert.equal(await a.listing_availability.count(),0);});
}finally{Module._load=original;axios.get=originalGet;await Promise.all([a.$disconnect(),b.$disconnect()]);}
const result={database:name,passed:passed.length,failed:failed.length,failures:failed,real_postgresql:true,production_calls:0,real_email_calls:0,processor_calls:0};
fs.writeFileSync('logs/sec1-auth-postgres-results.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));if(failed.length)process.exitCode=1;
