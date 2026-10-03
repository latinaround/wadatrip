// API and email delivery are entirely synthetic. Only local application assets are served.
const assert=require('node:assert/strict');
const { chromium }=require('../logs/p06-browser/node_modules/playwright-core');
const origin=new URL(process.argv[2]||'http://127.0.0.1:4173').origin;
if (new URL(origin).hostname !== '127.0.0.1') throw Error('Local frontend only');
const listing={id:'csyntheticrequestlisting0001',title:'Synthetic Walk',city:'Lima',country_code:'PE',category:'tour',status:'published',price_from:120,currency:'USD',provider_id:'synthetic-provider',provider_name:'Synthetic Host'};
const future=new Date(Date.now()+7*86400000).toISOString().slice(0,10);
async function main(){
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 let passed=0;
 async function run(name,fn){await fn();passed++;console.log('PASS: '+name);}
 try{
  const context=await browser.newContext({viewport:{width:390,height:844}});
  let items=[],fail=false,available=false;const calls=[];
  await context.route('**/*',async route=>{
   const request=route.request(),url=new URL(request.url());
   if(!['fetch','xhr'].includes(request.resourceType())) return url.origin===origin?route.continue():route.abort();
   calls.push({path:url.pathname,method:request.method(),body:request.postDataJSON(),authorization:request.headers().authorization});
   let body={items:[]};
   if(url.pathname==='/auth/me')body={id:'synthetic-traveler',email:'synthetic@example.invalid',name:'Synthetic User',role:'traveler'};
   if(url.pathname==='/providers/me')body={id:'synthetic-provider',type:'operator',name:'Synthetic Host',email:'synthetic@example.invalid',languages:['en'],base_city:'Lima',country_code:'PE',status:'approved'};
   if(url.pathname==='/listings/search')body={items:[listing]};
   if(url.pathname===`/listings/${listing.id}`)body=listing;
   if(url.pathname.endsWith('/availability'))body={items:available?[{date:future,spots_available:10}]:[]};
   if(url.pathname==='/tour-date-requests/status')body={enabled:true};
   if(url.pathname==='/tour-date-requests'&&request.method()==='GET')body={items};
   if(url.pathname==='/tour-date-requests'&&request.method()==='POST'){
    if(fail)return route.fulfill({status:503,contentType:'application/json',body:'{"message":"Synthetic save failed"}'});
    const payload=request.postDataJSON();body={id:'synthetic-request',listing_id:listing.id,requested_date:payload.date,num_people:payload.num_people,status:'requested',listing:{title:listing.title}};items=[body];
   }
   if(url.pathname.endsWith('/respond')){items=[{...items[0],status:'available',response_date:request.postDataJSON().date}];body=items[0];}
   if(url.pathname.endsWith('/cancel')){items=[{...items[0],status:'cancelled'}];body=items[0];}
   if(url.pathname.endsWith('/booking-terms'))body={terms:null};
   return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  });
  const page=await context.newPage();page.setDefaultTimeout(5000);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const panel=()=>page.getByRole('region',{name:'Request a date',exact:true});
  await run('Anonymous inquiry opens existing sign-in dialog without POST',async()=>{
   await page.goto(`${origin}/tours/${listing.id}`);await panel().getByRole('button',{name:'Sign in to request a date'}).click();await page.getByRole('dialog').waitFor();
   assert.equal(calls.filter(call=>call.method==='POST').length,0);
  });
  await page.evaluate(()=>localStorage.setItem('wadatrip_token','synthetic-ui-request-token'));
  await run('Traveler requests an unlisted date from a mobile calendar without booking or payment',async()=>{
   await page.goto(`${origin}/tours/${listing.id}`);
   await panel().getByLabel('Requested date',{exact:true}).click();
   const box=await page.locator('[data-slot="popover-content"]').boundingBox();assert.ok(box.x>=0&&box.x+box.width<=390);
   await page.locator('[data-slot="popover-content"] button[name="day"]:not(:disabled)').first().click();
   await panel().getByLabel('Travelers',{exact:true}).fill('2');await panel().getByRole('button',{name:'Send date request'}).click();
   await panel().getByText(/Request saved\. Await/).waitFor();
   const sent=calls.filter(call=>call.path==='/tour-date-requests'&&call.method==='POST').at(-1);
   assert.equal(sent.authorization,'Bearer synthetic-ui-request-token');assert.deepEqual(Object.keys(sent.body).sort(),['date','listing_id','num_people']);
   assert.equal(calls.some(call=>call.path==='/bookings'||call.path.includes('/payments')),false);
  });
  await run('Server failure never displays a fictitious saved request',async()=>{
   fail=true;await panel().getByRole('button',{name:'Send date request'}).click();await panel().getByRole('alert').getByText('Synthetic save failed').waitFor();
   assert.equal(await panel().getByText(/Request saved\. Await/).count(),0);fail=false;
  });
  await run('Operator cannot offer nonexistent availability and can manage real departures',async()=>{
   await page.goto(`${origin}/operator/tours/new`);const inbox=page.getByRole('region',{name:'Date requests',exact:true});
   await inbox.getByRole('button',{name:'Load real departures'}).click();await inbox.getByText(/No departure has enough spots/).waitFor();
   assert.equal(await inbox.getByRole('button',{name:'Offer this departure'}).count(),0);
   assert.match(await inbox.getByRole('link',{name:'Manage this tour and its availability'}).getAttribute('href'),/edit=csyntheticrequestlisting0001/);
  });
  await run('Operator offers a real date; traveler sees an offer explicitly not reserved',async()=>{
   available=true;const inbox=page.getByRole('region',{name:'Date requests',exact:true});await inbox.getByRole('button',{name:'Load real departures'}).click();
   await inbox.getByRole('button',{name:'Offer this departure'}).click();await inbox.getByText('Host offered a departure',{exact:true}).waitFor();
   await page.goto(`${origin}/tours/${listing.id}`);await panel().getByText('Host offered a departure',{exact:true}).waitFor();await panel().getByText(/Not reserved\. Current price/).waitFor();
   assert.equal(await panel().getByRole('link',{name:'View tour to book'}).getAttribute('href'),`/tours/${listing.id}`);
  });
  await run('Traveler can close the inquiry without touching any booking',async()=>{
   await panel().getByRole('button',{name:'Close request',exact:true}).click();await panel().getByText('Request closed',{exact:true}).waitFor();
   assert.equal(calls.some(call=>call.path==='/bookings'||call.path.includes('/payments')),false);
  });
  assert.deepEqual(errors,[]);console.log(`DATE REQUEST UI: ${passed}/${passed} passed; synthetic API only`);
 }finally{await browser.close();}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
