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
  if (!options.anonymous) await context.addInitScript(value => localStorage.setItem('wadatrip_token', value), token);
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
   if (url.pathname === '/bookings') body = { items: url.searchParams.has('provider_id') ? [incoming] : options.legacyHistory ? [{ ...ownBooking, id: 'synthetic-historical-booking', listing: { ...listing, title: 'Synthetic historical reservation' }, status: 'pending', payment_status: 'unpaid', date: '2001-02-03T00:00:00Z', payment: null }] : [{ ...ownBooking, payment: { processor_mode: options.paymentMode || 'live' } }], total: 1 };
   if (url.pathname === '/payments/user-history') body = { items: options.legacyHistory ? [] : [{ id: 'synthetic-context-payment', booking_id: ownBooking.id, amount_charged_cents: 5000, currency: 'USD', status: 'succeeded', processor_mode: options.paymentMode || 'live' }] };
   if (url.pathname === '/bookings/synthetic-personal-booking') body = ownBooking;
   if (url.pathname.startsWith('/listings') || url.pathname.endsWith('/listings')) body = { items: [listing] };
   return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
  });
  const page = await context.newPage(); page.setDefaultTimeout(1800); page.on('pageerror', error => errors.push(error.message));
  try {
   await page.goto(`${origin}${options.path || '/account'}`);
   if (!options.path?.startsWith('/checkout')) await page.getByRole('heading', { name: options.anonymous ? 'Sign in to view your trips' : options.path?.includes('/trips') || options.path?.includes('#my-trips') ? 'My trips' : 'Hi, Synthetic Account', exact: true }).waitFor();
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
  await check('Operator account profile does not embed traveler reservations or spending', async page => {
   await dashboard(page).first().waitFor();
   assert.equal(await page.locator('#my-trips').count(), 0);
   assert.equal(await personal(page).count(), 0);
   assert.equal(await page.getByText('Total spent', { exact: true }).count(), 0);
  });
  await check('Personal booking view is explicitly opt-in and never displays client bookings', async (page, calls) => {
   await dashboard(page).first().waitFor(); await page.getByRole('link', { name: 'My bookings as a traveler', exact: true }).click();
   await page.waitForURL(`${origin}/account/trips`);
   await page.getByRole('heading', { name: 'My trips', exact: true }).waitFor();
   assert.equal(await page.getByRole('heading', { name: 'Host profile', exact: true }).count(), 0);
   assert.equal(await page.getByLabel('Display name', { exact: true }).count(), 0);
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
  await check('Old my-trips bookmark redirects to the dedicated traveler page', async page => {
   await dashboard(page).first().waitFor(); await personal(page).waitFor();
   await page.waitForURL(`${origin}/account/trips`);
   assert.equal(await page.locator('#my-trips').evaluate(node => node.tagName), 'SECTION');
  }, { path: '/account#my-trips' });
  await check('Traveler without provider keeps My trips primary and reservations visible', async page => {
   await page.getByRole('button', { name: 'Become a host', exact: true }).waitFor();
   await page.getByRole('link', { name: 'My trips', exact: true }).click(); await page.waitForURL(`${origin}/account/trips`); await personal(page).waitFor();
   assert.equal(await dashboard(page).count(), 0);
  }, { host: false });
  await check('Role string alone does not fabricate an owned host workspace', async page => {
   await page.getByRole('button', { name: 'Become a host', exact: true }).waitFor();
   assert.equal(await dashboard(page).count(), 0); await page.getByRole('link', { name: 'My trips', exact: true }).click(); await personal(page).waitFor();
  }, { host: false, role: 'guide' });
  await check('Host profile no longer calls its dashboard Manage tours', async page => {
   await dashboard(page).first().waitFor();
   assert.equal(await page.getByRole('link', { name: 'Manage tours', exact: true }).count(), 0);
   await page.getByRole('heading', { name: 'Host profile', exact: true }).waitFor();
  });
  await check('Post-booking View my trips explicitly opens traveler history for a host', async page => {
   const link = page.getByRole('link', { name: 'View my trips', exact: true }); await link.waitFor();
   assert.equal(await link.getAttribute('href'), '/account/trips'); await link.click(); await personal(page).waitFor();
   assert.equal(await page.getByLabel('Display name', { exact: true }).count(), 0);
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
  await check('Sandbox booking and payment do not inflate personal trip or spending totals', async page => {
   await dashboard(page).first().waitFor(); await page.getByRole('link', { name: 'My bookings as a traveler', exact: true }).click();
   const trips = page.locator('#my-trips');
   const spent = trips.getByText('Total spent', { exact: true }).locator('../..');
   await spent.getByText('$0', { exact: true }).waitFor();
   const upcoming = trips.getByText('Upcoming trips', { exact: true }).locator('../..');
   await upcoming.getByText('0', { exact: true }).waitFor();
   assert.equal(await personal(page).isVisible(), false);
   await trips.getByText('Test bookings and payments', { exact: true }).click();
   await personal(page).waitFor();
   await trips.getByText('synthetic-personal-booking', { exact: true }).waitFor();
  }, { paymentMode: 'test' });
  await check('Old unpaid legacy bookings are preserved in collapsed history, with zero upcoming trips and spending', async page => {
   await dashboard(page).first().waitFor();
   await page.getByRole('link', { name: 'My bookings as a traveler', exact: true }).click();
   const trips = page.locator('#my-trips');
   await trips.getByText('You have no upcoming trips as a traveler.', { exact: true }).waitFor();
   await trips.getByText('Total spent', { exact: true }).locator('../..').getByText('$0', { exact: true }).waitFor();
   await trips.getByText('Upcoming trips', { exact: true }).locator('../..').getByText('0', { exact: true }).waitFor();
   const row = trips.getByRole('cell', { name: /^Synthetic historical reservation/, includeHidden: true });
   assert.equal(await row.isVisible(), false);
   assert.equal(await trips.getByText('Test bookings and payments', { exact: true }).count(), 0);
   await trips.getByText('Past and inactive bookings (1)', { exact: true }).click();
   await row.waitFor();
   assert.equal(await row.getByRole('link', { name: 'View booking', exact: true }).getAttribute('href'), '/checkout/success?booking_id=synthetic-historical-booking');
  }, { legacyHistory: true });
  await check('Traveler page supports direct entry, return to profile and marketplace navigation', async page => {
   await personal(page).waitFor();
   assert.equal(await page.getByRole('heading', { name: 'Your profile', exact: true }).count(), 0);
   assert.equal(await page.getByRole('heading', { name: 'Host profile', exact: true }).count(), 0);
   assert.equal(await page.getByRole('heading', { name: 'Generated itineraries', exact: true }).count(), 0);
   assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
   await page.screenshot({ path: 'logs/dedicated-trips-mobile-synthetic.png' });
   await page.getByRole('link', { name: 'Explore tours', exact: true }).click();
   await page.getByRole('link', { name: 'Back to my trips', exact: true }).click();
   await page.waitForURL(`${origin}/account/trips`); await personal(page).waitFor();
   await page.getByRole('link', { name: 'Back to my account', exact: true }).click();
   await page.waitForURL(`${origin}/account`);
   await page.getByRole('heading', { name: 'Your profile', exact: true }).waitFor();
  }, { path: '/account/trips' });
  await check('Anonymous direct traveler page never fetches account bookings or payment history', async (page, calls) => {
   assert.equal(await personal(page).count(), 0);
   assert.equal(calls.some(call => call.path.startsWith('/bookings') || call.path.startsWith('/payments')), false);
  }, { path: '/account/trips', anonymous: true });
  console.log(`ACCOUNT CONTEXT UI: ${passed}/${passed + failures.length} passed; localhost/synthetic only`);
  if (failures.length) process.exitCode = 1;
 } finally { await browser.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
