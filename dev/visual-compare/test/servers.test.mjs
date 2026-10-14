import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import { startDevServer, startPrototype, SetupError } from '../lib/servers.mjs';
import { launchBrowser } from '../lib/browser.mjs';

const { PROTOTYPE_DIR, VC_BROWSER_ROOT } = process.env;

test('dev server starts, answers, and stops', async () => {
  const server = await startDevServer({ port: 8790 });
  try {
    const res = await fetch(server.url + '/getSettings');
    assert.equal(res.status, 200);
    assert.ok('DarkMode' in await res.json());
  } finally {
    await server.stop();
  }
  await assert.rejects(fetch(server.url + '/getSettings'));
  await server.stop();
});

test('occupied port is a SetupError', async () => {
  const blocker = net.createServer().listen(8791, '127.0.0.1');
  await new Promise((r) => blocker.once('listening', r));
  try {
    const err = await startDevServer({ port: 8791 }).then(() => null, (e) => e);
    assert.ok(err instanceof SetupError, `expected SetupError, got ${err}`);
    if (err.child) assert.notEqual(err.child.exitCode ?? err.child.signalCode, null);
  } finally {
    blocker.close();
  }
});

test('port already answered by another HTTP server is a SetupError, not reused', async () => {
  const stale = http.createServer((req, res) => res.end('{"stale":true}')).listen(8792, '127.0.0.1');
  await new Promise((r) => stale.once('listening', r));
  try {
    const err = await startDevServer({ port: 8792 }).then(async (s) => { await s.stop(); return null; }, (e) => e);
    assert.ok(err instanceof SetupError, `expected SetupError, got ${err}`);
    assert.match(err.message, /dev server.*8792.*in use/);
  } finally {
    stale.close();
  }
});

test('prototype without a build is a SetupError', async () => {
  const err = await startPrototype({ dir: os.tmpdir(), port: 3791 }).then(() => null, (e) => e);
  assert.ok(err instanceof SetupError);
  assert.match(err.message, /next build/);
});

test('prototype starts and serves the app', { skip: !PROTOTYPE_DIR && 'PROTOTYPE_DIR not set' }, async () => {
  const proto = await startPrototype({ dir: PROTOTYPE_DIR, port: 3790 });
  try {
    const body = await (await fetch(proto.url + '/')).text();
    assert.match(body, /STRATUX/);
  } finally {
    await proto.stop();
  }
});

test('launchBrowser returns an engine and a 1024x768 context', async () => {
  const { browser, engine, contextOptions } = await launchBrowser({ browserRoot: VC_BROWSER_ROOT });
  try {
    assert.ok(['webkit', 'chromium'].includes(engine));
    const page = await (await browser.newContext(contextOptions)).newPage();
    assert.deepEqual(await page.evaluate(() => [innerWidth, innerHeight]), [1024, 768]);
  } finally {
    await browser.close();
  }
});
