// Local assets and synthetic API responses only; all external requests are blocked.
const assert = require('node:assert/strict');
const { chromium } = require('../logs/p06-browser/node_modules/playwright-core');
const origin = new URL(process.argv[2] || 'http://127.0.0.1:4178').origin;
if (new URL(origin).hostname !== '127.0.0.1') throw Error('Local frontend only');
const id = 'synthetic-summary-booking';
const token = 'synthetic-summary-token';
const fixture = {
  id, status: 'confirmed', payment_status: 'paid', amount_cents: 10000, currency: 'usd',
  date: '2026-11-30T00:00:00.000Z', num_people: 2,
  listing: { id: 'synthetic-summary-listing', title: 'Synthetic city tour', price_from: 999999, meeting_point: 'Changed listing meeting point' },
  provider: { name: 'Synthetic Host' },
  booking_terms: { departure_at: '2026-11-30T16:00:00Z', timezone: 'America/Lima', meeting_point: 'Synthetic booked meeting point' },
  checkout_session_id: 'cs_test_synthetic_private', payment_intent_id: 'pi_synthetic_private',
  user: { email: 'private-synthetic@example.invalid' },
};
async function main() {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  let passed = 0; const failures = [];
  async function check(name, fn, options = {}) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-US', timezoneId: 'Pacific/Honolulu' });
    const calls = [], errors = [];
    if (!options.anonymous) await context.addInitScript(value => localStorage.setItem('wadatrip_token', value), token);
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (!['fetch', 'xhr'].includes(request.resourceType())) return url.origin === origin ? route.continue() : route.abort();
      calls.push({ path: url.pathname, method: request.method(), authorization: request.headers().authorization });
      let body = { items: [] }, status = 200;
      if (url.pathname === '/auth/me') body = { id: 'synthetic-summary-user', name: 'Synthetic Traveler', role: 'traveler' };
      if (url.pathname === `/bookings/${id}`) { body = { ...fixture, ...options.booking }; status = options.status || 200; }
      return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    });
    const page = await context.newPage(); page.setDefaultTimeout(1500);
    page.on('pageerror', error => errors.push(error.message));
    try {
      await page.goto(`${origin}/checkout/success?booking_id=${id}&amount=1&currency=EUR&status=confirmed`);
      await fn(page, calls);
      assert.deepEqual(errors, []);
      assert.ok(calls.every(call => call.method === 'GET' || (call.method === 'POST' && call.path === `/payments/bookings/${id}/reconcile`)));
      assert.ok(calls.filter(call => call.path.includes(id)).every(call => call.authorization === `Bearer ${token}`));
      passed++; console.log('PASS: ' + name);
    } catch (error) { failures.push(name); console.error('FAIL: ' + name + ': ' + error.message.split('\n')[0]); }
    finally { await context.close(); }
  }
  const summary = page => page.getByRole('region', { name: 'Your booking details', exact: true });
  try {
    await check('Authenticated confirmation displays tour, host and traveler count', async page => {
      await summary(page).getByText('Synthetic city tour', { exact: true }).waitFor();
      await summary(page).getByText('Synthetic Host', { exact: true }).waitFor();
      assert.equal(await summary(page).locator('dd').filter({ hasText: /^2$/ }).count(), 1);
    });
    await check('Departure uses booking snapshot timezone, not browser timezone or midnight date', async page => {
      const text = await summary(page).innerText();
      assert.match(text, /Nov 30, 2026, 11:00 AM \(America\/Lima\)/);
      assert.doesNotMatch(text, /Nov 29|06:00 AM/);
    });
    await check('Total uses persisted amount and currency, never query or current listing price', async page => {
      await summary(page).getByText('USD 100.00', { exact: true }).waitFor();
      assert.doesNotMatch(await summary(page).innerText(), /EUR|999999/);
    });
    await check('Meeting point comes from saved booking terms', async page => {
      await summary(page).getByText('Synthetic booked meeting point', { exact: true }).waitFor();
      assert.equal(await page.getByText('Changed listing meeting point', { exact: true }).count(), 0);
    });
    await check('Booking reference is visible without external payment IDs or private email', async page => {
      await summary(page).getByText(id, { exact: true }).waitFor();
      assert.doesNotMatch(await page.locator('body').innerText(), /cs_test_synthetic_private|pi_synthetic_private|private-synthetic@example/);
      await summary(page).getByRole('link', { name: 'Contact support', exact: true }).click();
      await page.waitForURL(`${origin}/contact`);
    });
    await check('Pending booking details never imply confirmation', async page => {
      await summary(page).waitFor(); await page.getByRole('heading', { name: 'Booking status pending', exact: true }).waitFor();
      assert.equal(await page.getByRole('heading', { name: 'Your booking is confirmed', exact: true }).count(), 0);
    }, { booking: { status: 'payment_pending', payment_status: 'unpaid' } });
    await check('Financial review shows booking details without false success', async page => {
      await summary(page).waitFor(); await page.getByRole('heading', { name: 'Payment requires review', exact: true }).waitFor();
      await page.getByText(/Do not pay again\./).waitFor();
    }, { booking: { status: 'reconciliation_required' } });
    await check('Cancelled booking retains reference and truthful cancellation state', async page => {
      await summary(page).getByText(id, { exact: true }).waitFor(); await page.getByRole('heading', { name: 'Booking cancelled', exact: true }).waitFor();
    }, { booking: { status: 'cancelled', payment_status: 'refunded' } });
    await check('Unknown historical amount is not presented as zero or reconstructed from listing', async page => {
      await summary(page).getByText('Not available', { exact: true }).waitFor();
      assert.doesNotMatch(await summary(page).innerText(), /USD 0\.00|999999/);
    }, { booking: { amount_cents: null, total_price: null } });
    await check('Free booking explicitly shows zero total without starting checkout', async (page, calls) => {
      await summary(page).getByText('USD 0.00', { exact: true }).waitFor();
      assert.equal(calls.some(call => call.path.endsWith('/checkout')), false);
    }, { booking: { amount_cents: 0 } });
    await check('Negative historical amount is unavailable, never shown as a credit', async page => {
      await summary(page).getByText('Not available', { exact: true }).waitFor();
      assert.doesNotMatch(await summary(page).innerText(), /USD -/);
    }, { booking: { amount_cents: -100 } });
    await check('Missing currency does not silently become USD', async page => {
      await summary(page).getByText('Not available', { exact: true }).waitFor();
      assert.doesNotMatch(await summary(page).innerText(), /USD 100/);
    }, { booking: { currency: null } });
    await check('Legacy booking falls back to its calendar day without inventing meeting point', async page => {
      await summary(page).getByText('Nov 30, 2026', { exact: true }).waitFor();
      assert.equal(await summary(page).getByText('Changed listing meeting point', { exact: true }).count(), 0);
    }, { booking: { booking_terms: null } });
    await check('Unauthorized booking returns no booking details', async page => {
      await page.getByText('Unable to verify this booking. No confirmation is available.', { exact: true }).waitFor();
      assert.equal(await summary(page).count(), 0);
    }, { status: 403 });
    await check('Anonymous visitor cannot fetch or display a booking', async (page, calls) => {
      await page.getByRole('heading', { name: 'Sign in to view your booking', exact: true }).waitFor();
      assert.equal(await summary(page).count(), 0); assert.equal(calls.some(call => call.path.includes(id)), false);
    }, { anonymous: true });
    await check('Logout removes the previous travelers booking details', async page => {
      await summary(page).waitFor(); await page.setViewportSize({ width: 1440, height: 900 });
      await page.getByRole('button', { name: 'Log out', exact: true }).click();
      await page.getByRole('heading', { name: 'Sign in to view your booking', exact: true }).waitFor();
      assert.equal(await summary(page).count(), 0);
      assert.equal(await page.getByText('Synthetic booked meeting point', { exact: true }).count(), 0);
    });
    await check('Spanish and French summary labels follow the existing language selector', async page => {
      await summary(page).waitFor(); await page.setViewportSize({ width: 1440, height: 900 });
      await page.getByRole('button', { name: 'English', exact: true }).click();
      await page.getByRole('menuitem', { name: /Español/ }).click();
      await page.getByRole('region', { name: 'Detalles de tu reserva', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Español', exact: true }).click();
      await page.getByRole('menuitem', { name: /Français/ }).click();
      await page.getByRole('region', { name: 'Détails de votre réservation', exact: true }).waitFor();
    });
    await check('Mobile summary fits and long reference wraps', async page => {
      await summary(page).waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await summary(page).scrollIntoViewIfNeeded(); await page.screenshot({ path: 'logs/booking-summary-mobile-synthetic.png' });
    });
    console.log(`BOOKING SUMMARY UI: ${passed}/${passed + failures.length} passed; localhost/synthetic API only`);
    if (failures.length) process.exitCode = 1;
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
