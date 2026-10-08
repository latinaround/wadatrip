// Execute actual entrypoint source with synthetic environment and blocked dependencies.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const guard=require('./local-test-target.cjs');
async function run(file,env){
 let calls=0,constructors=0,exitCode=0;
 const blocked=()=>{calls++;throw Error('unexpected network');};
 class PrismaClient{constructor(){constructors++;}async $disconnect(){}}
 const module={exports:{}};
 const source=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
 const context={exports:module.exports,module,process:{env,exitCode:0,exit:code=>{exitCode=code}},console:{log(){},error(){}},Buffer,setTimeout,clearTimeout,URL,
  require:name=>name==='dotenv/config'?{}:name.includes('local-test-target.cjs')?guard:name==='axios'?{post:blocked,get:blocked,create:blocked}:name==='@prisma/client'?{PrismaClient}:name==='bcryptjs'?{}:(()=>{throw Error('Unexpected dependency '+name)})()};
 let thrown;try{vm.runInNewContext(source,context,{filename:file});await new Promise(resolve=>setImmediate(resolve));}catch(error){thrown=error}
 return {calls,constructors,rejected:!!thrown||exitCode!==0||context.process.exitCode!==0};
}
for(const file of ['scripts/smoke-guide.ts','scripts/smoke.ts','libs/db/prisma/seed.ts']){
 test(file+' rejects a hosted or production database before HTTP/client construction',async()=>{
  const result=await run(file,{SMOKE_GUIDE_BASE_URL:'https://wadatrip.onrender.com',GATEWAY_URL:'https://wadatrip.onrender.com',DATABASE_URL:'postgresql://synthetic:synthetic@production.example.invalid/wadatrip_db'});
  assert.equal(result.calls,0);assert.equal(result.constructors,0);assert.equal(result.rejected,true);
 });
 test(file+' rejects a remote DB even when the API URL is local',async()=>{
  const result=await run(file,{SMOKE_GUIDE_BASE_URL:'http://127.0.0.1:3000',GATEWAY_URL:'http://127.0.0.1:3000',DATABASE_URL:'postgresql://synthetic:synthetic@production.example.invalid/wadatrip_db'});
  assert.equal(result.calls,0);assert.equal(result.constructors,0);assert.equal(result.rejected,true);
 });
}
