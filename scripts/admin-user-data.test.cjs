// Synthetic records only. No database, email, Stripe or external HTTP.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {adminUserDataScope,classifyAdminUserData,readAdminUsers}=require('../apps/gateway/dist/apps/gateway/src/services/admin-user-data.service.js');
const testIds=['synthetic-test-user'];
const rows=[
 {id:'synthetic-test-user',role:'guide',email:'synthetic@example.invalid'},
 {id:'synthetic-real-user',role:'guide',email:'real@example.invalid'},
 {id:'synthetic-unreviewed-user',role:'traveler',email:'guide-smoke-123@example.com'},
];
const matches=(row,where)=>!where||Object.entries(where).every(([key,value])=>{
 if(key==='AND')return value.every(part=>matches(row,part));
 if(key==='OR')return value.some(part=>matches(row,part));
 if(value&&typeof value==='object'){
  if(value.in)return value.in.includes(row[key]);if(value.notIn)return !value.notIn.includes(row[key]);
  if(value.contains)return String(row[key]).toLowerCase().includes(value.contains.toLowerCase());
 }
 return row[key]===value;
});
function database(){const audits=[];const tx={users:{count:async({where})=>rows.filter(row=>matches(row,where)).length,
 findMany:async({where,skip,take,select})=>rows.filter(row=>matches(row,where)).slice(skip,skip+take).map(row=>Object.fromEntries(Object.keys(select).filter(key=>select[key]===true).map(key=>[key,row[key]])))},
 admin_audit_log:{create:async({data})=>audits.push(data)}};return {...tx,$transaction:async(fn,options)=>{assert.equal(options.isolationLevel,'RepeatableRead');return fn(tx)},audits};}
const read=(db,query={})=>readAdminUsers(db,{id:'synthetic-admin'},query,{page:1,limit:20,skip:0},{id:true,email:true,role:true},testIds);
test('default reporting scope excludes confirmed test IDs, never guesses from email',()=>{
 const where=adminUserDataScope({},testIds).where;assert.equal(matches(rows[0],where),false);assert.equal(matches(rows[1],where),true);assert.equal(matches(rows[2],where),true);
});
test('explicit scope accepts all or tests, rejects invalid scopes',()=>{
 assert.equal(rows.filter(row=>matches(row,adminUserDataScope({data_scope:'test'},testIds).where)).length,1);
 assert.equal(rows.filter(row=>matches(row,adminUserDataScope({data_scope:'all'},testIds).where)).length,3);
 for(const value of ['real','production','all,test',{in:['all']}])assert.throws(()=>adminUserDataScope({data_scope:value},testIds));
});
test('unknown and operational users are never labeled verified real customers',()=>{
 assert.equal(classifyAdminUserData('synthetic-test-user',testIds),'test');assert.equal(classifyAdminUserData('synthetic-real-user',testIds),'unclassified');
});
test('default count and pagination exclude tests on server and report excluded count',async()=>{
 const db=database(),result=await read(db);assert.equal(result.total,2);assert.equal(result.excluded_test_accounts,1);assert.equal(result.data_scope,'non_test');assert.deepEqual(result.items.map(x=>x.id),['synthetic-real-user','synthetic-unreviewed-user']);assert.equal(result.items[0].data_category,'unclassified');assert.equal(db.audits.length,1);
});
test('test view preserves records with explicit labels and all view preserves full counts',async()=>{
 const result=await read(database(),{data_scope:'test'});assert.equal(result.total,1);assert.equal(result.items[0].data_category,'test');
 const all=await read(database(),{data_scope:'all'});assert.equal(all.total,3);assert.equal(all.excluded_test_accounts,0);
});
test('role and search combine with classification before count and pagination',async()=>{
 const result=await read(database(),{role:'guide',q:'example.invalid'});assert.equal(result.total,1);assert.equal(result.excluded_test_accounts,1);assert.equal(result.items[0].id,'synthetic-real-user');
});
test('unsupported roles and excessive searches are rejected',async()=>{
 await assert.rejects(read(database(),{role:'owner'}));await assert.rejects(read(database(),{q:'x'.repeat(151)}));
});
test('test IDs cannot be supplied by a caller and registry is absent from output',async()=>{
 const result=await read(database(),{test_user_ids:['synthetic-real-user'],data_category:'test',is_test:true});assert.equal(result.total,2);assert.equal(JSON.stringify(result).includes('synthetic-test-user'),false);
});
test('data classification cannot mutate users, bookings, inventory or payment history',async()=>{
 const before=JSON.stringify(rows),db=database();await read(db,{data_scope:'all'});assert.equal(JSON.stringify(rows),before);assert.deepEqual(Object.keys(db.audits[0]).sort(),['action','actor_id','result']);
});
