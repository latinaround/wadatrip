import {webPolicy} from '@wadatrip/common/web-security';

export const browserHeaders=['Content-Type','X-Wadatrip-Web','X-Session-Version','X-CSRF-Token','X-Admin-Proof','X-Operator-Access-Code'];
export function browserCors(){
  return {origin:(origin:string|undefined,callback:any)=>callback(null,!origin||origin===webPolicy().web),credentials:true,
    methods:['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS'],allowedHeaders:browserHeaders,maxAge:600};
}
export function responseSecurity(req:any,res:any,next:any){
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');
  res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Content-Security-Policy',"default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
  res.setHeader('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  if(process.env.NODE_ENV==='production')res.setHeader('Strict-Transport-Security','max-age=31536000');
  if(req.headers.authorization||req.headers.cookie||/^\/(auth|admin|trips|devices)(\/|$)/.test(req.path||req.url))res.setHeader('Cache-Control','no-store');
  // CORS header omission alone does not prevent a browser request from executing.
  // Reject before parsers/controllers/proxies; originless native callers retain
  // their registered Bearer contract and all routes still require authorization.
  if(req.headers.origin!==undefined){
    let allowed=false,configured=true;
    try{allowed=typeof req.headers.origin==='string'&&req.headers.origin===webPolicy().web;}catch{configured=false;}
    if(!allowed){
      res.removeHeader('Access-Control-Allow-Origin');res.removeHeader('Access-Control-Allow-Credentials');
      res.setHeader('Cache-Control','no-store');
      const vary=String(res.getHeader('Vary')||'');
      if(!vary.split(',').some((v:string)=>v.trim().toLowerCase()==='origin'))res.setHeader('Vary',vary?vary+', Origin':'Origin');
      return res.status(configured?403:503).json({statusCode:configured?403:503,
        code:configured?'WEB_ORIGIN_NOT_ALLOWED':'WEB_ORIGIN_CONFIGURATION_UNAVAILABLE',
        message:configured?'Request origin is not allowed':'Browser authentication is temporarily unavailable'});
    }
  }
  next();
}
export function safeLog(value:any):string {
  // Do not serialize arbitrary exceptions/config objects (Axios embeds headers).
  const raw=typeof value==='string'?value:value instanceof Error?value.name:'[structured log omitted]';
  return raw.replace(/(?:Bearer\s+)[A-Za-z0-9_.-]+/gi,'Bearer [redacted]')
    .replace(/((?:authorization|cookie|password|id_?token|token|secret|code|csrf|proof)\s*[:=]\s*)[^\s,;]+/gi,'$1[redacted]')
    .replace(/\b[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g,'[credential redacted]')
    .replace(/\b[a-f0-9]{64}\b/gi,'[secret redacted]').slice(0,2048);
}
