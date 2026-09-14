// Actual compiled domain functions, actual Prisma and two independent PostgreSQL pools.
// No DB fixture/proxy or Stripe SDK. Processor observations below are explicitly synthetic.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { provision, client, verify, deploy } from './postgres-test-target.mjs';
const require = createRequire(import.meta.url);
const { Prisma } = require('@prisma/client');
const { createCapacityBooking, updateCapacityBooking } = require('@wadatrip/common/booking-capacity');
const { preparePayment, attachPaymentObject, applyPaymentObservation, withPaymentBooking } = require('@wadatrip/common/payment-lifecycle');
const database = `wadatrip_p05_repair_core_${Date.now().toString(36)}`;
const gateway = client(database), hub = client(database), observer = client(database);
const date = new Date(Date.now() + 7 * 86400000).toISOString().slice(0,10);
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
let serial = 0;
before(async () => {
  provision(database); await verify(gateway, database);
  assert.equal(deploy(database).status, 0, 'real migration chain is mandatory');
  await gateway.users.create({ data: { id: 'p05-user', email: 'traveler@example.invalid' } });
  await gateway.providers.create({ data: { id: 'p05-provider', type: 'guide', name: 'Synthetic',
    email: 'provider@example.invalid', languages: ['en'], base_city: 'Test', country_code: 'ZZ' } });
});
after(async () => { await Promise.all([gateway.$disconnect(), hub.$disconnect(), observer.$disconnect()]); });
async function listing(capacity = 1, price = 120) {
  const id = `p05-listing-${++serial}`;
  await gateway.listings.create({ data: { id, provider_id: 'p05-provider', title: 'Synthetic', category: 'tour',
    city: 'Test', country_code: 'ZZ', tags: [], status: 'published', price_from: price } });
  await gateway.listing_availability.create({ data: { id: `${id}-slot`, listing_id: id, date: new Date(date), spots_total: capacity, spots_available: capacity } });
  return id;
}
const create = (db, id, people = 1) => createCapacityBooking(db, { id: 'p05-user' }, { listing_id: id, date, num_people: people });
const parameters = (booking, id) => ({ metadata: { booking_id: booking.id, payment_record_id: id }, amount: booking.amount_cents, currency: booking.currency });
async function reserved(capacity = 1, price = 120) {
  const id = await listing(capacity, price), { created: booking } = await create(gateway, id);
  const payment = price ? await preparePayment(gateway, booking.id, 'checkout', parameters) : null;
  return { id, booking, payment };
}
const observation = (b, p, outcome = 'succeeded') => ({ bookingId: b.id, paymentId: p.id,
  sessionId: `cs_synthetic_${p.id}`, amount: p.amount_gross_cents, currency: 'usd', outcome });
const settle = (db, b, p, outcome = 'succeeded', event = `evt_synthetic_${++serial}`) =>
  applyPaymentObservation(db, event, `synthetic.${outcome}`, observation(b,p,outcome));
const booking = id => observer.bookings.findUnique({ where: { id } });
const payment = id => observer.paymentRecord.findUnique({ where: { booking_id: id } });
const remaining = async id => (await observer.listing_availability.findUnique({ where: { id: `${id}-slot` } })).spots_available;
async function waitForBlocked(count, completed = () => 0) {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    const [r] = await observer.$queryRaw`SELECT count(*)::int n FROM pg_stat_activity
      WHERE datname=current_database() AND cardinality(pg_blocking_pids(pid)) > 0`;
    if (r.n + completed() >= count) return;
    await new Promise(r => setTimeout(r, 20));
  }
  throw new Error(`Did not observe ${count} real blocked PostgreSQL sessions`);
}
async function contended(id, operations, firstReceipt = false) {
  const acquired = deferred(), release = deferred();
  const lock = observer.$transaction(async tx => {
    if (firstReceipt) {
      // Allow both upsert reads of an absent event, but block INSERT until both
      // connections arrive. This makes the original P2002 race reproducible.
      await tx.$executeRaw`LOCK TABLE "PaymentEvent" IN SHARE MODE`;
    } else await tx.$queryRaw`SELECT id FROM listings WHERE id=${id} FOR UPDATE`;
    acquired.resolve(); await release.promise;
  }, { timeout: 15000 });
  await acquired.promise;
  let completed = 0;
  const results = Promise.allSettled(operations.map(fn => fn().finally(() => { completed++; })));
  try { await waitForBlocked(operations.length, () => completed); }
  finally { release.resolve(); await lock; }
  return results;
}

test('real catalog: foreign keys, NOT VALID, expression uniqueness and indexes are installed', async () => {
  const rows = await gateway.$queryRaw`SELECT conname, convalidated FROM pg_constraint WHERE connamespace='public'::regnamespace`;
  for (const name of ['PaymentRecord_booking_id_fkey','booking_participants_positive','availability_capacity_valid']) {
    assert.equal(rows.find(r=>r.conname===name)?.convalidated, false);
  }
  const indexes = await gateway.$queryRaw`SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public'`;
  assert.match(indexes.find(i=>i.indexname==='listing_availability_listing_day_key').indexdef,/UNIQUE.*date.*date/);
  assert.ok(indexes.some(i=>i.indexname==='idx_bookings_listing_date'));
  await assert.rejects(gateway.paymentRecord.create({ data: { booking_id:'missing',provider_id:'p05-provider' } }), { code:'P2003' });
  const id=await listing();
  await assert.rejects(gateway.listing_availability.create({data:{ listing_id:id,date:new Date(`${date}T12:00:00Z`),spots_total:1,spots_available:1 }}), {code:'P2002'});
});

test('reconstructed schema supports every existing Prisma model without missing columns', async () => {
  for (const model of Prisma.dmmf.datamodel.models) {
    const accessor=model.name[0].toLowerCase()+model.name.slice(1);
    await gateway[accessor].findFirst(); // Exercise generated column selections, do not log row values.
  }
});

test('two Gateway-like connections: real FOR UPDATE serializes purchase of the last spot', async () => {
  const id=await listing();
  const results=await contended(id,[()=>create(gateway,id),()=>create(hub,id)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(results.find(r=>r.status==='rejected').reason.getStatus(),409);
  assert.equal(await gateway.bookings.count({where:{listing_id:id}}),1); assert.equal(await remaining(id),0);
});

test('Gateway + Provider Hub use the same real lock protocol for create versus cancel', async () => {
  for (const file of ['apps/gateway/src/controllers/bookings.controller.ts','services/provider-hub/src/controllers/bookings.controller.ts']) {
    assert.match(fs.readFileSync(file,'utf8'),/createCapacityBooking/); assert.match(fs.readFileSync(file,'utf8'),/updateCapacityBooking/);
  }
  const id=await listing(), {created:b}=await create(gateway,id);
  const results=await contended(id,[()=>updateCapacityBooking(hub,b.id,{status:'cancelled'}),()=>create(gateway,id)]);
  assert.equal(results[0].status,'fulfilled');
  const active=await observer.bookings.aggregate({where:{listing_id:id,inventory_state:'held'},_sum:{num_people:true}});
  assert.ok((active._sum.num_people||0)<=1); assert.equal(await remaining(id),1-(active._sum.num_people||0));
});

test('two checkout preparations persist one immutable ledger and idempotency identity', async () => {
  const id=await listing(), {created:b}=await create(gateway,id);
  const results=await contended(id,[()=>preparePayment(gateway,b.id,'checkout',parameters),()=>preparePayment(hub,b.id,'checkout',parameters)]);
  assert.equal(results[0].status,'fulfilled'); assert.equal(results[1].status,'fulfilled');
  assert.equal(results[0].value.id,results[1].value.id); assert.equal(await gateway.paymentRecord.count({where:{booking_id:b.id}}),1);
  await assert.rejects(preparePayment(hub,b.id,'intent',parameters));
});

test('concurrent duplicate webhook: durable event and one final financial state', async () => {
  const {id,booking:b,payment:p}=await reserved(); const event=`evt_duplicate_${++serial}`;
  const results=await contended(id,[()=>settle(gateway,b,p,'succeeded',event),()=>settle(hub,b,p,'succeeded',event)],true);
  fs.writeFileSync(`logs/p05-duplicate-${database}.json`, JSON.stringify(results.map(r => ({ status:r.status, code:r.reason?.code, meta:r.reason?.meta })),null,2));
  for(const r of results) assert.equal(r.status,'fulfilled',r.reason?.code);
  assert.equal((await booking(b.id)).status,'confirmed'); assert.equal((await payment(b.id)).status,'succeeded');
  const e=await observer.paymentEvent.findUnique({where:{id:event}}); assert.equal(e.status,'processed'); assert.ok(e.processed_at);
  assert.equal(await remaining(id),0); assert.equal(await observer.paymentEvent.count({where:{id:event}}),1);
});

test('failed durable event can retry successfully; exists does not mean processed', async () => {
  const {booking:b,payment:p}=await reserved(); const event=`evt_retry_${++serial}`;
  await assert.rejects(applyPaymentObservation(gateway,event,'synthetic', {...observation(b,p),currency:'INVALID'}));
  assert.equal((await observer.paymentEvent.findUnique({where:{id:event}})).status,'failed');
  await settle(hub,b,p,'succeeded',event);
  const e=await observer.paymentEvent.findUnique({where:{id:event}}); assert.equal(e.status,'processed'); assert.equal(e.attempts,2);
});

test('already-received event: concurrent processing is serialized by the real event row lock', async () => {
  const {id,booking:b,payment:p}=await reserved(); const event=`evt_received_${++serial}`;
  await gateway.paymentEvent.create({data:{id:event,type:'synthetic.succeeded',payload:observation(b,p)}});
  const results=await contended(id,[()=>settle(gateway,b,p,'succeeded',event),()=>settle(hub,b,p,'succeeded',event)]);
  for(const result of results) assert.equal(result.status,'fulfilled');
  const completed=await observer.paymentEvent.findUnique({where:{id:event}});
  assert.equal(completed.status,'processed'); assert.equal((await booking(b.id)).status,'confirmed');
  await settle(gateway,b,p,'succeeded',event);
  assert.deepEqual((await observer.paymentEvent.findUnique({where:{id:event}})).processed_at,completed.processed_at);
  assert.equal(await remaining(id),0);
});

test('legacy null amount with active reference preserves capacity during cancellation', async () => {
  const {id,booking:b,payment:p}=await reserved();
  await attachPaymentObject(gateway,p,{sessionId:`cs_synthetic_${p.id}`});
  await gateway.$transaction([
    gateway.paymentRecord.update({where:{id:p.id},data:{flow:null,amount_gross_cents:null,currency:null}}),
    gateway.bookings.update({where:{id:b.id},data:{amount_cents:null}}),
  ]);
  await updateCapacityBooking(hub,b.id,{status:'cancelled'});
  assert.equal((await booking(b.id)).status,'cancellation_pending'); assert.equal(await remaining(id),0);
  await assert.rejects(create(gateway,id));
});

test('legitimate success without available capacity records money for review without confirmation', async () => {
  const {id,booking:b,payment:p}=await reserved();
  // Model inconsistent historical occupancy explicitly, never alter runtime capacity to make it pass.
  await gateway.bookings.create({data:{listing_id:id,provider_id:'p05-provider',user_id:'p05-user',date:new Date(date),
    num_people:1,status:'pending',inventory_state:'held'}});
  await settle(hub,b,p);
  assert.equal((await booking(b.id)).status,'reconciliation_required');
  assert.equal((await payment(b.id)).status,'succeeded'); assert.equal((await payment(b.id)).resolution,'refund_required');
  assert.equal((await booking(b.id)).inventory_state,'held'); assert.equal(await remaining(id),0);
});

test('cancellation races payment success: no false confirmation, money retained for refund review', async () => {
  const {id,booking:b,payment:p}=await reserved();
  const results=await contended(id,[()=>updateCapacityBooking(gateway,b.id,{status:'cancelled'}),()=>settle(hub,b,p)]);
  for(const r of results) assert.equal(r.status,'fulfilled');
  assert.equal((await booking(b.id)).status,'reconciliation_required');
  assert.equal((await payment(b.id)).status,'succeeded'); assert.equal((await payment(b.id)).resolution,'refund_required');
  assert.equal(await remaining(id),1);
});

test('cancellation pending keeps inventory; verified expiration releases it', async () => {
  const {id,booking:b,payment:p}=await reserved();
  await updateCapacityBooking(gateway,b.id,{status:'cancelled'});
  assert.equal((await booking(b.id)).status,'cancellation_pending'); assert.equal(await remaining(id),0);
  await assert.rejects(create(hub,id));
  await settle(hub,b,p,'failed');
  assert.equal((await booking(b.id)).status,'cancelled'); assert.equal(await remaining(id),1);
});

test('late success after tour date still settles existing held inventory', async () => {
  const {id,booking:b,payment:p}=await reserved(); const past=new Date('2000-01-01T00:00:00Z');
  await gateway.$transaction([gateway.bookings.update({where:{id:b.id},data:{date:past}}),
    gateway.listing_availability.update({where:{id:`${id}-slot`},data:{date:past}})]);
  await settle(hub,b,p); assert.equal((await booking(b.id)).status,'confirmed'); assert.equal(await remaining(id),0);
});

test('out-of-order failure cannot undo paid; partial then full refund closes consistently', async () => {
  const {id,booking:b,payment:p}=await reserved();
  await settle(gateway,b,p); await settle(hub,b,p,'failed');
  assert.equal((await payment(b.id)).status,'succeeded'); assert.equal((await booking(b.id)).status,'confirmed');
  await settle(gateway,b,p,'partial_refund'); assert.equal(await remaining(id),0);
  await settle(hub,b,p,'refunded'); await settle(gateway,b,p);
  assert.equal((await booking(b.id)).status,'cancelled'); assert.equal((await payment(b.id)).status,'refunded'); assert.equal(await remaining(id),1);
});

test('free tour uses real inventory with no PaymentRecord', async () => {
  const {id,booking:b}=await reserved(1,0); assert.equal(b.status,'confirmed');
  assert.equal(await payment(b.id),null); await assert.rejects(create(hub,id)); assert.equal(await remaining(id),0);
});

test('same external session cannot be attached concurrently to different bookings/listings', async () => {
  const a=await reserved(), b=await reserved(); const sessionId=`cs_synthetic_shared_${++serial}`;
  const results=await Promise.allSettled([attachPaymentObject(gateway,a.payment,{sessionId}),attachPaymentObject(hub,b.payment,{sessionId})]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  assert.equal(await observer.paymentRecord.count({where:{stripe_checkout_session_id:sessionId}}),1);
  assert.equal(await observer.bookings.count({where:{checkout_session_id:sessionId}}),1);
});

test('transaction rollback undoes booking state and ledger writes together', async () => {
  const {booking:b,payment:p}=await reserved();
  await assert.rejects(withPaymentBooking(gateway,b.id,async tx=>{
    await tx.bookings.update({where:{id:b.id},data:{status:'cancelled'}});
    await tx.paymentRecord.update({where:{id:p.id},data:{status:'failed'}});
    throw new Error('synthetic rollback');
  }),/synthetic rollback/);
  assert.equal((await booking(b.id)).status,'payment_pending'); assert.equal((await payment(b.id)).status,'pending');
});

test('PostgreSQL detects an intentionally inverted lock order and rolls back one transaction', async () => {
  const a=await listing(), b=await listing(), first=deferred(), second=deferred();
  const lock=async(db,x,y,mine,other)=>db.$transaction(async tx=>{
    await tx.$queryRaw`SELECT id FROM listings WHERE id=${x} FOR UPDATE`;
    mine.resolve(); await other.promise;
    await tx.$queryRaw`SELECT id FROM listings WHERE id=${y} FOR UPDATE`;
  },{timeout:10000});
  const results=await Promise.allSettled([lock(gateway,a,b,first,second),lock(hub,b,a,second,first)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  const error=results.find(r=>r.status==='rejected').reason;
  assert.ok(error.code==='P2034'||error.meta?.code==='40P01',`expected deadlock, got ${error.code}`);
  await create(gateway,a); await create(hub,b); // Explicit subsequent retry can proceed after locks release.
});

test('backend connection loss before commit rolls back writes; reconnect can investigate/retry', async () => {
  const {booking:b,payment:p}=await reserved(), ready=deferred(), release=deferred(); let pid;
  const operation=withPaymentBooking(gateway,b.id,async tx=>{
    [{pid}]=await tx.$queryRaw`SELECT pg_backend_pid() AS pid`;
    await tx.bookings.update({where:{id:b.id},data:{status:'cancelled'}});
    await tx.paymentRecord.update({where:{id:p.id},data:{status:'failed'}});
    ready.resolve(); await release.promise;
  });
  const outcome=Promise.allSettled([operation]); await ready.promise;
  const [terminated]=await observer.$queryRaw`SELECT pg_terminate_backend(pid) AS terminated FROM pg_stat_activity
    WHERE pid=${pid} AND datname=current_database() AND usename=current_user`;
  assert.equal(terminated.terminated,true); release.resolve(); assert.equal((await outcome)[0].status,'rejected');
  assert.equal((await booking(b.id)).status,'payment_pending'); assert.equal((await payment(b.id)).status,'pending');
  await settle(hub,b,p); assert.equal((await booking(b.id)).status,'confirmed');
});

test('disconnect after successful commit does not erase the persisted outcome', async () => {
  const {booking:b,payment:p}=await reserved(); const event=`evt_disconnect_${++serial}`;
  await settle(hub,b,p,'succeeded',event); await hub.$disconnect();
  assert.equal((await booking(b.id)).status,'confirmed');
  await settle(gateway,b,p,'succeeded',event);
  assert.equal((await observer.paymentEvent.findUnique({where:{id:event}})).status,'processed');
});
