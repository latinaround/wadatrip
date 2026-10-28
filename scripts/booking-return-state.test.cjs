// Actual page render with synthetic auth/booking props, no effects/network. No real credentials.
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const root=process.env.WEB_CANCEL_SOURCE||path.resolve(__dirname,'..'),ts=require('typescript');
function render(options={}){
 const bookingId='synthetic-booking',auth=options.anonymous?{user:null,token:null,loading:false}:{user:{id:'synthetic-user'},token:'synthetic-token',loading:!!options.loading};
 let index=0;const seeded=options.booking?{actor:options.oldActor?'old-user':auth.user?.id,token:auth.token,bookingId,booking:options.booking}:null;
 const React={createElement:(type,props,...children)=>({type,props:{...props,children}}),useEffect(){},useRef:value=>({current:value}),useState:value=>{const i=index++;return[i===0?seeded:i===1?(options.error||''):value,()=>{}];}};
 const cache=new Map();function load(rel){const file=path.join(root,rel);if(cache.has(file))return cache.get(file);const module={exports:{}};const code=ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{jsx:ts.JsxEmit.React,module:ts.ModuleKind.CommonJS,esModuleInterop:true}}).outputText;
  vm.runInNewContext(code,{React,module,exports:module.exports,window:{location:{href:'http://127.0.0.1/checkout/success?booking_id='+bookingId}},require:name=>{
   if(name==='react')return React;if(name==='react-router-dom')return {Link:'Link',useSearchParams:()=>[new URLSearchParams({booking_id:bookingId,status:'cancelled'})]};
   if(name.includes('AuthContext'))return {useAuth:()=>auth};if(name.includes('bookingStatus'))return load('apps/web/src/services/bookingStatus.js');
   if(name.includes('travelerBooking'))return {canResumeTravelerCheckout:()=>false};if(name.includes('appConfig'))return {AppConfig:{api:{baseUrl:'http://127.0.0.1'}}};if(name.endsWith('/button'))return {Button:'Button'};
   return {__esModule:true,default:name};
  }});cache.set(file,module.exports);return module.exports;
 }
 const tree=load('apps/web/src/pages/CheckoutSuccess.jsx').default();function walk(n,out=[]){if(Array.isArray(n))n.forEach(v=>walk(v,out));else if(n&&typeof n==='object'){out.push(n);walk(n.props?.children,out);}return out;}
 return walk(tree).find(n=>n.type==='h1')?.props.children.join('');
}
test('anonymous return does not assert booking pending or cancelled before ownership verification',()=>assert.equal(render({anonymous:true}),'Sign in to view your booking'));
test('session restoration does not assert a financial booking state',()=>assert.equal(render({loading:true}),'Checking your session'));
test('authenticated initial loading is not booking pending',()=>assert.equal(render(),'Checking your booking'));
test('failed verification does not assert booking pending',()=>assert.equal(render({error:'Synthetic unavailable'}),'Unable to verify booking'));
test('only backend cancellation/refund produces cancelled heading',()=>assert.equal(render({booking:{id:'synthetic-booking',status:'cancelled',payment_status:'refunded'}}),'Booking cancelled'));
test('signed backend confirmation remains confirmed',()=>assert.equal(render({booking:{id:'synthetic-booking',status:'confirmed',payment_status:'paid'}}),'Your booking is confirmed'));
test('old actor result cannot appear as current cancelled state',()=>assert.equal(render({oldActor:true,booking:{id:'synthetic-booking',status:'cancelled',payment_status:'refunded'}}),'Checking your booking'));
