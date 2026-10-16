// Local preview and synthetic data only. No real accounts, bookings, Stripe or emails.
const assert = require('node:assert/strict');
const { chromium } = require('../logs/p06-browser/node_modules/playwright-core');
const origin = new URL(process.argv[2] || 'http://127.0.0.1:4178').origin;
if (new URL(origin).hostname !== '127.0.0.1') throw Error('Local frontend only');
const token = 'synthetic-account-context-token';
const userId = 'synthetic-account-context-user';
const providerId = 'synthetic-account-context-provider';
const listing = { id: 'csyntheticcontextlisting00001', provider_id: providerId, title: 'Synthetic owned tour', city: 'Lima', country_code: 'PE', status: 'published', price_from: 50, currency: 'USD' };
const ownBooking = { id: 'synthetic-personal-booking', user_id: userId, listing_id: listing.id, provider_id: providerId,
  listing: { ...listing, title: 'Synthetic personal reservation' }, provider: { name: 'Synthetic Host' },
  status: 'confirmed', payment_status: 'paid', amount_cents: 5000, total_price: 50, currency: 'USD', num_people: 1, date: '2026-11-30T00:00:00Z' };
const incoming = { ...ownBooking, id: 'synthetic-client-booking', user_id: 'synthetic-client',
  listing, user: { name: 'Synthetic Client' } };
async function main() {
 const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
 let passed = 0; const failures = [];
 async function check(name, fn, options = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-US' });
  await context.addInitScript(value => localStorage.setItem('wadatrip_token', value), token);
  const calls = [], errors = [];
  await context.route('**/*', async route => {
   const request = route.request(), url = new URL(request.url());
   if (!['fetch', 'xhr'].includes(request.resourceType())) return url.origin === origin ? route.continue() : route.abort();
   calls.push({ path: url.pathname, query: url.search, method: request.method(), auth: request.headers().authorization });
   let body = { items: [] }, status = 200;
   const provider = { id: providerId, user_id: userId, name: 'Synthetic Host', status: 'verified', type: 'operator',
     country_code: 'PE', base_city: 'Lima', verified_level: 'community', listings: [listing] };
   if (url.pathname === '/auth/me') body = { id: userId, name: 'Synthetic Account', email: 'synthetic-account@example.invalid', role: options.role || 'traveler' };
   if (url.pathname === '/providers/me') { body = options.host === false ? { message: 'No synthetic provider' } : provider; status = options.host === false ? 404 : 200; }
   if (url.pathname === `/providers/${providerId}`) body = provider;
   if (url.pathname === '/bookings/mine') { status = 404; body = { message: 'Synthetic legacy route missing' }; }
   if (url.pathname === '/bookings') body = { items: url.searchParams.has('provider_id') ? [incoming] : [ownBooking], total: 1 };
   if (url.pathname === '/bookings/synthetic-personal-booking') body = ownBooking;
   if (url.pathname.startsWith('/listings') || url.pathname.endsWith('/listings')) body = { items: [listing] };
   return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });
  const page = await context.newPage(); page.setDefaultTimeout(1800); page.on('pageerror', error => errors.push(error.message));
  try {
   await page.goto(`${origin}${options.path || '/account'}`);
   await page.getByRole('heading', { name: 'Hi, Synthetic Account', exact: true }).waitFor().catch(async error => { if (!options.path?.startsWith('/checkout')) throw error; });
   await fn(page, calls);
   assert.deepEqual(errors, []);
   assert.ok(calls.every(call => call.method === 'GET' || (call.method === 'POST' && call.path.endsWith('/reconcile'))));
   passed++; console.log('PASS: ' + name);
  } catch (error) { failures.push(name); console.error('FAIL: ' + name + ': ' + error.message.split('\n')[0]); }
  finally { await context.close(); }
 }
 const dashboard = page => page.getByRole('link', { name: 'Operator dashboard', exact: true });
 const personal = page => page.getByRole('cell', { name: /^Synthetic personal reservation/, includeHidden: true });
 try {
  await check('Owned provider selects an operator entry even when account role is traveler', async page => {
   await dashboard(page).first().waitFor(); assert.equal(await dashboard(page).first().getAttribute('href'), '/operator/tours/new');
   assert.equal(await page.getByRole('link', { name: 'My trips', exact: true }).count(), 0);
  });
  await check('Operator personal reservations and spending are collapsed by default', async page => {
   await dashboard(page).first().waitFor(); await personal(page).waitFor({ state: 'attached' });
   assert.equal(await page.locator('#my-trips').evaluate(node => node.tagName), 'DETAILS');
   assert.equal(await page.locator('#my-trips').evaluate(node => node.open), false);
   assert.equal(await personal(page).isVisible(), false);
   assert.equal(await page.getByText('Total spent', { exact: true }).isVisible(), false);
  });
  await check('Personal booking view is explicitly opt-in and never displays client bookings', async (page, calls) => {
   await dashboard(page).first().waitFor(); await page.getByRole('link', { name: 'My bookings as a traveler', exact: true }).click();
   await personal(page).waitFor();
   assert.equal(await page.getByText('Synthetic Client', { exact: true }).count(), 0);
   assert.ok(calls.some(call => call.path === '/bookings' && call.query.includes('scope=mine') && call.auth === `Bearer ${token}`));
   assert.equal(calls.some(call => call.path === '/bookings' && call.query.includes('provider_id=')), false);
  });
  await check('Operator link opens incoming reservations with the owned provider filter and Bearer', async (page, calls) => {
   await dashboard(page).first().click(); await page.waitForURL(`${origin}/operator/tours/new`);
   await page.getByText('Synthetic Client', { exact: true }).waitFor();
   assert.ok(calls.some(call => call.path === '/bookings' && call.query.includes(`provider_id=${providerId}`) && call.auth === `Bearer ${token}`));
   assert.equal(await personal(page).count(), 0);
  });
  await check('Explicit my-trips URL opens personal history for an operator', async page => {
   await dashboard(page).first().waitFor(); await personal(page).waitFor();
   assert.equal(await page.locator('#my-trips').evaluate(node => node.open), true);
  }, { path: '/account#my-trips' });
  await check('Traveler without provider keeps My trips primary and reservations visible', async page => {
   await page.getByRole('button', { name: 'Become a host', exact: true }).waitFor();
   await page.getByRole('link', { name: 'My trips', exact: true }).waitFor(); await personal(page).waitFor();
   assert.equal(await dashboard(page).count(), 0);
  }, { host: false });
  await check('Role string alone does not fabricate an owned host workspace', async page => {
   await page.getByRole('button', { name: 'Become a host', exact: true }).waitFor();
   assert.equal(await dashboard(page).count(), 0); await personal(page).waitFor();
  }, { host: false, role: 'guide' });
  await check('Host profile no longer calls its dashboard Manage tours', async page => {
   await dashboard(page).first().waitFor();
   assert.equal(await page.getByRole('link', { name: 'Manage tours', exact: true }).count(), 0);
   await page.getByRole('heading', { name: 'Host profile', exact: true }).waitFor();
  });
  await check('Post-booking View my trips explicitly opens traveler history for a host', async page => {
   const link = page.getByRole('link', { name: 'View my trips', exact: true }); await link.waitFor();
   assert.equal(await link.getAttribute('href'), '/account#my-trips'); await link.click(); await personal(page).waitFor();
   assert.equal(await page.locator('#my-trips').evaluate(node => node.open), true);
  }, { path: '/checkout/success?booking_id=synthetic-personal-booking' });
  await check('Spanish account controls distinguish operator and traveler contexts', async page => {
   await dashboard(page).first().waitFor(); await page.setViewportSize({ width: 1440, height: 900 });
   await page.getByRole('button', { name: 'English', exact: true }).click(); await page.getByRole('menuitem', { name: /Español/ }).click();
   await page.getByRole('link', { name: 'Panel de operadora u operador', exact: true }).first().waitFor();
   await page.getByRole('link', { name: 'Mis reservas como viajero', exact: true }).click(); await personal(page).waitFor();
  });
  await check('Mobile operator landing fits with personal history closed', async page => {
   await dashboard(page).first().waitFor(); assert.equal(await personal(page).isVisible(), false);
   assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
   await page.screenshot({ path: 'logs/account-operator-context-mobile-synthetic.png' });
  });
  console.log(`ACCOUNT CONTEXT UI: ${passed}/${passed + failures.length} passed; localhost/synthetic only`);
  if (failures.length) process.exitCode = 1;
 } finally { await browser.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
