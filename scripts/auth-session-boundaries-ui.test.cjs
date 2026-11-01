const {createUiCookieSession}=require('./helpers/ui-cookie-session.cjs');
// Local browser regression only. All identities, codes, tokens and API data are synthetic.
const assert = require('node:assert/strict');
const { chromium } = require('../logs/p06-browser/node_modules/playwright-core');
const origin = new URL(process.argv[2] || 'http://127.0.0.1:4187').origin;
assert.equal(new URL(origin).hostname, '127.0.0.1', 'Local application only');
const users = Object.fromEntries(['owner', 'traveler'].map(id => [id, {
  id: `synthetic-${id}`, name: `Synthetic ${id}`, email: `${id}@example.invalid`, role: 'traveler', status: 'active',
}]));
const token = id => `synthetic-session-${id}`;
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

async function main() {
  const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
  let passed = 0; const failures = [];
  async function check(name, run, { delayed = false, expired = false, delayedVerification = false, delayedUpdate = false } = {}) {
    const context = await browser.newContext();
    const held = deferred(), release = deferred();
    const verificationHeld = deferred(), verificationRelease = deferred();
    const updateHeld = deferred(), updateRelease = deferred();
    let heldOnce = false;let ownerProfiles=0;
    const calls = [];const cookies=createUiCookieSession(id=>Object.values(users).find(u=>u.id===id));
    try {
      await context.route('**/*', async route => {
        const request = route.request(), url = new URL(request.url());
        if (!['fetch', 'xhr'].includes(request.resourceType())) return url.origin === origin ? route.continue() : route.abort();
        if(await cookies.bootstrap(route,async captured=>{if(delayed&&captured.user?.id===users.owner.id&&!heldOnce){heldOnce=true;held.resolve();const outcome=await release.promise;if(outcome==='failure')return{status:401,body:{message:'Synthetic expired old session'}};}}))return;const identity=cookies.validate(request)===users.owner.id?'owner':'traveler';
        calls.push({ path: url.pathname, method: request.method(), identity });
        let body = [], status = 200;
        if (url.pathname === '/auth/web/request-code') body = { ok: true, channel: 'email', expires_in_minutes: 10 };
        if (url.pathname === '/auth/web/verify-code') {
          const id = request.postDataJSON().email === users.owner.email ? 'owner' : 'traveler';
          if (delayedVerification && id === 'traveler') { verificationHeld.resolve(); await verificationRelease.promise; }
          body = { user: users[id], token: token(id) };
        }
        if (url.pathname === '/auth/update') {
          body = { ...users[identity], name: request.postDataJSON().name };
          if (delayedUpdate) { updateHeld.resolve(); await updateRelease.promise; }
        }
        if (url.pathname === '/auth/me') {
          if(identity==='owner')ownerProfiles++;
          body = users[identity];
          if (delayed && identity === 'owner' && ownerProfiles > 1 && !heldOnce) {
            heldOnce = true; held.resolve();
            const outcome = await release.promise;
            if (outcome === 'failure') { status = 401; body = { message: 'Synthetic expired old session' }; }
          } else if (expired && ownerProfiles >= 1) { cookies.select(null);status = 401; body = { message: 'Synthetic expired current session' }; }
        }
        if (url.pathname === '/providers/me') { status = 404; body = { message: 'No synthetic provider' }; }
        if (url.pathname === '/operator/booking-inbox') body = { is_operator: false, groups: {} };
        if(url.pathname==='/auth/web/logout')body={ok:true};

        await cookies.finish(route,status,body).catch(()=>{});
      });
      const page = await context.newPage(); page.setDefaultTimeout(4000);
      async function signIn(id, { navigate = true, waitForAccount = true } = {}) {
        if(navigate){if(new URL(page.url()).origin===origin){await page.evaluate(()=>{history.pushState(null,'','/register?mode=login&role=traveler');window.dispatchEvent(new PopStateEvent('popstate'));});}else await page.goto(`${origin}/register?mode=login&role=traveler`);}
        await page.locator('#guide-email').fill(users[id].email);
        await page.getByRole('button', { name: 'Send code to continue', exact: true }).click();
        await page.locator('#guide-secret').fill('123456');
        await page.getByRole('button', { name: 'Continue to your account', exact: true }).click();
        if(waitForAccount){await page.waitForURL(url=>url.pathname==='/account');if(delayed&&id==='owner'){await page.getByRole('heading',{name:'Hi, Synthetic owner',exact:true}).waitFor();await page.evaluate(()=>window.dispatchEvent(new Event('focus')));}}
      }
      async function signedOut() {
        await page.getByRole('heading', { name: 'Sign in to view your trips', exact: true }).waitFor();
        assert.equal(await page.evaluate(() => localStorage.getItem('wadatrip_token')), null);
        assert.equal(await page.locator('header').getByRole('button', { name: /Synthetic/ }).count(), 0);
      }
      async function finishOld(outcome) {
        const response = page.waitForResponse(r => new URL(r.url()).pathname === '/auth/web/bootstrap' && r.status() === (outcome === 'failure' ? 401 : 200));
        release.resolve(outcome); await response;
        // Flush the response-body microtasks and the React render, without arbitrary sleeps.
        await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
      }
      await run({ page, signIn, signedOut, finishOld, held, calls, verificationHeld, verificationRelease, updateHeld, updateRelease });
      passed++; console.log(`PASS: ${name}`);
    } catch (error) { failures.push(name); console.error(`FAIL: ${name}: ${error.message.split('\n')[0]}`); }
    finally { release.resolve('success'); verificationRelease.resolve(); updateRelease.resolve(); await context.close(); }
  }
  try {
    await check('Logout, browser Back and reload do not restore private account data', async ({ page, signIn, signedOut }) => {
      await signIn('owner');
      await page.getByRole('heading', { name: 'Hi, Synthetic owner', exact: true }).waitFor();
      await page.locator('header a[href="/tours"]').first().click();
      await page.getByRole('button', { name: 'Log out', exact: true }).click();
      await page.goBack(); await signedOut();
      await page.reload(); await signedOut();
    });
    await check('A late successful profile response cannot restore a logged-out user', async ({ page, signIn, signedOut, held, finishOld }) => {
      await signIn('owner'); await held.promise;
      await page.getByRole('button', { name: 'Log out', exact: true }).click(); await signedOut();
      await finishOld('success'); await signedOut();
    }, { delayed: true });
    await check('A current expired profile removes the token and requires sign-in', async ({page,signIn,signedOut}) => {
      await signIn('owner',{waitForAccount:false});await page.locator('[role="alert"],form').filter({hasText:'Synthetic expired current session'}).first().waitFor();await page.goto(origin+'/account');await signedOut();
    }, { expired: true });
    for (const outcome of ['success', 'failure']) {
      await check(`Old profile ${outcome} cannot replace or log out the next account`, async ({ page, signIn, held, finishOld }) => {
        await signIn('owner'); await held.promise;
        await page.getByRole('button', { name: 'Log out', exact: true }).click();
        await finishOld(outcome);
        await signIn('traveler');
        await page.getByRole('heading', { name: 'Hi, Synthetic traveler', exact: true }).waitFor();
        assert.equal(await page.evaluate(() => localStorage.getItem('wadatrip_token')), null);
        assert.equal(await page.getByRole('heading', { name: 'Hi, Synthetic traveler', exact: true }).count(), 1);
        assert.equal(await page.locator('header').getByRole('button', { name: 'Synthetic owner', exact: true }).count(), 0);
      }, { delayed: true });
    }
    await check('Logout also invalidates a code verification already in flight', async ({ page, signIn, verificationHeld, verificationRelease }) => {
      await signIn('owner');
      await page.getByRole('heading', { name: 'Hi, Synthetic owner', exact: true }).waitFor();
      await signIn('traveler', { waitForAccount: false }); await verificationHeld.promise;
      await page.getByRole('button', { name: 'Log out', exact: true }).click();
      const response = page.waitForResponse(r => new URL(r.url()).pathname === '/auth/web/verify-code');
      verificationRelease.resolve(); await response;
      await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
      assert.equal(await page.evaluate(() => localStorage.getItem('wadatrip_token')), null);
      assert.equal(await page.locator('header').getByRole('link', { name: 'Login', exact: true }).count(), 1);
    }, { delayedVerification: true });
    await check('A late profile save cannot overwrite the next signed-in account', async ({ page, signIn, updateHeld, updateRelease }) => {
      await signIn('owner');
      await page.getByRole('heading', { name: 'Hi, Synthetic owner', exact: true }).waitFor();
      await page.locator('#account-name').fill('Late synthetic owner update');
      await page.getByRole('button', { name: 'Save account', exact: true }).click(); await updateHeld.promise;
      await page.getByRole('button', { name: 'Log out', exact: true }).click();
      await signIn('traveler');
      await page.getByRole('heading', { name: 'Hi, Synthetic traveler', exact: true }).waitFor();
      const response = page.waitForResponse(r => new URL(r.url()).pathname === '/auth/update');
      updateRelease.resolve(); await response;
      await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
      assert.equal(await page.evaluate(() => localStorage.getItem('wadatrip_token')), null);
      assert.equal(await page.getByRole('heading', { name: 'Hi, Synthetic traveler', exact: true }).count(), 1);
    }, { delayedUpdate: true });
    await check('A retired sign-in fragment cannot establish or restore a session', async ({ page, signedOut, calls }) => {
      await page.goto(`${origin}/account?return_test=synthetic#auth_token=${encodeURIComponent(token('owner'))}`);
      await signedOut();
      assert.equal(calls.filter(call => call.path === '/auth/me').length, 0);
      await page.reload(); await signedOut();
      assert.equal(new URL(page.url()).hash, '');
      assert.equal(new URL(page.url()).searchParams.get('return_test'), 'synthetic');
    });
    await check('A malformed legacy sign-in fragment fails closed without crashing the account page', async ({ page, signedOut, calls }) => {
      await page.goto(`${origin}/account#auth_token=%E0%A4%A`);
      await signedOut();
      assert.equal(new URL(page.url()).hash, '');
      assert.equal(calls.filter(call => call.path === '/auth/me').length, 0);
    });
  } finally { await browser.close(); }
  console.log(JSON.stringify({ passed, failed: failures.length, failures, production_calls: 0 }));
  assert.equal(failures.length, 0);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
