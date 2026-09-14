// Real traveler helper -> Nest HTTP controllers -> Prisma/PostgreSQL.
// Stripe SDK uses ONLY a loopback HTTP simulator. This is not Stripe Test E2E.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import path from 'node:path';
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
import { provision, client, verify, deploy, sql } from './postgres-test-target.mjs';
import { bookTravelerExperience } from '../apps/web/src/services/travelerBooking.js';
const require=createRequire(import.meta.url);
require('reflect-metadata');
const ModuleLoader=require('node:module'), originalLoad=ModuleLoader._load;
const Stripe=require('stripe'), jwt=require('jsonwebtoken'), express=require('express');
const { Module }=require('@nestjs/common'), { NestFactory }=require('@nestjs/core');
const axios=require('axios');
const dbName=`wadatrip_p05_repair_http_${Date.now().toString(36)}`;
const db=client(dbName), hubDb=client(dbName);
const apps=[], sessions=new Map(), keys=new Map(), checkoutRequests=[];
let processor, sdk, gateway, proxyGateway, hub, loadingHub=false, serial=0, loseResponse=false;
const date=new Date(Date.now()+7*86400000).toISOString().slice(0,10);
const rawFetch=global.fetch;
const axiosGuard=axios.interceptors.request.use(config=>{
  assert.equal(new URL(config.url).hostname,'127.0.0.1'); config.proxy=false; return config;
});
global.fetch=(url,options)=>{assert.equal(new URL(url).hostname,'127.0.0.1');return rawFetch(url,options);};
for(const key of Object.keys(process.env)) if(/DATABASE|STRIPE|SENDGRID|REDIS|ADMIN_|PROVIDER_HUB|CHECKOUT_|GATEWAY_URL|INTERNAL_SERVICE_TOKEN|JWT_SECRET|AUTH_JWT/.test(key)) delete process.env[key];
process.env.NODE_ENV='test'; process.env.FF_PROVIDER_HUB='false';
process.env.JWT_SECRET=randomBytes(32).toString('hex');
process.env.INTERNAL_SERVICE_TOKEN=randomBytes(32).toString('hex');
process.env.STRIPE_SECRET_KEY=`sk_test_${randomBytes(24).toString('hex')}`;
process.env.STRIPE_WEBHOOK_SECRET=`whsec_${randomBytes(24).toString('hex')}`;
const token=id=>jwt.sign({sub:id,email:`${id}@example.invalid`,email_verified:true},process.env.JWT_SECRET,{expiresIn:'10m'});
const load=(service,file)=>require(path.resolve(service,'dist',service,'src',file));
async function app(controllers){
  class TestModule {} Module({controllers})(TestModule);
  const instance=await NestFactory.create(TestModule,{logger:false,abortOnError:false,bodyParser:false});
  instance.use('/webhooks/stripe',express.raw({type:'application/json'})); instance.use(express.json());
  await instance.listen(0,'127.0.0.1'); apps.push(instance);
  return `http://127.0.0.1:${instance.getHttpServer().address().port}`;
}
before(async()=>{
  provision(dbName); await verify(db,dbName); assert.equal(deploy(dbName).status,0);
  for(const id of ['traveler-a','traveler-b','operator']) await db.users.create({data:{id,email:`${id}@example.invalid`}});
  await db.providers.create({data:{id:'http-provider',user_id:'operator',type:'guide',name:'Synthetic',email:'operator@example.invalid',languages:['en'],base_city:'Test',country_code:'ZZ'}});
  processor=http.createServer(async(req,res)=>{
    try {
      let body=''; for await(const chunk of req) body+=chunk;
      const request=new URL(req.url,'http://127.0.0.1');
      if(req.method==='POST'&&request.pathname==='/v1/checkout/sessions'){
        const params=new URLSearchParams(body), key=req.headers['idempotency-key']; assert.ok(key);
        checkoutRequests.push({key,params:Object.fromEntries(params)});
        let session=keys.get(key);
        if(!session){
          session={id:`cs_synthetic_${++serial}`,object:'checkout.session',status:'open',payment_status:'unpaid',
            payment_intent:null,metadata:{booking_id:params.get('metadata[booking_id]'),payment_record_id:params.get('metadata[payment_record_id]')},
            amount_total:Number(params.get('line_items[0][price_data][unit_amount]')),currency:params.get('line_items[0][price_data][currency]'),
            url:'http://127.0.0.1/synthetic-checkout'};
          keys.set(key,session); sessions.set(session.id,session);
        }
        if(loseResponse){res.destroy();return;}
        res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(session)); return;
      }
      const match=request.pathname.match(/^\/v1\/checkout\/sessions\/(cs_synthetic_\d+)(\/expire)?$/);
      if(match&&sessions.has(match[1])){
        const session=sessions.get(match[1]);
        if(match[2]){assert.equal(req.method,'POST');session.status='expired';session.url=null;}
        res.setHeader('Content-Type','application/json');res.end(JSON.stringify(session));return;
      }
      res.statusCode=404;res.end(JSON.stringify({error:{message:'Unexpected synthetic processor request'}}));
    } catch {res.statusCode=500;res.end(JSON.stringify({error:{message:'Synthetic processor assertion failed'}}));}
  });
  await new Promise(resolve=>processor.listen(0,'127.0.0.1',resolve));
  sdk=new Stripe(process.env.STRIPE_SECRET_KEY,{host:'127.0.0.1',port:processor.address().port,protocol:'http',maxNetworkRetries:0,timeout:2000});
  ModuleLoader._load=function(request,...args){
    if(request==='@wadatrip/db'){const selected=loadingHub?hubDb:db;return {getPrisma:()=>selected};}
    if(request==='stripe') return function LocalStripe(){return sdk;};
    return originalLoad.call(this,request,...args);
  };
  loadingHub=true; const HubBookings=load('services/provider-hub','controllers/bookings.controller.js').BookingsController;
  hub=await app([HubBookings]); loadingHub=false;
  const GatewayBookings=load('apps/gateway','controllers/bookings.controller.js').BookingsController;
  const Payments=load('apps/gateway','controllers/payments.controller.js').PaymentsController;
  const Webhooks=load('apps/gateway','controllers/webhooks.controller.js').WebhooksController;
  gateway=await app([GatewayBookings,Payments,Webhooks]);
  process.env.CHECKOUT_SUCCESS_URL=`${gateway}/checkout/success`;process.env.CHECKOUT_CANCEL_URL=`${gateway}/checkout/cancel`;
  process.env.FF_PROVIDER_HUB='true';process.env.PROVIDER_HUB_URL=hub;
  const file=path.resolve('apps/gateway/dist/apps/gateway/src/controllers/bookings.controller.js');delete require.cache[file];
  proxyGateway=await app([require(file).BookingsController]);process.env.FF_PROVIDER_HUB='false';
});
after(async()=>{
  await Promise.all(apps.map(a=>a.close()));
  if(processor) await new Promise(resolve=>processor.close(resolve));
  await Promise.all([db.$disconnect(),hubDb.$disconnect()]);
  ModuleLoader._load=originalLoad;global.fetch=rawFetch;axios.interceptors.request.eject(axiosGuard);
});
async function listing(price=120,capacity=1){
  const id=`http-listing-${++serial}`;
  await db.listings.create({data:{id,provider_id:'http-provider',title:'Synthetic',category:'tour',city:'Test',country_code:'ZZ',tags:[],status:'published',price_from:price}});
  await db.listing_availability.create({data:{listing_id:id,date:new Date(date),spots_total:capacity,spots_available:capacity}});
  return id;
}
async function request(base,route,actor,body,extra={}){
  const response=await fetch(`${base}${route}`,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json',
    ...(actor?{Authorization:`Bearer ${token(actor)}`} : {}),...extra},...(body===undefined?{}:{body:JSON.stringify(body)})});
  return {status:response.status,data:await response.json()};
}
const payload=id=>({listing_id:id,date,num_people:1});
async function webhook(session,eventId,signature=true){
  const body=JSON.stringify({id:eventId,type:'checkout.session.completed',data:{object:{id:session.id}}});
  const headers={'Content-Type':'application/json'};
  if(signature) headers['stripe-signature']=sdk.webhooks.generateTestHeaderString({payload:body,secret:process.env.STRIPE_WEBHOOK_SECRET});
  return fetch(`${gateway}/webhooks/stripe`,{method:'POST',headers,body});
}

test('traveler helper sends JWT through real booking/checkout HTTP and stores canonical price',async()=>{
  const id=await listing();const jwtToken=token('traveler-a');
  const result=await bookTravelerExperience({apiBase:gateway,getSession:()=>({user:{id:'traveler-a'},token:jwtToken,logout:()=>assert.fail('unexpected logout')}),
    booking:{...payload(id),price:1,currency:'EUR',user_id:'traveler-b',role:'admin'}});
  const b=await db.bookings.findUnique({where:{id:result.booking.id}});assert.equal(b.user_id,'traveler-a');assert.equal(b.amount_cents,12000);assert.equal(b.currency,'usd');
  assert.equal(b.status,'payment_pending');assert.equal(result.checkoutUrl,'http://127.0.0.1/synthetic-checkout');
  const p=await db.paymentRecord.findUnique({where:{booking_id:b.id}});assert.equal(p.amount_gross_cents,12000);
  assert.equal(checkoutRequests.at(-1).params['line_items[0][price_data][unit_amount]'],'12000');
  const session=sessions.get(p.stripe_checkout_session_id);session.status='complete';session.payment_status='paid';
  const replies=await Promise.all([webhook(session,'evt_http_duplicate'),webhook(session,'evt_http_duplicate')]);
  assert.ok(replies.every(r=>r.ok));assert.equal((await db.bookings.findUnique({where:{id:b.id}})).status,'confirmed');
  assert.equal((await db.paymentEvent.findUnique({where:{id:'evt_http_duplicate'}})).status,'processed');
});

test('anonymous and another traveler cannot create/read/pay an unauthorized booking',async()=>{
  const id=await listing();const count=keys.size;
  assert.equal((await request(gateway,'/bookings',null,payload(id))).status,401);
  const created=await request(gateway,'/bookings','traveler-a',{...payload(id),price:1,currency:'EUR',user_id:'traveler-b'});
  assert.equal(created.status,201);assert.equal(created.data.amount_cents,12000);assert.equal(created.data.user_id,'traveler-a');
  assert.equal((await request(gateway,`/bookings/${created.data.id}`,'traveler-b')).status,404);
  assert.equal((await request(gateway,`/payments/bookings/${created.data.id}/checkout`,'traveler-b',{})).status,404);
  assert.equal(keys.size,count);
});

test('webhook without valid signature cannot create a durable payment event',async()=>{
  const response=await webhook({id:'cs_synthetic_missing'},'evt_unsigned',false);assert.equal(response.status,401);
  assert.equal(await db.paymentEvent.findUnique({where:{id:'evt_unsigned'}}),null);
});

test('free tour completes traveler helper without calling the processor',async()=>{
  const id=await listing(0);const calls=checkoutRequests.length;const jwtToken=token('traveler-a');
  const result=await bookTravelerExperience({apiBase:gateway,getSession:()=>({user:{id:'traveler-a'},token:jwtToken,logout:()=>{}}),booking:payload(id)});
  assert.equal(result.booking.status,'confirmed');assert.equal(result.booking.amount_cents,0);assert.equal(result.checkoutUrl,undefined);
  assert.equal(checkoutRequests.length,calls);
});

test('Gateway and Gateway-through-Provider-Hub HTTP requests compete safely for the last seat',async()=>{
  const id=await listing();const results=await Promise.all([request(gateway,'/bookings','traveler-a',payload(id)),request(proxyGateway,'/bookings','traveler-b',payload(id))]);
  assert.deepEqual(results.map(r=>r.status).sort(),[201,409]);assert.equal(await db.bookings.count({where:{listing_id:id}}),1);
});

test('lost processor creation response retries the same payment identity without another session',async()=>{
  const id=await listing();const {data:b}=await request(gateway,'/bookings','traveler-a',payload(id));const count=keys.size;
  // Keep the fault active through SDK transport retries, then restore connectivity.
  loseResponse=true;let failed;
  try {failed=await request(gateway,`/payments/bookings/${b.id}/checkout`,'traveler-a',{});} finally {loseResponse=false;}
  assert.equal(failed.status,500);
  const pending=await db.paymentRecord.findUnique({where:{booking_id:b.id}});assert.equal(pending.status,'pending');assert.equal(pending.stripe_checkout_session_id,null);
  const retry=await request(gateway,`/payments/bookings/${b.id}/checkout`,'traveler-a',{});assert.equal(retry.status,201);
  assert.equal(keys.size,count+1);assert.equal(checkoutRequests.at(-1).key,checkoutRequests.at(-2).key);
  assert.deepEqual(checkoutRequests.at(-1).params,checkoutRequests.at(-2).params);
  assert.equal((await db.paymentRecord.findUnique({where:{booking_id:b.id}})).id,pending.id);
});

test('operator cancellation expires the associated checkout before releasing inventory',async()=>{
  const id=await listing();const {data:b}=await request(gateway,'/bookings','traveler-a',payload(id));
  assert.equal((await request(gateway,`/payments/bookings/${b.id}/checkout`,'traveler-a',{})).status,201);
  const response=await request(gateway,`/bookings/${b.id}/status`,'operator',{status:'cancelled'});assert.equal(response.status,201);assert.equal(response.data.status,'cancelled');
  const p=await db.paymentRecord.findUnique({where:{booking_id:b.id}});assert.equal(p.status,'failed');assert.equal(sessions.get(p.stripe_checkout_session_id).status,'expired');
  assert.equal((await db.listing_availability.findFirst({where:{listing_id:id}})).spots_available,1);
});

test('DB connection dies after processor creation: rollback preserves hold and retry reattaches the same session',async()=>{
  const id=await listing();const {data:b}=await request(gateway,'/bookings','traveler-a',payload(id));const count=keys.size;
  // Disposable-DB fault injection only: kill this PostgreSQL session during attachment,
  // after the real SDK has received the simulator response. No Prisma methods are mocked.
  sql(dbName,`CREATE FUNCTION p05_drop_attachment_connection() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN PERFORM pg_terminate_backend(pg_backend_pid()); RETURN NEW; END $$;
    CREATE TRIGGER p05_drop_attachment BEFORE UPDATE OF stripe_checkout_session_id ON "PaymentRecord"
    FOR EACH ROW WHEN (NEW.stripe_checkout_session_id IS NOT NULL) EXECUTE FUNCTION p05_drop_attachment_connection();`);
  let failed;
  try {failed=await request(gateway,`/payments/bookings/${b.id}/checkout`,'traveler-a',{});}
  finally {sql(dbName,'DROP TRIGGER p05_drop_attachment ON "PaymentRecord"; DROP FUNCTION p05_drop_attachment_connection();');}
  assert.equal(failed.status,500);assert.equal(keys.size,count+1);
  const pending=await db.paymentRecord.findUnique({where:{booking_id:b.id}});
  assert.equal(pending.status,'pending');assert.equal(pending.stripe_checkout_session_id,null);
  const held=await db.bookings.findUnique({where:{id:b.id}});assert.equal(held.status,'payment_pending');assert.equal(held.inventory_state,'held');
  assert.equal((await db.listing_availability.findFirst({where:{listing_id:id}})).spots_available,0);
  assert.equal((await request(gateway,`/payments/bookings/${b.id}/checkout`,'traveler-a',{})).status,201);
  assert.equal(keys.size,count+1);assert.equal((await db.paymentRecord.findUnique({where:{booking_id:b.id}})).id,pending.id);
  assert.equal(checkoutRequests.at(-1).key,checkoutRequests.at(-2).key);
  assert.deepEqual(checkoutRequests.at(-1).params,checkoutRequests.at(-2).params);
});
