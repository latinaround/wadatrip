const {test}=require('node:test');
const assert=require('node:assert/strict');
const {localTestApi,localTestDatabase}=require('./local-test-target.cjs');
test('synthetic API tooling defaults to loopback and accepts local IPv4/IPv6',()=>{
 assert.equal(localTestApi(),'http://127.0.0.1:3000');
 for(const url of ['http://localhost:3000','http://127.0.0.1:3000','http://[::1]:3000'])assert.ok(localTestApi(url));
});
test('synthetic API tooling rejects hosted, private network, credentials and alternate paths',()=>{
 for(const url of ['https://wadatrip.onrender.com','https://api.wadatrip.com','https://www.wadatrip.com','http://192.168.0.5:3000','http://localhost.example.com','http://user:pass@localhost:3000','http://localhost:3000/proxy','http://localhost:3000?redirect=production','http://localhost:3000#production','file:///tmp/test','invalid'])assert.throws(()=>localTestApi(url));
});
test('synthetic database tooling rejects remote and production-name databases',()=>{
 for(const url of [undefined,'postgresql://synthetic:synthetic@production.example.invalid/wadatrip_db','postgresql://synthetic:synthetic@localhost:5432/wadatrip_db','postgresql://synthetic:synthetic@localhost:5432/postgres','postgresql://synthetic:synthetic@localhost:5432/wadatrip_test?host=production.example.invalid'])assert.throws(()=>localTestDatabase(url));
});
test('synthetic database tooling accepts only explicit local disposable names',()=>{
 for(const name of ['wadatrip_test','wadatrip_test_synthetic','wadatrip_dev','wadatrip_p05_repair_synthetic','wadatrip_p07_fixture']){const url='postgresql://synthetic:synthetic@127.0.0.1:55435/'+name;assert.equal(localTestDatabase(url),url)}
});
