// Local browser regression: synthetic API responses only, no processor or production calls.
const assert = require('node:assert/strict');
const { chromium } = require('../logs/p06-browser/node_modules/playwright-core');
const origin = new URL(process.argv[2] || 'http://127.0.0.1:4178').origin;
if (new URL(origin).hostname !== '127.0.0.1') throw Error('Local frontend only');
const future = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);

async function main() {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  let passed = 0;
  try {
    for (const locale of ['en-US', 'pt-BR']) {
      for (const free of [false, true]) {
        const listing = { id: 'csyntheticcurrency000001', title: 'Synthetic Currency Walk', city: 'Lima', country_code: 'PE', category: 'tour', status: 'published', price_from: free ? 0 : 50.50, currency: 'USD', tags: free ? ['free_tour'] : [], provider_id: 'synthetic-provider', provider_name: 'Synthetic Host' };
        const context = await browser.newContext({ locale });
        await context.addInitScript(() => localStorage.setItem('wadatrip_token', 'synthetic-currency-token'));
        const writes = [], errors = [];
        await context.route('**/*', async route => {
          const request = route.request(), url = new URL(request.url());
          if (url.origin === origin && url.pathname === '/synthetic-checkout') return route.fulfill({ contentType: 'text/html', body: '<p>Synthetic checkout</p>' });
          if (!['fetch', 'xhr'].includes(request.resourceType())) return url.origin === origin ? route.continue() : route.abort();
          if (request.method() !== 'GET') writes.push({ path: url.pathname, body: request.postDataJSON(), authorization: request.headers().authorization });
          let body = { items: [] };
          if (url.pathname === '/auth/me') body = { id: 'synthetic-traveler', email: 'synthetic@example.invalid', name: 'Synthetic Traveler', role: 'traveler' };
          if (url.pathname === '/listings/search') body = { items: [listing] };
          if (url.pathname === `/listings/${listing.id}`) body = listing;
          if (url.pathname.endsWith('/availability')) body = { items: [{ date: future, spots_available: 10 }] };
          if (url.pathname === '/tour-date-requests/status') body = { enabled: true };
          if (url.pathname.endsWith('/booking-terms')) body = { terms: { bookings_open: true, version: 'synthetic-policy', departure_at: `${future}T14:30:00Z`, timezone: 'America/Lima', meeting_point: 'Synthetic meeting point', booking_closes_at: `${future}T00:00:00Z`, cancellation_policy: 'Synthetic cancellation policy' } };
          if (url.pathname === '/bookings' && request.method() === 'POST') body = { id: 'synthetic-currency-booking', amount_cents: free ? 0 : 5050 };
          if (url.pathname === '/payments/bookings/synthetic-currency-booking/checkout') body = { url: `${origin}/synthetic-checkout` };
          return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
        });
        const page = await context.newPage(); page.setDefaultTimeout(5000);
        page.on('pageerror', error => errors.push(error.message));
        const price = new RegExp(new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', currencyDisplay: 'code', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(50.5).replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s/g, '\\s'));
        await page.goto(`${origin}/tours`);
        const card = page.getByRole('link').filter({ has: page.getByRole('heading', { name: listing.title, exact: true }) });
        await card.waitFor();
        assert.match(await card.innerText(), free ? /Free walking tour/ : price);
        await card.click();
        const button = page.getByRole('button', { name: free ? 'Join free tour' : 'Book and pay securely', exact: true });
        await button.waitFor();
        const notice = page.getByRole('note');
        if (free) assert.equal(await notice.count(), 0);
        else {
          await notice.getByText('Payment currency: USD (US dollars).', { exact: true }).waitFor();
          assert.match(await notice.innerText(), /Your bank may apply currency conversion or international transaction fees/);
          assert.equal(await notice.evaluate((node, cta) => Boolean(node.compareDocumentPosition(cta) & Node.DOCUMENT_POSITION_FOLLOWING), await button.elementHandle()), true);
          assert.match(await page.locator('body').innerText(), price);
          if (locale === 'en-US') {
            await page.getByRole('button', { name: 'English', exact: true }).click();
            await page.getByRole('menuitem', { name: /Español/ }).click();
            await notice.getByText('Moneda de pago: USD (dólares estadounidenses).', { exact: true }).waitFor();
            assert.match(await notice.innerText(), /Tu banco puede aplicar cargos/);
            await page.getByRole('button', { name: 'Español', exact: true }).click();
            await page.getByRole('menuitem', { name: /Français/ }).click();
            await notice.getByText('Devise de paiement : USD (dollars américains).', { exact: true }).waitFor();
            assert.match(await notice.innerText(), /Votre banque peut appliquer des frais/);
            await page.getByRole('button', { name: 'Français', exact: true }).click();
            await page.getByRole('menuitem', { name: /English/ }).click();
            await notice.getByText('Payment currency: USD (US dollars).', { exact: true }).waitFor();
          }
        }
        await page.getByRole('button', { name: /^Booking date:/ }).click();
        await page.locator('[data-slot="popover-content"] button[name="day"]:not(:disabled)').first().click();
        await page.getByRole('checkbox', { name: 'I have read and accept this cancellation policy.' }).check();
        await button.click();
        if (free) await page.getByText('Your free tour booking is confirmed.', { exact: true }).waitFor();
        else await page.waitForURL(`${origin}/synthetic-checkout`);
        assert.equal(writes.length, free ? 1 : 2);
        assert.deepEqual(writes[0], { path: '/bookings', authorization: 'Bearer synthetic-currency-token', body: { listing_id: listing.id, num_people: 1, date: future, policy_version: 'synthetic-policy' } });
        if (!free) assert.deepEqual(writes[1], { path: '/payments/bookings/synthetic-currency-booking/checkout', authorization: 'Bearer synthetic-currency-token', body: null });
        assert.deepEqual(errors, []);
        await context.close();
        passed++; console.log(`PASS ${locale}: ${free ? 'free tour has no charge notice or checkout' : 'explicit USD, cents preserved, notice before CTA, server-owned checkout payload'}`);
      }
    }
    console.log(`CURRENCY UI: ${passed}/${passed} passed; localhost and synthetic API only`);
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
