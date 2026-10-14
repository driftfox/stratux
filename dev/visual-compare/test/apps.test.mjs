import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startDevServer, startPrototype } from '../lib/servers.mjs';
import { launchBrowser } from '../lib/browser.mjs';
import {
  SCREENS, SHELL_STATES, prepareReskinPage, preparePrototypePage,
  openScreen, openShellState, isDark, setTheme, assertTheme, settle,
} from '../lib/apps.mjs';
import { measure } from '../lib/measure.mjs';

const { PROTOTYPE_DIR, VC_BROWSER_ROOT } = process.env;
const needsProto = { skip: !PROTOTYPE_DIR && 'PROTOTYPE_DIR not set' };

let dev, proto, browser, contextOptions;

before(async () => {
  dev = await startDevServer({ port: 8790 });
  if (PROTOTYPE_DIR) proto = await startPrototype({ dir: PROTOTYPE_DIR, port: 3790 });
  ({ browser, contextOptions } = await launchBrowser({ browserRoot: VC_BROWSER_ROOT }));
});

after(async () => {
  await browser?.close();
  await proto?.stop();
  await dev?.stop();
});

async function page(app) {
  const p = await (await browser.newContext(contextOptions)).newPage();
  p.setDefaultTimeout(15000);
  if (app === 'reskin') await prepareReskinPage(p);
  else await preparePrototypePage(p);
  return p;
}

const base = (app) => (app === 'reskin' ? dev.url : proto.url);

test('reskin setTheme reaches dark and is idempotent', async () => {
  const p = await page('reskin');
  await openScreen(p, 'reskin', base('reskin'), 'status');
  await setTheme(p, 'reskin', 'dark');
  await setTheme(p, 'reskin', 'dark');
  assert.equal(await isDark(p, 'reskin'), true);
  await setTheme(p, 'reskin', 'light');
  assert.equal(await isDark(p, 'reskin'), false);
  await p.context().close();
});

test('prototype setTheme reaches light and is idempotent', needsProto, async () => {
  const p = await page('proto');
  await openScreen(p, 'proto', base('proto'), 'status');
  assert.equal(await isDark(p, 'proto'), true);
  await setTheme(p, 'proto', 'light');
  await setTheme(p, 'proto', 'light');
  assert.equal(await isDark(p, 'proto'), false);
  await p.context().close();
});

test('reskin settle on traffic renders rows', async () => {
  const p = await page('reskin');
  await openScreen(p, 'reskin', base('reskin'), 'traffic');
  await settle(p, 'reskin', 'traffic');
  assert.ok(await p.locator('tbody tr').count() >= 1);
  await p.context().close();
});

test('reskin DeveloperMode is injected', async () => {
  const p = await page('reskin');
  await openScreen(p, 'reskin', base('reskin'), 'settings');
  await settle(p, 'reskin', 'settings');
  const m = await measure(p, { hw: 'panel:Hardware' });
  assert.equal(m.hw.found, true, JSON.stringify(m.hw));
  await p.context().close();
});

test('reskin add-to-home-screen prompt never covers the page', async () => {
  const p = await page('reskin');
  await openScreen(p, 'reskin', base('reskin'), 'status');
  await p.waitForTimeout(2500);
  assert.equal(await p.locator('.ath-viewport').isVisible(), false);
  await p.context().close();
});

test('prototype navigation reaches each screen', needsProto, async () => {
  const p = await page('proto');
  for (const screen of SCREENS) {
    await openScreen(p, 'proto', base('proto'), screen.key);
    assert.equal((await p.locator('h1').textContent()).trim(), screen.proto);
  }
  await p.context().close();
});

test('measure reports hidden matches as hidden', async () => {
  const p = await page('reskin');
  await openScreen(p, 'reskin', base('reskin'), 'status');
  await p.evaluate(() => {
    const d = document.createElement('div');
    d.className = 'vc-probe';
    d.style.display = 'none';
    d.textContent = 'x';
    document.body.appendChild(d);
  });
  const m = await measure(p, { hidden: '.vc-probe', none: '.vc-absent' });
  assert.deepEqual(m.hidden, { found: false, reason: 'hidden' });
  assert.deepEqual(m.none, { found: false, reason: 'no-match' });
  await p.context().close();
});

test('panel selector resolves on both apps', needsProto, async () => {
  for (const app of ['reskin', 'proto']) {
    const p = await page(app);
    await openScreen(p, app, base(app), 'status');
    await settle(p, app, 'status');
    const m = await measure(p, { panel: 'panel:Receiver health', head: 'panel:Receiver health >> h2' });
    assert.equal(m.panel.found, true, `${app}: ${JSON.stringify(m.panel)}`);
    assert.equal(m.head.found, true, `${app}: ${JSON.stringify(m.head)}`);
    assert.ok(m.panel.w > m.head.w - 1 && m.panel.h > m.head.h);
    await p.context().close();
  }
});

test('assertTheme catches a theme a late loader switched back', async () => {
  const p = await page('reskin');
  await openScreen(p, 'reskin', base('reskin'), 'status');
  await setTheme(p, 'reskin', 'dark');
  await assertTheme(p, 'reskin', 'dark');
  await p.evaluate(() => {
    const scope = angular.element(document.querySelector('[ng-controller="MainCtrl"]')).scope();
    scope.$apply(() => scope.updateTheme(false));
  });
  await assert.rejects(assertTheme(p, 'reskin', 'dark'), /reskin.*not dark/);
  await p.context().close();
});

test('panel heading ending in * matches by prefix', async () => {
  const p = await page('reskin');
  await openScreen(p, 'reskin', base('reskin'), 'developer');
  await settle(p, 'reskin', 'developer');
  const m = await measure(p, { exact: 'panel:Logfile', prefix: 'panel:Logfile*', head: 'panel:Logfile* >> h2' });
  assert.equal(m.exact.found, false);
  assert.equal(m.prefix.found, true, JSON.stringify(m.prefix));
  assert.equal(m.head.found, true, JSON.stringify(m.head));
  await p.context().close();
});

test('shell states open on both apps', needsProto, async () => {
  for (const app of ['reskin', 'proto']) {
    for (const state of SHELL_STATES) {
      const p = await page(app);
      await openScreen(p, app, base(app), 'status');
      await openShellState(p, app, state);
      await p.context().close();
    }
  }
});
