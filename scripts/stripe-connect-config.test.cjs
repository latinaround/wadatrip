const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');

const file = path.resolve(__dirname, '../apps/gateway/src/services/stripe-connect.service.ts');
const compiled = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const loaded = { exports: {} };
class BadRequestException extends Error {}
new Function('require', 'module', 'exports', compiled)((id) => {
  if (id === '@nestjs/common') return { BadRequestException };
  throw new Error(`Unexpected dependency: ${id}`);
}, loaded, loaded.exports);

const { stripeConnectCapabilities, stripeConnectUrls, stripeConnectStatus } = loaded.exports;

test('Stripe Connect requests the payment and transfer capabilities needed by an operator', () => {
  assert.deepEqual(stripeConnectCapabilities(), {
    card_payments: { requested: true },
    transfers: { requested: true },
  });
});

test('Stripe Connect refuses missing, placeholder and insecure production return URLs', () => {
  assert.throws(() => stripeConnectUrls({ NODE_ENV: 'production' }));
  assert.throws(() => stripeConnectUrls({ NODE_ENV: 'production', CONNECT_RETURN_URL: 'https://example.com/return', CONNECT_REFRESH_URL: 'https://www.wadatrip.com/refresh' }));
  assert.throws(() => stripeConnectUrls({ NODE_ENV: 'production', CONNECT_RETURN_URL: 'http://www.wadatrip.com/return', CONNECT_REFRESH_URL: 'https://www.wadatrip.com/refresh' }));
});

test('Stripe Connect accepts explicit HTTPS Wadatrip return URLs', () => {
  const urls = stripeConnectUrls({
    NODE_ENV: 'production',
    CONNECT_RETURN_URL: 'https://www.wadatrip.com/operator/tours/new?connect=return',
    CONNECT_REFRESH_URL: 'https://www.wadatrip.com/operator/tours/new?connect=refresh',
  });
  assert.equal(new URL(urls.returnUrl).hostname, 'www.wadatrip.com');
  assert.equal(new URL(urls.refreshUrl).searchParams.get('connect'), 'refresh');
});

test('a stored account ID is not ready until Stripe confirms account capabilities', () => {
  assert.equal(stripeConnectStatus({ id: 'acct_synthetic', details_submitted: false, charges_enabled: false, payouts_enabled: false }).ready, false);
  assert.equal(stripeConnectStatus({ id: 'acct_synthetic', details_submitted: true, charges_enabled: true, payouts_enabled: true, requirements: { currently_due: ['synthetic'] } }).ready, false);
  assert.equal(stripeConnectStatus({ id: 'acct_synthetic', details_submitted: true, charges_enabled: true, payouts_enabled: true, requirements: {} }).ready, true);
});

test('booking payment routes require a ready destination and contain no platform-charge fallback', () => {
  const controller = fs.readFileSync(path.resolve(__dirname, '../apps/gateway/src/controllers/payments.controller.ts'), 'utf8');
  assert.match(controller, /requireReadyPayoutAccount\(stripe, booking\)/);
  assert.match(controller, /idempotencyKey: `wadatrip-connect-account:\$\{providerId\}`/);
  assert.match(controller, /capabilities: stripeConnectCapabilities\(\)/);
  assert.match(controller, /accounts\.update\(accountId, \{ capabilities: stripeConnectCapabilities\(\) \}\)/);
  assert.doesNotMatch(controller, /connect_fallback/);
  assert.doesNotMatch(controller, /example\.com\/reauth|example\.com\/return/);
});
