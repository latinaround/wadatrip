// Actual sign-in component and helpers, synthetic identities/I/O only.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const root = path.resolve(__dirname, '..');
const origin = 'https://www.wadatrip.com';
const payload = { token: 'synthetic-noncredential', user: { id: 'synthetic-user' } };

function fixture(query = '', options = {}) {
  const state = [], destinations = [], requests = [], shared = [], storage = new Map();
  let cursor = 0;
  const React = {
    createElement: (type, props, ...children) => ({ type, props: { ...props, children } }),
    useState: initial => { const index = cursor++; if (!(index in state)) state[index] = typeof initial === 'function' ? initial() : initial; return [state[index], value => { state[index] = typeof value === 'function' ? value(state[index]) : value; }]; },
    useMemo: fn => fn(), useCallback: fn => fn(), useEffect() {},
    useRef: initial => { const index = cursor++; if (!(index in state)) state[index] = { current: initial }; return state[index]; },
  };
  const auth = {};
  for (const method of ['login', 'register', 'requestCode', 'verifyCode']) auth[method] = async body => {
    shared.push({ method, body });
    if (options.sessionChanged) throw Error('Your session changed. Please sign in again.');
    return options.invalidResponse ? {} : payload;
  };
  const cache = new Map();
  const location = { origin, href: origin + '/register?' + query, hash: '', assign: url => destinations.push(url), replace: url => destinations.push(url) };
  function load(relative) {
    const absolute = path.resolve(root, relative);
    if (!absolute.startsWith(root + path.sep)) throw Error('Source boundary');
    if (cache.has(absolute)) return cache.get(absolute).exports;
    const module = { exports: {} }; cache.set(absolute, module);
    const code = ts.transpileModule(fs.readFileSync(absolute, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
    vm.runInNewContext(code, { module, exports: module.exports, React, URL, URLSearchParams, AbortController,
      window: { location, setTimeout: () => 1, clearTimeout() {}, localStorage: { setItem: (k, v) => storage.set(k, v), getItem: k => storage.get(k) ?? null } },
      fetch: async (url, request) => { requests.push({ url, body: JSON.parse(request.body) }); return { ok: true, json: async () => options.invalidResponse ? {} : payload }; },
      require: name => {
        if (name === 'react') return React;
        if (name === 'react-router-dom') return { Link: 'Link', useNavigate: () => destination => destinations.push(destination), useSearchParams: () => [new URLSearchParams(query)] };
        if (name.includes('AuthContext')) return { useAuth: () => auth };
        if (name.includes('appConfig')) return { AppConfig: { api: { baseUrl: 'http://127.0.0.1:1', timeout: 100 } } };
        if (name.startsWith('.')) { const local = path.resolve(path.dirname(absolute), name); const found = ['', '.js', '.jsx'].map(ext => local + ext).find(fs.existsSync); if (found) return load(path.relative(root, found)); }
        throw Error('External dependency forbidden: ' + name);
      },
    }, { filename: absolute });
    return module.exports;
  }
  const page = load('apps/web/src/pages/GuideSignupPage.jsx').default;
  const walk = (node, out = []) => { if (Array.isArray(node)) node.forEach(item => walk(item, out)); else if (node && typeof node === 'object') { out.push(node); walk(node.props?.children, out); } return out; };
  const label = node => Array.isArray(node) ? node.map(label).join('') : node && typeof node === 'object' ? label(node.props?.children) : node == null || node === false ? '' : String(node);
  const nodes = () => { cursor = 0; return walk(page()); };
  const input = (id, value) => { const node = nodes().find(n => n.props.id === id); assert.ok(node, id); node.props.onChange({ target: { value } }); };
  const click = text => { const node = nodes().find(n => n.type === 'button' && label(n) === text); assert.ok(node, text); node.props.onClick(); };
  const submit = () => nodes().find(n => n.type === 'form').props.onSubmit({ preventDefault() {}, stopPropagation() {} });
  return { input, click, submit, destinations, requests, shared, storage };
}

async function password(query, options) {
  const f = fixture(query, options); f.input('guide-email', 'synthetic@example.invalid'); f.click('Use password instead'); f.input('guide-secret', 'synthetic-password'); await f.submit(); return f;
}

test('password login never sends an auth token to a protocol-relative next destination', async () => {
  const f = await password('mode=login&role=traveler&next=' + encodeURIComponent('//external.example.invalid/return'));
  assert.equal(f.destinations.length, 1);
  assert.equal(new URL(f.destinations[0], origin).origin, origin);
  assert.equal(f.destinations[0], '/account');
});

test('password registration uses the shared session and never writes a token into navigation', async () => {
  const f = await password('mode=register&next=' + encodeURIComponent('/operator/tours/new?panel=tours'));
  assert.equal(f.destinations[0], '/operator/tours/new?panel=tours');
  assert.equal(f.shared.filter(c => c.method === 'register').length, 1);
  assert.equal(f.requests.length, 0);
});

test('password login uses the existing guarded AuthContext instead of a second session writer', async () => {
  const f = await password('mode=login&role=traveler');
  assert.equal(f.shared.filter(c => c.method === 'login').length, 1);
  assert.equal(f.storage.size, 0);
  assert.deepEqual(f.destinations, ['/account']);
});

test('an invalid auth response cannot navigate as though sign-in succeeded', async () => {
  const f = await password('mode=login&role=traveler', { invalidResponse: true });
  assert.equal(f.destinations.length, 0);
});

test('a session change rejects a late password login without navigating', async () => {
  const f = await password('mode=login&role=traveler', { sessionChanged: true });
  assert.equal(f.destinations.length, 0);
});

test('email-code sign-in preserves a legitimate booking return without a token in its URL', async () => {
  const f = fixture('mode=login&role=traveler&next=' + encodeURIComponent('/checkout/success?booking_id=synthetic-booking'));
  f.input('guide-email', 'synthetic@example.invalid'); await f.submit(); f.input('guide-secret', '123456'); await f.submit();
  assert.deepEqual(f.destinations, ['/checkout/success?booking_id=synthetic-booking']);
});

for (const next of ['//external.example.invalid', '/\\external.example.invalid', '/%2fexternal.example.invalid', '/%252fexternal.example.invalid', '/%2e%2e//external.example.invalid', '/\n/external.example.invalid', '/account#auth_token=synthetic', '/account?auth_token=synthetic', 'https://external.example.invalid']) {
  test('unsafe return is rejected: ' + JSON.stringify(next), async () => {
    const f = await password('mode=login&role=traveler&next=' + encodeURIComponent(next));
    assert.deepEqual(f.destinations, ['/account']);
  });
}

function readSession(file, name, stored) {
  const source = fs.readFileSync(path.join(root, file), 'utf8');
  const helper = source.match(new RegExp('function ' + name + '\\(\\) \\{[\\s\\S]*?\\n\\}'));
  assert.ok(helper, name);
  const context = { tokenStorageKey: 'wadatrip_token', window: { location: { hash: '#auth_token=synthetic-injected' }, localStorage: { getItem: () => stored } } };
  vm.runInNewContext(helper[0] + '; this.value=' + name + '();', context);
  return context.value;
}
test('AuthContext retires URL/storage credentials without accepting them',()=>{const source=fs.readFileSync(path.join(root,'apps/web/src/context/AuthContext.jsx'),'utf8');assert.doesNotMatch(source,/getItem|setItem|payload\.token/);assert.match(source,/removeItem/);assert.match(source,/replaceState/);});
test('operator page has no independent credential reader',()=>{const source=fs.readFileSync(path.join(root,'apps/web/src/pages/OperatorToursNew.jsx'),'utf8');assert.doesNotMatch(source,/localStorage|sessionStorage|Bearer/);assert.match(source,/sessionFetch/);});
