import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from '../compare.mjs';
import { writeReport } from '../lib/report.mjs';

const { PROTOTYPE_DIR, VC_BROWSER_ROOT } = process.env;
const needsProto = { skip: !PROTOTYPE_DIR && 'PROTOTYPE_DIR not set' };
const CLI = fileURLToPath(new URL('../compare.mjs', import.meta.url));
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'vc-'));
const pngHeight = (file) => fs.readFileSync(file).readUInt32BE(20);

const runCli = (args) => spawnSync(process.execPath, [CLI, ...args], {
  encoding: 'utf8', timeout: 240000, env: { ...process.env, VC_BROWSER_ROOT: VC_BROWSER_ROOT ?? '' },
});

test('parseArgs requires --prototype', () => {
  assert.throws(() => parseArgs([]), /--prototype/);
});

test('parseArgs parses --only', () => {
  assert.deepEqual(parseArgs(['--prototype', '/p', '--only', 'status,traffic']).only, ['status', 'traffic']);
});

test('writeReport writes json and html', () => {
  const out = tmp();
  const findings = [
    { screen: 'status', theme: 'light', id: 'status.alpha', metric: 'x', proto: 0, reskin: 9, delta: 9, tolerance: 4, verdict: 'fail' },
    { screen: 'status', theme: 'light', id: 'status.beta', metric: null, proto: null, reskin: null, delta: null, tolerance: null, verdict: 'map-miss', reason: 'no-match' },
  ];
  writeReport(out, { engine: 'webkit', startedAt: new Date().toISOString(), findings, unused: [], screenshots: [] });
  const json = JSON.parse(fs.readFileSync(path.join(out, 'report.json'), 'utf8'));
  assert.equal(json.engine, 'webkit');
  const html = fs.readFileSync(path.join(out, 'report.html'), 'utf8');
  assert.match(html, /status\.alpha/);
  assert.match(html, /status\.beta/);
});

test('end-to-end on status exits 0 or 1 and writes screenshots', needsProto, () => {
  const out = tmp();
  const r = runCli(['--prototype', PROTOTYPE_DIR, '--out', out, '--only', 'status']);
  assert.ok([0, 1].includes(r.status), `exit ${r.status}\n${r.stderr}`);
  for (const theme of ['light', 'dark']) {
    for (const side of ['prototype', 'reskin']) {
      assert.ok(fs.existsSync(path.join(out, 'screenshots', `status-${theme}-${side}.png`)), `${theme} ${side}`);
    }
  }
  assert.ok(JSON.parse(fs.readFileSync(path.join(out, 'report.json'), 'utf8')).engine);
});

test('reskin screenshot covers the whole scroll area', needsProto, () => {
  const out = tmp();
  const r = runCli(['--prototype', PROTOTYPE_DIR, '--out', out, '--only', 'settings']);
  assert.ok([0, 1].includes(r.status), `exit ${r.status}\n${r.stderr}`);
  assert.ok(pngHeight(path.join(out, 'screenshots', 'settings-light-reskin.png')) > 768);
});

test('bad prototype dir exits 2', () => {
  const r = runCli(['--prototype', '/nonexistent', '--out', tmp()]);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /next build/);
});
