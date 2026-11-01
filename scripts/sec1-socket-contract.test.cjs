const registryFixture=require('./session-fixture.cjs');registryFixture.install();
// Actual registered Gateway and Socket.IO client, loopback only, synthetic users.
const {test}=require('node:test'),assert=require('node:assert/strict'),{Module}=require('node:module');
process.env.NODE_ENV='test';process.env.JWT_SECRET='synthetic-sec1-socket-contract-signing-secret';
delete process.env.ADMIN_EMAILS;delete process.env.ADMIN_USER_IDS;
require('reflect-metadata');const jwt=require('jsonwebtoken'),{io}=require('socket.io-client');
const original=Module._load,users=new Map([['active',{id:'active',email:'active@example.invalid',role:'traveler',status:'active'}],['inactive',{id:'inactive',email:'inactive@example.invalid',role:'traveler',status:'inactive'}]]);
Module._load=function(id,...args){if(id==='@wadatrip/db')return{getPrisma:()=>registryFixture.enable({users:{findUnique:async({where})=>users.get(where.id)||null}})};return original.call(this,id,...args);};
const {EventsGateway}=require('../apps/gateway/dist/apps/gateway/src/events.gateway.js');Module._load=original;
test('registered WebSocket gateway preserves active-user private rooms and rejects inactive/missing identity',async()=>{
 const {NestFactory}=require('@nestjs/core'),{Module:NestModule}=require('@nestjs/common');class Fixture{}NestModule({providers:[EventsGateway]})(Fixture);
 const app=await NestFactory.create(Fixture,{logger:false}),clients=[];await app.listen(0,'127.0.0.1');const base=await app.getUrl(),gateway=app.get(EventsGateway);
 const wait=async predicate=>{const end=Date.now()+2500;while(!predicate()){if(Date.now()>end)throw Error('Synthetic socket contract timed out');await new Promise(r=>setTimeout(r,10));}};
 const connect=(id,transport)=>{const token=id?jwt.sign({sub:id,email:id+'@example.invalid'},process.env.JWT_SECRET,{expiresIn:60}):undefined;const socket=io(base+'/ws',{auth:token?{token}:{},transports:[transport],reconnection:false,timeout:1500,forceNew:true});clients.push(socket);return socket;};
 try{
  for(const transport of ['polling','websocket']){
   const active=connect('active',transport);await wait(()=>active.connected&&gateway.server.adapter.rooms.get('user:active')?.size===1);
   const received=new Promise(resolve=>active.once('itinerary.updated',resolve));gateway.emitItineraryUpdated('active',{id:'synthetic-itinerary'});assert.deepEqual(await received,{id:'synthetic-itinerary'});
   active.disconnect();await wait(()=>!gateway.server.adapter.rooms.has('user:active'));
   for(const id of ['inactive','missing',null]){const rejected=connect(id,transport);let disconnected=false;rejected.on('disconnect',()=>disconnected=true);rejected.on('connect_error',()=>disconnected=true);await wait(()=>disconnected);assert.equal(rejected.connected,false);assert.equal(gateway.server.adapter.rooms.has('user:'+id),false);rejected.disconnect();}
  }
 }finally{for(const client of clients)client.disconnect();await app.close();}
});
