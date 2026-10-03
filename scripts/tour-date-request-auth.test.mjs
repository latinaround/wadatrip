import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { dateRequestApi } from '../apps/web/src/services/tourDateRequests.js';
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; });
const session = () => ({ user: { id: 'synthetic-traveler' }, token: 'synthetic-token', loading: false, logout() {} });
const apiBase = 'http://127.0.0.1:1';
test('date request uses existing Bearer JWT and sends no browser-selected identity or price', async () => {
  const current = session();
  global.fetch = async (url, opts) => {
    assert.equal(url, `${apiBase}/tour-date-requests`); assert.equal(opts.headers.Authorization, 'Bearer synthetic-token');
    assert.deepEqual(JSON.parse(opts.body), { listing_id: 'synthetic-listing', date: '2099-10-10', num_people: 2 });
    return Response.json({ id:'synthetic-request',status:'requested' });
  };
  assert.equal((await dateRequestApi({ apiBase, getSession:()=>current, method:'POST', body:{listing_id:'synthetic-listing',date:'2099-10-10',num_people:2} })).status,'requested');
});
test('anonymous or loading session never sends an inquiry', async () => {
  global.fetch = () => { throw Error('No external calls'); };
  for (const current of [{ user:null, token:null }, { ...session(),loading:true }]) {
    await assert.rejects(dateRequestApi({ apiBase,getSession:()=>current,method:'POST' }), {status:401});
  }
});
test('401 clears only the current existing session and stops the request', async () => {
  let loggedOut=0; const current={ ...session(), logout(){loggedOut++;} };
  global.fetch=async()=>Response.json({message:'expired'},{status:401});
  await assert.rejects(dateRequestApi({apiBase,getSession:()=>current}),{status:401}); assert.equal(loggedOut,1);
});
test('late 401 for traveler A never logs out traveler B', async () => {
  let loggedOut=0,current={...session(),logout(){loggedOut++;}};
  global.fetch=async()=>{current={...session(),user:{id:'synthetic-other'},token:'synthetic-other-token',logout(){loggedOut++;}};return Response.json({}, {status:401});};
  await assert.rejects(dateRequestApi({apiBase,getSession:()=>current}),{status:401});assert.equal(loggedOut,0);
});
test('failed server response is never reported as saved and has no retry side effects', async () => {
  let calls=0;global.fetch=async()=>{calls++;return Response.json({message:'Synthetic database failure'},{status:503});};
  await assert.rejects(dateRequestApi({apiBase,getSession:session,method:'POST',body:{}}),/Synthetic database failure/);assert.equal(calls,1);
});
test('response from a previous session is rejected even if it succeeded', async () => {
  let current=session();global.fetch=async()=>{current={...session(),token:'synthetic-replacement'};return Response.json({id:'synthetic-request'});};
  await assert.rejects(dateRequestApi({apiBase,getSession:()=>current}),{status:401});
});
