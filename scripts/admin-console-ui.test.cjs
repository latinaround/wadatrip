// Local assets; every API/auth/MFA response is synthetic. No external sends.
const assert=require('node:assert/strict');
const {chromium}=require('../logs/p06-browser/node_modules/playwright-core');
const origin=new URL(process.argv[2]||'http://127.0.0.1:4176').origin;
if(new URL(origin).hostname!=='127.0.0.1')throw Error('Local frontend only');
(async()=>{
 const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
 const context=await browser.newContext({viewport:{width:1440,height:1000}});
 const calls=[],errors=[];let eligible=false,enrolled=false,expire=false,setupExpired=false,reauthRequired=false;
 let primary='synthetic-primary',now=Date.now(),proof;
 const user={id:'synthetic-admin',name:'Synthetic Admin',email:'admin@example.invalid',role:'admin'};
 await context.route('**/*',route=>{
  const r=route.request(),u=new URL(r.url());
  if(!['xhr','fetch'].includes(r.resourceType()))return u.origin===origin?route.continue():route.abort();
  calls.push({path:u.pathname,method:r.method(),headers:r.headers()});let status=200,body={items:[],total:0};
  if(u.pathname==='/auth/me')body=user;
  if(u.pathname==='/auth/request-code')body={ok:true,channel:'email'};
  if(u.pathname==='/auth/verify-code'){primary='synthetic-refreshed-primary';body={token:primary,user};}
  if(u.pathname==='/admin/session'){status=eligible?200:403;body=eligible?{admin:true,mfa_enrolled:enrolled,step_up_verified:Boolean(proof)&&!expire&&r.headers()['x-admin-proof']===proof}:{message:'No admin access'};}
  if(u.pathname==='/admin/mfa/setup'){
   if(reauthRequired){reauthRequired=false;status=403;body={message:'Inicia sesión de nuevo.',code:'ADMIN_PRIMARY_REAUTH_REQUIRED'};}
   else body={secret:'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567',issuer:'Wadatrip',expires_at:new Date(now+15*60000).toISOString()};
  }
  if(u.pathname==='/admin/mfa/verify'){
   if(setupExpired){status=403;body={message:'La configuración ha vencido.',code:'ADMIN_MFA_SETUP_EXPIRED'};}
   else{enrolled=true;proof='synthetic.'+Buffer.from(JSON.stringify({exp:Math.floor(now/1000)+900})).toString('base64url')+'.synthetic';body={proof};}
  }
  if(u.pathname==='/admin/users')body={items:[{id:'synthetic-traveler',name:'Synthetic Traveler',email:'traveler@example.invalid',role:'traveler',status:'active',created_at:new Date().toISOString(),_count:{bookings:2,tour_date_requests:1}}],total:1};
  if(u.pathname==='/admin/date-requests')body={items:[{id:'synthetic-inquiry',user_id:'synthetic-traveler',listing_id:'synthetic-listing',requested_date:'2026-10-10',status:'requested',num_people:2,listing:{title:'Synthetic tour'}}],total:1};
  if(u.pathname==='/admin/payment-issues')body={items:[{id:'synthetic-booking',status:'reconciliation_required',inventory_state:'reserved',amount_cents:null,payment:null,listing:{title:'Synthetic tour'}}],total:1};
  if(expire&&u.pathname==='/admin/users'){status=403;body={message:'Verify authenticator',code:'ADMIN_STEP_UP_REQUIRED'};}
  return route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
 });
 const page=await context.newPage();page.setDefaultTimeout(8000);page.on('pageerror',e=>errors.push(e.message));let count=0;
 await page.clock.install();
 const run=async(name,fn)=>{await fn();count++;console.log('PASS: '+name)};
 try{
  await run('Anonymous admin entry opens the existing sign-in dialog without Firebase',async()=>{
   await page.goto(origin+'/admin/users');await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();await page.getByRole('dialog').waitFor();assert.equal(calls.some(c=>c.path==='/admin/users'),false);
  });
  await page.evaluate(()=>localStorage.setItem('wadatrip_token','synthetic-primary'));
  await run('Frontend admin role does not bypass a backend access denial',async()=>{
   await page.goto(origin+'/admin/users');await page.getByText('Esta cuenta no tiene permiso de administración.',{exact:true}).waitFor();assert.equal(calls.some(c=>c.path==='/admin/users'),false);
  });
  eligible=true;
  await run('Server-expired setup clears the obsolete key and offers restart',async()=>{
   await page.getByRole('button',{name:'Volver a comprobar'}).click();await page.getByRole('button',{name:'Configurar segundo factor'}).click();await page.getByLabel('Clave de configuración').waitFor();
   setupExpired=true;await page.getByLabel('Código de la app autenticadora').fill('123456');await page.getByRole('button',{name:'Verificar y entrar'}).click();await page.getByRole('button',{name:'Reiniciar configuración',exact:true}).waitFor();
   assert.equal(await page.getByLabel('Clave de configuración').count(),0);assert.equal(calls.some(c=>c.path==='/admin/users'),false);
  });
  await run('Timed enrollment expiry removes the key and code without another click',async()=>{
   setupExpired=false;await page.getByRole('button',{name:'Reiniciar configuración',exact:true}).click();await page.getByLabel('Clave de configuración').waitFor();
   now+=16*60000;await page.clock.fastForward(16*60000);await page.getByRole('button',{name:'Reiniciar configuración',exact:true}).waitFor();assert.equal(await page.getByLabel('Clave de configuración').count(),0);assert.equal(await page.getByLabel('Código de la app autenticadora').count(),0);
  });
  await run('Restart with stale primary session requires shared email sign-in again',async()=>{
   reauthRequired=true;await page.getByRole('button',{name:'Reiniciar configuración',exact:true}).click();await page.getByRole('button',{name:'Iniciar sesión',exact:true}).waitFor();assert.equal(await page.evaluate(()=>localStorage.getItem('wadatrip_token')),null);
   await page.getByRole('button',{name:'Iniciar sesión',exact:true}).click();await page.locator('#auth-email').fill('admin@example.invalid');await page.getByRole('button',{name:'Email me a code',exact:true}).click();await page.locator('#auth-code').fill('123456');await page.getByRole('button',{name:'Continue with code',exact:true}).click();await page.getByRole('button',{name:'Configurar segundo factor'}).waitFor();
  });
  await run('Fresh setup can be completed after expired setup and primary reauthentication',async()=>{
   await page.getByRole('button',{name:'Configurar segundo factor'}).click();await page.getByLabel('Clave de configuración').waitFor();await page.getByLabel('Código de la app autenticadora').fill('123456');await page.getByRole('button',{name:'Verificar y entrar'}).click();await page.getByRole('heading',{name:'Usuarios registrados',exact:true}).waitFor();
  });
  await run('Users are fetched with shared Bearer and in-memory step-up proof',async()=>{
   await page.getByRole('cell',{name:'traveler@example.invalid',exact:true}).waitFor();const r=calls.find(c=>c.path==='/admin/users');assert.equal(r.headers.authorization,'Bearer '+primary);assert.equal(r.headers['x-admin-proof'],proof);
  });
  await run('Date requests and unknown financial amounts are visible without money actions',async()=>{
   await page.getByRole('link',{name:'Solicitudes de fechas',exact:true}).click();await page.getByRole('cell',{name:'synthetic-inquiry',exact:true}).waitFor();await page.getByRole('link',{name:'Incidencias de pagos',exact:true}).click();await page.getByRole('cell',{name:'synthetic-booking',exact:true}).waitFor();assert.ok(await page.getByRole('cell',{name:'Desconocido',exact:true}).count());assert.equal(await page.getByRole('button',{name:/reembolsar|confirmar/i}).count(),0);
  });
  await run('Timed proof expiry removes an open privileged view without another click',async()=>{
   expire=true;await page.clock.fastForward(16*60000);await page.getByLabel('Código de la app autenticadora').waitFor();assert.equal(await page.getByRole('cell',{name:'synthetic-booking',exact:true}).count(),0);
  });
  await run('Logout clears shared session and never retains privileged records',async()=>{
   await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();await page.getByRole('button',{name:'Iniciar sesión',exact:true}).waitFor();assert.equal(await page.evaluate(()=>localStorage.getItem('wadatrip_token')),null);assert.equal(calls.some(c=>c.path==='/auth/firebase'),false);
  });
  assert.deepEqual(errors,[]);console.log(`ADMIN UI: ${count}/${count} passed; synthetic APIs only`);
 }finally{await browser.close()}
})().catch(e=>{console.error(e.message);process.exitCode=1});
