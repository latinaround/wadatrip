const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
test('beta image uploads reject before any Firebase SDK operation',async()=>{
 let sdk=0;
 const src=fs.readFileSync('apps/web/src/services/mediaUpload.js','utf8').replace(/^import .*;\r?\n/gm,'').replaceAll('import.meta.env','env').replaceAll('export default','const defaultExport =').replaceAll('export ','');
 const ctx={env:{},file:{type:'image/jpeg',size:4},getApps:()=>{sdk++;return[]},initializeApp:()=>{sdk++},getStorage:()=>{sdk++;return{}},ref:()=>{sdk++},uploadBytes:()=>{sdk++},getDownloadURL:()=>{sdk++}};
 vm.createContext(ctx);vm.runInContext(src+'\nglobalThis.run = uploadImageFile;',ctx);
 await assert.rejects(ctx.run(ctx.file,{ownerId:'synthetic-operator'}),/paused during the operator beta/);assert.equal(sdk,0);
});
