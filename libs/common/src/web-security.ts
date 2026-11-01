import { BadRequestException, ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';

export function webPolicy() {
  const api = process.env.AUTH_PUBLIC_API_ORIGIN || 'https://api.wadatrip.com';
  const web = process.env.AUTH_WEB_ORIGIN || 'https://www.wadatrip.com';
  let a: URL, w: URL;
  try { a=new URL(api);w=new URL(web); } catch { throw new ServiceUnavailableException('Web authentication origin configuration is invalid'); }
  if(a.origin!==api||w.origin!==web||a.protocol!=='https:'||w.protocol!=='https:'||a.username||w.username||a.password||w.password)
    throw new ServiceUnavailableException('Web authentication requires exact HTTPS origins');
  if(process.env.NODE_ENV==='production' && (api!=='https://api.wadatrip.com'||web!=='https://www.wadatrip.com'))throw new ServiceUnavailableException('Production web authentication requires the approved same-site domains');
  const secret=process.env.AUTH_CSRF_SECRET||'';
  if(secret.length<32||secret===process.env.JWT_SECRET||secret===process.env.AUTH_RATE_LIMIT_SECRET||secret===process.env.INTERNAL_SERVICE_TOKEN)throw new ServiceUnavailableException('Independent web authentication protection is required');
  return{api,web,apiHost:a.host,secret};
}
export const flowCookieName=(id:string)=>`__Host-wada_flow_${id}`;
export const sessionCookieName=(id:string,generation:number)=>`__Host-wada_session_${id}_${generation}`;
export type WebCookies={flows:Array<{name:string;id:string;value:string}>;sessions:Array<{name:string;id:string;generation:number;value:string}>;any:boolean};
export function webCookies(req:any):WebCookies {
  const header=req?.headers?.cookie;
  if(header!==undefined&&(typeof header!=='string'||header.length>8192))throw new BadRequestException('Invalid cookie header');
  const jar:WebCookies={flows:[],sessions:[],any:false},seen=new Set<string>();
  for(const field of String(header||'').split(';')){
    const i=field.indexOf('=');if(i<0)continue;const name=field.slice(0,i).trim(),value=field.slice(i+1).trim();
    if(!name.startsWith('__Host-wada_'))continue;
    jar.any=true;if(seen.has(name))throw new BadRequestException('Duplicate session cookie');seen.add(name);
    const flow=/^__Host-wada_flow_([a-f0-9]{64})$/.exec(name),session=/^__Host-wada_session_([a-f0-9]{64})_(\d{1,9})$/.exec(name);
    if(!/^[a-f0-9]{64}$/.test(value)||(!flow&&!session))throw new BadRequestException('Invalid session cookie');
    if(flow)jar.flows.push({name,id:flow[1],value});else if(session)jar.sessions.push({name,id:session[1],generation:Number(session[2]),value});
  }
  if(jar.flows.length>8||jar.sessions.length>8)throw new BadRequestException('Too many session cookies');return jar;
}
export function requireWebRequest(req:any, json=false) {
  const policy=webPolicy();
  if(req?.headers?.authorization||req?.headers?.['x-wada-session-credential'])throw new ForbiddenException('Mixed authentication transports');
  if(req?.headers?.origin!==policy.web||req?.headers?.['x-wadatrip-web']!=='1')throw new ForbiddenException('Trusted web origin and request header are required');
  if(req?.headers?.host!==policy.apiHost)throw new ForbiddenException('Web authentication requires the configured API host');
  const socket=String(req?.socket?.remoteAddress||'').replace(/^::ffff:/,'');
  const proxy=process.env.RENDER==='true'&&Boolean(process.env.RENDER_SERVICE_ID)&&/^(?:127\.|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/.test(socket)&&req?.headers?.['x-forwarded-proto']==='https';
  if(!req?.socket?.encrypted&&!proxy)throw new ForbiddenException('HTTPS is required');
  if(req?.headers?.['sec-fetch-site']==='cross-site')throw new ForbiddenException('Cross-site authentication is not allowed');
  if(json&&!/^application\/json(?:\s*;|$)/i.test(String(req?.headers?.['content-type']||'')))throw new ForbiddenException('JSON is required');
  return policy;
}
export function csrfFor(row:any,generation=row.generation) {
  return createHmac('sha256',webPolicy().secret).update(JSON.stringify(['wada-csrf-v1',row.id,generation,row.flow_hash])).digest('hex');
}
export function webReference(req:any) {
  const value=req?.headers?.['x-session-version'];
  if(typeof value!=='string'||!/^([a-f0-9]{64}):\d{1,9}$/.test(value))throw new ForbiddenException('Session context is required');
  const [id,generation]=value.split(':');return{id,generation:Number(generation)};
}
export function verifyCsrf(req:any,row:any,generation=row.generation) {
  const value=req?.headers?.['x-csrf-token'],expected=csrfFor(row,generation);
  if(typeof value!=='string'||!/^[a-f0-9]{64}$/.test(value)||!timingSafeEqual(Buffer.from(value,'hex'),Buffer.from(expected,'hex')))throw new ForbiddenException('Invalid CSRF proof');
}
export function bootstrapSecrets(nonce:any) {
  if(typeof nonce!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/.test(nonce))throw new BadRequestException('Invalid bootstrap request');
  const secret=webPolicy().secret;
  return{id:createHmac('sha256',secret).update('wada-bootstrap-id-v1:'+nonce).digest('hex'),token:createHmac('sha256',secret).update('wada-flow-cookie-v1:'+nonce).digest('hex')};
}
export function appendCookie(res:any,name:string,value:string,maxAge:number) {
  const previous=res.getHeader?.('Set-Cookie');const all=Array.isArray(previous)?previous:previous?[String(previous)]:[];
  res.setHeader('Set-Cookie',[...all,`${name}=${value}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${Math.max(0,Math.floor(maxAge))}`]);
  res.setHeader('Cache-Control','no-store');
}
export function expireCookie(res:any,name:string){appendCookie(res,name,'',0);}
