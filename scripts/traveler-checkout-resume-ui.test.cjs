const {createUiCookieSession}=require('./helpers/ui-cookie-session.cjs');
// Local frontend only. All API and Stripe navigation are intercepted with synthetic data.
const assert = require('node:assert/strict');
const { chromium } = require('../logs/p06-browser/node_modules/playwright-core');
const origin = new URL(process.argv[2] || 'http://127.0.0.1:4189').origin;
if (new URL(origin).hostname !== '127.0.0.1') throw Error('Local preview required');
const token = 'synthetic-resume-ui-token';
const booking = { id: 'synthetic-resume-booking', status: 'payment_pending', payment_status: 'unpaid',
  amount_cents: 5000, currency: 'USD', num_people: 1, listing: { title: 'Synthetic experience' },
  date: '2026-11-30T00:00:00Z' };
const target = 'https://checkout.stripe.com/c/pay/cs_test_synthetic_resume_ui';
async function main() {
 const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
 let passed = 0; const failures = [];
 async function check(name, fn, options = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-US' });
  const cookies=createUiCookieSession(()=>({id:"synthetic-resume-user",name:"Synthetic Traveler",email:"synthetic@example.invalid"}),options.anonymous?null:"synthetic-resume-user");
  const calls = [], errors = []; let release;
  const barrier = new Promise(resolve => { release = resolve; });
  await context.route('**/*', async route => {
   const r = route.request(), url = new URL(r.url());
   if (url.href === target) return route.fulfill({ contentType: 'text/html', body: '<h1>Synthetic intercepted checkout</h1>' });
   if (!['fetch', 'xhr'].includes(r.resourceType())) return url.origin === origin ? route.continue() : route.abort();
   if(await cookies.bootstrap(route))return;cookies.validate(r);
   assert.ok(['127.0.0.1', 'localhost'].includes(url.hostname), 'External API forbidden');
   calls.push({ path: url.pathname, method: r.method(), auth: r.headers().authorization, body: r.postData() });
   let status = 200, body = { items: [] };
   if (url.pathname === '/auth/me') body = { id: 'synthetic-resume-user', name: 'Synthetic Traveler', email: 'synthetic@example.invalid' };
   if (url.pathname === '/providers/me') { status = 404; body = {}; }
   if (url.pathname === `/bookings/${booking.id}`) body = { ...booking, ...options.booking };
   if (url.pathname.endsWith('/checkout')) {
    if (options.delay) await barrier;
    status = options.checkoutStatus || 200;
    body = status === 200 ? { url: target } : { message: status === 401 ? 'Synthetic session expired' : 'Synthetic checkout expired' };
   }
        if(url.pathname==='/auth/web/logout')body={ok:true};

   return cookies.finish(route,status,body);
  });
  const page = await context.newPage(); page.setDefaultTimeout(2200); page.on('pageerror', error => errors.push(error.message));
  try {
   await page.goto(`${origin}/checkout/cancel?booking_id=${booking.id}`);
   if (!options.anonymous) await page.getByText(booking.id, { exact: true }).waitFor();
   else await page.getByRole('button', { name: 'Sign in', exact: true }).waitFor();
   await fn(page, calls, release);
   assert.deepEqual(errors, []);
   assert.equal(calls.filter(c => c.path === '/bookings' && c.method === 'POST').length, 0);
   passed++; console.log('PASS: ' + name);
  } catch (error) { failures.push(name); console.error('FAIL: ' + name + ': ' + error.message); }
  finally { release(); await context.close(); }
 }
 const button = page => page.getByRole('button', { name: 'Continue payment', exact: true });
 try {
  await check('pending booking can resume its own checkout with Bearer and no new booking', async (page, calls) => {
   await button(page).waitFor();
   assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
   await page.screenshot({ path: 'logs/traveler-checkout-resume-mobile.png', fullPage: true });
   await button(page).click(); await page.waitForURL(target);
   const posts = calls.filter(c => c.path.endsWith('/checkout'));
   assert.equal(posts.length, 1); assert.equal(posts[0].auth, undefined);
   assert.equal(posts[0].path, `/payments/bookings/${booking.id}/checkout`); assert.equal(posts[0].body, null);
  });
  for (const [label, changes] of [
   ['paid', { status: 'confirmed', payment_status: 'paid' }], ['cancelled', { status: 'cancelled' }],
   ['cancelling', { status: 'cancellation_pending' }], ['uncertain', { status: 'reconciliation_required' }],
   ['free', { amount_cents: 0 }],
  ]) await check(`${label} booking has no continue-payment action`, async page => {
   assert.equal(await button(page).count(), 0);
  }, { booking: changes });
  await check('anonymous visitor cannot resume checkout', async (page, calls) => {
   assert.equal(await button(page).count(), 0); assert.equal(calls.some(c => c.path.endsWith('/checkout')), false);
  }, { anonymous: true });
  await check('double click sends one checkout request', async (page, calls, release) => {
   await button(page).click();
   await page.waitForFunction(() => [...document.querySelectorAll('button')].some(b => b.disabled && b.textContent.includes('Opening checkout')));
   await page.getByRole('button', { name: 'Opening checkout…', exact: true }).evaluate(el => { el.click(); el.click(); });
   release(); await page.waitForURL(target);
   assert.equal(calls.filter(c => c.path.endsWith('/checkout')).length, 1);
  }, { delay: true });
  await check('expired checkout shows an error and never opens a new payment', async (page, calls) => {
   await button(page).click(); await page.getByRole('alert').getByText('Synthetic checkout expired', { exact: true }).waitFor();
   assert.equal(new URL(page.url()).origin, origin); assert.equal(calls.filter(c => c.path.endsWith('/checkout')).length, 1);
  }, { checkoutStatus: 409 });
  await check('checkout 401 clears the session through existing auth', async (page, calls) => {
   await button(page).click(); await page.getByRole('button',{name:'Sign in',exact:true}).waitFor();
   assert.equal(await button(page).count(), 0); assert.equal(new URL(page.url()).origin, origin);
   assert.equal(calls.filter(c => c.path.endsWith('/checkout')).length, 1);
  }, { checkoutStatus: 401 });
  await check('logout while checkout is pending prevents stale navigation', async (page, calls, release) => {
   await button(page).click();
   await page.getByRole('button', { name: 'Open menu', exact: true }).click();
   await page.getByRole('button', { name: 'Log out', exact: true }).last().click();
   await page.waitForFunction(() => !localStorage.getItem('wadatrip_token'));
   release();
   // Wait for the intercepted request to finish, then check navigation after its callback.
   await page.waitForLoadState('networkidle');
   assert.equal(new URL(page.url()).origin, origin); assert.equal(calls.filter(c => c.path.endsWith('/checkout')).length, 1);
  }, { delay: true });
  await check('leaving the booking while checkout is pending prevents stale navigation', async (page, calls, release) => {
   await button(page).click(); await page.getByRole('link', { name: 'View my trips', exact: true }).click();
   await page.waitForURL(`${origin}/account/trips`);
   release(); await page.waitForLoadState('networkidle');
   assert.equal(page.url(), `${origin}/account/trips`); assert.equal(calls.filter(c => c.path.endsWith('/checkout')).length, 1);
  }, { delay: true });
 } finally { await browser.close(); }
 console.log(JSON.stringify({ passed, failed: failures.length, failures }));
 if (failures.length) process.exitCode = 1;
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
