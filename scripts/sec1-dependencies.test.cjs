// Bounded loopback regressions only; never direct malformed input to a deployed host.
const {test}=require('node:test'),assert=require('node:assert/strict'),http=require('node:http'),{gzipSync}=require('node:zlib');
const {createRequire}=require('node:module'),path=require('node:path');
const root=process.env.SEC1_DEPENDENCY_ROOT?path.resolve(process.env.SEC1_DEPENDENCY_ROOT):path.resolve(__dirname,'..');
const load=createRequire(path.join(root,'package.json')),express=load('express');
const listen=server=>new Promise(resolve=>server.listen(0,'127.0.0.1',()=>resolve('http://127.0.0.1:'+server.address().port)));
const close=server=>new Promise(resolve=>{server.closeAllConnections?.();server.close(resolve);});
test('finished compressed parser input safely handles a late decoder error',async()=>{
 const {PassThrough}=require('node:stream'),{deflateSync}=require('node:zlib'),req=new PassThrough();
 req.headers={'content-type':'application/json','content-encoding':'deflate','transfer-encoding':'chunked'};
 let decoder;const pipe=req.pipe;req.pipe=function(dest,...args){decoder=dest;return pipe.call(this,dest,...args);};
 const parsed=new Promise((resolve,reject)=>express.json()(req,{},error=>error?reject(error):resolve()));
 req.end(deflateSync('{"ok":true}'));await parsed;await new Promise(setImmediate);assert.deepEqual(req.body,{ok:true});
 // Controlled fault injection of the maintainer's late-decompression-error condition;
 // no unbounded payload and no uncaught process crash in the test runner.
 assert.doesNotThrow(()=>decoder.emit('error',new Error('synthetic late decompression error')));
});
test('invalid parser size limits fail closed instead of disabling enforcement',()=>{
 const parser=load('body-parser');for(const method of ['json','raw','text','urlencoded'])assert.throws(()=>parser[method]({limit:'not-a-byte-limit',extended:true}));
});
test('Socket.IO rejects zero and excessive binary attachment counts without retaining a reconstructor',()=>{
 const {Decoder}=load('socket.io-parser');for(const wire of ['50-["synthetic"]','599999999-["synthetic"]']){const decoder=new Decoder();assert.throws(()=>decoder.add(wire));assert.ok(!decoder.reconstructor);decoder.destroy();}
});
test('Engine.IO closes malformed binary polling POSTs instead of leaking HTTP connections',async()=>{
 const {Server}=load('engine.io'),engine=new Server(),server=http.createServer();engine.attach(server);const base=await listen(server);
 try{for(let i=0;i<3;i++){const handshake=await fetch(base+'/engine.io/?EIO=4&transport=polling',{signal:AbortSignal.timeout(1500)});const sid=JSON.parse((await handshake.text()).slice(1)).sid;
  const result=await fetch(base+'/engine.io/?EIO=4&transport=polling&sid='+sid,{method:'POST',headers:{'Content-Type':'application/octet-stream'},body:Buffer.from([1]),signal:AbortSignal.timeout(1000)});assert.equal(result.status,400);await result.arrayBuffer();assert.equal(engine.clientsCount,0);}}
 finally{engine.close();await close(server);}
});
test('JSON, URL encoding, compressed bodies and raw Stripe signature bytes remain compatible',async()=>{
 const app=express(),raw=Buffer.from('{"id":"evt_synthetic","spacing":  true}');
 app.use('/webhooks/stripe',express.raw({type:'*/*'}));app.post('/webhooks/stripe',(req,res)=>res.json({raw:Buffer.isBuffer(req.body),exact:req.body.equals(raw)}));
 app.use(express.json({limit:'5mb'}));app.use(express.urlencoded({extended:true,limit:'5mb'}));app.post('/echo',(req,res)=>res.json(req.body));app.use((err,req,res,next)=>res.status(err.status||400).json({error:'invalid input'}));
 const server=http.createServer(app),base=await listen(server);
 try{
  for(const [headers,body]of [[{'Content-Type':'application/json'},'{"ok":true}'],[{'Content-Type':'application/json','Content-Encoding':'gzip'},gzipSync('{"ok":true}')],[{'Content-Type':'application/x-www-form-urlencoded'},'ok=true']]){const res=await fetch(base+'/echo',{method:'POST',headers,body,signal:AbortSignal.timeout(1500)});assert.equal(res.status,200);assert.ok((await res.json()).ok);}
  const hook=await fetch(base+'/webhooks/stripe',{method:'POST',headers:{'Content-Type':'application/json'},body:raw});assert.deepEqual(await hook.json(),{raw:true,exact:true});
  const bad=await fetch(base+'/echo',{method:'POST',headers:{'Content-Type':'application/json','Content-Encoding':'gzip'},body:Buffer.from('invalid compressed bytes')});assert.equal(bad.status,400);await bad.arrayBuffer();
  const oversized=await fetch(base+'/echo',{method:'POST',headers:{'Content-Type':'application/json'},body:'"'+'x'.repeat(5*1024*1024)+'"'});assert.equal(oversized.status,413);await oversized.arrayBuffer();
 }finally{await close(server);}
});
