const registryFixture=require('./session-fixture.cjs');registryFixture.install();
// Guard-level checks. No multipart bytes, documents, storage or external verifier.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),jwt=require('jsonwebtoken');
process.env.JWT_SECRET='synthetic-upload-guard';delete process.env.ENABLE_OPERATOR_DOCUMENT_UPLOADS;delete process.env.ADMIN_EMAILS;delete process.env.ADMIN_USER_IDS;
const db={users:{findUnique:async({where})=>({id:where.id,email:where.id+'@example.invalid',role:'traveler',status:'active'})},providers:{findUnique:async()=>({id:'synthetic-provider',user_id:'owner'})}};
const moduleFixture={exports:{}};const source=fs.readFileSync('services/provider-hub/src/security.guard.ts','utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,esModuleInterop:true,experimentalDecorators:true}}).outputText;
vm.runInNewContext(compiled,{module:moduleFixture,exports:moduleFixture.exports,process,require:name=>name==='@wadatrip/db'?{getPrisma:()=>registryFixture.enable(db)}:name.includes('health.controller')?{HealthController:class{}}:require(name)});
const Guard=moduleFixture.exports.ProviderUploadGuard;
const context=id=>({switchToHttp:()=>({getRequest:()=>({params:{id:'synthetic-provider'},headers:{authorization:'Bearer '+jwt.sign({email:id+'@example.invalid',email_verified:true},process.env.JWT_SECRET,{subject:id,expiresIn:300})}})})});
test('document ingestion defaults closed even for the verified owner before Multer runs',async()=>{await assert.rejects(new Guard().canActivate(context('owner')),e=>e.getStatus?.()===503);});
test('another operator cannot reach private document ingestion',async()=>{await assert.rejects(new Guard().canActivate(context('other')),e=>e.getStatus?.()===404);});
test('an unknown flag value cannot enable document ingestion',async()=>{process.env.ENABLE_OPERATOR_DOCUMENT_UPLOADS='yes';try{await assert.rejects(new Guard().canActivate(context('owner')),e=>e.getStatus?.()===503);}finally{delete process.env.ENABLE_OPERATOR_DOCUMENT_UPLOADS;}});
