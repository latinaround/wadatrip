import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { buildManifest, sourcePath } from './release-manifest.mjs';
import { verifyManifest } from './verify-release.mjs';
const area = path.resolve('logs/launch-beta-20261025/manifest-fixtures');
fs.mkdirSync(area, { recursive: true });
const commit = 'a'.repeat(40);
const blob = value => crypto.createHash('sha1').update(`blob ${Buffer.byteLength(value)}\0`).update(value).digest('hex');
function fixture() {
  const root = fs.mkdtempSync(path.join(area, 'source-'));
  const write = (name, value) => { const target = path.join(root, name); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, value); };
  write('apps/web/src/page.js', 'export const page=1;\n');
  write('package.json', '{"private":true}\n');
  const tree = [{ path: 'apps/web/src/page.js', mode: '100644', oid: blob('export const page=1;\n') }, { path: 'package.json', mode: '100644', oid: blob('{"private":true}\n') }];
  write('apps/web/src/page.js', 'export const page=2;\n');
  const options = { baseCommit: commit, changes: ['apps/web/src/page.js'] };
  return { root, tree, options, write, manifest: () => buildManifest(root, tree, options) };
}
test('manifest verifies the exact base and explicitly listed overlay', () => { const f=fixture(), m=f.manifest(); assert.equal(m.files.length,2); assert.equal(verifyManifest(f.root,f.tree,m).changed_files,1); });
test('output is deterministic without timestamps, secrets, absolute paths or machine identity', () => { const a=fixture(),b=fixture(); assert.deepEqual(a.manifest(),b.manifest()); });
test('modified content after review is rejected', () => { const f=fixture(),m=f.manifest(); f.write('apps/web/src/page.js','export const page=3;'); assert.throws(()=>verifyManifest(f.root,f.tree,m),/does not match/); });
test('unlisted source additions are rejected', () => { const f=fixture();f.write('apps/web/src/other.js','extra');assert.throws(f.manifest,/Unlisted addition/); });
test('unlisted base modifications are rejected', () => { const f=fixture();f.write('package.json','{"private":false}');assert.throws(f.manifest,/Unlisted modification/); });
test('missing baseline files cannot be hidden by a manifest', () => { const f=fixture();fs.unlinkSync(path.join(f.root,'package.json'));assert.throws(f.manifest,/Missing base/); });
test('private dotenv files cannot enter a release', () => { const f=fixture();f.write('.env','SYNTHETIC=private');assert.throws(f.manifest,/Private or generated/); });
test('protected package and install-state changes cannot be declared', () => { for(const name of ['package.json','.yarn/install-state.gz']){const f=fixture();assert.throws(()=>buildManifest(f.root,f.tree,{...f.options,changes:[name]}),/Protected change/);} });
function runtimeFixture() {
  const f=fixture();
  const before=JSON.stringify({private:true,scripts:{start:'node app.js'},dependencies:{example:'1.0.0'},packageManager:'yarn@3.6.4',engines:{node:'>=20.11.1 <21'}},null,2)+'\n';
  f.tree.find(row=>row.path==='package.json').oid=blob(before);
  f.options.changes.push('package.json');
  const after=before.replace('>=20.11.1 <21','>=24.22.1 <25');
  f.write('package.json',after);
  return {...f,before,after};
}
test('approved Node engine transition is admitted and remains hash-verified',()=>{
  const f=runtimeFixture(), manifest=f.manifest();
  assert.equal(manifest.files.find(row=>row.path==='package.json').changed,true);
  assert.equal(verifyManifest(f.root,f.tree,manifest).changed_files,2);
  f.write('package.json',f.after.replace('node app.js','node injected.js'));
  assert.throws(()=>verifyManifest(f.root,f.tree,manifest));
});
test('Node runtime exception tolerates only existing CRLF normalization',()=>{
  const f=runtimeFixture();f.write('package.json',f.after.replaceAll('\n','\r\n'));
  assert.equal(f.manifest().files.find(row=>row.path==='package.json').changed,true);
});
for(const [label,from,to] of [
  ['dependency','"example": "1.0.0"','"example": "2.0.0"'],
  ['script','node app.js','node injected.js'],
  ['package manager','yarn@3.6.4','yarn@4.0.0'],
  ['unapproved runtime','>=24.22.1 <25','>=20 <27'],
]) test(`Node runtime exception rejects unrelated ${label} changes`,()=>{
  const f=runtimeFixture();f.write('package.json',f.after.replace(from,to));assert.throws(f.manifest,/Protected change/);
});
test('Node engine transition still requires an explicit package declaration',()=>{
  const f=runtimeFixture();f.options.changes=f.options.changes.filter(name=>name!=='package.json');
  assert.throws(f.manifest,/Unlisted modification/);
});
test('integrated account source requires explicit inclusion and remains hash-verified', () => {
  const f=fixture(), name='apps/web/src/pages/Account.jsx'; f.write(name,'export default function Account() {}');
  assert.throws(f.manifest,/Unlisted addition/);
  const manifest=buildManifest(f.root,f.tree,{...f.options,changes:[...f.options.changes,name]});
  const entry=manifest.files.find(row=>row.path===name);
  assert.equal(entry.changed,true); assert.match(entry.sha256,/^[a-f0-9]{64}$/);
  f.write(name,'changed after review');
  assert.throws(()=>verifyManifest(f.root,f.tree,manifest),/does not match/);
});
test('source traversal, Windows paths and control characters are rejected', () => { for(const name of ['../.env','/absolute','a/../b','C:/private','a\\b','a\nb'])assert.throws(()=>sourcePath(name),/Invalid/); });
test('symlinks in the baseline are rejected', () => {const f=fixture();f.tree[0].mode='120000';assert.throws(f.manifest,/Invalid base/);});
test('possible private credentials stop the release without printing their value', () => {const f=fixture(),key='sk_live_'+crypto.randomBytes(20).toString('hex');f.write('apps/web/src/page.js',`const key='${key}';`);assert.throws(f.manifest,error=>error.message.includes('requires review')&&!error.message.includes(key));});
test('shortened or symbolic base revisions are not accepted', () => {const f=fixture();for(const baseCommit of ['main','abc123','a'.repeat(40)+' --other'])assert.throws(()=>buildManifest(f.root,f.tree,{...f.options,baseCommit}),/immutable base/);});
test('historically tracked Yarn install state is explicitly excluded instead of shipped', () => {const f=fixture();for(const name of ['.yarn/install-state.gz','apps/web/.yarn/install-state.gz'])f.tree.push({path:name,mode:'100644',oid:blob('synthetic generated state')});const manifest=f.manifest();assert.deepEqual(manifest.excluded_base_paths,['.yarn/install-state.gz','apps/web/.yarn/install-state.gz']);assert.equal(manifest.files.length,2);});
test('an unchanged locked dependency archive is hash-verified without treating compressed bytes as text', () => {const f=fixture(),name='.yarn/cache/synthetic-npm-1.0.0.zip',value=Buffer.alloc(9*1024*1024);f.write(name,value);f.tree.push({path:name,mode:'100644',oid:blob(value)});assert.equal(f.manifest().files.length,3);});
