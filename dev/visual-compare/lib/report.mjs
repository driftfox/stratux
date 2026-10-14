import fs from 'node:fs';
import path from 'node:path';

const VERDICT_ORDER = ['fail', 'missing-in-reskin', 'map-miss', 'empty-screen', 'accepted', 'reskin-only', 'pass'];

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export function totals(findings) {
  const t = Object.fromEntries(VERDICT_ORDER.map((v) => [v, 0]));
  for (const f of findings) t[f.verdict]++;
  return t;
}

function outlines(shot, ids, width) {
  return ids.map((id) => shot.boxes?.[id]).filter((b) => b?.found).map((b) =>
    `<i style="left:${b.x / width * 100}%;top:${b.y / shot.height * 100}%;width:${b.w / width * 100}%;height:${b.h / shot.height * 100}%"></i>`,
  ).join('');
}

function section(pair, findings) {
  const mine = findings.filter((f) => f.screen === pair.screen && f.theme === pair.theme);
  const failIds = [...new Set(mine.filter((f) => f.verdict === 'fail').map((f) => f.id))];
  const missingIds = [...new Set(mine.filter((f) => f.verdict === 'missing-in-reskin').map((f) => f.id))];
  const rows = mine.filter((f) => f.verdict !== 'pass')
    .sort((a, b) => VERDICT_ORDER.indexOf(a.verdict) - VERDICT_ORDER.indexOf(b.verdict))
    .map((f) => `<tr class="${esc(f.verdict)}"><td>${esc(f.verdict)}</td><td>${esc(f.id)}</td><td>${esc(f.metric)}</td>` +
      `<td>${esc(f.proto)}</td><td>${esc(f.reskin)}</td><td>${esc(f.delta)}</td><td>${esc(f.tolerance)}</td><td>${esc(f.reason)}</td></tr>`)
    .join('');
  const t = totals(mine);
  const figure = (label, shot, ids) => `<figure><figcaption>${label}</figcaption>` +
    `<div class="shot"><img src="${esc(shot.file)}" alt="">${outlines(shot, ids, 1024)}</div></figure>`;
  return `<section><h2>${esc(pair.screen)} · ${esc(pair.theme)}</h2>
<p class="t">${VERDICT_ORDER.map((v) => `${v}: ${t[v]}`).join(' · ')}</p>
<div class="pair">${figure('prototype', pair.prototype, [...failIds, ...missingIds])}${figure('reskin', pair.reskin, failIds)}</div>
${rows ? `<table><tr><th>verdict</th><th>id</th><th>metric</th><th>proto</th><th>reskin</th><th>delta</th><th>tol</th><th>reason</th></tr>${rows}</table>` : '<p>All measurements within tolerance.</p>'}
</section>`;
}

function orphanRows(findings, screenshots) {
  const shown = new Set(screenshots.map((s) => `${s.screen}|${s.theme}`));
  return findings.filter((f) => f.verdict !== 'pass' && !shown.has(`${f.screen}|${f.theme}`))
    .map((f) => `<tr class="${esc(f.verdict)}"><td>${esc(f.verdict)}</td><td>${esc(f.screen)}</td><td>${esc(f.theme)}</td><td>${esc(f.id)}</td><td>${esc(f.metric)}</td><td>${esc(f.delta)}</td><td>${esc(f.reason)}</td></tr>`)
    .join('');
}

export function writeReport(outDir, { engine, startedAt, findings, unused, screenshots }) {
  fs.mkdirSync(outDir, { recursive: true });
  const t = totals(findings);
  fs.writeFileSync(path.join(outDir, 'report.json'),
    JSON.stringify({ engine, startedAt, finishedAt: new Date().toISOString(), totals: t, unused, findings, screenshots }, null, 2));

  const orphans = orphanRows(findings, screenshots);
  const html = `<!doctype html><meta charset="utf-8"><title>Prototype layout comparison</title>
<style>
body{font:14px system-ui,sans-serif;margin:24px;color:#111}
.pair{display:grid;grid-template-columns:1fr 1fr;gap:16px}
figure{margin:0}figcaption{font-weight:600;margin-bottom:4px}
.shot{position:relative;border:1px solid #ccc}.shot img{display:block;width:100%}
.shot i{position:absolute;outline:2px solid #e00;background:rgba(255,0,0,.08)}
table{border-collapse:collapse;margin:12px 0 32px;width:100%}td,th{border:1px solid #ddd;padding:3px 6px;text-align:left}
tr.fail td:first-child,tr.missing-in-reskin td:first-child,tr.map-miss td:first-child,tr.empty-screen td:first-child{color:#b00;font-weight:600}
tr.accepted td:first-child{color:#865}.t{color:#555}
</style>
<h1>Prototype layout comparison</h1>
<p>Engine: <b>${esc(engine)}</b> · started ${esc(startedAt)} · 1024×768</p>
<p class="t">${VERDICT_ORDER.map((v) => `${v}: ${t[v]}`).join(' · ')}</p>
${unused.length ? `<h2>Unused accepted differences</h2><ul>${unused.map((a) => `<li>${esc(a.screen)} ${esc(a.id)} ${esc(a.metric)} ${esc(a.theme)} — ${esc(a.reason)}</li>`).join('')}</ul>` : ''}
${orphans ? `<h2>Findings</h2><table><tr><th>verdict</th><th>screen</th><th>theme</th><th>id</th><th>metric</th><th>delta</th><th>reason</th></tr>${orphans}</table>` : ''}
${screenshots.map((s) => section(s, findings)).join('\n')}
`;
  fs.writeFileSync(path.join(outDir, 'report.html'), html);
}
