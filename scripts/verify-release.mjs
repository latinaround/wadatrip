import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildManifest, readBaseTree, parseOptions } from './release-manifest.mjs';

export function verifyManifest(root, tree, manifest) {
  if (manifest?.schema_version !== 1) throw Error('Unsupported release manifest');
  const actual = buildManifest(root, tree, { baseCommit: manifest.base_commit, changes: manifest.changes });
  if (JSON.stringify(actual) !== JSON.stringify(manifest)) throw Error('Source does not match the reviewed release manifest');
  return { result: 'source_verified', base_commit: actual.base_commit, files: actual.files.length, changed_files: actual.files.filter(f => f.changed).length };
}
function main() {
  const options = parseOptions(process.argv.slice(2), ['root', 'repo', 'manifest']);
  const manifest = JSON.parse(fs.readFileSync(options.manifest, 'utf8'));
  console.log(JSON.stringify(verifyManifest(options.root, readBaseTree(options.repo, manifest.base_commit), manifest)));
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
