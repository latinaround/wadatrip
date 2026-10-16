// Local preview + synthetic API only. No production booking, Stripe or email calls.
const assert = require('node:assert/strict');
const { chromium } = require('../logs/p06-browser/node_modules/playwright-core');
const origin = new URL(process.argv[2] || 'http://127.0.0.1:4178').origin;
if (new URL(origin).hostname !== '127.0.0.1') throw Error('Local frontend only');
const id = 'synthetic-cancellation-booking';
const token = 'synthetic-cancellation-token';
const future = new Date(Date.now() + 14 * 86400000).toISOString();
const past = new Date(Date.now() - 86400000).toISOString();
const fixture = {
  id, status: 'confirmed', payment_status: 'paid', amount_cents: 5000, currency: 'usd', num_people: 1,
  date: future.slice(0, 10), listing: { title: 'Synthetic cancellation tour' },
  booking_terms: { version: 'synthetic-policy', cancellation_policy: 'Synthetic 24-hour cancellation policy.',
    cancellation_deadline: future, departure_at: future, timezone: 'America/Lima', meeting_point: 'Synthetic meeting point' },
};
async function main() {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  let passed = 0; const failures = [];
  const review = page => page.getByRole('button', { name: 'Review cancellation and refund', exact: true });
  const dialog = page => page.getByRole('alertdialog', { name: 'Cancel this booking?', exact: true });
  async function check(name, fn, options = {}) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'en-US' });
    await context.addInitScript(value => localStorage.setItem('wadatrip_token', value), token);
    let booking = { ...fixture, ...options.booking, booking_terms: { ...fixture.booking_terms, ...options.terms } };
    const calls = [], errors = []; let release;
    const gate = options.delay ? new Promise(resolve => { release = resolve; }) : Promise.resolve();
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (!['fetch', 'xhr'].includes(request.resourceType())) return url.origin === origin ? route.continue() : route.abort();
      calls.push({ path: url.pathname, method: request.method(), authorization: request.headers().authorization, body: request.postData() });
      let body = { items: [] }, status = 200;
      if (url.pathname === '/auth/me') body = { id: 'synthetic-cancellation-user', name: 'Synthetic Traveler', role: 'traveler' };
      if (url.pathname === `/bookings/${id}/cancel`) {
        await gate; status = options.cancelStatus || 200;
        if (status === 200) booking = { ...booking, status: 'cancelled', payment_status: 'refunded', cancellation_requested_at: new Date().toISOString(), ...options.cancelResult };
        body = status === 200 ? booking : { message: 'Synthetic cancellation could not be verified.' };
      }
      if (url.pathname === `/bookings/${id}`) body = booking;
      return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    });
    const page = await context.newPage(); page.setDefaultTimeout(1500); page.on('pageerror', error => errors.push(error.message));
    const cancellations = () => calls.filter(call => call.path.endsWith('/cancel'));
    try {
      await page.goto(`${origin}/checkout/success?booking_id=${id}&cancel=1&refund=999999`);
      await page.getByRole('heading', { name: 'Your cancellation policy', exact: true }).waitFor();
      await fn(page, cancellations, release);
      assert.deepEqual(errors, []);
      assert.ok(calls.every(call => call.method === 'GET' || (call.method === 'POST' && [ `/bookings/${id}/cancel`, `/payments/bookings/${id}/reconcile` ].includes(call.path))));
      passed++; console.log('PASS: ' + name);
    } catch (error) { failures.push(name); console.error('FAIL: ' + name + ': ' + error.message.split('\n')[0]); }
    finally { release?.(); await context.close(); }
  }
  try {
    await check('Reading policy never displays an acceptance checkbox or starts cancellation', async (page, cancellations) => {
      await review(page).waitFor(); assert.equal(await page.getByRole('checkbox').count(), 0);
      assert.equal(await page.getByRole('button', { name: 'Confirm cancellation', exact: true }).count(), 0);
      assert.equal(await dialog(page).count(), 0); assert.equal(cancellations().length, 0);
    });
    await check('Review is an informational step with a safe default and no POST', async (page, cancellations) => {
      await review(page).click(); await dialog(page).waitFor();
      await dialog(page).getByText('Synthetic cancellation tour', { exact: true }).waitFor();
      assert.equal(await dialog(page).getByRole('button', { name: 'Keep my booking', exact: true }).evaluate(node => node === document.activeElement), true);
      assert.equal(cancellations().length, 0);
    });
    await check('Keep my booking closes the review without any cancellation', async (page, cancellations) => {
      await review(page).click(); await dialog(page).getByRole('button', { name: 'Keep my booking', exact: true }).click();
      await dialog(page).waitFor({ state: 'hidden' }); assert.equal(cancellations().length, 0);
      await page.getByRole('heading', { name: 'Your booking is confirmed', exact: true }).waitFor();
    });
    await check('Escape dismisses the review and restores focus without cancelling', async (page, cancellations) => {
      await review(page).click(); await dialog(page).waitFor(); await page.keyboard.press('Escape');
      await dialog(page).waitFor({ state: 'hidden' }); assert.equal(cancellations().length, 0);
      assert.equal(await review(page).evaluate(node => node === document.activeElement), true);
    });
    await check('Only explicit confirmation sends one Bearer request with no client refund amount', async (page, cancellations) => {
      await review(page).click(); await dialog(page).getByText(/Estimated refund: USD\s50\.00/).waitFor();
      await dialog(page).getByRole('button', { name: 'Confirm cancellation', exact: true }).click();
      await page.getByRole('heading', { name: 'Booking cancelled', exact: true }).waitFor();
      assert.deepEqual(cancellations(), [{ path: `/bookings/${id}/cancel`, method: 'POST', authorization: `Bearer ${token}`, body: null }]);
    });
    await check('After the deadline no refund is promised', async (page, cancellations) => {
      await review(page).click(); await dialog(page).getByText('No automatic refund applies after the free cancellation deadline under your accepted policy.', { exact: true }).waitFor();
      assert.equal(await dialog(page).getByText(/Estimated refund:/).count(), 0); assert.equal(cancellations().length, 0);
    }, { terms: { cancellation_deadline: past } });
    await check('An unpaid booking does not promise a refund and server-pending cancellation stays pending', async page => {
      await review(page).click(); assert.equal(await dialog(page).getByText(/Estimated refund:/).count(), 0);
      await dialog(page).getByRole('button', { name: 'Confirm cancellation', exact: true }).click();
      await page.getByText(/Cancellation is being checked with the payment processor/).waitFor();
      assert.equal(await page.getByRole('heading', { name: 'Booking cancelled', exact: true }).count(), 0);
    }, { booking: { status: 'payment_pending', payment_status: 'unpaid' }, cancelResult: { status: 'cancellation_pending', payment_status: 'unpaid' } });
    await check('Free tour review states that no payment was required', async page => {
      await review(page).click(); await dialog(page).getByText('No payment was required for this booking.', { exact: true }).waitFor();
      assert.equal(await dialog(page).getByText(/Estimated refund:/).count(), 0);
    }, { booking: { amount_cents: 0 } });
    await check('Request failure keeps the review open and never claims cancellation succeeded', async (page, cancellations) => {
      await review(page).click(); await dialog(page).getByRole('button', { name: 'Confirm cancellation', exact: true }).click();
      await dialog(page).getByRole('alert').getByText('Synthetic cancellation could not be verified.', { exact: true }).waitFor();
      await dialog(page).getByRole('button', { name: 'Keep my booking', exact: true }).click();
      assert.equal(cancellations().length, 1); await page.getByRole('heading', { name: 'Your booking is confirmed', exact: true }).waitFor();
    }, { cancelStatus: 503 });
    await check('Cancellation 401 signs out without displaying the previous booking', async page => {
      await review(page).click(); await dialog(page).getByRole('button', { name: 'Confirm cancellation', exact: true }).click();
      await page.getByText('Sign in to check your booking.', { exact: true }).waitFor();
      assert.equal(await page.getByText('Synthetic cancellation tour', { exact: true }).count(), 0);
    }, { cancelStatus: 401 });
    await check('A delayed request disables both actions and prevents a duplicate submission', async (page, cancellations, release) => {
      await review(page).click(); await dialog(page).getByRole('button', { name: 'Confirm cancellation', exact: true }).click();
      const busy = dialog(page).getByRole('button', { name: 'Requesting cancellation…', exact: true });
      await busy.waitFor(); assert.equal(await busy.isDisabled(), true);
      assert.equal(await dialog(page).getByRole('button', { name: 'Keep my booking', exact: true }).isDisabled(), true);
      await busy.evaluate(node => { node.click(); node.click(); });
      assert.equal(cancellations().length, 1); release();
      await page.getByRole('heading', { name: 'Booking cancelled', exact: true }).waitFor();
    }, { delay: true });
    await check('Invalid historical deadline/timezone does not crash or promise a refund', async (page, cancellations) => {
      await review(page).click(); await dialog(page).waitFor();
      assert.equal(await dialog(page).getByText(/Estimated refund:/).count(), 0); assert.equal(cancellations().length, 0);
    }, { terms: { cancellation_deadline: 'invalid', timezone: 'Synthetic/Invalid' } });
    await check('Terminal bookings do not offer cancellation', async page => {
      assert.equal(await review(page).count(), 0); assert.equal(await dialog(page).count(), 0);
    }, { booking: { status: 'completed' } });
    await check('Spanish review controls use the existing language setting', async page => {
      await review(page).waitFor(); await page.setViewportSize({ width: 1440, height: 900 });
      await page.getByRole('button', { name: 'English', exact: true }).click(); await page.getByRole('menuitem', { name: /Español/ }).click();
      await page.getByRole('button', { name: 'Revisar cancelación y reembolso', exact: true }).click();
      const modal = page.getByRole('alertdialog', { name: '¿Cancelar esta reserva?', exact: true });
      await modal.getByRole('button', { name: 'Mantener mi reserva', exact: true }).waitFor();
      await modal.getByRole('button', { name: 'Confirmar cancelación', exact: true }).waitFor();
    });
    await check('Mobile review fits and exposes both decisions', async page => {
      await review(page).click(); await dialog(page).waitFor();
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await dialog(page).getByRole('button', { name: 'Keep my booking', exact: true }).scrollIntoViewIfNeeded();
      await page.screenshot({ path: 'logs/cancellation-review-mobile-synthetic.png' });
    });
    console.log(`CANCELLATION REVIEW UI: ${passed}/${passed + failures.length} passed; localhost/synthetic only`);
    if (failures.length) process.exitCode = 1;
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
