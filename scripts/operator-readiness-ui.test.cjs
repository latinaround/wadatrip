const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const ts = require('typescript');

const root = path.resolve(__dirname, '..');
const webRequire = createRequire(path.join(root, 'apps/web/package.json'));
const React = webRequire('react');
const { renderToStaticMarkup } = webRequire('react-dom/server');
const file = path.join(root, 'apps/web/src/components/OperatorReadinessPanel.jsx');
const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS },
}).outputText;
const loaded = { exports: {} };
// Render the real component. Only leaf UI controls are replaced with native controls.
new Function('require', 'module', 'exports', compiled)((id) => {
  if (id === './ui/button') return { Button: ({ variant, ...props }) => React.createElement('button', props) };
  if (id === './ui/input') return { Input: (props) => React.createElement('input', props) };
  if (id === './OperatorBookingPolicyForm.jsx') return { default: () => null };
  return webRequire(id);
}, loaded, loaded.exports);
const Panel = loaded.exports.default;
const provider = { name: 'Synthetic guide', base_city: 'Lima', country_code: 'PE', languages: ['es'], status: 'approved' };
const listing = { id: 'synthetic-listing', price_from: '50.00', currency: 'USD', timezone: 'America/Lima', meeting_point: 'Synthetic meeting point', cancellation_policy: 'Synthetic policy', booking_cutoff_hours: 24, tags: [] };
function render(p = provider, l = listing, extra = {}) {
  return renderToStaticMarkup(React.createElement(Panel, { provider: p, listing: l, availability: [], ...extra })).replace(/<[^>]*>/g, '');
}

test('listing operational fields complete the checklist independently of provider fields', () => {
  const text = render();
  for (const label of ['Price and currency', 'Timezone', 'Meeting point', 'Cancellation policy', 'Booking cutoff']) {
    assert.ok(text.includes(`✓ ${label}`), `${label} must use the listing`);
  }
  assert.match(text, /7\/8/);
  assert.match(text, /No dates configured yet/);
});

test('provider fields cannot make an absent listing look complete', () => {
  const text = render({ ...provider, ...listing }, null);
  for (const label of ['Price and currency', 'Timezone', 'Meeting point', 'Cancellation policy', 'Booking cutoff']) {
    assert.ok(text.includes(`○ ${label}`), `${label} must not use the provider`);
  }
  assert.match(text, /2\/8/);
});

test('a missing provider or listing is safe to render', () => {
  assert.match(render(null, null), /0\/8/);
});

test('missing and invalid canonical price are incomplete; a valid zero price is complete', () => {
  for (const value of [null, undefined, '', ' ', -1, 'NaN', 'Infinity']) {
    assert.ok(render(provider, { ...listing, price_from: value }).includes('○ Price and currency'));
  }
  assert.ok(render(provider, { ...listing, price_from: 0 }).includes('✓ Price and currency'));
  assert.ok(render(provider, { ...listing, currency: '' }).includes('○ Price and currency'));
});

test('free-tour legacy null price remains supported but does not bypass currency or invalid price', () => {
  const free = { ...listing, tags: ['free_tour'], price_from: null };
  assert.ok(render(provider, free).includes('✓ Price and currency'));
  assert.ok(render(provider, { ...free, currency: '' }).includes('○ Price and currency'));
  assert.ok(render(provider, { ...free, price_from: 50 }).includes('○ Price and currency'));
});

test('cutoff is only complete for an explicit nonnegative integer', () => {
  for (const value of [null, undefined, '', ' ', -1, 0.5]) {
    assert.ok(render(provider, { ...listing, booking_cutoff_hours: value }).includes('○ Booking cutoff'));
  }
  for (const value of [0, 24]) {
    assert.ok(render(provider, { ...listing, booking_cutoff_hours: value }).includes('✓ Booking cutoff'));
  }
});

test('a Stripe reference alone is not payout readiness and operators can continue setup', () => {
  const text = render({ ...provider, id: 'provider-synthetic', stripe_account_id: 'acct_synthetic_fixture' }, listing, {
    payoutStatus: { linked: true, ready: false },
    onConnectPayout: () => {},
  });
  assert.match(text, /○ Payouts enabled/);
  assert.match(text, /7\/8/);
  assert.match(text, /Continue payout setup/);
});

test('readiness requires Stripe-confirmed transfers and payouts', () => {
  const text = render({ ...provider, id: 'provider-synthetic' }, listing, {
    payoutStatus: { linked: true, ready: true, transfers_enabled: true, payouts_enabled: true },
    onConnectPayout: () => {},
  });
  assert.match(text, /✓ Payouts enabled/);
  assert.match(text, /8\/8/);
});

test('operator tour editing gives immediate feedback and restores the sole tour after Stripe return', () => {
  const page = fs.readFileSync(path.resolve(__dirname, '../apps/web/src/pages/OperatorToursNew.jsx'), 'utf8');
  assert.match(page, /const \[loadingTourId, setLoadingTourId\] = useState\(null\)/);
  assert.match(page, /loadingTourId === listing\.id/);
  assert.match(page, /document\.getElementById\('tour-details'\)\?\.scrollIntoView/);
  assert.match(page, /id="tour-details"/);
  assert.match(page, /ownedListings\.length === 1/);
  assert.match(page, /handleLoadTourById\(ownedListings\[0\]\.id, \{ scroll: false \}\)/);
});

test('editing an existing tour cannot accidentally submit the create-tour action', () => {
  const page = fs.readFileSync(path.resolve(__dirname, '../apps/web/src/pages/OperatorToursNew.jsx'), 'utf8');
  assert.match(page, /onSubmit=\{editingId \? handleUpdateTour : handleCreateTour\}/);
  assert.match(page, /event\?\.preventDefault\(\)/);
  assert.match(page, /editingId\s*\? t\('operator\.update_button', 'Update tour'\)/);
  assert.doesNotMatch(page, /onClick=\{handleUpdateTour\}/);
});
