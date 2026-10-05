import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAdminClient } from '../apps/web/src/admin/client.js';
const session = () => ({ user:{id:'synthetic-admin'},token:'synthetic-primary',loading:false,logout(){} });
const response = (status,body) => ({status,ok:status===200,json:async()=>body});
const proof = expires => 'synthetic.'+Buffer.from(JSON.stringify({exp:expires})).toString('base64url')+'.synthetic';
test('admin requests use the existing traveler session and MFA proof', async()=>{
  const current=session();let headers;const client=createAdminClient({getSession:()=>current,getBase:()=> 'http://localhost',now:()=>1000,fetcher:async(url,init)=>{headers=init.headers;return response(200,{items:[]})}});
  client.setProof(proof(100),'synthetic-primary');await client.request('/admin/users');assert.equal(headers.get('Authorization'),'Bearer synthetic-primary');assert.equal(headers.get('X-Admin-Proof'),proof(100));
});
test('anonymous never calls admin API',async()=>{let calls=0;const c=createAdminClient({getSession:()=>null,getBase:()=>'',fetcher:async()=>calls++});await assert.rejects(c.request('/admin/users'));assert.equal(calls,0)});
test('user switch during fetch or JSON parsing never exposes old user records',async()=>{
  for(const phase of ['fetch','json']){let current=session();const c=createAdminClient({getSession:()=>current,getBase:()=>'',fetcher:async()=>{if(phase==='fetch')current={...session(),token:'other',user:{id:'other'}};return {status:200,ok:true,json:async()=>{if(phase==='json')current=null;return {items:[{email:'synthetic@example.invalid'}]}}}}});await assert.rejects(c.request('/admin/users'),/Inicia sesión/)}
});
test('expired proof and server challenge trigger step-up without new auth storage',async()=>{
  const current=session();let time=1000,events=0;const c=createAdminClient({getSession:()=>current,getBase:()=>'',now:()=>time,onStepUp:()=>events++,fetcher:async(url,init)=>{assert.equal(init.headers.has('X-Admin-Proof'),false);return response(403,{code:'ADMIN_STEP_UP_REQUIRED',message:'Verify again'})}});
  c.setProof(proof(2),current.token);time=3000;await assert.rejects(c.request('/admin/users'));assert.ok(events>=1);
});
test('logout and failed primary authentication clear proof and session',async()=>{
  const current=session();let loggedOut=false;current.logout=()=>loggedOut=true;const c=createAdminClient({getSession:()=>current,getBase:()=>'',fetcher:async()=>response(401,{})});await assert.rejects(c.request('/admin/users'));assert.equal(loggedOut,true);
});
test('proof cannot attach to a different session',()=>{const current=session();const c=createAdminClient({getSession:()=>current,getBase:()=>''});assert.throws(()=>c.setProof(proof(Date.now()/1000+60),'another-session'))});
test('caller cannot forward a stale proof after memory was cleared',async()=>{
 const current=session();let sent;const c=createAdminClient({getSession:()=>current,getBase:()=>'',fetcher:async(url,init)=>{sent=init.headers;return response(200,{})}});
 c.setProof(proof(Date.now()/1000+60),current.token);c.clear();await c.request('/admin/session',{headers:{'X-Admin-Proof':'stale-proof'}});assert.equal(sent.has('X-Admin-Proof'),false);
});
