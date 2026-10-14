import { spawn } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('../../../', import.meta.url));

export class SetupError extends Error {
  constructor(message, { child } = {}) {
    super(message);
    this.name = 'SetupError';
    this.child = child;
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Each server runs in its own process group so stop() also reaches grandchildren
// (corepack → pnpm → next).
function launch(command, args, { cwd, env }) {
  const child = spawn(command, args, {
    cwd, env: { ...process.env, ...env }, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  const keep = (chunk) => { output = (output + chunk).slice(-4000); };
  child.stdout.on('data', keep);
  child.stderr.on('data', keep);
  const exited = new Promise((resolve) => child.once('exit', resolve));
  return { child, exited, output: () => output };
}

function stopper({ child, exited }) {
  return async () => {
    if (child.exitCode !== null || child.signalCode !== null) return;
    const kill = (signal) => { try { process.kill(-child.pid, signal); } catch { /* already gone */ } };
    kill('SIGTERM');
    const timer = setTimeout(() => kill('SIGKILL'), 5000);
    await exited;
    clearTimeout(timer);
  };
}

// Readiness polling cannot tell our server from a leftover one on the same
// port (e.g. from a run killed with SIGKILL), so refuse a taken port up front.
async function ensurePortFree(name, port) {
  const probe = net.createServer();
  const error = await new Promise((resolve) => {
    probe.once('error', resolve);
    probe.listen(port, '127.0.0.1', () => probe.close(() => resolve(null)));
  });
  if (error) {
    throw new SetupError(`${name}: port ${port} already in use (${error.code}) — stop whatever holds it and rerun`);
  }
}

async function waitUntilReady(name, proc, url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let exitedEarly = false;
  proc.exited.then(() => { exitedEarly = true; });
  while (Date.now() < deadline) {
    if (exitedEarly) break;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(2000) });
      if (res.ok && !exitedEarly) return;
    } catch { /* not up yet */ }
    await sleep(250);
  }
  await stopper(proc)();
  throw new SetupError(
    `${name} did not become ready at ${url}${exitedEarly ? ' (process exited)' : ` within ${timeoutMs / 1000}s`}\n${proc.output()}`,
    { child: proc.child },
  );
}

export async function startDevServer({ port }) {
  await ensurePortFree('dev server', port);
  const url = `http://127.0.0.1:${port}`;
  const proc = launch(process.execPath, [path.join(REPO_ROOT, 'dev/server.mjs'), '--port', String(port)], { cwd: REPO_ROOT });
  await waitUntilReady('dev server', proc, url + '/getSettings', 15000);
  return { url, stop: stopper(proc) };
}

export async function startPrototype({ dir, port }) {
  if (!fs.existsSync(path.join(dir, '.next', 'BUILD_ID'))) {
    throw new SetupError(
      `prototype at ${dir} has no production build — run "corepack pnpm install && corepack pnpm build" (next build) there first`);
  }
  await ensurePortFree('prototype', port);
  const url = `http://127.0.0.1:${port}`;
  const proc = launch('corepack', ['pnpm', 'exec', 'next', 'start', '-p', String(port), '-H', '127.0.0.1'], {
    cwd: dir, env: { NEXT_TELEMETRY_DISABLED: '1', COREPACK_ENABLE_DOWNLOAD_PROMPT: '0' },
  });
  await waitUntilReady('prototype', proc, url + '/', 60000);
  return { url, stop: stopper(proc) };
}
