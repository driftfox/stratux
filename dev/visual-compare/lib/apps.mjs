export const SCREENS = Object.freeze([
  { key: 'status', proto: 'Status', route: '#/' },
  { key: 'weather', proto: 'Weather', route: '#/weather' },
  { key: 'traffic', proto: 'Traffic', route: '#/traffic' },
  { key: 'towers', proto: 'Towers', route: '#/towers' },
  { key: 'logs', proto: 'Logs', route: '#/logs' },
  { key: 'settings', proto: 'Settings', route: '#/settings' },
  { key: 'radar', proto: 'Radar', route: '#/radar' },
  { key: 'developer', proto: 'Developer', route: '#/developer' },
]);

export const SHELL_STATES = Object.freeze(['menu', 'help', 'shutdown']);

const SHELL = {
  proto: {
    menu: { open: 'button[aria-label="Open menu"]', shown: 'aside.drawer.left' },
    help: { open: 'button[aria-label="Open help"]', shown: 'aside.drawer.right' },
    shutdown: { open: 'button[aria-label="Open shutdown confirmation"]', shown: '.confirm-dialog' },
  },
  reskin: {
    menu: { open: '[aria-label="Menu"]', shown: '.sidebar-left-in' },
    help: { open: '[aria-label="Help"]', shown: '.sidebar-right-in' },
    shutdown: { open: '[aria-label="Shut down"]', shown: '.sx-confirm-dialog' },
  },
};

// Rows that prove the reskin's WebSocket data has rendered.
const DATA_ROWS = { traffic: 'tbody tr', towers: 'tbody tr', weather: '.sx-report' };

const screen = (key) => {
  const s = SCREENS.find((x) => x.key === key);
  if (!s) throw new Error(`unknown screen "${key}"`);
  return s;
};

export async function prepareReskinPage(page) {
  // addtohomescreen.js prompts iPad user agents 1s after load for 15s, over
  // the page; it is not part of the layout under comparison.
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = '.ath-viewport{display:none!important}';
      document.head.appendChild(style);
    });
  });
  await page.route('**/getSettings', async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    await route.fulfill({ response, json: { ...json, DeveloperMode: true } });
  });
}

export async function preparePrototypePage(page) {
  await page.route('**/_vercel/**', (route) => route.abort());
}

export async function openScreen(page, app, baseUrl, screenKey) {
  const s = screen(screenKey);
  if (app === 'proto') {
    await page.goto(baseUrl + '/', { waitUntil: 'networkidle' });
    await openPrototypeDrawer(page, SHELL.proto.menu);
    await page.locator('aside.drawer.left .nav-item span').getByText(s.proto, { exact: true }).click();
    await page.waitForFunction((name) => document.querySelector('h1')?.textContent.trim() === name, s.proto);
    return;
  }
  // The saved theme is re-applied when /getSettings answers; toggling before
  // then would be silently undone.
  const settings = page.waitForResponse((r) => r.url().endsWith('/getSettings'));
  await page.goto(`${baseUrl}/${s.route}`);
  await settings;
  // The response event can fire before MainCtrl's callback has run updateTheme.
  await page.waitForFunction(() => window.angular?.element(document.body).scope()?.DarkMode !== undefined);
  await page.waitForSelector('[ui-view] > *', { state: 'attached' });
}

// A click that lands before React hydrates does nothing, so retry until shown.
async function openPrototypeDrawer(page, { open, shown }) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    await page.click(open);
    try {
      await page.waitForSelector(shown, { state: 'visible', timeout: 1000 });
      return;
    } catch { /* not hydrated yet */ }
  }
  throw new Error(`prototype: ${shown} did not open`);
}

export async function openShellState(page, app, state) {
  const s = SHELL[app][state];
  if (!s) throw new Error(`unknown shell state "${state}"`);
  if (app === 'proto') return openPrototypeDrawer(page, s);
  await page.click(s.open);
  await page.waitForSelector(s.shown, { state: app === 'reskin' && state !== 'shutdown' ? 'attached' : 'visible' });
}

export async function isDark(page, app) {
  return app === 'proto'
    ? page.evaluate(() => document.querySelector('main.app')?.classList.contains('dark') ?? false)
    : page.evaluate(() => (document.getElementById('themeStylesheet')?.getAttribute('href') || '').endsWith('css/dark-mode.css'));
}

export async function setTheme(page, app, theme) {
  const want = theme === 'dark';
  if (await isDark(page, app) === want) return;
  await page.click(app === 'proto' ? 'button[aria-label="Toggle dark mode"]' : 'button[aria-label="Toggle theme"]');
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (await isDark(page, app) === want) return;
    await page.waitForTimeout(100);
  }
  throw new Error(`${app}: theme did not switch to ${theme}`);
}

export async function assertTheme(page, app, theme) {
  if (await isDark(page, app) !== (theme === 'dark')) {
    throw new Error(`${app}: page is not ${theme} at measurement time`);
  }
}

export async function settle(page, app, screenKey) {
  await page.addStyleTag({ content: '*,*::before,*::after{animation:none!important;transition:none!important}' });
  if (app === 'proto') {
    await page.waitForLoadState('networkidle');
    return;
  }
  // WebSockets never go idle; give the first frames a moment instead.
  await page.waitForTimeout(1000);
  const rows = DATA_ROWS[screenKey];
  if (rows) await page.waitForFunction((sel) => document.querySelectorAll(sel).length > 0, rows);
}
