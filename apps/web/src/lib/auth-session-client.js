// Primary browser credentials exist only in host-only HttpOnly cookies.
export function createSessionClient(request, onState = () => {}, runtime = globalThis) {
  let context=null, revision=0, tail=Promise.resolve(), pendingLogout=null, bootstrapNonce=null;
  const stale=()=>Object.assign(new Error('Your session changed. Please sign in again.'),{status:409});
  const publish=()=>onState({user:context?.user||null,session:context?.session||null,sessionKey:context?.user?context.session_version:null,logoutPending:Boolean(pendingLogout)});
  const headers=c=>({'X-Wadatrip-Web':'1','Content-Type':'application/json',...(c?{'X-Session-Version':c.session_version,'X-CSRF-Token':c.csrf_token}:{})});
  function accept(value){
    if(!value||value.token||!/^([a-f0-9]{64}):\d{1,9}$/.test(value.session_version)||!/^([a-f0-9]{64})$/.test(value.csrf_token)
      ||value.session?.kind!=='web'||value.session_version!==`${value.session.id}:${value.session.generation}`)throw new Error('Invalid web session response');
    context=value;publish();return value;
  }
  function serialized(operation){
    const run=()=>runtime.navigator?.locks?.request?runtime.navigator.locks.request('wadatrip-web-auth-v3',operation)
      :Promise.reject(new Error('This browser needs Web Locks support for secure sign-in. Please use a current browser.'));
    const result=tail.catch(()=>{}).then(run);tail=result.catch(()=>{});return result;
  }
  async function bootstrapInside(mark){
    bootstrapNonce ||= runtime.crypto.randomUUID();
    const value=await request('/auth/web/bootstrap',{method:'POST',headers:headers(),body:JSON.stringify({bootstrap_nonce:bootstrapNonce})});
    if(mark!==revision)throw stale();bootstrapNonce=null;return accept(value);
  }
  async function revokePending(){
    if(!pendingLogout)return;const target=pendingLogout;
    const result=await request(target.context?'/auth/web/logout':'/auth/web/cancel-bootstrap',{
      method:'POST',headers:headers(target.context),body:JSON.stringify(target.context?{}:{bootstrap_nonce:target.nonce})});
    if(result?.ok!==true)throw new Error('Server sign-out has not been confirmed. Please retry.');
    if(pendingLogout===target)pendingLogout=null;bootstrapNonce=null;publish();
  }
  return {
    snapshot:()=>context,
    logoutPending:()=>Boolean(pendingLogout),
    invalidate(){revision++;context=null;publish();},
    bootstrap(){const mark=revision;return serialized(async()=>{if(pendingLogout)await revokePending();return bootstrapInside(mark);});},
    authenticate(path,body){const mark=revision;return serialized(async()=>{
      if(pendingLogout)await revokePending();if(mark!==revision)throw stale();
      await bootstrapInside(mark);const before=context;
      const value=await request(path.replace(/^\/auth\//,'/auth/web/'),{method:'POST',headers:headers(before),body:JSON.stringify(body)});
      if(mark!==revision)throw stale();
      let me;try{me=await request('/auth/me',{headers:headers(value)});if(me?.id!==value.user?.id)throw stale();}
      catch(error){if(mark===revision){pendingLogout ||= {context:value};context=null;publish();try{await revokePending();}catch{ /* Retain the exact retry context and block further sign-in. */ }}throw error;}
      if(mark!==revision)throw stale();const verified={...value,user:me};accept(verified);return verified;
    });},
    async requestCode(body){const mark=revision;return serialized(async()=>{
      if(pendingLogout)throw new Error('Confirm server sign-out before continuing.');
      await bootstrapInside(mark);return request('/auth/web/request-code',{method:'POST',headers:headers(context),body:JSON.stringify(body)});
    });},
    logout(){revision++;pendingLogout ||= context?{context}:{nonce:bootstrapNonce||runtime.crypto.randomUUID()};context=null;publish();return serialized(revokePending).catch(error=>{publish();throw error;});},
    async fetch(fetcher,url,init={}){
      const captured=context,mark=revision;if(!captured?.user||pendingLogout)throw Object.assign(new Error('Please sign in again.'),{status:401});
      const current=()=>{if(mark!==revision||context!==captured)throw stale();};
      const h=new Headers(init.headers);if(h.has('Authorization')||h.has('X-Wada-Session-Credential'))throw new Error('Browser Bearer credentials are prohibited');
      for(const [key,value]of Object.entries(headers(captured)))h.set(key,value);
      const response=await fetcher(url,{...init,headers:h,credentials:'include',redirect:'error',cache:'no-store',signal:init.signal||AbortSignal.timeout(15000)});current();
      // A business 409 (capacity, expired checkout) is not a session change.
      if(response.status===401){this.invalidate();throw Object.assign(new Error('Your session expired or changed. Please sign in again.'),{status:response.status});}
      const read=method=>async(...args)=>{current();const value=await response[method](...args);current();return value;};
      return new Proxy(response,{get(target,key){if(['json','text','arrayBuffer','blob','formData'].includes(key))return read(key);if(key==='clone')return()=>{throw new Error('Private responses cannot be cloned');};const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});
    },
  };
}
