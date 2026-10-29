// Local source verification only. Never reads dotenv, calls a service, migrates or deploys.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';

// The integrated operator beta includes Account.jsx. Like every application file,
// it must be explicitly declared and hash-verified; unrelated environment inputs stay closed.
const protectedChanges = new Set(['package.json', '.yarn/install-state.gz']);
// Historical commits contain this generated file. It is never a deployable input.
const excludedBase = new Set(['.yarn/install-state.gz', 'apps/web/.yarn/install-state.gz']);
const dependencyArchive = name => /^(?:apps\/web\/)?\.yarn\/cache\/[^/]+\.zip$/.test(name);
const sha256 = data => crypto.createHash('sha256').update(data).digest('hex');
const gitBlob = data => crypto.createHash('sha1').update(`blob ${data.length}\0`).update(data).digest('hex');
// Owner-approved metadata-only transition. Reverting this one value must recover
// the immutable Git blob; dependency/script edits cannot ride on the exception.
function approvedNodeRuntimeOnly(data, baselineOid) {
  try {
    const raw = data.toString('utf8');
    if (JSON.parse(raw)?.engines?.node !== '>=24.22.1 <25') return false;
    const restore = text => text.replace(/("engines"\s*:\s*\{[^{}]*?"node"\s*:\s*")>=24\.22\.1 <25(")/,
      '$1>=20.11.1 <21$2');
    return [raw, raw.replace(/\r\n/g, '\n')].some(text => {
      const restored = restore(text);
      return restored !== text && gitBlob(Buffer.from(restored)) === baselineOid;
    });
  } catch { return false; }
}
const privatePath = name => /(^|\/)(?:\.git|\.env(?:\.(?!example$)[^/]*)?|node_modules|logs|\.aws|\.render|\.vercel|backups?)(?:\/|$)/i.test(name)
  || /\.(?:pem|key|p12|pfx|dump|bak|tar|gz)$/i.test(name);

export function sourcePath(value) {
  if (typeof value !== 'string' || !value || /[\\\u0000-\u0020\u007f:]/.test(value)
    || value.startsWith('/') || value.split('/').some(part => !part || part === '.' || part === '..')) throw Error('Invalid release source path');
  return value;
}

export function readBaseTree(repository, baseCommit) {
  if (!/^[a-f0-9]{40}$/.test(baseCommit)) throw Error('A full immutable base commit is required');
  const raw = execFileSync('git', ['-C', path.resolve(repository), 'ls-tree', '-r', '-z', baseCommit], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  return raw.split('\0').filter(Boolean).map(row => {
    const match = /^(\d+) blob ([a-f0-9]{40})\t(.+)$/.exec(row);
    if (!match) throw Error('Unsupported base tree entry');
    return { mode: match[1], oid: match[2], path: sourcePath(match[3]) };
  });
}

function filesIn(root) {
  const names = [];
  const walk = relative => {
    for (const entry of fs.readdirSync(path.join(root, relative), { withFileTypes: true })) {
      const name = sourcePath(relative ? `${relative}/${entry.name}` : entry.name);
      if (privatePath(name)) throw Error(`Private or generated input rejected: ${name}`);
      if (entry.isSymbolicLink()) throw Error(`Symbolic input rejected: ${name}`);
      if (entry.isDirectory()) walk(name);
      else if (entry.isFile()) names.push(name);
      else throw Error(`Unsupported source input: ${name}`);
    }
  };
  walk(''); return names.sort();
}

function scanCredentials(data, name) {
  if (data.length > 8 * 1024 * 1024) throw Error(`Oversized source input: ${name}`);
  const text = data.toString('utf8');
  // Values are deliberately never included in errors. Public Firebase configuration
  // and publishable Stripe keys are not private credentials.
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text)
    || /\b(?:sk|rk)_(?:test|live)_[A-Za-z0-9]{24,}\b/.test(text)
    || /\bwhsec_[A-Za-z0-9]{24,}\b/.test(text)
    || /\bre_[A-Za-z0-9]{28,}\b/.test(text)) throw Error(`Possible private credential requires review: ${name}`);
}

export function buildManifest(root, tree, { baseCommit, changes }) {
  if (!/^[a-f0-9]{40}$/.test(baseCommit)) throw Error('A full immutable base commit is required');
  if (!Array.isArray(changes) || !changes.length || new Set(changes).size !== changes.length) throw Error('An explicit nonempty unique change list is required');
  const allowed = new Set(changes.map(sourcePath));
  for (const name of allowed) if (privatePath(name) || (protectedChanges.has(name) && name !== 'package.json') || dependencyArchive(name)) throw Error(`Protected change rejected: ${name}`);
  const base = new Map();
  for (const entry of tree) {
    const name = sourcePath(entry.path);
    if (!['100644', '100755'].includes(entry.mode) || !/^[a-f0-9]{40}$/.test(entry.oid) || base.has(name)) throw Error('Invalid base tree');
    base.set(name, entry);
  }
  const source = fs.realpathSync(root), names = filesIn(source), folded = new Set();
  if (allowed.has('package.json') && (!base.has('package.json') || !names.includes('package.json')
    || !approvedNodeRuntimeOnly(fs.readFileSync(path.join(source, 'package.json')), base.get('package.json').oid))) {
    throw Error('Protected change rejected: package.json (only the approved Node engine transition is allowed)');
  }
  const records = [];
  for (const name of names) {
    const key = name.toLowerCase();
    if (folded.has(key)) throw Error('Case-colliding release paths'); folded.add(key);
    if (!base.has(name) && !allowed.has(name)) throw Error(`Unlisted addition rejected: ${name}`);
    const data = fs.readFileSync(path.join(source, name));
    const changed = !base.has(name) || gitBlob(data) !== base.get(name).oid;
    if (changed && !allowed.has(name)) throw Error(`Unlisted modification rejected: ${name}`);
    // Immutable dependency ZIPs are verified against the exact Git blob and lockfile,
    // never interpreted as application text or admitted as an overlay.
    if (!dependencyArchive(name)) scanCredentials(data, name);
    records.push({ path: name, sha256: sha256(data), bytes: data.length, changed });
  }
  for (const name of base.keys()) if (!names.includes(name) && !excludedBase.has(name)) throw Error(`Missing base source rejected: ${name}`);
  for (const name of allowed) if (!names.includes(name)) throw Error(`Missing declared change: ${name}`);
  return { schema_version: 1, base_commit: baseCommit, excluded_base_paths: [...base.keys()].filter(name => excludedBase.has(name)).sort(), changes: [...allowed].sort(), files: records };
}

export function parseOptions(argv, allowed) {
  const options = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, '');
    if (!argv[i]?.startsWith('--') || !allowed.includes(key) || options[key] || !argv[i + 1]) throw Error('Invalid release command arguments');
    options[key] = argv[i + 1];
  }
  for (const key of allowed) if (!options[key]) throw Error(`Missing --${key}`);
  return options;
}

function main() {
  const options = parseOptions(process.argv.slice(2), ['root', 'repo', 'base', 'changes', 'out']);
  const root = fs.realpathSync(options.root), output = path.resolve(options.out);
  if (output === root || output.startsWith(root + path.sep)) throw Error('Manifest must remain outside source directory');
  const manifest = buildManifest(root, readBaseTree(options.repo, options.base), {
    baseCommit: options.base, changes: JSON.parse(fs.readFileSync(options.changes, 'utf8')),
  });
  // Refuse accidental replacement of an existing reviewed manifest.
  fs.writeFileSync(output, JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ result: 'source_manifest_created', base_commit: manifest.base_commit, files: manifest.files.length, changed_files: manifest.files.filter(f => f.changed).length }));
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  try { main(); } catch (error) { console.error(error.message); process.exitCode = 1; }
}
