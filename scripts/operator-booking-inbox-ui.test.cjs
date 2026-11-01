const {createUiCookieSession}=require('./helpers/ui-cookie-session.cjs');
// Local frontend only. Every API response is synthetic and external resources are blocked.
const assert = require('node:assert/strict');
const { chromium } = require('../logs/p06-browser/node_modules/playwright-core');
const origin = new URL(process.argv[2] || 'http://127.0.0.1:4183').origin;
assert.equal(new URL(origin).hostname, '127.0.0.1');
const item = id => ({ id, title: `Synthetic reservation ${id}`, date: '2026-11-30', departure_at: '2026-11-30T16:00:00Z', timezone: 'America/Lima', travelers: 1, amount_cents: 5000, currency: 'USD' });
async function main() {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  let passed = 0;
  const failures = [];
  async function check(name, fn, options = {}) {
    const context = await browser.newContext({ viewport: options.mobile ? { width: 390, height: 844 } : { width: 1440, height: 1000 }, locale: 'en-US' });
    await context.addInitScript(()=>localStorage.setItem('i18nextLng','en'));
    const cookies=createUiCookieSession(id=>({id,name:'Synthetic Account',email:'synthetic@example.test',role:'traveler'}),options.traveler?'synthetic-traveler':'synthetic-owner-a');
    const receipts = new Set(), calls = [], errors = [];
    const state = { fail: false, expire: false, failReview: false, extra: false };
    function inbox(owner) {
      if (owner === 'synthetic-traveler') return { is_operator: false, groups: {} };
      const ownerB = owner === 'synthetic-owner-b';
      const ids = ownerB ? ['owner-b-only'] : ['live-one', 'live-two', ...(state.extra ? ['live-new'] : [])];
      const batch = ids => { const items = ids.filter(id => !receipts.has(`${owner}:${id}`)).map(item); return { total: items.length, items }; };
      return { is_operator: true, groups: { reservations: batch(ids), sandbox: batch(ownerB ? [] : ['test-one']), unverified: batch(ownerB ? [] : ['legacy-one']) } };
    }
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (!['fetch', 'xhr'].includes(request.resourceType())) return url.origin === origin ? route.continue() : route.abort();
      if(await cookies.bootstrap(route))return;const owner=cookies.validate(request);
      calls.push({ path: url.pathname, method: request.method(), owner });
      let body = { items: [] }, status = 200;
      const provider = { id: `provider-${owner}`, name: 'Synthetic Host', type: 'operator', status: 'verified', user_id: owner, listings: [] };
      if (url.pathname === '/auth/me') body = { id: owner, name: 'Synthetic Account', email: 'synthetic@example.test', role: 'traveler' };
      if (url.pathname === '/providers/me') { body = owner === 'synthetic-traveler' ? {} : provider; status = owner === 'synthetic-traveler' ? 404 : 200; }
      if (url.pathname === '/operator/booking-inbox') {
        status = state.expire ? 401 : state.fail ? 503 : 200;
        body = status === 200 ? inbox(owner) : { message: 'Synthetic unavailable' };
      }
      if (/^\/operator\/booking-inbox\/[^/]+\/review$/.test(url.pathname)) {
        assert.equal(request.method(), 'POST');
        const id = url.pathname.split('/')[3];
        if (state.failReview) { status = 503; body = { message: 'Synthetic unavailable' }; }
        else { receipts.add(`${owner}:${id}`); body = { booking_id: id, reviewed_at: '2026-10-20T23:00:00Z' }; }
      }
        if(url.pathname==='/auth/web/logout')body={ok:true};

      return cookies.finish(route,status,body);
    });
    const page = await context.newPage(); page.setDefaultTimeout(5000); page.on('pageerror', e => errors.push(e.message));
    const openDashboard = async () => {
      await page.goto(`${origin}/operator/tours/new?panel=operations`);
      await page.getByRole('heading', { name: 'New reservations', exact: true }).waitFor();
      await page.getByRole('heading', { name: 'Reservations to review · 2', exact: true }).waitFor();
    };
    try {
      await fn({ page, context, receipts, calls, state, openDashboard, cookies });
      assert.deepEqual(errors, []);
      assert.ok(calls.filter(call => call.method !== 'GET').every(call => call.method === 'POST' && (call.path==='/auth/web/logout' || /^\/operator\/booking-inbox\/[^/]+\/review$/.test(call.path))), 'Only explicit review and server logout writes; no financial, email or inventory mutation');
      passed++; console.log(`PASS: ${name}`);
    } catch (error) { failures.push(name); console.error(`FAIL: ${name}: ${error.message.split('\n')[0]}`); }
    finally { await context.close(); }
  }
  try {
    await check('Account shows real, Sandbox and unknown counts and opens Bookings directly', async ({ page, receipts }) => {
      await page.goto(`${origin}/account`);
      const link = page.getByRole('link', { name: /Operator dashboard.*New: 2.*Sandbox: 1.*Unverified: 1/ }).first();
      await link.waitFor(); await link.click();
      await page.getByRole('heading', { name: 'New reservations', exact: true }).waitFor();
      assert.equal(receipts.size, 0);
    });
    await check('Explicit review clears only one reservation and survives reload', async ({ page, receipts, openDashboard }) => {
      await openDashboard();
      await page.getByRole('article').filter({ hasText: 'Synthetic reservation live-one' }).getByRole('button', { name: 'Mark as reviewed' }).click();
      await page.getByRole('heading', { name: 'Reservations to review · 1', exact: true }).waitFor();
      assert.equal(receipts.size, 1);
      await page.reload();
      await page.getByRole('heading', { name: 'Reservations to review · 1', exact: true }).waitFor();
      await page.getByRole('heading', { name: 'Sandbox reservations to review · 1', exact: true }).waitFor();
    });
    await check('Marking Sandbox reviewed never changes real reservation count', async ({ page, openDashboard }) => {
      await openDashboard();
      await page.getByRole('article').filter({ hasText: 'Synthetic reservation test-one' }).getByRole('button', { name: 'Mark as reviewed' }).click();
      await page.getByRole('heading', { name: 'Sandbox reservations to review · 0', exact: true }).waitFor();
      assert.equal(await page.getByRole('heading', { name: 'Reservations to review · 2', exact: true }).count(), 1);
    });
    await check('Failed review retains reservation and offers a safe retry', async ({ page, state, receipts, openDashboard }) => {
      await openDashboard(); state.failReview = true;
      const button = page.getByRole('article').filter({ hasText: 'Synthetic reservation live-one' }).getByRole('button', { name: 'Mark as reviewed' });
      await button.click(); await page.getByRole('alert').waitFor();
      assert.equal(receipts.size, 0); state.failReview = false; await button.click();
      await page.getByRole('heading', { name: 'Reservations to review · 1', exact: true }).waitFor();
    });
    await check('Focus refresh discovers a new reservation without email or reload', async ({ page, state, openDashboard }) => {
      await openDashboard(); state.extra = true;
      await page.evaluate(() => window.dispatchEvent(new Event('focus')));
      await page.getByRole('heading', { name: 'Reservations to review · 3', exact: true }).waitFor();
    });
    await check('Same-page dashboard alert returns from Tours panel to Bookings', async ({ page, openDashboard }) => {
      await openDashboard();
      await page.getByRole('button', { name: /Tours & availability/ }).click();
      assert.equal(await page.getByRole('heading', { name: 'New reservations', exact: true }).count(), 0);
      await page.locator('header').first().getByRole('link', { name: /Operator dashboard/ }).click();
      await page.getByRole('heading', { name: 'New reservations', exact: true }).waitFor();
    });
    await check('Mobile navigation exposes the operator alert without horizontal overflow', async ({ page }) => {
      await page.goto(`${origin}/account`);
      await page.getByRole('button', { name: 'Open menu', exact: true }).click();
      const link = page.locator('header').first().getByRole('link', { name: /Operator dashboard.*New: 2/ });
      await link.waitFor();
      const overflow = await page.evaluate(() => ({ width: innerWidth, scroll: document.documentElement.scrollWidth,
        nodes: [...document.querySelectorAll('body *')].filter(node => node.getBoundingClientRect().right > innerWidth + 1).slice(0, 10).map(node => ({ tag: node.tagName, classes: String(node.className), right: node.getBoundingClientRect().right })) }));
      assert.ok(overflow.scroll <= overflow.width + 1, JSON.stringify(overflow));
      await link.click(); await page.getByRole('heading', { name: 'New reservations', exact: true }).waitFor();
      await page.screenshot({ path: 'logs/operator-booking-inbox-mobile.png', fullPage: false });
    }, { mobile: true });
    await check('Header and account alerts fit tablet and desktop widths', async ({ page }) => {
      await page.goto(`${origin}/account`);
      await page.getByRole('link', { name: /Operator dashboard.*New: 2/ }).first().waitFor();
      for (const width of [768, 1024, 1280, 1440]) {
        await page.setViewportSize({ width, height: 1000 });
        const extent = await page.evaluate(() => ({ viewport: innerWidth, scroll: document.documentElement.scrollWidth }));
        assert.ok(extent.scroll <= extent.viewport + 1, `Viewport ${width} overflow: ${extent.scroll}`);
      }
    });
    await check('Traveler has no operator badge or access implied by a role string', async ({ page }) => {
      await page.goto(`${origin}/account`);
      await page.getByRole('button', { name: 'Become a host', exact: true }).waitFor();
      assert.equal(await page.getByRole('link', { name: /Operator dashboard/ }).count(), 0);
    }, { traveler: true });
    await check('Account switch never shows the prior owner inbox', async ({ page, openDashboard, cookies }) => {
      await openDashboard();
      cookies.select('synthetic-owner-b');
      await page.reload();
      await page.getByRole('heading', { name: 'Synthetic reservation owner-b-only', exact: true }).waitFor();
      assert.equal(await page.getByRole('heading', { name: 'Synthetic reservation live-one', exact: true }).count(), 0);
    });
    await check('Expired session uses existing logout and removes private operator alerts', async ({ page, state, openDashboard }) => {
      await openDashboard(); state.expire = true;
      await page.getByRole('button', { name: 'Refresh alerts', exact: true }).click();
      await page.locator('header').first().getByRole('link', { name: 'Login', exact: true }).waitFor();
      assert.equal(await page.getByRole('article').count(), 0);
      assert.equal(await page.evaluate(() => localStorage.getItem('wadatrip_token')), null);
    });
    await check('Unavailable backend shows an error instead of reporting zero new reservations', async ({ page, state, openDashboard }) => {
      await openDashboard(); state.fail = true;
      await page.getByRole('button', { name: 'Refresh alerts', exact: true }).click();
      await page.getByRole('alert').waitFor();
      assert.equal(await page.getByRole('heading', { name: 'Reservations to review · 0', exact: true }).count(), 0);
    });
  } finally { await browser.close(); }
  console.log(JSON.stringify({ passed, failed: failures.length, failures }));
  assert.equal(failures.length, 0);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
