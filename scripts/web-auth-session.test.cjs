// Browser regression: intercept every API call with synthetic data. Never send email,
// verify a real code, touch production accounts, or call Stripe.
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(path.resolve(__dirname, '../logs/p06-browser/node_modules/playwright-core'));

async function main() {
  const origin = new URL(process.argv[2] || 'http://localhost:4173').origin;
  const browser = await chromium.launch({
    executablePath: process.env.AUTH_TEST_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
    headless: true,
  });
  const user = { id: 'synthetic-traveler', name: 'Synthetic Traveler', email: 'traveler@example.invalid', role: 'traveler', status: 'active' };
  const token = 'synthetic-browser-test-token';
  const calls = [];
  const context = await browser.newContext();
  try {
    await context.route('**/*', async route => {
      const request = route.request();
      const url = new URL(request.url());
      // Only the application assets reach the requested website/local server.
      // All API requests, including same-origin requests, are intercepted.
      if (url.origin === origin && request.resourceType() !== 'fetch' && request.resourceType() !== 'xhr') {
        return route.continue();
      }
      if (request.resourceType() !== 'fetch' && request.resourceType() !== 'xhr') return route.abort();
      calls.push({ path: url.pathname, method: request.method(), authorization: request.headers().authorization, body: request.postDataJSON() });
      let body = [];
      let status = 200;
      if (url.pathname === '/auth/request-code') { status = 201; body = { ok: true, channel: 'email', expires_in_minutes: 10 }; }
      if (url.pathname === '/auth/verify-code') { status = 201; body = { token, user }; }
      if (url.pathname === '/auth/me') {
        status = request.headers().authorization === `Bearer ${token}` ? 200 : 401;
        body = status === 200 ? user : { message: 'not authenticated' };
      }
      if (url.pathname === '/providers/me') { status = 404; body = { message: 'provider not found' }; }
      await route.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': origin }, body: JSON.stringify(body) });
    });
    const page = await context.newPage();
    await page.goto(`${origin}/register?mode=login&role=traveler`);
    await page.locator('#guide-email').fill(user.email);
    await page.getByRole('button', { name: 'Send code to continue', exact: true }).click();
    await page.locator('#guide-secret').waitFor();
    assert.equal(calls.filter(c => c.path === '/auth/request-code').length, 1, 'The email notice must correspond to an actual request-code request');
    await page.locator('#guide-secret').fill('123456');
    await page.getByRole('button', { name: 'Continue to your account', exact: true }).click();
    await page.waitForURL(url => url.pathname === '/account');
    await page.getByRole('heading', { name: `Hi, ${user.name}`, exact: true }).waitFor({ timeout: 10000 });
    assert.equal(calls.filter(c => c.path === '/auth/verify-code').length, 1);
    assert.ok(calls.some(c => c.path === '/auth/me' && c.authorization === `Bearer ${token}`));
    assert.equal(await page.evaluate(() => localStorage.getItem('wadatrip_token')), token);
    console.log('PASS: email request, code verification, authenticated account and Bearer profile request');
    await page.reload();
    await page.getByRole('heading', { name: `Hi, ${user.name}`, exact: true }).waitFor();
    assert.ok(calls.filter(c => c.path === '/auth/me' && c.authorization === `Bearer ${token}`).length >= 2);
    console.log('PASS: session survives page reload');
    await page.getByRole('button', { name: /logout|cerrar sesi/i }).first().click();
    await page.getByRole('heading', { name: 'Sign in to view your trips', exact: true }).waitFor();
    assert.equal(await page.evaluate(() => localStorage.getItem('wadatrip_token')), null);
    console.log('PASS: logout removes session and account access');
    await page.goto(`${origin}/guide/register?mode=login`);
    await page.locator('#guide-email').fill(user.email);
    await page.getByRole('button', { name: 'Send code to continue', exact: true }).click();
    await page.locator('#guide-secret').fill('123456');
    await page.getByRole('button', { name: 'Continue to publish tours', exact: true }).click();
    await page.waitForURL(url => url.pathname === '/operator/tours/new');
    await page.getByRole('heading', { name: 'Create your first tour', exact: true }).first().waitFor();
    assert.ok(calls.some(c => c.path === '/auth/verify-code' && c.body.role === 'guide'));
    assert.ok(calls.some(c => c.path === '/providers/me' && c.authorization === `Bearer ${token}`));
    console.log('PASS: guide sign-in shares the authenticated session and operator API uses Bearer');
    console.log('WEB AUTH SESSION: 4/4 checks passed; synthetic API only');
  } finally {
    await context.close();
    await browser.close();
  }
}
main().catch(error => { console.error(`${error.name}: ${error.message}`); process.exitCode = 1; });
