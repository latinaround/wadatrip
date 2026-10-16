// Local application assets with synthetic API only. No Stripe, email or production calls.
const assert = require('node:assert/strict');
const { chromium } = require('../logs/p06-browser/node_modules/playwright-core');
const origin = new URL(process.argv[2] || 'http://127.0.0.1:4178').origin;
if (new URL(origin).hostname !== '127.0.0.1') throw Error('Local frontend only');
const future = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);
async function main() {
 const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
 let passed = 0; const failures = [];
 async function check(name, fn) {
  try { await fn(); passed++; console.log('PASS: ' + name); }
  catch (error) { failures.push(name); console.error('FAIL: ' + name + ': ' + error.message.split('\n')[0]); }
 }
 try {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-US' });
  await context.addInitScript(() => localStorage.setItem('wadatrip_token', 'synthetic-details-token'));
  let free = false, minutes = 360, multipleHosts = false; const writes = [], errors = [];
  const listing = () => ({ id: 'csyntheticdetails000001', title: 'Synthetic City Experience', description: 'Synthetic introduction.\n\nIncluded: synthetic guide and transport.\n\nSynthetic meeting instructions.', city: 'Lima', country_code: 'PE', category: 'tour', status: 'published', price_from: free ? 0 : 50.50, currency: 'USD', duration_minutes: minutes, tags: free ? ['free_tour'] : [], provider_id: 'synthetic-provider', provider_name: 'Synthetic Host' });
  const alternate = () => ({ ...listing(), id: 'csyntheticdetails000002', provider_id: 'synthetic-alternate-provider', provider_name: 'Synthetic Alternate Host', duration_minutes: 90, price_from: 80.50 });
  await context.route('**/*', async route => {
   const request = route.request(), url = new URL(request.url());
   if (url.origin === origin && url.pathname === '/synthetic-checkout') return route.fulfill({ contentType: 'text/html', body: '<p>Synthetic checkout</p>' });
   if (!['fetch', 'xhr'].includes(request.resourceType())) return url.origin === origin ? route.continue() : route.abort();
   if (request.method() !== 'GET') writes.push({ path: url.pathname, body: request.postDataJSON(), auth: request.headers().authorization });
   let body = { items: [] };
   if (url.pathname === '/auth/me') body = { id: 'synthetic-traveler', name: 'Synthetic Traveler', email: 'synthetic@example.invalid', role: 'traveler' };
   if (url.pathname === '/listings/search') body = { items: multipleHosts ? [listing(), alternate()] : [listing()] };
   if (url.pathname === `/listings/${listing().id}`) body = listing();
   if (url.pathname.endsWith('/availability')) body = { items: [{ date: future, spots_available: 10 }] };
   if (url.pathname.endsWith('/booking-terms')) body = { terms: { bookings_open: true, version: 'synthetic-policy', departure_at: `${future}T16:00:00Z`, timezone: 'America/Lima', meeting_point: 'Synthetic meeting point', booking_closes_at: `${future}T00:00:00Z`, cancellation_policy: 'Synthetic cancellation policy' } };
   if (url.pathname === '/tour-date-requests/status') body = { enabled: true };
   if (url.pathname === '/bookings' && request.method() === 'POST') body = { id: 'synthetic-details-booking', amount_cents: free ? 0 : 10100 };
   if (url.pathname === '/payments/bookings/synthetic-details-booking/checkout') body = { url: `${origin}/synthetic-checkout` };
   return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });
  const page = await context.newPage(); page.setDefaultTimeout(3500); page.on('pageerror', error => errors.push(error.message));
  const detail = async () => { await page.goto(`${origin}/tours/${listing().id}`); await page.getByRole('heading', { name: listing().title, exact: true }).waitFor(); };
  await page.goto(`${origin}/tours`);
  await page.getByRole('heading', { name: listing().title, exact: true }).waitFor();
  await check('Catalog identifies the paid price as per person', async () => { await page.getByText('per person', { exact: true }).waitFor(); });
  await detail();
  await check('Single-host booking identifies the per-person unit once', async () => { await page.getByText('per person', { exact: true }).waitFor(); });
  await check('Booking duration comes from the selected listing in hours', async () => { await page.getByText('Duration: 6 hours', { exact: true }).waitFor(); });
  await check('Traveler input has a visible associated label on mobile', async () => { const label = page.locator('label[for="booking-travelers"]'); await label.waitFor(); assert.equal(await label.innerText(), 'Travelers'); assert.equal(await page.locator('#booking-travelers').getAttribute('type'), 'number'); await label.scrollIntoViewIfNeeded(); await page.screenshot({ path: 'logs/booking-details-mobile-synthetic.png' }); });
  await check('Listing description preserves paragraphs', async () => { const description = page.getByText(/^Synthetic introduction\./).first(); assert.equal(await description.evaluate(node => getComputedStyle(node).whiteSpace), 'pre-line'); });
  await check('Single host does not repeat the tour description or offer redundant host selection', async () => { await page.getByText('1 host', { exact: true }).waitFor(); assert.equal(await page.getByText(/^Synthetic introduction\./).count(), 1); assert.equal(await page.getByRole('button', { name: 'Select Synthetic Host', exact: true }).count(), 0); });
  await check('Traveler date inquiry has one visible title and retains its form', async () => { const panel = page.getByRole('region', { name: 'Request a date', exact: true }); assert.equal(await panel.getByRole('heading', { name: 'Request a date', exact: true }).count(), 0); assert.equal(await panel.locator('summary').innerText(), 'Request a date'); assert.equal(await panel.getByLabel('Requested date', { exact: true }).isVisible(), true); });
  await check('One share action copies the current link with truthful feedback', async () => { const button = page.getByRole('button', { name: 'Copy public tour link', exact: true }); assert.equal(await button.count(), 1); assert.equal(await page.getByRole('button', { name: 'Copy public link', exact: true }).count(), 0); await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async value => { window.syntheticCopiedLink = value; } } })); await button.click(); await page.getByText('Public tour link copied.', { exact: true }).waitFor(); assert.equal(await page.evaluate(() => window.syntheticCopiedLink), page.url()); });
  await check('Generic duplicate-listing marketing does not distract from booking', async () => { assert.equal(await page.getByText('Cleaner listings, verified hosts, and less duplicated marketplace noise.', { exact: true }).count(), 0); assert.equal(await page.getByText('Send one clean link to travelers', { exact: true }).count(), 0); });
  await check('Changing language translates price units, duration and traveler label', async () => {
   await page.setViewportSize({ width: 1440, height: 900 });
   for (const item of [ { from: 'English', next: 'Español', price: 'por persona', duration: 'Duración: 6 horas', travelers: 'Viajeros' }, { from: 'Español', next: 'Français', price: 'par personne', duration: 'Durée : 6 heures', travelers: 'Voyageurs' } ]) {
    await page.getByRole('button', { name: item.from, exact: true }).click();
    await page.getByRole('menuitem', { name: new RegExp(item.next) }).click();
    await page.getByText(item.price, { exact: true }).first().waitFor();
    await page.getByText(item.duration, { exact: true }).waitFor();
    assert.equal(await page.locator('label[for="booking-travelers"]').innerText(), item.travelers);
   }
   await page.getByRole('button', { name: 'Français', exact: true }).click(); await page.getByRole('menuitem', { name: /English/ }).click();
   await page.getByText('Duration: 6 hours', { exact: true }).waitFor(); await page.locator('label[for="booking-travelers"]').scrollIntoViewIfNeeded(); await page.screenshot({ path: 'logs/booking-details-desktop-synthetic.png' });
  });
  multipleHosts = true; await detail();
  await check('Multiple hosts retain comparison, individual price units and working selection', async () => { await page.getByRole('heading', { name: 'Choose your host', exact: true }).waitFor(); await page.getByText('2 hosts', { exact: true }).waitFor(); assert.equal(await page.getByText('per person', { exact: true }).count(), 3); assert.equal(await page.getByText(/^Synthetic introduction\./).count(), 1); await page.getByRole('button', { name: 'Select Synthetic Alternate Host', exact: true }).click(); await page.getByText('Duration: 90 minutes', { exact: true }).waitFor(); assert.equal(await page.getByRole('button', { name: 'Select Synthetic Alternate Host', exact: true }).getAttribute('aria-pressed'), 'true'); assert.match(await page.locator('body').innerText(), /USD\s80\.50/); assert.equal(writes.length, 0); });
  multipleHosts = false;
  // Each following scenario reloads the app so localization from prior checks cannot leak.
  minutes = 90; await detail();
  await check('Non-whole-hour duration stays exact in minutes', async () => { await page.getByText('Duration: 90 minutes', { exact: true }).waitFor(); });
  minutes = null; await detail();
  await check('Missing duration is not invented', async () => { assert.equal(await page.getByText(/^Duration:/).count(), 0); });
  minutes = 360; await detail();
  await check('Two travelers still use JWT and server-owned booking pricing', async () => {
   // Selector works on both pre-fix and post-fix markup to independently test the payload.
   await page.locator('input[type="number"]').first().fill('2');
   await page.getByRole('button', { name: /^Booking date:/ }).click();
   await page.locator('[data-slot="popover-content"] button[name="day"]:not(:disabled)').first().click();
   await page.getByRole('checkbox', { name: 'I have read and accept this cancellation policy.' }).check();
   await page.getByRole('button', { name: 'Book and pay securely', exact: true }).click(); await page.waitForURL(`${origin}/synthetic-checkout`);
   assert.deepEqual(writes, [ { path: '/bookings', auth: 'Bearer synthetic-details-token', body: { listing_id: listing().id, num_people: 2, date: future, policy_version: 'synthetic-policy' } }, { path: '/payments/bookings/synthetic-details-booking/checkout', body: null, auth: 'Bearer synthetic-details-token' } ]);
  });
  free = true; writes.length = 0; await page.goto(`${origin}/tours`); await page.getByRole('heading', { name: listing().title, exact: true }).waitFor();
  await check('Free catalog does not display a paid per-person price', async () => { assert.equal(await page.getByText('per person', { exact: true }).count(), 0); await page.getByText('Free walking tour', { exact: true }).first().waitFor(); });
  await detail();
  await check('Free tour keeps real duration without charge unit and never starts checkout', async () => {
   assert.equal(await page.getByText('per person', { exact: true }).count(), 0); await page.getByText('Duration: 6 hours', { exact: true }).waitFor();
   await page.locator('input[type="number"]').first().fill('2');
   await page.getByRole('button', { name: /^Booking date:/ }).click(); await page.locator('[data-slot="popover-content"] button[name="day"]:not(:disabled)').first().click();
   await page.getByRole('checkbox', { name: 'I have read and accept this cancellation policy.' }).check();
   await page.getByRole('button', { name: 'Join free tour', exact: true }).click(); await page.getByText('Your free tour booking is confirmed.', { exact: true }).waitFor();
   assert.equal(writes.length, 1); assert.equal(writes[0].path, '/bookings'); assert.equal(writes[0].auth, 'Bearer synthetic-details-token');
  });
  assert.deepEqual(errors, []);
  console.log(`BOOKING DETAILS UI: ${passed}/${passed + failures.length} passed; synthetic API only`);
  if (failures.length) process.exitCode = 1;
 } finally { await browser.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
