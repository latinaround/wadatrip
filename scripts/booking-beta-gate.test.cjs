// Actual shared booking entry point; no DB, network, payment or dotenv.
const {test, afterEach}=require('node:test');
const assert=require('node:assert/strict');
const {createCapacityBooking, updateCapacityBooking}=require('@wadatrip/common/booking-capacity');
const previous=process.env.OPERATOR_BETA_PREPARATION_ONLY;
afterEach(()=>{if(previous===undefined)delete process.env.OPERATOR_BETA_PREPARATION_ONLY;else process.env.OPERATOR_BETA_PREPARATION_ONLY=previous;});
const actor={id:'synthetic-traveler',name:'Synthetic Traveler'};
const body={listing_id:'synthetic-listing',date:'2027-01-01',num_people:1};
const entered=Error('synthetic transaction entered');
function database(){let count=0;return{prisma:{$transaction:async()=>{count++;throw entered;}},count:()=>count};}
test('preparation beta rejects concurrent new reservations before any database transaction or inventory hold',async()=>{
 process.env.OPERATOR_BETA_PREPARATION_ONLY='true';const db=database();
 const attempts=await Promise.allSettled(Array.from({length:10},()=>createCapacityBooking(db.prisma,actor,body)));
 assert.equal(db.count(),0,'a paused booking must never enter a transaction');
 for(const attempt of attempts){assert.equal(attempt.status,'rejected');assert.equal(attempt.reason.getStatus?.(),503);}
});
test('admin claims and client flags cannot bypass the preparation booking pause',async()=>{
 process.env.OPERATOR_BETA_PREPARATION_ONLY='true';const db=database();
 await assert.rejects(createCapacityBooking(db.prisma,{...actor,admin:true},{...body,OPERATOR_BETA_PREPARATION_ONLY:false}),e=>e.getStatus?.()===503);
 assert.equal(db.count(),0);
});
test('normal booking flow still reaches the original engine outside preparation mode',async()=>{
 for(const value of ['false',undefined]){if(value===undefined)delete process.env.OPERATOR_BETA_PREPARATION_ONLY;else process.env.OPERATOR_BETA_PREPARATION_ONLY=value;const db=database();await assert.rejects(createCapacityBooking(db.prisma,actor,body),e=>e===entered);assert.equal(db.count(),1);}
});
test('preparation pause does not block the shared existing-booking update path',async()=>{
 process.env.OPERATOR_BETA_PREPARATION_ONLY='true';const db=database();await assert.rejects(updateCapacityBooking(db.prisma,'synthetic-existing',{status:'cancelled'}),e=>e===entered);assert.equal(db.count(),1);
});
