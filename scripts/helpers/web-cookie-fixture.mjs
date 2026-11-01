import assert from 'node:assert/strict';
import {createSessionClient} from '../../apps/web/src/lib/auth-session-client.js';
// Unit transport only. Actual browser HttpOnly storage and DB authority are tested separately.
export function createCookieFixture(fetcher){
 const id='a'.repeat(64),csrf='c'.repeat(64),payload={user:{id:'synthetic'},session:{id,generation:1,kind:'web'},session_version:id+':1',csrf_token:csrf};
 const client=createSessionClient(async path=>{assert.equal(path,'/auth/web/bootstrap');return payload;},()=>{}, {crypto:globalThis.crypto,navigator:{locks:{request:async(_name,run)=>run()}}});
 const ready=client.bootstrap();
 return async(url,init)=>{await ready;return client.fetch(async(target,options)=>{
  const h=new Headers(options.headers);assert.equal(h.has('Authorization'),false);assert.equal(h.get('X-CSRF-Token'),csrf);assert.equal(h.get('X-Session-Version'),id+':1');assert.equal(options.credentials,'include');
  return fetcher(target,options);
 },url,init);};
}
