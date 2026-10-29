// Actual controller/service sources, synthetic PostgreSQL contract and email only.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
process.env.JWT_SECRET='synthetic-rate-limit-key';process.env.NODE_ENV='test';delete process.env.AUTH_CODE_PREVIEW;
const root=path.resolve(__dirname,'..');
function fixture(options={}){
 let rows=new Map(),serial=Promise.resolve(),clock=new Date('2026-10-26T12:00:00Z'),failure=false,sent=0,created=0;
 const db={users:{findUnique:async()=>options.existing?{id:'synthetic-existing'}:null},auth_login_codes:{create:async()=>({id:'synthetic-code-'+ ++created}),delete:async()=>{}},
  $transaction(fn){const next=serial.then(async()=>{if(failure)throw Error('synthetic DB unavailable');const previous=structuredClone(rows);try{return await fn(db);}catch(e){rows=previous;throw e;}});serial=next.catch(()=>{});return next;},
  $queryRaw:async(parts,...values)=>{const sql=parts.join('?');if(sql.includes('CURRENT_TIMESTAMP'))return[{now:clock}];assert.ok(sql.includes('INSERT INTO "auth_request_limits"'));const[key,now,expires,cutoff]=values,limit=values.at(-1),old=rows.get(key);if(old&&+old.window_started_at>+cutoff&&old.attempts>=limit)return[];rows.set(key,{window_started_at:!old||+old.window_started_at<=+cutoff?now:old.window_started_at,attempts:!old||+old.window_started_at<=+cutoff?1:old.attempts+1,expires_at:expires});return[{key}];},
  $executeRaw:async()=>0,
 };
 const cache=new Map();function load(relative){const file=path.resolve(root,relative);if(cache.has(file))return cache.get(file).exports;const module={exports:{}};cache.set(file,module);const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,experimentalDecorators:true,emitDecoratorMetadata:true,esModuleInterop:true}}).outputText;
  vm.runInNewContext(code,{module,exports:module.exports,process,Buffer,URL,Date,console,require:name=>{
   if(name==='@wadatrip/db')return{getPrisma:()=>db};if(name.endsWith('/email.service'))return{sendTransactionalEmail:async()=>{sent++;return{sent:true};}};
   if(name.endsWith('/firebase-auth'))return{verifyFirebaseIdToken:async()=>{throw Error('No Firebase in this fixture');}};
   if(name.startsWith('.')){const p=path.resolve(path.dirname(file),name),f=['','.ts','.js'].map(ext=>p+ext).find(fs.existsSync);if(f)return load(path.relative(root,f));}
   return require(name);
  }});return module.exports;}
 const Controller=load('apps/gateway/src/controllers/auth.controller.ts').AuthController;
 const request=(email='synthetic@example.invalid',headers={})=>new Controller().requestCode({email},{ip:'127.0.0.1',socket:{remoteAddress:'127.0.0.1'},headers});
 return{request,db,counters:()=>({sent,created,rows:[...rows.entries()]}),advance:ms=>clock=new Date(+clock+ms),fail:()=>failure=true};
}
const status=number=>error=>error.getStatus?.()===number;
test('concurrent requests for one email reserve exactly one send before external IO',async()=>{const f=fixture(),out=await Promise.allSettled(Array.from({length:12},()=>f.request()));assert.equal(out.filter(r=>r.status==='fulfilled').length,1);assert.equal(f.counters().sent,1);assert.equal(f.counters().created,1);});
test('a new controller instance cannot bypass the persisted cooldown',async()=>{const f=fixture();await f.request();await assert.rejects(f.request(),status(429));assert.equal(f.counters().sent,1);});
test('email case and whitespace cannot bypass the same account budget',async()=>{const f=fixture();await f.request();await assert.rejects(f.request(' SYNTHETIC@EXAMPLE.INVALID '),status(429));});
test('database uncertainty fails closed before creating or emailing a code',async()=>{const f=fixture();f.fail();await assert.rejects(f.request(),status(503));assert.equal(f.counters().sent,0);assert.equal(f.counters().created,0);});
test('invalid email input cannot create a code or reserve an address bucket',async()=>{const f=fixture();for(const email of ['bad-address',{},'x'.repeat(300)+'@example.invalid'])await assert.rejects(f.request(email),status(400));assert.equal(f.counters().created,0);});
test('forwarded IP headers cannot escape the verified peer budget',async()=>{process.env.AUTH_CODE_LIMIT_IP_HOUR='2';try{const f=fixture();await f.request('a@example.invalid',{'x-forwarded-for':'192.0.2.1'});await f.request('b@example.invalid',{'x-forwarded-for':'192.0.2.2'});await assert.rejects(f.request('c@example.invalid',{'x-forwarded-for':'192.0.2.3'}),status(429));assert.equal(f.counters().sent,2);}finally{delete process.env.AUTH_CODE_LIMIT_IP_HOUR;}});
test('budgets recover after time passes and never store raw email/IP keys',async()=>{const f=fixture();await f.request();f.advance(61000);await f.request();assert.equal(f.counters().sent,2);for(const[key]of f.counters().rows)assert.match(key,/^[a-f0-9]{64}$/);});
test('nonpositive limit configuration cannot silently disable protection',async()=>{process.env.AUTH_CODE_LIMIT_EMAIL_HOUR='0';try{const f=fixture();await assert.rejects(f.request(),status(503));assert.equal(f.counters().sent,0);}finally{delete process.env.AUTH_CODE_LIMIT_EMAIL_HOUR;}});
test('request-code responses do not reveal whether an email is registered',async()=>{const fresh=fixture(),existing=fixture({existing:true});assert.deepEqual(JSON.parse(JSON.stringify(await fresh.request())),JSON.parse(JSON.stringify(await existing.request())));});
