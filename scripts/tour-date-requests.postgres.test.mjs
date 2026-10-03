// Dedicated disposable PostgreSQL only. Uses the pre-existing safety-checked P05 target.
// No production copy, .env, Stripe or real emails. Existing test databases are never reused/deleted.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire, Module } from 'node:module';
import { client, verify, provision, deploy } from './postgres-test-target.mjs';
const require = createRequire(import.meta.url);
const domain = require('../apps/gateway/dist/apps/gateway/src/services/tour-date-request.service.js');
const { createCapacityBooking } = require('@wadatrip/common/booking-capacity');
const name = `wadatrip_p05_repair_requests_${Date.now()}`;
const historicalName = `wadatrip_p05_history_requests_${Date.now()}`;
let db, second, historical;
// Inject only the unused Nest singleton factory; all queries use explicit, verified real clients.
const originalLoad = Module._load;
Module._load = function(name, ...args) {
  if (name === '@wadatrip/db') return { getPrisma: () => { throw Error('Use the explicit verified disposable client'); } };
  return originalLoad.call(this,name,...args);
};
const { sendRequestNotifications } = require('../apps/gateway/dist/apps/gateway/src/services/tour-request-notifications.service.js');
Module._load = originalLoad;
const day = new Date(Date.now() + 7 * 86400000).toISOString().slice(0,10);
const actor = id => ({ id, email:`${id}@example.invalid`, verified:true, role:'traveler', name:null, admin:false });
const request = () => domain.createDateRequest(db, actor('synthetic-traveler'), { listing_id:'synthetic-listing',date:day,num_people:2 });
async function seed(prisma, legacy = false) {
  if (legacy) {
    // The current client cannot SELECT columns added after this historical schema.
    await prisma.$executeRaw`INSERT INTO users (id,email,role,status,created_at) VALUES
      ('synthetic-traveler','synthetic-traveler@example.invalid','traveler','active',CURRENT_TIMESTAMP),
      ('synthetic-owner','synthetic-owner@example.invalid','traveler','active',CURRENT_TIMESTAMP)`;
    await prisma.$executeRaw`INSERT INTO providers (id,user_id,type,name,email,languages,base_city,country_code,status,created_at)
      VALUES ('synthetic-provider','synthetic-owner','operator','Synthetic Host','synthetic-provider@example.invalid',ARRAY['en'],'Lima','PE','approved',CURRENT_TIMESTAMP)`;
    await prisma.$executeRaw`INSERT INTO listings (id,provider_id,title,category,city,country_code,tags,status,price_from,currency,created_at)
      VALUES ('synthetic-listing','synthetic-provider','Synthetic Walk','tour','Lima','PE',ARRAY[]::text[],'published',120,'USD',CURRENT_TIMESTAMP)`;
    return;
  }
  for (const id of ['synthetic-traveler','synthetic-owner','synthetic-other']) await prisma.users.create({data:{id,email:`${id}@example.invalid`,status:'active'}});
  await prisma.providers.create({data:{id:'synthetic-provider',user_id:'synthetic-owner',name:'Synthetic Host',email:'synthetic-provider@example.invalid',type:'operator',languages:['en'],base_city:'Lima',country_code:'PE',status:'approved'}});
  await prisma.listings.create({data:{id:'synthetic-listing',provider_id:'synthetic-provider',title:'Synthetic Walk',category:'tour',city:'Lima',country_code:'PE',tags:[],status:'published',price_from:120,currency:'USD'}});
}
before(async () => {
  provision(name); deploy(name); db=client(name); second=client(name); await verify(db,name); await verify(second,name); await seed(db);
});
after(async () => { await Promise.all([db?.$disconnect(),second?.$disconnect(),historical?.$disconnect()]); });
test('full migrations from scratch create both isolated tables with real valid constraints', async () => {
  const constraints=await db.$queryRaw`SELECT conname,convalidated FROM pg_constraint WHERE conrelid IN ('tour_date_requests'::regclass,'tour_request_notifications'::regclass)`;
  assert.ok(constraints.length>=10); assert.ok(constraints.every(row=>row.convalidated));
  const indexes=await db.$queryRaw`SELECT indexname FROM pg_indexes WHERE tablename IN ('tour_date_requests','tour_request_notifications')`;
  assert.ok(indexes.some(row=>row.indexname==='tour_date_requests_user_id_listing_id_requested_date_key'));
});
test('two real connections concurrently submit one request and one durable notification', async () => {
  const [a,b]=await Promise.all([request(),domain.createDateRequest(second,actor('synthetic-traveler'),{listing_id:'synthetic-listing',date:day,num_people:2})]);
  assert.equal(a.id,b.id); assert.equal(await db.tour_date_requests.count(),1); assert.equal(await db.tour_request_notifications.count(),1);
  assert.equal(await db.bookings.count(),0); assert.equal(await db.paymentRecord.count(),0); assert.equal(await db.listing_availability.count(),0);
});
test('real DB enforces request FK, traveler count, lifecycle and notification uniqueness', async () => {
  const data={user_id:'synthetic-traveler',listing_id:'synthetic-listing',requested_date:new Date(day),num_people:2};
  for (const override of [{user_id:'missing'},{listing_id:'missing'},{num_people:0},{num_people:101},{status:'confirmed'},{status:'available'}]) {
    await assert.rejects(db.tour_date_requests.create({data:{...data,...override,requested_date:new Date(Date.now()+30*86400000)}}));
  }
  const existing=await request();
  await assert.rejects(db.tour_request_notifications.create({data:{request_id:existing.id,audience:'operator'}}));
  await assert.rejects(db.tour_request_notifications.create({data:{request_id:'missing',audience:'operator'}}));
  assert.equal(await db.tour_date_requests.count(),1);
});
test('failed offer rolls back and never invents inventory', async () => {
  const existing=await request();
  await assert.rejects(domain.respondToDateRequest(db,actor('synthetic-owner'),existing.id,{status:'available',date:day}));
  assert.equal((await db.tour_date_requests.findUnique({where:{id:existing.id}})).status,'requested');
  assert.equal(await db.tour_request_notifications.count(),1); assert.equal(await db.listing_availability.count(),0);
});
test('two real connections concurrently answer once, without consuming any capacity', async () => {
  const existing=await request();
  await db.listing_availability.create({data:{listing_id:'synthetic-listing',date:new Date(day),spots_total:20,spots_available:20}});
  const response={status:'available',date:day};
  const [a,b]=await Promise.all([domain.respondToDateRequest(db,actor('synthetic-owner'),existing.id,response),domain.respondToDateRequest(second,actor('synthetic-owner'),existing.id,response)]);
  assert.equal(a.status,'available');assert.equal(b.status,'available');assert.equal(await db.tour_request_notifications.count(),2);
  assert.equal((await db.listing_availability.findFirst()).spots_available,20); assert.equal(await db.bookings.count(),0);
});
test('real outbox claims prevent simultaneous workers from sending the same alert', async () => {
  let sends=0;
  const sender=async () => { sends++; await new Promise(resolve=>setTimeout(resolve,50)); return {sent:true}; };
  await Promise.all([sendRequestNotifications(db,sender),sendRequestNotifications(second,sender)]);
  // Stale operator inquiry is skipped after response; the traveler receives one response.
  assert.equal(sends,1); assert.equal(await db.tour_request_notifications.count({where:{status:'sent'}}),1);
});
test('concurrent traveler closure and operator response cannot create contradictory inventory effects', async () => {
  const result=await domain.createDateRequest(db,actor('synthetic-other'),{listing_id:'synthetic-listing',date:day,num_people:2});
  await Promise.allSettled([domain.cancelDateRequest(db,actor('synthetic-other'),result.id),domain.respondToDateRequest(second,actor('synthetic-owner'),result.id,{status:'available',date:day})]);
  assert.equal((await db.tour_date_requests.findUnique({where:{id:result.id}})).status,'cancelled');
  assert.equal((await db.listing_availability.findFirst()).spots_available,20);assert.equal(await db.bookings.count(),0);
});
test('inquiry abuse-limit lock does not deadlock a concurrent actual booking foreign key', async () => {
  let listingHeld, travelerHeld;
  const listingLocked=new Promise(resolve=>{listingHeld=resolve;});
  const travelerLocked=new Promise(resolve=>{travelerHeld=resolve;});
  const wrapped=(prisma,kind)=>({$transaction:fn=>prisma.$transaction(tx=>fn(new Proxy(tx,{get(target,key){
    if(key!=='$queryRaw') return target[key];
    return async(parts,...values)=>{
      const result=await target.$queryRaw(parts,...values);
      const query=parts.join('?');
      if(kind==='booking'&&query.includes('FROM listings')){listingHeld();await travelerLocked;}
      if(kind==='inquiry'&&query.includes('FROM users'))travelerHeld();
      return result;
    };
  }})),{isolationLevel:'ReadCommitted',timeout:10000})});
  const booking=createCapacityBooking(wrapped(second,'booking'),actor('synthetic-traveler'),{listing_id:'synthetic-listing',date:day,num_people:1});
  await listingLocked;
  const inquiry=domain.createDateRequest(wrapped(db,'inquiry'),actor('synthetic-traveler'),{listing_id:'synthetic-listing',date:day,num_people:2});
  const results=await Promise.allSettled([booking,inquiry]);
  assert.deepEqual(results.map(result=>result.status),['fulfilled','fulfilled'],`Booking/inquiry interference: ${results.map(result=>result.reason ? `${result.reason.code}:${result.reason.meta?.code||'unknown'}` : result.status).join(',')}`);
  assert.equal(await db.bookings.count(),1);assert.equal((await db.listing_availability.findFirst()).spots_available,19);
});
test('migration over synthetic legacy data preserves unknown financial amounts and original records', async () => {
  provision(historicalName);deploy(historicalName,'recovered');historical=client(historicalName);await verify(historical,historicalName);await seed(historical,true);
  await historical.$executeRaw`INSERT INTO bookings (id,listing_id,provider_id,user_id,status,date,num_people,total_price,created_at)
    VALUES ('synthetic-legacy-booking','synthetic-listing','synthetic-provider','synthetic-traveler','cancelled',TIMESTAMP '2025-01-01',1,NULL,TIMESTAMP '2025-01-01')`;
  const before=await historical.$queryRaw`SELECT * FROM bookings ORDER BY id`;
  deploy(historicalName);
  const after=await historical.$queryRaw`SELECT id,listing_id,provider_id,user_id,status,date,num_people,total_price,created_at FROM bookings ORDER BY id`;
  for (const key of Object.keys(after[0])) assert.deepEqual(after[0][key],before[0][key]);
  assert.equal((await historical.bookings.findUnique({where:{id:'synthetic-legacy-booking'}})).amount_cents,null);
  assert.equal(await historical.tour_date_requests.count(),0);assert.equal(await historical.tour_request_notifications.count(),0);
});
