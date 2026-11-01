import { ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { createWebSession, credentialHash, databaseNow, selectedWebFlow, sessionTransaction, resolveSession } from '@wadatrip/common/sessions';
import { appendCookie, bootstrapSecrets, csrfFor, expireCookie, flowCookieName, requireWebRequest, sessionCookieName, verifyCsrf, webCookies, webReference } from '@wadatrip/common/web-security';
import { safeUser } from '@wadatrip/common/public-data';
import { reserveAuthAttempt } from './auth-rate-limit.service';

const contexts=new WeakMap<object,any>(),issued=new WeakMap<object,any>();
export const webAuthContext=(req:any)=>contexts.get(req);
export async function prepareWebAuth(db:any,req:any) {
  requireWebRequest(req,true);const selected=await selectedWebFlow(db,req),ref=webReference(req),now=await databaseNow(db);
  if(!selected.row||!selected.cookie||selected.row.id!==ref.id||selected.row.generation!==ref.generation||selected.row.revoked_at||+selected.row.expires_at<=+now)throw new ConflictException('Sign-in context changed. Bootstrap again.');
  verifyCsrf(req,selected.row);contexts.set(req,{...selected,flow:{token:selected.cookie.value,generation:ref.generation}});
}
export async function webCredential(tx:any,req:any,user:any,method:any,verified:boolean,proofAt:Date|null) {
  const context=contexts.get(req);if(!context)throw new ForbiddenException('A verified browser flow is required');
  const result=await createWebSession(tx,user.id,method,verified,proofAt,context.flow);
  const row=await tx.auth_sessions.findUnique({where:{id:result.session.id}});
  const others=context.jar.flows.filter((c:any)=>c.id!==row.id);
  if(others.length)await tx.auth_sessions.updateMany({where:{kind:'web',id:{in:others.map((c:any)=>c.id)},flow_hash:{in:others.map((c:any)=>credentialHash(c.value))},revoked_at:null},data:{revoked_at:await databaseNow(tx),revocation_reason:'logout',generation:{increment:1}}});
  issued.set(req,{...result,row});
  return{user:safeUser(result.user),session:result.session,csrf_token:csrfFor(row),session_version:`${row.id}:${row.generation}`};
}
export function completeWebAuth(req:any,res:any) {
  const result=issued.get(req);if(!result)throw new UnauthorizedException('No browser session was issued');
  appendCookie(res,sessionCookieName(result.row.id,result.row.generation),result.credential,Math.min(28800,(+result.row.expires_at-Date.now())/1000));
  const jar=webCookies(req);
  for(const c of jar.sessions)if(c.id!==result.row.id||c.generation!==result.row.generation)expireCookie(res,c.name);
  for(const c of jar.flows)if(c.id!==result.row.id)expireCookie(res,c.name);
  issued.delete(req);
}
async function nonceRow(tx:any,nonce:any,cancel=false) {
  const {id,token}=bootstrapSecrets(nonce);await tx.$queryRaw`SELECT 1 AS locked FROM pg_advisory_xact_lock(hashtextextended(${`web-bootstrap:${id}`},0))`;
  const now=await databaseNow(tx);let row=await tx.auth_sessions.findUnique({where:{id}});
  if(!row)row=await tx.auth_sessions.create({data:{id,kind:'web',flow_hash:credentialHash(token),created_at:now,last_seen_at:now,expires_at:new Date(+now+1800000),...(cancel?{revoked_at:now,revocation_reason:'logout'}:{})}});
  else if(cancel&&!row.revoked_at)row=await tx.auth_sessions.update({where:{id},data:{revoked_at:now,revocation_reason:'logout',generation:{increment:1}}});
  return{row,token,now};
}
export async function bootstrapWeb(db:any,req:any,res:any,nonce:any) {
  requireWebRequest(req,true);res.setHeader('Cache-Control','no-store');
  let selected=await selectedWebFlow(db,req),now=await databaseNow(db);
  if(!selected.row||selected.row.revoked_at||+selected.row.expires_at<=+now){
    bootstrapSecrets(nonce);await reserveAuthAttempt(db,'flow',null,req);
    const fresh=await sessionTransaction(db,tx=>nonceRow(tx,nonce));
    if(fresh.row.revoked_at||+fresh.row.expires_at<=+fresh.now)throw new ConflictException('Bootstrap was cancelled. Start again.');
    appendCookie(res,flowCookieName(fresh.row.id),fresh.token,28800);
    selected={jar:selected.jar,row:fresh.row,cookie:{id:fresh.row.id,value:fresh.token,name:flowCookieName(fresh.row.id)}};
  }
  const row=selected.row;let user:any=null,session:any={id:row.id,generation:row.generation,kind:'web',expires_at:row.expires_at.toISOString()};
  const primary=selected.jar.sessions.find(c=>c.id===row.id&&c.generation===row.generation);
  if(row.user_id&&primary){
    const saved=req.headers['x-session-version'];req.headers['x-session-version']=`${row.id}:${row.generation}`;
    const savedMethod=req.method;req.method='GET';
    try{const active=await resolveSession(db,req,{touch:false});user=safeUser(active.user);}
    catch(error:any){if(error.getStatus?.()!==401)throw error;}
    finally{req.method=savedMethod;if(saved===undefined)delete req.headers['x-session-version'];else req.headers['x-session-version']=saved;}
  }
  // Clean names observed in this request only; a delayed response cannot clear a
  // newer generation's distinct cookie name. Never fall back to an older flow.
  for(const c of selected.jar.sessions)if(c.id!==row.id||c.generation!==row.generation)expireCookie(res,c.name);
  for(const c of selected.jar.flows)if(c.id!==row.id)expireCookie(res,c.name);
  return{user,session,csrf_token:csrfFor(row),session_version:`${row.id}:${row.generation}`};
}
export async function logoutWeb(db:any,req:any,res:any) {
  requireWebRequest(req,true);const ref=webReference(req),jar=webCookies(req),cookie=jar.flows.find(c=>c.id===ref.id);
  if(!cookie)throw new UnauthorizedException('Sign-out context is unavailable');
  const result=await sessionTransaction(db,async tx=>{
    await tx.$queryRaw`SELECT id FROM auth_sessions WHERE id=${ref.id} FOR UPDATE`;
    const row=await tx.auth_sessions.findUnique({where:{id:ref.id}});
    if(!row||row.flow_hash!==credentialHash(cookie.value))throw new UnauthorizedException('Sign-out context is unavailable');
    verifyCsrf(req,row,ref.generation);
    if(!row.revoked_at&&row.generation>ref.generation+1)throw new ConflictException('A newer sign-in exists');
    if(!row.revoked_at)await tx.auth_sessions.update({where:{id:row.id},data:{revoked_at:await databaseNow(tx),revocation_reason:'logout',generation:{increment:1}}});
    return{ok:true};
  });
  expireCookie(res,sessionCookieName(ref.id,ref.generation));expireCookie(res,sessionCookieName(ref.id,ref.generation+1));return result;
}
export async function cancelBootstrap(db:any,req:any,res:any,nonce:any){
  requireWebRequest(req,true);bootstrapSecrets(nonce);res.setHeader('Cache-Control','no-store');
  const {id}=bootstrapSecrets(nonce),existing=await db.auth_sessions.findUnique({where:{id}});
  if(!existing)await reserveAuthAttempt(db,'flow',null,req);
  await sessionTransaction(db,tx=>nonceRow(tx,nonce,true));return{ok:true};
}
