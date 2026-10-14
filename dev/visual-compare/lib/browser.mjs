import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { webkit, chromium, devices } from 'playwright';
import { SetupError } from './servers.mjs';

const MINIBROWSER_WRAPPER = fileURLToPath(new URL('./minibrowser-wpe.sh', import.meta.url));

const { defaultBrowserType, ...ipad } = devices['iPad (gen 7) landscape'];
export const CONTEXT_OPTIONS = Object.freeze({ ...ipad, viewport: { width: 1024, height: 768 } });

// Environment for libraries unpacked by setup-browser-libs.sh.
function browserEnv(root) {
  const lib = `${root}/usr/lib/x86_64-linux-gnu:${root}/lib/x86_64-linux-gnu`;
  return {
    LD_LIBRARY_PATH: process.env.LD_LIBRARY_PATH ? `${lib}:${process.env.LD_LIBRARY_PATH}` : lib,
    FONTCONFIG_FILE: `${root}/fonts.conf`,
    __EGL_VENDOR_LIBRARY_DIRS: `${root}/usr/share/glvnd/egl_vendor.d`,
    LIBGL_DRIVERS_PATH: `${root}/usr/lib/x86_64-linux-gnu/dri`,
  };
}

// WebKit can launch and still crash on the first page (no EGL display), so a
// launch only counts once a page has rendered.
async function tryLaunch(browserType, options) {
  const browser = await browserType.launch({ timeout: 30000, ...options });
  try {
    const context = await browser.newContext(CONTEXT_OPTIONS);
    const page = await context.newPage();
    await page.setContent('<p>probe</p>');
    await context.close();
    return browser;
  } catch (e) {
    await browser.close().catch(() => {});
    throw e;
  }
}

export async function launchBrowser({ browserRoot } = {}) {
  const env = browserRoot ? { ...process.env, ...browserEnv(browserRoot) } : undefined;
  // Playwright checks host libraries with `ldconfig -p`, which cannot see browserRoot.
  if (browserRoot) process.env.PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS = '1';

  const errors = [];
  try {
    const browser = await tryLaunch(webkit, browserRoot ? {
      env: { ...env, VC_MINIBROWSER_DIR: path.join(path.dirname(webkit.executablePath()), 'minibrowser-wpe') },
      executablePath: MINIBROWSER_WRAPPER,
    } : {});
    return { browser, engine: 'webkit', contextOptions: CONTEXT_OPTIONS };
  } catch (e) {
    errors.push(`webkit: ${e.message.split('\n')[0]}`);
  }
  try {
    const browser = await tryLaunch(chromium, { args: ['--no-sandbox'], ...(env ? { env } : {}) });
    return { browser, engine: 'chromium', contextOptions: CONTEXT_OPTIONS };
  } catch (e) {
    errors.push(`chromium: ${e.message.split('\n')[0]}`);
  }
  throw new SetupError(`no browser could launch${browserRoot ? '' : ' (try --browser-root, see setup-browser-libs.sh)'}\n${errors.join('\n')}`);
}
