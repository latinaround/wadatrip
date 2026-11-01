import {AppConfig} from '../config/appConfig';
import {createSessionClient} from './auth-session-client';
const base=()=>AppConfig.api.baseUrl.replace(/\/$/,'');
const subscribers=new Set();let state={user:null,session:null,sessionKey:null,logoutPending:false};
async function jsonRequest(path,init={}){
  const response=await fetch(`${base()}${path}`,{...init,credentials:'include',redirect:'error',cache:'no-store',signal:AbortSignal.timeout(15000)});
  const payload=await response.json().catch(()=>null);
  if(!response.ok)throw Object.assign(new Error(payload?.message||'Authentication request failed.'),{status:response.status});return payload;
}
export const webSession=createSessionClient(jsonRequest,next=>{state=next;for(const callback of subscribers)callback(next);});
export const sessionState=()=>state;
export function subscribeSession(callback){subscribers.add(callback);return()=>subscribers.delete(callback);}
export function sessionFetch(input,init={}){
  const allowed=new URL(base()),url=new URL(input,allowed);
  if(url.origin!==allowed.origin||url.username||url.password||url.hash)throw new Error('Private requests require the configured API origin');return webSession.fetch(fetch,url.href,init);
}
export function signalSessionChange(){try{localStorage.setItem('wadatrip_auth_revision',crypto.randomUUID());}catch{}}
