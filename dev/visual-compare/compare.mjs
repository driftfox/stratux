#!/usr/bin/env node
// Measures layout and spacing drift between the v0 prototype and the reskin.
// Design: docs/superpowers/specs/2026-10-13-visual-compare-design.md
//
//   node compare.mjs --prototype <dir> [--out <dir>] [--only status,traffic,shell] [--browser-root <dir>]
//
// Exit 0: clean. 1: unexplained drift, missing elements, or map misses.
// 2: the run could not complete (server, browser, or setup failure).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startDevServer, startPrototype, SetupError } from './lib/servers.mjs';
import { launchBrowser } from './lib/browser.mjs';
import { prepareReskinPage, preparePrototypePage, openScreen, openShellState, setTheme, assertTheme, settle } from './lib/apps.mjs';
import { measure } from './lib/measure.mjs';
import { compareScreen, loadAccepted, unusedAccepted, exitCode } from './lib/compare.mjs';
import { writeReport, totals } from './lib/report.mjs';
import { ELEMENTS } from './elements.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PORTS = { dev: 8790, proto: 3790 };
const THEMES = ['light', 'dark'];

export function parseArgs(argv) {
  const value = (flag) => {
    const i = argv.indexOf(flag);
    return i !== -1 ? argv[i + 1] : undefined;
  };
  const prototype = value('--prototype');
  if (!prototype) throw new Error('--prototype <dir> is required');
  const only = value('--only');
  return {
    prototype: path.resolve(prototype),
    out: path.resolve(value('--out') ?? path.join(HERE, 'out')),
    only: only ? only.split(',').map((s) => s.trim()).filter(Boolean) : undefined,
    browserRoot: value('--browser-root') ?? (process.env.VC_BROWSER_ROOT || undefined),
  };
}

function selectedKeys(only) {
  const keys = Object.keys(ELEMENTS);
  if (!only) return keys;
  return keys.filter((k) => only.includes(k) || (k.startsWith('shell:') && only.includes('shell')));
}

async function fullScreenshot(page, file) {
  // The reskin scrolls inside .scrollable-content, not the document, so grow the
  // viewport to the content instead of relying on fullPage.
  const content = await page.evaluate(() => {
    let h = document.documentElement.scrollHeight;
    for (const el of document.querySelectorAll('.app-content .scrollable-content')) {
      h = Math.max(h, el.getBoundingClientRect().top + el.scrollHeight);
    }
    return Math.ceil(h);
  });
  const height = Math.max(768, content);
  await page.setViewportSize({ width: 1024, height });
  await page.waitForTimeout(200);
  await page.screenshot({ path: file });
  await page.setViewportSize({ width: 1024, height: 768 });
  return height;
}

async function capture({ browser, contextOptions, app, baseUrl, key, theme, entries, outDir }) {
  const context = await browser.newContext(contextOptions);
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(20000);
    await (app === 'reskin' ? prepareReskinPage(page) : preparePrototypePage(page));

    const shell = key.startsWith('shell:') ? key.slice('shell:'.length) : null;
    const screenKey = shell ? 'status' : key;
    await openScreen(page, app, baseUrl, screenKey);
    await setTheme(page, app, theme);
    await settle(page, app, screenKey);
    // A screen's own settings load (Settings) can reset the theme after the toggle.
    await setTheme(page, app, theme);
    if (shell) await openShellState(page, app, shell);

    const side = app === 'proto' ? 'proto' : 'reskin';
    const selectors = Object.fromEntries(entries.filter((e) => e[side]).map((e) => [e.id, e[side]]));
    await assertTheme(page, app, theme);
    const boxes = await measure(page, selectors);

    const name = `${shell ?? key}-${theme}-${app === 'proto' ? 'prototype' : 'reskin'}.png`;
    await assertTheme(page, app, theme);
    const height = await fullScreenshot(page, path.join(outDir, 'screenshots', name));
    return { boxes, shot: { file: `screenshots/${name}`, height, boxes } };
  } finally {
    await context.close();
  }
}

export async function main(argv) {
  let args;
  try {
    args = parseArgs(argv);
  } catch (e) {
    console.error(e.message);
    return 2;
  }

  const startedAt = new Date().toISOString();
  const keys = selectedKeys(args.only);
  const accepted = loadAccepted(JSON.parse(fs.readFileSync(path.join(HERE, 'accepted-differences.json'), 'utf8')))
    .filter((a) => keys.includes(a.screen));
  const findings = [];
  const screenshots = [];
  let proto, dev, browser;

  const cleanup = async () => {
    await browser?.close().catch(() => {});
    await proto?.stop();
    await dev?.stop();
  };
  const onSignal = () => { cleanup().finally(() => process.exit(130)); };
  const SIGNALS = ['SIGINT', 'SIGTERM', 'SIGHUP'];
  for (const s of SIGNALS) process.once(s, onSignal);

  try {
    proto = await startPrototype({ dir: args.prototype, port: PORTS.proto });
    dev = await startDevServer({ port: PORTS.dev });
    const launched = await launchBrowser({ browserRoot: args.browserRoot });
    browser = launched.browser;
    console.log(`engine: ${launched.engine}`);
    fs.mkdirSync(path.join(args.out, 'screenshots'), { recursive: true });

    for (const theme of THEMES) {
      for (const key of keys) {
        const entries = ELEMENTS[key];
        const common = { browser, contextOptions: launched.contextOptions, key, theme, entries, outDir: args.out };
        const p = await capture({ ...common, app: 'proto', baseUrl: proto.url });
        const r = await capture({ ...common, app: 'reskin', baseUrl: dev.url });
        const mine = compareScreen({ screen: key, theme, entries, proto: p.boxes, reskin: r.boxes, accepted });
        findings.push(...mine);
        screenshots.push({ screen: key, theme, prototype: p.shot, reskin: r.shot });
        const t = totals(mine);
        console.log(`${key} ${theme}: ${t.pass} pass, ${t.fail} fail, ${t['missing-in-reskin']} missing, ` +
          `${t['map-miss']} map-miss, ${t.accepted} accepted, ${t['reskin-only']} reskin-only`);
      }
    }

    const unused = unusedAccepted(accepted, findings);
    writeReport(args.out, { engine: launched.engine, startedAt, findings, unused, screenshots });
    const t = totals(findings);
    console.log(`total: ${t.pass} pass, ${t.fail} fail, ${t['missing-in-reskin']} missing, ${t['map-miss']} map-miss, ` +
      `${t['empty-screen']} empty, ${t.accepted} accepted, ${unused.length} unused accepted → ${path.join(args.out, 'report.html')}`);
    return exitCode(findings);
  } catch (e) {
    console.error(e instanceof SetupError ? e.message : e.stack);
    return 2;
  } finally {
    for (const s of SIGNALS) process.off(s, onSignal);
    await cleanup();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then((code) => { process.exitCode = code; });
}
