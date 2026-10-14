import { TOLERANCES } from './tolerances.mjs';

const PADDING = ['padTop', 'padRight', 'padBottom', 'padLeft'];
const FAILING = new Set(['fail', 'missing-in-reskin', 'map-miss', 'empty-screen']);

const round = (n) => Math.round(n * 100) / 100;

function metricsFor(entry) {
  const metrics = entry.kind === 'fixed'
    ? ['x', 'y', 'w', 'h', ...PADDING]
    : ['x', ...(entry.firstVariable ? ['y'] : []), 'w', ...PADDING];
  return entry.noPosition ? metrics.filter((m) => m !== 'x' && m !== 'y') : metrics;
}

function toleranceFor(entry, metric) {
  if (PADDING.includes(metric)) return TOLERANCES.padding;
  if (metric === 'x' || metric === 'y') return TOLERANCES.position;
  if (metric === 'gap') return TOLERANCES.gap;
  if (metric === 'w' && entry.kind === 'variable') {
    return round(TOLERANCES.viewportWidth * TOLERANCES.variableWidthPct / 100);
  }
  return TOLERANCES.fixedSize;
}

function gapOf(prev, cur, axis) {
  return axis === 'x' ? cur.x - (prev.x + prev.w) : cur.y - (prev.y + prev.h);
}

const matches = (pattern, value) => pattern === '*' || pattern === value;

// A map-miss or empty screen is a broken map, never an accepted layout.
const ACCEPTABLE = new Set(['fail', 'missing-in-reskin']);

function applyAccepted(finding, accepted) {
  if (!ACCEPTABLE.has(finding.verdict)) return finding;
  const hit = accepted.find((a) =>
    a.screen === finding.screen &&
    matches(a.id, finding.id) &&
    matches(a.metric, finding.metric ?? '*') &&
    matches(a.theme, finding.theme));
  if (!hit) return finding;
  return { ...finding, verdict: 'accepted', reason: hit.reason, acceptedBy: hit };
}

export function compareScreen({ screen, theme, entries, proto, reskin, accepted = [] }) {
  const findings = [];
  const base = { screen, theme };
  let compared = 0;

  for (const entry of entries) {
    const { id } = entry;
    const r = reskin[id];

    if (entry.proto === null) {
      findings.push({ ...base, id, metric: null, proto: null, reskin: null, delta: null, tolerance: null,
        verdict: 'reskin-only', reason: r?.found ? undefined : r?.reason ?? 'no-match' });
      continue;
    }

    const p = proto[id];
    if (!p?.found) {
      findings.push({ ...base, id, metric: null, proto: null, reskin: null, delta: null, tolerance: null,
        verdict: 'map-miss', reason: p?.reason ?? 'no-match' });
      continue;
    }
    if (!r?.found) {
      findings.push({ ...base, id, metric: null, proto: null, reskin: null, delta: null, tolerance: null,
        verdict: 'missing-in-reskin', reason: r?.reason ?? 'no-match' });
      continue;
    }

    compared++;
    const values = metricsFor(entry).map((metric) => [metric, p[metric], r[metric]]);

    if (entry.after) {
      const pPrev = proto[entry.after.id];
      const rPrev = reskin[entry.after.id];
      if (pPrev?.found && rPrev?.found) {
        values.push(['gap', gapOf(pPrev, p, entry.after.axis), gapOf(rPrev, r, entry.after.axis)]);
      }
    }

    for (const [metric, pv, rv] of values) {
      const tolerance = toleranceFor(entry, metric);
      const delta = round(rv - pv);
      findings.push({ ...base, id, metric, proto: round(pv), reskin: round(rv), delta, tolerance,
        verdict: Math.abs(delta) <= tolerance ? 'pass' : 'fail' });
    }
  }

  if (compared === 0) {
    findings.push({ ...base, id: '*', metric: null, proto: null, reskin: null, delta: null, tolerance: null,
      verdict: 'empty-screen', reason: 'no element was found in both apps' });
  }

  return findings.map((f) => applyAccepted(f, accepted));
}

export function loadAccepted(json) {
  if (!Array.isArray(json)) throw new Error('accepted differences must be an array');
  return json.map((a, i) => {
    for (const key of ['screen', 'id', 'metric', 'theme']) {
      if (typeof a?.[key] !== 'string' || !a[key]) {
        throw new Error(`accepted difference #${i} is missing "${key}"`);
      }
    }
    if (typeof a.reason !== 'string' || !a.reason.trim()) {
      throw new Error(`accepted difference #${i} (${a.screen} ${a.id} ${a.metric}) has no reason`);
    }
    return { screen: a.screen, id: a.id, metric: a.metric, theme: a.theme, reason: a.reason };
  });
}

export function unusedAccepted(accepted, findings) {
  const used = new Set(findings.map((f) => f.acceptedBy).filter(Boolean));
  return accepted.filter((a) => !used.has(a));
}

export function exitCode(findings) {
  return findings.some((f) => FAILING.has(f.verdict)) ? 1 : 0;
}
