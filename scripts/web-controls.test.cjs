// Every API response is synthetic. No emails, bookings, payments or account
// changes are sent to production. Only application assets reach the target.
const assert = require('node:assert/strict');
const path = require('node:path');
const { chromium } = require(path.resolve(__dirname, '../logs/p06-browser/node_modules/playwright-core'));

async function main() {
  const origin = new URL(process.argv[2] || 'http://localhost:4173').origin;
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const user = { id: 'synthetic-traveler', name: 'Synthetic Traveler', email: 'traveler@example.invalid', role: 'traveler' };
  const listing = { id: 'csyntheticlisting000001', title: 'Synthetic walking tour', city: 'Lima', country_code: 'PE', status: 'published', price_from: 120, currency: 'USD', provider_id: 'synthetic-provider', provider_name: 'Synthetic Host' };
  const freeListing = { ...listing, id: 'csyntheticlisting000002', title: 'Synthetic free walk', price_from: 0, tags: ['free_tour'] };
  const departure = new Date(Date.now() + 14 * 86400000).toISOString();
  const date = departure.slice(0, 10);
  const terms = { version: 'synthetic-policy-v1', departure_at: departure, booking_closes_at: departure, timezone: 'America/Lima', meeting_point: 'Synthetic meeting point', cancellation_policy: 'Synthetic policy', bookings_open: true };
  const calls = [];
  const errors = [];
  let passed = 0;
  const failures = [];
  try {
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (url.origin === origin && url.pathname === '/synthetic-checkout') return route.fulfill({ contentType: 'text/html', body: '<h1>Synthetic checkout</h1>' });
      if (!['fetch', 'xhr'].includes(request.resourceType())) return url.origin === origin ? route.continue() : route.abort();
      calls.push({ path: url.pathname, method: request.method(), authorization: request.headers().authorization, body: request.postDataJSON() });
      let body = [];
      if (url.pathname === '/auth/me') body = user;
      if (url.pathname === '/providers/me') return route.fulfill({ status: 404, contentType: 'application/json', body: '{"message":"No synthetic provider"}' });
      if (url.pathname === '/listings/search') body = { items: url.searchParams.get('free_tour') === 'true' ? [freeListing] : [listing, freeListing] };
      if (url.pathname === `/listings/${listing.id}`) body = listing;
      if (url.pathname === `/listings/${freeListing.id}`) body = freeListing;
      if (url.pathname.endsWith('/availability')) body = { items: [{ date, spots_available: 10 }] };
      if (url.pathname.endsWith('/booking-terms')) body = { terms };
      if (url.pathname === '/bookings' && request.method() === 'POST') body = { id: 'synthetic-booking', amount_cents: request.postDataJSON().listing_id === freeListing.id ? 0 : 12000 };
      if (url.pathname === '/payments/bookings/synthetic-booking/checkout') body = { url: `${origin}/synthetic-checkout` };
      if (url.pathname === '/bookings/synthetic-booking') body = { id: 'synthetic-booking', status: 'confirmed', payment_status: 'paid', amount_cents: 12000 };
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });
    const page = await context.newPage();
    page.setDefaultTimeout(3000);
    page.on('pageerror', error => errors.push(error.message));
    async function check(name, fn) {
      try { await fn(); passed++; console.log(`PASS: ${name}`); }
      catch (error) { failures.push(name); console.log(`FAIL: ${name}: ${error.message}`); }
    }
    await check('About us contact and careers navigate to contact', async () => {
      await page.goto(`${origin}/about-us`);
      await page.locator('main h1').waitFor();
      const links = page.locator('main a[href="/contact"]');
      assert.equal(await links.count(), 2);
      await links.first().click(); await page.waitForURL('**/contact');
    });
    await check('Contact prepares a real email draft and preserves entered data', async () => {
      await page.goto(`${origin}/contact`);
      for (const [id, value] of Object.entries({ name: 'Synthetic Traveler', email: user.email, subject: 'Synthetic inquiry', message: 'Synthetic message' })) await page.locator(`#${id}`).fill(value);
      await page.locator('main button[type="submit"]').click();
      const draft = page.locator('form a[href^="mailto:"]'); await draft.waitFor();
      assert.match(decodeURIComponent(await draft.getAttribute('href')), /Synthetic message/);
      assert.equal(await page.locator('#message').inputValue(), 'Synthetic message');
      assert.ok(await page.getByRole('status').isVisible());
      assert.equal(await page.locator('a[href="#"]').count(), 0);
    });
    await check('Demo prepares email rather than reporting a fictitious delivery', async () => {
      await page.goto(`${origin}/request-demo`);
      for (const [id, value] of Object.entries({ name: 'Synthetic Traveler', email: user.email, company: 'Synthetic Company', position: 'Tester', phone: '000000000', message: 'Synthetic demo request' })) await page.locator(`#${id}`).fill(value);
      await page.locator('#employees').selectOption('1-10');
      await page.locator('main button[type="submit"]').click();
      const draft = page.locator('form a[href^="mailto:"]'); await draft.waitFor();
      assert.match(decodeURIComponent(await draft.getAttribute('href')), /Synthetic demo request/);
      assert.equal(await page.locator('#message').inputValue(), 'Synthetic demo request');
      await page.locator('main a[href="/contact"]').click(); await page.waitForURL('**/contact');
    });
    await check('Support routes to contact instead of a placeholder WhatsApp number', async () => {
      await page.goto(origin);
      const support = page.locator('a[aria-label="Contact support"]');
      assert.equal(await support.getAttribute('href'), '/contact');
      await support.click(); await page.waitForURL('**/contact');
    });
    await check('Paused assistant is explicitly unavailable', async () => {
      await page.goto(`${origin}/products`);
      assert.ok(await page.getByRole('button', { name: 'Coming soon', exact: true }).isDisabled());
    });
    await check('Every desktop navigation link opens its matching page', async () => {
      await page.goto(origin);
      for (const route of ['/products', '/solutions', '/price-alerts', '/enhanced-search', '/tours', '/about-us', '/contact', '/privacy-policy']) {
        await page.locator(`header a[href="${route}"]`).first().click();
        await page.waitForURL(url => url.pathname === route);
        await page.locator('h1').first().waitFor();
      }
    });
    await check('Anonymous List your tour opens guide registration', async () => {
      await page.goto(origin);
      await page.locator('header a[href="/guide/register"]').first().click();
      await page.waitForURL('**/guide/register');
      await page.getByRole('heading', { name: 'Create your guide account', exact: true }).waitFor();
    });
    await check('Anonymous Sign in to book opens authentication without creating a booking', async () => {
      await page.goto(`${origin}/tours/${listing.id}`);
      const before = calls.length;
      await page.getByRole('button', { name: 'Sign in to book', exact: true }).click();
      await page.getByRole('dialog').waitFor();
      assert.ok(!calls.slice(before).some(call => call.path === '/bookings'));
    });
    await check('Clipboard unavailable does not report a successful copy', async () => {
      await page.goto(`${origin}/tours/${listing.id}`);
      await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: undefined }));
      await page.getByRole('button', { name: 'Copy public link', exact: true }).first().click();
      await page.getByText('Copy the URL from your browser and share it with travelers.', { exact: true }).waitFor();
    });
    await check('Host profile links are not nested inside selection buttons', async () => {
      await page.goto(`${origin}/tours/${listing.id}`);
      await page.getByRole('heading', { name: listing.title, exact: true }).waitFor();
      assert.equal(await page.locator('button a').count(), 0);
      await page.getByRole('button', { name: 'Select Synthetic Host', exact: true }).click();
    });
    await check('Traveler login describes the traveler destination', async () => {
      await page.goto(`${origin}/register?mode=login&role=traveler`);
      await page.getByRole('heading', { name: 'Sign in to your account', exact: true }).waitFor();
    });
    await check('Unavailable code delivery displays an error rather than a sent notice', async () => {
      await page.route('**/auth/request-code', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{"message":"Synthetic delivery unavailable"}' }));
      await page.goto(`${origin}/register?mode=login&role=traveler`);
      await page.locator('#guide-email').fill(user.email);
      await page.getByRole('button', { name: 'Send code to continue', exact: true }).click();
      await page.getByText('Synthetic delivery unavailable', { exact: true }).waitFor();
      assert.equal(await page.locator('#guide-secret').count(), 0);
      await page.unroute('**/auth/request-code');
    });
    await check('Switching modal sign-up back to login keeps the email form usable', async () => {
      await page.goto(`${origin}/tours/${listing.id}`);
      await page.getByRole('button', { name: 'Sign in to book', exact: true }).click();
      const dialog = page.getByRole('dialog');
      await dialog.getByRole('button', { name: 'New here? Create an account', exact: true }).click();
      await dialog.getByRole('button', { name: 'Already have an account? Sign in', exact: true }).click();
      assert.ok(await dialog.getByRole('button', { name: 'Email me a code', exact: true }).isVisible());
    });
    await check('Paused alerts do not accept a no-op submission', async () => {
      for (const route of ['/enhanced-search', '/price-alerts']) {
        await page.goto(`${origin}${route}`);
        await page.getByText('This feature is currently unavailable. You can browse tours and book available experiences.', { exact: true }).waitFor();
        assert.equal(await page.locator('form').count(), 0);
        await page.locator('main a[href="/tours"]').click(); await page.waitForURL('**/tours');
      }
    });
    await check('Tours navigation clears a free-only URL filter', async () => {
      await page.goto(`${origin}/tours?free_tour=true`);
      const filter = page.getByRole('checkbox', { name: 'Free walking tours', exact: true });
      await filter.waitFor(); assert.ok(await filter.isChecked());
      await page.locator('header a[href="/tours"]').first().click(); await page.waitForURL('**/tours');
      await page.waitForFunction(() => document.querySelector('#free-tours')?.checked === false);
      assert.equal(await filter.isChecked(), false);
    });
    await check('Country, city and free-tour filter controls update search and cards navigate', async () => {
      await page.goto(`${origin}/tours`);
      await page.getByLabel('Country', { exact: true }).click();
      await page.getByRole('option', { name: 'Peru (PE)', exact: true }).click();
      await page.getByLabel('City', { exact: true }).fill('Lima');
      const filtered = page.waitForResponse(response => new URL(response.url()).searchParams.get('free_tour') === 'true');
      await page.getByRole('checkbox', { name: 'Free walking tours', exact: true }).check(); await filtered;
      await page.getByRole('link').filter({ has: page.getByRole('heading', { name: freeListing.title, exact: true }) }).click();
      await page.getByRole('heading', { name: freeListing.title, exact: true }).waitFor();
      await page.getByRole('button', { name: 'Back', exact: true }).click(); await page.waitForURL('**/tours');
    });
    await check('Authenticated List your tour uses the existing session', async () => {
      await page.goto(origin);
      await page.evaluate(() => localStorage.setItem('wadatrip_token', 'synthetic-browser-test-token'));
      await page.reload();
      const link = page.locator('header a').filter({ hasText: 'List your tour' }).first();
      await page.getByRole('button', { name: user.name, exact: true }).waitFor();
      assert.equal(await link.getAttribute('href'), '/operator/tours/new');
      await link.click(); await page.waitForURL('**/operator/tours/new');
      await page.getByRole('heading', { name: 'Create your first tour', exact: true }).first().waitFor();
    });
    await check('Mobile menu and Login navigate correctly', async () => {
      await page.evaluate(() => localStorage.clear());
      await page.setViewportSize({ width: 390, height: 844 });
      await page.goto(origin);
      await page.getByRole('button', { name: 'Open menu', exact: true }).click();
      const login = page.locator('header a[href="/register?mode=login&role=traveler"]').filter({ visible: true });
      await login.click(); await page.waitForURL('**/register?mode=login&role=traveler');
    });
    await check('Booking controls validate input and paid checkout uses Bearer without client price or identity', async () => {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.evaluate(() => localStorage.setItem('wadatrip_token', 'synthetic-browser-test-token'));
      await page.goto(`${origin}/tours/${listing.id}`);
      const book = page.getByRole('button', { name: 'Book and pay securely', exact: true });
      await book.waitFor();
      const before = calls.length;
      await page.getByRole('spinbutton', { name: 'Travelers', exact: true }).fill('0');
      await book.click(); await page.getByText('Enter a valid traveler count', { exact: true }).waitFor();
      assert.ok(!calls.slice(before).some(call => call.path === '/bookings'));
      await page.getByRole('spinbutton', { name: 'Travelers', exact: true }).fill('2');
      await page.getByLabel('Booking date (UTC)', { exact: true }).fill(date);
      await page.getByLabel('I have read and accept this cancellation policy.', { exact: true }).check();
      await book.click(); await page.waitForURL('**/synthetic-checkout');
      const booking = calls.slice(before).find(call => call.path === '/bookings');
      assert.deepEqual(booking.body, { listing_id: listing.id, num_people: 2, date, policy_version: terms.version });
      assert.equal(booking.authorization, 'Bearer synthetic-browser-test-token');
      assert.ok(calls.slice(before).some(call => call.path.endsWith('/checkout') && call.authorization === booking.authorization));
    });
    await check('Free-tour button confirms using the backend result without checkout', async () => {
      await page.goto(`${origin}/tours/${freeListing.id}`);
      await page.getByRole('button', { name: 'Join free tour', exact: true }).waitFor();
      await page.getByLabel('Booking date (UTC)', { exact: true }).fill(date);
      await page.getByLabel('I have read and accept this cancellation policy.', { exact: true }).check();
      const before = calls.length;
      await page.getByRole('button', { name: 'Join free tour', exact: true }).click();
      await page.getByText('Your free tour booking is confirmed.', { exact: true }).waitFor();
      assert.ok(calls.slice(before).some(call => call.path === '/bookings'));
      assert.ok(!calls.slice(before).some(call => call.path.endsWith('/checkout')));
    });
    await check('Return-page Refresh status verifies backend and Back to tours navigates', async () => {
      await page.goto(`${origin}/checkout/success?booking_id=synthetic-booking`);
      await page.getByRole('heading', { name: 'Your booking is confirmed', exact: true }).waitFor();
      const before = calls.filter(call => call.path.endsWith('/reconcile')).length;
      await page.getByRole('button', { name: 'Refresh status', exact: true }).click();
      await page.getByRole('heading', { name: 'Your booking is confirmed', exact: true }).waitFor();
      assert.equal(calls.filter(call => call.path.endsWith('/reconcile')).length, before + 1);
      await page.getByRole('link', { name: 'Back to tours', exact: true }).click(); await page.waitForURL('**/tours');
    });
    await check('Language menu changes visible contact controls', async () => {
      await page.setViewportSize({ width: 1440, height: 1000 });
      await page.goto(`${origin}/contact`);
      await page.getByRole('button', { name: 'English', exact: true }).click();
      await page.getByRole('menuitem', { name: /Español/ }).click();
      await page.getByRole('button', { name: 'Preparar correo', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Español', exact: true }).click();
      await page.getByRole('menuitem', { name: /Français/ }).click();
      await page.getByRole('button', { name: 'Préparer le courriel', exact: true }).waitFor();
    });
    assert.equal(errors.length, 0, 'No uncaught browser errors');
    console.log(`WEB CONTROLS: ${passed}/${passed + failures.length} passed; synthetic API only`);
    if (failures.length) process.exitCode = 1;
  } finally { await context.close(); await browser.close(); }
}
main().catch(error => { console.error(`${error.name}: ${error.message}`); process.exitCode = 1; });
