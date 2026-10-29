// Full localhost application; every API/external request is synthetic or blocked.
const assert = require('node:assert/strict');
const { chromium } = require('../logs/p06-browser/node_modules/playwright-core');
const origin = new URL(process.argv[2] || 'http://127.0.0.1:4196').origin;
assert.equal(new URL(origin).hostname, '127.0.0.1');
const token = 'synthetic-return-session';
const user = { id: 'synthetic-return-user', name: 'Synthetic Return Traveler', email: 'return@example.invalid', role: 'traveler', status: 'active' };

async function main() {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  let passed = 0;
  async function check(name, run, { stored = false } = {}) {
    const context = await browser.newContext();
    const calls = [], navigations = [];
    try {
      if (stored) await context.addInitScript(value => localStorage.setItem('wadatrip_token', value), token);
      await context.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url());
        if (!['fetch', 'xhr'].includes(request.resourceType())) {
          if (request.isNavigationRequest()) navigations.push(url.origin);
          return url.origin === origin ? route.continue() : route.abort();
        }
        calls.push({ path: url.pathname, method: request.method(), bearer: request.headers().authorization });
        let status = 200, body = { items: [] };
        if (url.pathname === '/auth/request-code') body = { ok: true, channel: 'email', expires_in_minutes: 10 };
        if (['/auth/login', '/auth/register', '/auth/verify-code'].includes(url.pathname)) body = { token, user };
        if (url.pathname === '/auth/me') {
          status = request.headers().authorization === `Bearer ${token}` ? 200 : 401;
          body = status === 200 ? user : { message: 'Synthetic unauthenticated' };
        }
        if (url.pathname === '/providers/me') { status = 404; body = { message: 'No synthetic host profile' }; }
        if (url.pathname === '/operator/booking-inbox') body = { is_operator: false, groups: {} };
        if (url.pathname === '/bookings/synthetic-return-booking') body = { id: 'synthetic-return-booking', status: 'cancelled', payment_status: 'failed' };
        await route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
      });
      const page = await context.newPage(); page.setDefaultTimeout(7000);
      await run(page, calls);
      assert.ok(navigations.every(value => value === origin), 'No off-origin navigation attempted');
      assert.ok(!decodeURIComponent(page.url()).includes(token), 'No credential in current URL');
      passed++; console.log('PASS: ' + name);
    } finally { await context.close(); }
  }
  const enterPassword = async page => {
    await page.locator('#guide-email').fill(user.email);
    await page.getByRole('button', { name: 'Use password instead', exact: true }).click();
    await page.locator('#guide-secret').fill('synthetic-password');
    await page.locator('form button[type=submit]').click();
  };
  try {
    await check('password login rejects an external return and maintains an authenticated account', async (page, calls) => {
      await page.goto(origin + '/register?mode=login&role=traveler&next=' + encodeURIComponent('//external.example.invalid/return'));
      await enterPassword(page);
      await page.waitForURL(url => url.pathname === '/account');
      await page.getByRole('heading', { name: 'Hi, ' + user.name, exact: true }).waitFor();
      assert.equal(new URL(page.url()).hash, '');
      assert.equal(calls.filter(c => c.path === '/auth/login').length, 1);
      assert.ok(calls.some(c => c.path === '/auth/me' && c.bearer === `Bearer ${token}`));
      await page.reload();
      await page.getByRole('heading', { name: 'Hi, ' + user.name, exact: true }).waitFor();
      await page.getByRole('button', { name: 'Log out', exact: true }).click();
      assert.equal(await page.evaluate(() => localStorage.getItem('wadatrip_token')), null);
    });
    await check('password registration preserves the destination without a credential handoff', async (page, calls) => {
      await page.goto(origin + '/register?mode=register&role=traveler&next=' + encodeURIComponent('/account/trips'));
      await enterPassword(page);
      await page.waitForURL(url => url.pathname === '/account/trips');
      await page.getByRole('heading', { name: 'My trips', exact: true }).waitFor();
      assert.equal(calls.filter(c => c.path === '/auth/register').length, 1);
      assert.equal(new URL(page.url()).hash, '');
    });
    await check('code sign-in preserves a booking return and uses the same session', async (page, calls) => {
      await page.goto(origin + '/register?mode=login&role=traveler&next=' + encodeURIComponent('/checkout/success?booking_id=synthetic-return-booking'));
      await page.locator('#guide-email').fill(user.email);
      await page.locator('form button[type=submit]').click();
      await page.locator('#guide-secret').fill('123456');
      await page.locator('form button[type=submit]').click();
      await page.waitForURL(url => url.pathname === '/checkout/success');
      await page.getByRole('heading', { name: 'Booking cancelled', exact: true }).waitFor();
      assert.ok(calls.some(c => c.path === '/bookings/synthetic-return-booking' && c.bearer === `Bearer ${token}`));
    });
    await check('a fragment alone never signs in an account', async (page, calls) => {
      await page.goto(origin + '/account#auth_token=synthetic-injected');
      await page.getByRole('heading', { name: 'Sign in to view your trips', exact: true }).waitFor();
      assert.equal(calls.filter(c => c.path === '/auth/me').length, 0);
      assert.equal(await page.evaluate(() => localStorage.getItem('wadatrip_token')), null);
      assert.equal(new URL(page.url()).hash, '');
    });
    await check('a fragment cannot switch a valid stored account', async (page, calls) => {
      await page.goto(origin + '/account#auth_token=synthetic-injected');
      await page.getByRole('heading', { name: 'Hi, ' + user.name, exact: true }).waitFor();
      assert.ok(calls.filter(c => c.path === '/auth/me').every(c => c.bearer === `Bearer ${token}`));
      assert.equal(await page.evaluate(() => localStorage.getItem('wadatrip_token')), token);
      assert.equal(new URL(page.url()).hash, '');
    }, { stored: true });
    await check('operator route ignores malformed credential fragments without a crash', async (page, calls) => {
      await page.goto(origin + '/operator/tours/new#auth_token=%E0%A4%A');
      await page.locator('main, .page-shell').first().waitFor();
      await page.waitForFunction(() => window.location.hash === '');
      assert.equal(calls.filter(c => c.bearer).length, 0);
    });
  } finally { await browser.close(); }
  console.log(JSON.stringify({ passed, production_calls: 0, evidence: 'Chrome localhost; synthetic API; no real authentication or processor calls' }));
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
