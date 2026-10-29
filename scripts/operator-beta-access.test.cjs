// Actual controllers, synthetic verified identities. No network, cloud or database.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),path=require('node:path'),jwt=require('jsonwebtoken');
require('reflect-metadata');
process.env.JWT_SECRET='synthetic-beta-only';process.env.FF_PROVIDER_HUB='false';delete process.env.ADMIN_USER_IDS;delete process.env.ADMIN_EMAILS;
const envKeys=['OPERATOR_BETA_USER_IDS','OPERATOR_BETA_PUBLICATION_USER_IDS','OPERATOR_BETA_MAX_OPERATORS','OPERATOR_BETA_PREPARATION_ONLY'];
const reset=()=>{for(const k of envKeys)delete process.env[k];};
let writes=0, legacyMode=false;
const provider={id:'provider',user_id:'owner',status:'verified',name:'Synthetic Host',email:'owner@example.invalid',base_city:'Synthetic City',country_code:'BR'};
const listing={id:'listing',provider_id:'provider',status:'draft',provider,tags:[]};
const db={users:{findUnique:async({where})=>({id:where.id,email:where.id+'@example.invalid',status:'active',role:'traveler'})},
 admin_mfa:{findUnique:async()=>({enabled_at:new Date(),version:1})},
 providers:{findUnique:async()=>provider,findFirst:async({where})=>legacyMode?(where.user_id===null?{...provider,user_id:null}:null):(where.user_id==='owner'?provider:null),updateMany:async()=>{writes++;return{count:1}},update:async()=>{writes++;return provider},create:async()=>{writes++;return provider}},
 listings:{findUnique:async()=>listing,create:async({data})=>{writes++;return data},update:async({data})=>{writes++;return data}}};
const cache={};
function load(file){const abs=path.resolve(file);if(cache[abs])return cache[abs].exports;const m={exports:{}};cache[abs]=m;
 const code=ts.transpileModule(fs.readFileSync(abs,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true,experimentalDecorators:true}}).outputText;
 const req=n=>n==='@wadatrip/db'?{getPrisma:()=>db}:n==='@wadatrip/common/security'?load('libs/common/src/security.ts'):n.startsWith('.')?load(path.resolve(path.dirname(abs),n+'.ts')):n==='axios'?{get(){throw Error('External HTTP forbidden')}}:require(n);
 vm.runInNewContext(code,{module:m,exports:m.exports,require:req,process,Buffer,URL,Reflect,console});return m.exports;}
const security=load('libs/common/src/security.ts');
const Gateway=load('apps/gateway/src/controllers/providers.controller.ts').ProvidersController;
const Hub=load('services/provider-hub/src/controllers/listings.controller.ts').ListingsController;
const req=id=>({headers:{authorization:'Bearer '+jwt.sign({email:id+'@example.invalid',email_verified:true},process.env.JWT_SECRET,{subject:id,expiresIn:300})}});
const body={provider_id:'provider',title:'Synthetic Tour',category:'tour',city:'Synthetic City',country_code:'BR',price_from:50,currency:'USD',status:'draft'};
const forbidden=e=>[403,503].includes(e.getStatus?.());
test('uninvited verified account cannot create a provider',async()=>{reset();writes=0;await assert.rejects(new Gateway().createProvider(req('new'),{name:'Synthetic',base_city:'City',country_code:'ZA'}),forbidden);assert.equal(writes,0)});
test('reading a profile cannot enroll an uninvited legacy account as a side effect',async()=>{reset();writes=0;legacyMode=true;try{assert.equal(await security.findOwnedProvider(db,{id:'owner',email:provider.email,verified:true,admin:false}),null);assert.equal(writes,0);}finally{legacyMode=false;}});
test('verified invited legacy account can still claim only an unowned matching profile',async()=>{reset();process.env.OPERATOR_BETA_USER_IDS='owner';writes=0;legacyMode=true;try{assert.equal((await security.findOwnedProvider(db,{id:'owner',email:provider.email,verified:true,admin:false})).user_id,'owner');assert.equal(writes,1);}finally{legacyMode=false;}});
test('existing operator profile remains readable after cohort access is revoked',async()=>{reset();assert.equal((await security.findOwnedProvider(db,{id:'owner',email:provider.email,verified:true,admin:false})).id,provider.id)});
test('uninvited existing owner cannot bypass the cohort through provider update',async()=>{reset();writes=0;await assert.rejects(new Gateway().upsertMyProvider(req('owner'),{name:'Synthetic'}),forbidden);assert.equal(writes,0)});
test('Gateway rejects uninvited draft creation before writing',async()=>{reset();writes=0;await assert.rejects(new Gateway().createListing(req('owner'),body),forbidden);assert.equal(writes,0)});
test('Provider Hub rejects uninvited draft creation too',async()=>{reset();writes=0;await assert.rejects(new Hub().create(req('owner'),body),forbidden);assert.equal(writes,0)});
test('invited owner can prepare a draft in another country without financial approval',async()=>{reset();process.env.OPERATOR_BETA_USER_IDS='owner';assert.equal((await new Gateway().createListing(req('owner'),body)).status,'draft');assert.equal((await new Hub().create(req('owner'),body)).status,'draft')});
test('an invited pending provider can prepare drafts without becoming approved',async()=>{reset();process.env.OPERATOR_BETA_USER_IDS='owner';provider.status='pending';try{assert.equal((await new Hub().create(req('owner'),body)).status,'draft');assert.equal(provider.status,'pending')}finally{provider.status='verified'}});
test('editing a public listing requires separate publication access',async()=>{reset();process.env.OPERATOR_BETA_USER_IDS='owner';listing.status='published';writes=0;try{await assert.rejects(new Gateway().updateListing(req('owner'),'listing',{title:'Changed'}),forbidden);assert.equal(writes,0)}finally{listing.status='draft'}});
test('direct Hub availability mutation does not bypass the cohort',async()=>{reset();writes=0;await assert.rejects(new Hub().upsertAvailability('listing',{date:'2026-11-30',spots_total:12},req('owner')),forbidden);assert.equal(writes,0)});
test('invitation alone never allows public publication on either entry point',async()=>{reset();process.env.OPERATOR_BETA_USER_IDS='owner';for(const run of [()=>new Gateway().createListing(req('owner'),{...body,status:'published'}),()=>new Hub().create(req('owner'),{...body,status:'published'})]){writes=0;await assert.rejects(run(),forbidden);assert.equal(writes,0)}});
test('status endpoint cannot bypass publication permission',async()=>{reset();process.env.OPERATOR_BETA_USER_IDS='owner';writes=0;await assert.rejects(new Gateway().setListingStatus(req('owner'),'listing',{status:'published'}),forbidden);await assert.rejects(new Hub().updateStatus('listing',{status:'published'},req('owner')),forbidden);assert.equal(writes,0)});

test('MFA-approved administrator cannot publish a draft through either status or creation route during preparation',async()=>{
 reset();process.env.OPERATOR_BETA_PREPARATION_ONLY='true';process.env.ADMIN_USER_IDS='synthetic-admin';
 const request=req('synthetic-admin');request.headers['x-admin-proof']=jwt.sign({purpose:'admin_step_up',session_hash:require('node:crypto').createHash('sha256').update(request.headers.authorization).digest('hex'),credential_version:1},process.env.JWT_SECRET,{subject:'synthetic-admin',audience:'wadatrip-admin',issuer:'wadatrip',expiresIn:120});
 try{assert.equal((await security.requireActor(request,db)).admin,true);for(const run of [()=>new Gateway().setListingStatus(request,'listing',{status:'published'}),()=>new Hub().updateStatus('listing',{status:'published'},request),()=>new Gateway().createListing(request,{...body,status:'published'}),()=>new Hub().create(request,{...body,status:'published'})]){writes=0;await assert.rejects(run(),e=>e.getStatus?.()===503);assert.equal(writes,0)}}finally{delete process.env.ADMIN_USER_IDS;reset();}
});

test('preparation capabilities never advertise publication to an administrator',()=>{reset();process.env.OPERATOR_BETA_PREPARATION_ONLY='true';try{const caps=security.operatorBetaCapabilities({id:'synthetic-admin',verified:true,admin:true});assert.equal(caps.can_prepare,true);assert.equal(caps.can_publish,false);}finally{reset();}});
test('removing an ID revokes workspace access on the next call',async()=>{reset();const actor={id:'owner',verified:true,admin:false};process.env.OPERATOR_BETA_USER_IDS='owner';security.requireOperatorBetaAccess(actor);delete process.env.OPERATOR_BETA_USER_IDS;assert.throws(()=>security.requireOperatorBetaAccess(actor),forbidden)});
test('wildcard and oversized cohorts fail closed',()=>{reset();for(const value of ['*',Array.from({length:6},(_,i)=>'operator'+i).join(',')]){process.env.OPERATOR_BETA_USER_IDS=value;assert.throws(()=>security.operatorBetaCapabilities({id:'owner',verified:true,admin:false}),forbidden)}});
test('publication allowlist must be a subset of enrolled accounts',()=>{reset();process.env.OPERATOR_BETA_PUBLICATION_USER_IDS='owner';assert.throws(()=>security.operatorBetaCapabilities({id:'owner',verified:true,admin:false}),forbidden)});
test('email fields and body roles cannot grant beta access',()=>{reset();process.env.OPERATOR_BETA_USER_IDS='owner';assert.throws(()=>security.requireOperatorBetaAccess({id:'other',email:'owner',verified:true,admin:false,role:'admin'}),forbidden)});
test('explicit publication permission does not grant Live money',()=>{reset();process.env.OPERATOR_BETA_USER_IDS='owner';process.env.OPERATOR_BETA_PUBLICATION_USER_IDS='owner';assert.equal(security.operatorBetaCapabilities({id:'owner',verified:true,admin:false}).can_publish,true);const payments=load('apps/gateway/src/services/payment-config.service.ts');assert.throws(()=>payments.requireNewPaymentAccess('provider',{STRIPE_SECRET_KEY:'sk_live_synthetic',PAYMENTS_ACCEPT_NEW:'true',PAYMENTS_LIVE_ENABLED:'true',PAYMENTS_LIVE_PROVIDER_IDS:'provider',WADATRIP_FEE_PCT:'15'}),e=>e.getStatus?.()===503)});
