// Explicit external Stripe TEST run. Never included in offline/unit test discovery.
// Chrome profile, CLI config, credentials and screenshots remain under ignored logs/.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { randomBytes } from 'node:crypto';
import { provision, client, verify, deploy } from './postgres-test-target.mjs';
import { bookTravelerExperience } from '../apps/web/src/services/travelerBooking.js';

if (process.argv[2] !== '--run-stripe-test') throw new Error('Explicit --run-stripe-test required');
const require=createRequire(import.meta.url);
require('reflect-metadata');
const dotenv=require('dotenv'), Stripe=require('stripe'), jwt=require('jsonwebtoken');
const { chromium }=require(path.resolve('logs/p06-browser/node_modules/playwright-core'));
const { Module }=require('@nestjs/common'), { NestFactory }=require('@nestjs/core'), express=require('express');
const ModuleLoader=require('node:module'), originalLoad=ModuleLoader._load;
const configured=dotenv.parse(fs.readFileSync('.env'));
const key=configured.STRIPE_SECRET_KEY||configured.STRIPE_SECRET;
if(!/^sk_test_/.test(key||'')) throw new Error('Live/unknown keys refused');
const stripe=new Stripe(key,{apiVersion:'2024-06-20',maxNetworkRetries:0,timeout:20000});
const run=Date.now().toString(36), dbName=`wadatrip_p05_repair_stripe_${run}`, db=client(dbName);
const report={run,mode:'stripe_test',database:dbName,status:'RUNNING',checks:{}};
const ownedBookings=new Set(), apps=[];
let cli, browser, base, currentSession;
let cliText='';
const reportFile=`logs/p06-stripe-test-${run}.json`;
const save=()=>fs.writeFileSync(reportFile,JSON.stringify(report,null,2));
const wait=async(fn,timeout=30000)=>{const deadline=Date.now()+timeout;while(Date.now()<deadline){const result=await fn();if(result)return result;await new Promise(r=>setTimeout(r,250));}throw new Error('Bounded E2E wait timed out');};
const localFetch=(route,options={})=>fetch(`${base}${route}`,options);
const date=new Date(Date.now()+7*86400000).toISOString().slice(0,10);
const load=file=>require(path.resolve('apps/gateway/dist/apps/gateway/src',file));

async function fill(page, selectors, value) {
  return wait(async()=>{
    for(const frame of page.frames()) for(const selector of selectors){
      const locator=frame.locator(selector).first();
      if(await locator.isVisible().catch(()=>false)){await locator.fill(value);return true;}
    }
    return false;
  },20000);
}

try {
  assert.equal((await stripe.balance.retrieve()).livemode,false);
  const endpoints=await stripe.webhookEndpoints.list({limit:100}).autoPagingToArray({limit:1000});
  assert.equal(endpoints.filter(e=>e.status==='enabled').length,0,'Existing webhook destinations require separate sandbox review');
  report.checks.test_mode_and_no_configured_webhook_endpoints=true;save();
  provision(dbName);await verify(db,dbName);assert.equal(deploy(dbName).status,0);
  for(const name of Object.keys(process.env)) if(/DATABASE|STRIPE|SENDGRID|REDIS|ADMIN_|PROVIDER_HUB|CHECKOUT_|GATEWAY_URL|JWT_SECRET|AUTH_JWT/.test(name)) delete process.env[name];
  process.env.NODE_ENV='test';process.env.FF_PROVIDER_HUB='false';process.env.STRIPE_SECRET_KEY=key;
  process.env.JWT_SECRET=randomBytes(32).toString('hex');
  await db.users.create({data:{id:`traveler-${run}`,email:'stripe-e2e@example.invalid',name:'Synthetic Traveler'}});
  await db.users.create({data:{id:`operator-${run}`,email:'operator-e2e@example.invalid',name:'Synthetic Operator'}});
  await db.providers.create({data:{id:`provider-${run}`,user_id:`operator-${run}`,type:'guide',name:'Synthetic Provider',email:'operator-e2e@example.invalid',languages:['en'],base_city:'Test',country_code:'ZZ'}});
  const listingId=`listing-${run}`;
  await db.listings.create({data:{id:listingId,provider_id:`provider-${run}`,title:'Wadatrip isolated Stripe TEST experience',category:'tour',city:'Test',country_code:'ZZ',tags:[],status:'published',price_from:120}});
  await db.listing_availability.create({data:{listing_id:listingId,date:new Date(date),spots_total:2,spots_available:2}});
  ModuleLoader._load=function(request,...args){if(request==='@wadatrip/db')return {getPrisma:()=>db};return originalLoad.call(this,request,...args);};
  class TestModule {}
  Module({controllers:[load('controllers/bookings.controller.js').BookingsController,load('controllers/payments.controller.js').PaymentsController,load('controllers/webhooks.controller.js').WebhooksController]})(TestModule);
  const app=await NestFactory.create(TestModule,{logger:false,abortOnError:false,bodyParser:false});apps.push(app);
  app.use('/webhooks/stripe',express.raw({type:'application/json'}));
  app.use('/webhooks/stripe',(req,res,next)=>{
    try {const event=JSON.parse(req.body.toString());
      // Do not ingest unrelated account activity into the disposable DB.
      if(event.livemode!==false||!ownedBookings.has(event.data?.object?.metadata?.booking_id))return res.sendStatus(200);
      next();
    }catch {res.sendStatus(400);}
  });
  app.use(express.json());
  app.getHttpAdapter().get('/checkout/success',(_req,res)=>res.send('Wadatrip TEST return received. Confirmation is verified against PostgreSQL.'));
  app.getHttpAdapter().get('/checkout/cancel',(_req,res)=>res.send('Wadatrip TEST checkout return. Cancellation is verified by the backend.'));
  await app.listen(0,'127.0.0.1');base=`http://127.0.0.1:${app.getHttpServer().address().port}`;
  process.env.CHECKOUT_SUCCESS_URL=`${base}/checkout/success`;process.env.CHECKOUT_CANCEL_URL=`${base}/checkout/cancel`;
  const cliEnv={...process.env,STRIPE_API_KEY:key,STRIPE_DEVICE_NAME:`wadatrip-isolated-${run}`};
  cli=spawn('C:/stripe/stripe.exe',['--config',path.resolve(`logs/p06-stripe-${run}.toml`),'listen','--skip-update',
    '--events','checkout.session.completed,checkout.session.expired,payment_intent.succeeded,payment_intent.payment_failed',
    '--forward-to',`${base}/webhooks/stripe`],{env:cliEnv,windowsHide:true,stdio:['ignore','pipe','pipe']});
  const capture=chunk=>{cliText=(cliText+chunk.toString()).slice(-16000);};
  cli.stdout.on('data',capture);cli.stderr.on('data',capture);
  cli.on('error',()=>{report.cli_start_failed=true;});
  process.env.STRIPE_WEBHOOK_SECRET=await wait(()=>{
    if(cli.exitCode!==null) throw new Error('Stripe CLI exited before readiness');
    return cliText.match(/whsec_[A-Za-z0-9]+/)?.[0];
  });
  const travelerToken=jwt.sign({sub:`traveler-${run}`,email:'stripe-e2e@example.invalid',email_verified:true},process.env.JWT_SECRET,{expiresIn:'20m'});
  const session={user:{id:`traveler-${run}`},token:travelerToken,logout:()=>{throw new Error('Unexpected auth expiration');}};
  // Register only DB-created IDs before a checkout can create external events.
  const originalFetch=global.fetch;
  global.fetch=async(url,options)=>{
    const response=await originalFetch(url,options);
    if(url===`${base}/bookings`&&response.ok){const b=await response.clone().json();ownedBookings.add(b.id);}
    return response;
  };
  let created;
  try {created=await bookTravelerExperience({apiBase:base,getSession:()=>session,booking:{listing_id:listingId,date,num_people:1,price:1,currency:'EUR'}});}
  finally {global.fetch=originalFetch;}
  const record=await db.paymentRecord.findUnique({where:{booking_id:created.booking.id}});
  currentSession=record.stripe_checkout_session_id;
  const checkout=await stripe.checkout.sessions.retrieve(currentSession);
  assert.equal(checkout.livemode,false);assert.equal(checkout.amount_total,12000);assert.equal(checkout.currency,'usd');
  assert.equal(checkout.metadata.booking_id,created.booking.id);assert.equal(checkout.metadata.payment_record_id,record.id);
  assert.equal(new URL(created.checkoutUrl).hostname,'checkout.stripe.com');
  report.booking_id=created.booking.id;report.payment_record_id=record.id;report.checkout_session_id=currentSession;
  report.checks.canonical_checkout_120_usd=true;save();
  browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
  const context=await browser.newContext();const page=await context.newPage();
  await page.goto(created.checkoutUrl,{waitUntil:'domcontentloaded',timeout:60000});
  await fill(page,['input#email','input[name="email"]'],'stripe-e2e@example.invalid');
  await fill(page,['input[name="cardNumber"]','input#cardNumber','input[autocomplete="cc-number"]'],'4242424242424242');
  await fill(page,['input[name="cardExpiry"]','input#cardExpiry','input[autocomplete="cc-exp"]'],'12/35');
  await fill(page,['input[name="cardCvc"]','input#cardCvc','input[autocomplete="cc-csc"]'],'123');
  for(const frame of page.frames()){
    const name=frame.locator('input#billingName,input[name="billingName"],input[autocomplete="cc-name"]').first();
    if(await name.isVisible().catch(()=>false))await name.fill('Synthetic Traveler');
    const postal=frame.locator('input#billingPostalCode,input[name="billingPostalCode"]').first();
    if(await postal.isVisible().catch(()=>false))await postal.fill('94107');
    // Exercise card checkout without enrolling the synthetic traveler in Link.
    const saveInfo=frame.locator('input#enableStripePass');
    if(await saveInfo.isVisible().catch(()=>false))await saveInfo.uncheck();
  }
  const pay=page.locator('button.SubmitButton,button[type="submit"]').last();await pay.click();
  await wait(async()=>{
    const s=await stripe.checkout.sessions.retrieve(currentSession);assert.equal(s.livemode,false);
    return s.payment_status==='paid';
  },60000);
  const paid=await wait(async()=>{
    const b=await db.bookings.findUnique({where:{id:created.booking.id},include:{payment:true}});
    return b.status==='confirmed'&&b.payment?.status==='succeeded'?b:false;
  },45000);
  const events=await db.paymentEvent.findMany({where:{booking_id:paid.id,status:'processed'}});
  assert.ok(events.some(e=>e.id.startsWith('evt_')),'A real Stripe event must commit confirmation');
  assert.equal(paid.inventory_state,'held');assert.equal(paid.amount_cents,12000);
  assert.equal((await db.listing_availability.findFirst({where:{listing_id:listingId}})).spots_available,1);
  report.checks.hosted_checkout_paid_in_test=true;report.checks.real_signed_webhook_confirmed_booking=true;
  report.checks.inventory_and_ledger_consistent=true;report.payment_intent_id=paid.payment_intent_id;
  report.processed_event_ids=events.map(e=>e.id);save();
  const replay=await stripe.events.retrieve(events.find(e=>e.type==='checkout.session.completed')?.id||events[0].id);
  assert.equal(replay.livemode,false);const body=JSON.stringify(replay);
  const signature=stripe.webhooks.generateTestHeaderString({payload:body,secret:process.env.STRIPE_WEBHOOK_SECRET});
  const replies=await Promise.all([1,2].map(()=>localFetch('/webhooks/stripe',{method:'POST',headers:{'Content-Type':'application/json','stripe-signature':signature},body})));
  assert.ok(replies.every(r=>r.ok));assert.equal(await db.paymentRecord.count({where:{booking_id:paid.id}}),1);
  assert.equal((await db.bookings.findUnique({where:{id:paid.id}})).status,'confirmed');
  report.checks.duplicate_signed_replay_safe=true;report.status='PASS';
}catch(error){
  report.status='FAIL';report.error={name:error.name,code:error.code||null,type:error.type||null,
    message:String(error.message||'').replaceAll(key||'no-key','[redacted]').replace(/(?:whsec_|sk_test_|pk_test_)[A-Za-z0-9_]+/g,'[redacted]').replace(/https:\/\/checkout\.stripe\.com\/\S+/g,'[checkout-url-redacted]')};
  if(browser){const page=browser.contexts()[0]?.pages()[0];if(page){
    report.browser_fields=await Promise.all(page.frames().map(async f=>({inputs:await f.locator('input').evaluateAll(nodes=>nodes.map(n=>({name:n.name,id:n.id,type:n.type,placeholder:n.placeholder}))).catch(()=>[])})));
    await page.screenshot({path:`logs/p06-failure-${run}.png`,fullPage:true}).catch(()=>{});
  }}
  process.exitCode=1;
}finally{
  if(currentSession&&report.status!=='PASS'){
    try {const s=await stripe.checkout.sessions.retrieve(currentSession);if(s.livemode===false&&s.status==='open'){await stripe.checkout.sessions.expire(s.id);report.unfinished_test_checkout_expired=true;}}
    catch {report.test_checkout_cleanup_requires_review=true;}
  }
  if(browser)await browser.close();if(cli)cli.kill();await Promise.all(apps.map(a=>a.close()));await db.$disconnect();
  ModuleLoader._load=originalLoad;report.finished_at=new Date().toISOString();save();
  console.log(JSON.stringify(report,null,2));
}
