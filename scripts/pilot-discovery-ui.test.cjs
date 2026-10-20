// Local application regression only: all API data is synthetic; external requests are blocked.
const assert = require('node:assert/strict');
const { chromium } = require('../logs/p06-browser/node_modules/playwright-core');
const origin = new URL(process.argv[2] || 'http://127.0.0.1:4183').origin;
assert.ok(['127.0.0.1', 'localhost'].includes(new URL(origin).hostname), 'Local frontend only');
const listings = [
  { id: 'csyntheticpilotperu00001', title: 'Synthetic Lima tour', city: 'Lima', country_code: 'PE' },
  { id: 'csyntheticpilotecuador01', title: 'Synthetic Quito tour', city: 'Quito', country_code: 'EC' },
].map(item => ({ ...item, price_from: 50, currency: 'USD', status: 'published', provider_id: 'synthetic-host', provider_name: 'Synthetic Host' }));

async function main() {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  let passed = 0;
  const failures = [];
  async function check(name, fn, { language = 'en', authenticated = false, geolocation = false, viewport = { width: 1440, height: 1000 } } = {}) {
    const context = await browser.newContext({ viewport, ...(geolocation ? { geolocation: { latitude: 0, longitude: 0 }, permissions: ['geolocation'] } : {}) });
    const calls = [], errors = [];
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      if (!['fetch', 'xhr'].includes(request.resourceType())) return url.origin === origin ? route.continue() : route.abort();
      calls.push({ path: url.pathname, query: Object.fromEntries(url.searchParams), method: request.method() });
      assert.equal(request.method(), 'GET', 'Discovery must not write any data');
      let body = {};
      if (url.pathname === '/auth/me') body = { id: 'synthetic-discovery-user', name: 'Synthetic Traveler', email: 'traveler@example.invalid', role: 'traveler' };
      if (url.pathname === '/reverse') body = { address: { city: 'Quito', country_code: 'ec' } };
      if (url.pathname === '/listings/search') {
        const items = listings.filter(item => (!url.searchParams.get('country_code') || item.country_code === url.searchParams.get('country_code'))
          && (!url.searchParams.get('city') || item.city === url.searchParams.get('city')));
        body = { items, total: items.length };
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });
    await context.addInitScript(({ language, authenticated }) => {
      localStorage.setItem('i18nextLng', language);
      if (authenticated) localStorage.setItem('wadatrip_token', 'synthetic-discovery-token');
    }, { language, authenticated });
    const page = await context.newPage(); page.setDefaultTimeout(2200);
    page.on('pageerror', error => errors.push(error.message));
    try { await fn(page, calls); assert.deepEqual(errors, []); passed++; console.log('PASS: ' + name); }
    catch (error) { failures.push(name); console.error('FAIL: ' + name + ': ' + error.message.split('\n')[0]); }
    finally { await context.close(); }
  }
  try {
    await check('Peru catalog sends PE and displays its synthetic tour', async (page, calls) => {
      await page.goto(`${origin}/tours?country_code=PE`);
      await page.getByRole('heading', { name: listings[0].title }).waitFor();
      assert.ok(calls.some(call => call.path === '/listings/search' && call.query.country_code === 'PE'));
      assert.equal(await page.getByRole('heading', { name: listings[1].title }).count(), 0);
    });
    await check('Country names in shared links normalize before the search request', async (page, calls) => {
      await page.goto(`${origin}/tours?country_code=Per%C3%BA`);
      await page.getByRole('heading', { name: listings[0].title }).waitFor();
      assert.ok(calls.filter(call => call.path === '/listings/search').every(call => call.query.country_code === 'PE'));
    });
    await check('Changing Peru/Lima to Ecuador clears the incompatible city', async (page, calls) => {
      await page.goto(`${origin}/tours?country_code=PE&city=Lima`);
      await page.getByRole('heading', { name: listings[0].title }).waitFor();
      await page.getByRole('combobox', { name: 'Country', exact: true }).click();
      await page.getByRole('option', { name: 'Ecuador (EC)', exact: true }).click();
      await page.getByRole('heading', { name: listings[1].title }).waitFor();
      assert.equal(await page.getByLabel('City', { exact: true }).inputValue(), '');
      assert.ok(calls.some(call => call.query.country_code === 'EC' && !call.query.city));
      assert.equal(await page.getByRole('button', { name: 'Lima', exact: true }).count(), 0);
    });
    await check('Ecuador city selection searches within EC', async (page, calls) => {
      await page.goto(`${origin}/tours?country_code=EC`);
      await page.getByRole('heading', { name: listings[1].title }).waitFor();
      await Promise.all([
        page.waitForResponse(response => response.url().includes('country_code=EC') && response.url().includes('city=Quito')),
        page.getByRole('button', { name: 'Quito', exact: true }).click(),
      ]);
      assert.ok(calls.some(call => call.query.country_code === 'EC' && call.query.city === 'Quito'));
    });
    await check('City has an explicit dropdown with clickable suggestions after selecting Peru', async (page, calls) => {
      await page.goto(`${origin}/tours?country_code=PE`);
      await page.getByRole('heading', { name: listings[0].title }).waitFor();
      await page.getByRole('button', { name: 'Choose a city', exact: true }).click();
      await page.getByRole('combobox', { name: 'Search cities', exact: true }).fill('lim');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'City picker must fit the mobile viewport');
      await page.screenshot({ path: 'logs/city-picker-mobile.png' });
      await page.getByRole('option', { name: 'Lima', exact: true }).click();
      assert.equal(await page.getByLabel('City', { exact: true }).inputValue(), 'Lima');
      assert.ok(calls.some(call => call.query.country_code === 'PE' && call.query.city === 'Lima'));
    }, { viewport: { width: 390, height: 844 } });
    await check('A destination without city suggestions still accepts a manually searched city', async (page, calls) => {
      await page.goto(`${origin}/tours?country_code=ZA`);
      await page.getByText('No tours match this destination yet.', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Choose a city', exact: true }).click();
      await page.getByText('No suggested cities yet. You can type a city.', { exact: true }).waitFor();
      await page.getByRole('combobox', { name: 'Search cities', exact: true }).fill('Cape Town');
      await page.getByRole('option', { name: 'Search for Cape Town', exact: true }).click();
      assert.equal(await page.getByLabel('City', { exact: true }).inputValue(), 'Cape Town');
      assert.ok(calls.some(call => call.query.country_code === 'ZA' && call.query.city === 'Cape Town'));
    });
    await check('Colombia has an honest destination-specific empty state and clear filters', async page => {
      await page.goto(`${origin}/tours?country_code=CO`);
      await page.getByText('No tours match this destination yet.', { exact: true }).waitFor();
      await page.getByRole('button', { name: 'Clear filters', exact: true }).click();
      await page.getByRole('heading', { name: listings[0].title }).waitFor();
      await page.getByRole('heading', { name: listings[1].title }).waitFor();
    });
    await check('South Africa is searchable even without any tours and never suggests Lima', async (page, calls) => {
      await page.goto(`${origin}/tours`);
      await page.getByRole('combobox', { name: 'Country', exact: true }).click();
      await page.getByRole('combobox', { name: 'Search countries', exact: true }).fill('south africa');
      await page.getByRole('option', { name: 'South Africa (ZA)', exact: true }).waitFor();
      await page.getByRole('combobox', { name: 'Search countries', exact: true }).fill('Sudafrica');
      await page.getByRole('option', { name: 'South Africa (ZA)', exact: true }).click();
      await page.getByText('No tours match this destination yet.', { exact: true }).waitFor();
      assert.ok(calls.some(call => call.query.country_code === 'ZA'));
      assert.equal(await page.getByRole('button', { name: 'Lima', exact: true }).count(), 0);
      await Promise.all([
        page.waitForResponse(response => response.url().includes('country_code=ZA') && response.url().includes('city=Cape')),
        page.getByLabel('City', { exact: true }).fill('Cape Town'),
      ]);
    });
    await check('A shared South Africa country-name URL queries ZA, not SO', async (page, calls) => {
      await page.goto(`${origin}/tours?country_code=South%20Africa`);
      await page.getByText('No tours match this destination yet.', { exact: true }).waitFor();
      assert.ok(calls.filter(call => call.path === '/listings/search').every(call => call.query.country_code === 'ZA'));
    });
    await check('A future synthetic publication appears in South Africa without changing the country list', async page => {
      await page.goto(`${origin}/tours?country_code=ZA`);
      await page.getByText('No tours match this destination yet.', { exact: true }).waitFor();
      const item = { ...listings[0], id: 'csyntheticpilotsouthafrica', title: 'Synthetic future Cape Town tour', city: 'Cape Town', country_code: 'ZA' };
      listings.push(item);
      try {
        await page.reload();
        await page.getByRole('heading', { name: item.title }).waitFor();
        assert.equal(await page.getByText('No tours match this destination yet.', { exact: true }).count(), 0);
      } finally { listings.splice(listings.indexOf(item), 1); }
    });
    await check('Spanish country search supports accents and keyboard selection', async (page, calls) => {
      await page.goto(`${origin}/tours`);
      await page.getByRole('button', { name: 'English', exact: true }).click();
      await page.getByRole('menuitem', { name: /Español/ }).click();
      await page.getByRole('combobox', { name: 'País', exact: true }).click();
      const search = page.getByRole('combobox', { name: 'Buscar países', exact: true });
      await search.fill('Sudafrica');
      await page.getByRole('option', { name: 'Sudáfrica (ZA)', exact: true }).waitFor();
      await search.press('ArrowDown'); await search.press('Enter');
      await page.getByText('Todavía no hay tours que coincidan con este destino.', { exact: true }).waitFor();
      assert.ok(calls.some(call => call.query.country_code === 'ZA'));
    });
    await check('Use my location resolves a synthetic position into country and city filters', async (page, calls) => {
      await page.goto(`${origin}/tours?country_code=PE&city=Lima`);
      await page.getByRole('heading', { name: listings[0].title }).waitFor();
      await page.getByRole('button', { name: 'Use my location', exact: true }).click();
      await page.getByRole('heading', { name: listings[1].title }).waitFor();
      assert.ok(calls.some(call => call.query.country_code === 'EC' && call.query.city === 'Quito'));
    }, { geolocation: true });
    await check('Location denial keeps manual destination selection usable', async page => {
      await page.addInitScript(() => Object.defineProperty(navigator, 'geolocation', { value: { getCurrentPosition: (_, reject) => reject({ code: 1 }) } }));
      await page.goto(`${origin}/tours?country_code=PE&city=Lima`);
      await page.getByRole('heading', { name: listings[0].title }).waitFor();
      await page.getByRole('button', { name: 'Use my location', exact: true }).click();
      await page.getByText('Location permission denied. Enter your city manually.', { exact: true }).waitFor();
      assert.equal(await page.getByLabel('City', { exact: true }).inputValue(), 'Lima');
    });
    await check('Catalog does not claim checkout availability or superior trust from publication alone', async page => {
      await page.goto(`${origin}/tours?country_code=PE`);
      await page.getByRole('heading', { name: listings[0].title }).waitFor();
      assert.equal(await page.getByText('Online checkout available', { exact: true }).count(), 0);
      assert.equal(await page.getByText('Top trusted host', { exact: true }).count(), 0);
      await page.getByText('View dates and booking details', { exact: true }).waitFor();
    });
    await check('Desktop navigation includes company information, contact and personal trips', async page => {
      await page.goto(`${origin}/tours`);
      const header = page.locator('header');
      await header.getByRole('link', { name: 'My trips', exact: true }).waitFor();
      assert.equal(await header.getByRole('link', { name: 'My trips', exact: true }).getAttribute('href'), '/account/trips');
      assert.equal(await header.getByRole('link', { name: /Flight Alerts|Tour Alerts|Products|Solutions/ }).count(), 0);
      await header.getByRole('link', { name: 'About Wadatrip', exact: true }).waitFor();
      await header.getByRole('link', { name: 'Contact', exact: true }).waitFor();
    }, { authenticated: true });
    await check('Mobile navigation preserves account access as well as personal trips', async page => {
      await page.goto(`${origin}/tours`);
      await page.getByRole('button', { name: 'Open menu', exact: true }).click();
      const header = page.locator('header');
      await header.getByRole('link', { name: 'My account', exact: true }).waitFor();
      assert.equal(await header.getByRole('link', { name: 'My account', exact: true }).getAttribute('href'), '/account');
      await header.getByRole('link', { name: 'My trips', exact: true }).waitFor();
      await header.getByRole('link', { name: 'About Wadatrip', exact: true }).waitFor();
      await header.getByRole('link', { name: 'Contact', exact: true }).waitFor();
    }, { authenticated: true, viewport: { width: 390, height: 844 } });
    await check('Spanish catalog has translated destination controls and empty state', async page => {
      await page.goto(`${origin}/tours?country_code=CO`);
      await page.getByRole('button', { name: 'English', exact: true }).click();
      await page.getByRole('menuitem', { name: /Español/ }).click();
      await page.getByText('Todavía no hay tours que coincidan con este destino.', { exact: true }).waitFor();
      await page.getByRole('combobox', { name: 'País', exact: true }).waitFor();
      await page.getByLabel('Ciudad', { exact: true }).waitFor();
    }, { language: 'es' });
    console.log(`PILOT DISCOVERY: ${passed}/${passed + failures.length} passed; localhost + synthetic API only`);
    if (failures.length) process.exitCode = 1;
  } finally { await browser.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
