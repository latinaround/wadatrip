const assert=require('node:assert/strict');const{randomBytes}=require('node:crypto');
// Synthetic API for component regressions. Real cookies/authority are tested with PostgreSQL HTTPS.
exports.createUiCookieSession=(getUser,initial=null)=>{
 let user=initial,id=randomBytes(32).toString('hex'),generation=0;const csrf='c'.repeat(64);
 const payload=()=>({user:user?getUser(user):null,session:{id,generation,kind:'web',expires_at:new Date(Date.now()+3600000).toISOString()},session_version:id+':'+generation,csrf_token:csrf});
 return{identity:()=>user,select(value){user=value;id=randomBytes(32).toString('hex');generation++;},
 async bootstrap(route,before){const r=route.request();assert.equal(r.headers().authorization,undefined);if(new URL(r.url()).pathname!=='/auth/web/bootstrap')return false;assert.equal(r.headers()['x-wadatrip-web'],'1');const captured=payload();const override=await before?.(captured);await route.fulfill({status:override?.status||200,contentType:'application/json',body:JSON.stringify(override?.body||captured)}).catch(()=>{});return true;},
 validate(r){const p=new URL(r.url()).pathname;assert.equal(r.headers().authorization,undefined);if(r.headers()['x-session-version']){assert.equal(r.headers()['x-wadatrip-web'],'1');if(r.method()!=='GET')assert.equal(r.headers()['x-csrf-token'],csrf);}return user;},
 async finish(route,status,body){const p=new URL(route.request().url()).pathname;
  if(['/auth/web/login','/auth/web/register','/auth/web/verify-code'].includes(p)&&status<400){assert.ok(body?.user);user=body.user.id;generation++;body=payload();}
  if(p==='/auth/web/logout'){user=null;id=randomBytes(32).toString('hex');generation=0;body={ok:true};}
  await route.fulfill({status,contentType:'application/json',body:JSON.stringify(body)});
 },payload};
};
