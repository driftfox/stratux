#!/usr/bin/env node
/**
 * Stratux UI development fixture server.
 *
 * Serves the real `web/` directory off disk (edit + refresh, no build step) and
 * emulates the Stratux management interface well enough that every screen in the
 * UI renders fully populated. Data is fixed; only freshness counters move.
 *
 *   node dev/server.mjs            # http://127.0.0.1:8080
 *   node dev/server.mjs --port 3000
 *
 * Zero dependencies. Nothing in `web/` or `main/` is modified by this.
 *
 * Deliberate deviation from the real backend:
 *   - `status.Clock` is added. The real Go `status` struct has no `Clock` field,
 *     so production shows "Invalid Date" in the traffic and radar headers. It is
 *     supplied here so it does not distract from judging the UI. Remove the
 *     line marked CLOCK below for byte-faithful behaviour.
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const WEB_DIR = path.join(REPO_ROOT, 'web');
const FIXTURES_DIR = path.join(__dirname, 'fixtures');

const args = process.argv.slice(2);
const portArg = args.indexOf('--port');
const PORT = portArg !== -1 && args[portArg + 1] ? Number(args[portArg + 1]) : Number(process.env.PORT || 8080);
const hostArg = args.indexOf('--host');
const HOST = hostArg !== -1 && args[hostArg + 1] ? args[hostArg + 1] : (process.env.HOST || '127.0.0.1');

// ---------------------------------------------------------------- fixtures --

const readJson = (name) => JSON.parse(fs.readFileSync(path.join(FIXTURES_DIR, name), 'utf8'));

const fixtureStatus = readJson('status.json');
const fixtureSituation = readJson('situation.json');
const fixtureSettings = readJson('settings.json');
const fixtureTowers = readJson('towers.json');
const fixtureSatellites = readJson('satellites.json');
const fixtureTraffic = readJson('traffic.json');
const fixtureWeather = readJson('weather.json');

let settings = structuredClone(fixtureSettings);

// The device "booted" 6h17m ago; uptime ticks from there.
const BOOT_TIME = new Date(Date.now() - (6 * 3600 + 17 * 60) * 1000);

// ------------------------------------------------------------------- time ---

const iso = (d) => (d instanceof Date ? d : new Date(d)).toISOString();
const isoNow = () => new Date().toISOString();

/** "DDHHMM" in UTC, the short datetime format FIS-B reports use. */
function shortUtc(d) {
  const p = (n) => String(n).padStart(2, '0');
  return p(d.getUTCDate()) + p(d.getUTCHours()) + p(d.getUTCMinutes());
}

/** Seconds elapsed since midnight UTC. */
function secondsSinceUtcMidnight(d = new Date()) {
  return d.getUTCHours() * 3600 + d.getUTCMinutes() * 60 + d.getUTCSeconds();
}

// -------------------------------------------------------------------- geo ---

const DEG = Math.PI / 180;

/** Great-circle destination: start at (lat, lon), go `distM` metres on `bearingDeg`. */
function destination(lat, lon, bearingDeg, distM) {
  const R = 6371008.8;
  const delta = distM / R;
  const theta = bearingDeg * DEG;
  const phi1 = lat * DEG;
  const lambda1 = lon * DEG;

  const sinPhi2 = Math.sin(phi1) * Math.cos(delta) + Math.cos(phi1) * Math.sin(delta) * Math.cos(theta);
  const phi2 = Math.asin(sinPhi2);
  const lambda2 =
    lambda1 + Math.atan2(Math.sin(theta) * Math.sin(delta) * Math.cos(phi1), Math.cos(delta) - Math.sin(phi1) * sinPhi2);

  let lon2 = ((lambda2 / DEG + 540) % 360) - 180;
  return [phi2 / DEG, lon2];
}

/** Haversine distance in metres. */
function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371008.8;
  const dPhi = (lat2 - lat1) * DEG;
  const dLambda = (lon2 - lon1) * DEG;
  const a =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(lat1 * DEG) * Math.cos(lat2 * DEG) * Math.sin(dLambda / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Initial bearing from point 1 to point 2, degrees true. */
function bearing(lat1, lon1, lat2, lon2) {
  const y = Math.sin((lon2 - lon1) * DEG) * Math.cos(lat2 * DEG);
  const x =
    Math.cos(lat1 * DEG) * Math.sin(lat2 * DEG) -
    Math.sin(lat1 * DEG) * Math.cos(lat2 * DEG) * Math.cos((lon2 - lon1) * DEG);
  return (Math.atan2(y, x) / DEG + 360) % 360;
}

// --------------------------------------------------------------- payloads ---

function buildStatus() {
  const now = new Date();
  return {
    ...fixtureStatus,
    // CLOCK: omitted by the real backend - delete this line for faithful behaviour.
    Clock: iso(now),
    UptimeClock: iso(BOOT_TIME),
    Uptime: now.getTime() - BOOT_TIME.getTime(),
  };
}

function buildSituation() {
  const now = new Date();
  return {
    ...fixtureSituation,
    GPSLastFixSinceMidnightUTC: secondsSinceUtcMidnight(now),
    GPSLastFixLocalTime: iso(now),
    GPSTime: iso(now),
    GPSLastGPSTimeStratuxTime: iso(now),
    GPSLastValidNMEAMessageTime: iso(now),
    GPSLastAccuracyTime: iso(now),
    GPSLastGroundTrackTime: iso(now),
    BaroLastMeasurementTime: iso(now),
    AHRSLastAttitudeTime: iso(now),
  };
}

const hasPosition = (t) => t.Position_valid && t._bearingDeg !== null && t._distanceM !== null;

/**
 * One traffic target. Positions are derived from the ownship fixture plus the
 * target's dev-only `_bearingDeg` / `_distanceM`, so bearing and distance are
 * always self-consistent with where the aircraft sits on the map.
 *
 * Ages are held constant so the UI's 59-second staleness sweep never removes a
 * target: the list stays populated and stable.
 */
function buildTarget(t, now) {
  const out = { ...t };
  const age = t._age ?? 1;
  const ageLastAlt = t._ageLastAlt ?? age;

  out.Timestamp = iso(new Date(now.getTime() - age * 1000));
  out.Last_seen = out.Timestamp;
  out.Last_alt = iso(new Date(now.getTime() - ageLastAlt * 1000));
  out.Last_speed = out.Last_seen;
  out.Last_GnssDiff = out.Last_seen;
  out.Last_GnssDiffAlt = t.Alt ?? 0;
  out.Last_extrapolation = out.Last_seen;
  out.Age = age;
  out.AgeLastAlt = ageLastAlt;
  out.AgeExtrapolation = 0;
  out.DistanceEstimatedLastTs = out.Last_seen;

  if (hasPosition(t)) {
    const [lat, lon] = destination(
      fixtureSituation.GPSLatitude,
      fixtureSituation.GPSLongitude,
      t._bearingDeg,
      t._distanceM,
    );
    out.Lat = Number(lat.toFixed(6));
    out.Lng = Number(lon.toFixed(6));
    out.Bearing = Number(t._bearingDeg.toFixed(1));
    out.Distance = Math.round(t._distanceM);
    out.DistanceEstimated = Math.round(t._distanceM);
    out.Lat_fix = out.Lat;
    out.Lng_fix = out.Lng;
    out.Alt_fix = t.Alt ?? 0;
  } else {
    out.Lat = 0;
    out.Lng = 0;
    out.Bearing = 0;
    out.Distance = 0;
    out.DistanceEstimated = 0;
    out.Lat_fix = 0;
    out.Lng_fix = 0;
    out.Alt_fix = t.Alt ?? 0;
  }

  delete out._bearingDeg;
  delete out._distanceM;
  delete out._age;
  delete out._ageLastAlt;
  return out;
}

function buildTraffic(now = new Date()) {
  return fixtureTraffic.map((t) => buildTarget(t, now));
}

/** Targets the real backend would forward to `/radar`. */
function buildRadarTargets(now = new Date()) {
  const ownAlt = fixtureSituation.GPSAltitudeMSL;
  const altSlack = (settings.RadarLimits ?? 2000) * 1.3;
  const distSlack = (settings.RadarRange ?? 10) * 1852 * 1.3;

  return buildTraffic(now).filter((t) => {
    if (t.IsStratux) return false;
    if (Math.abs(t.Alt - ownAlt) > altSlack) return false;
    if (t.Position_valid && t.Distance > distSlack) return false;
    return true;
  });
}

function buildTowers() {
  // Stable content: jitter the "now" column so the signal bars look alive
  // without the values drifting away from reality.
  return structuredClone(fixtureTowers);
}

function buildSatellites() {
  const now = isoNow();
  const out = {};
  for (const [id, sat] of Object.entries(fixtureSatellites)) {
    out[id] = {
      ...sat,
      TimeLastSolution: sat.InSolution ? now : '0001-01-01T00:00:00Z',
      TimeLastSeen: now,
      TimeLastTracked: now,
    };
  }
  return out;
}

function buildRegion() {
  if (settings.RegionSelected === 1) return { IsSet: true, Region: 'US' };
  if (settings.RegionSelected === 2) return { IsSet: true, Region: 'EU' };
  return { IsSet: false, Region: '' };
}

/** One WeatherMessage, with `Time` stamped relative to now so ages read sensibly. */
function buildWeatherMessage(msg, now = new Date()) {
  const sent = new Date(now.getTime() - (msg._ageMinutes ?? 5) * 60 * 1000);
  return {
    Type: msg.Type,
    Location: msg.Location,
    Time: shortUtc(sent),
    Data: msg.Data,
    LocaltimeReceived: iso(sent),
  };
}

// Keys `/setSettings` honours, mirroring handleSettingsSetRequest in
// main/managementinterface.go. Anything else is ignored, exactly as in production.
const SETTABLE_KEYS = new Set([
  'DarkMode', 'UAT_Enabled', 'ES_Enabled', 'OGN_Enabled', 'AIS_Enabled', 'APRS_Enabled',
  'Ping_Enabled', 'Pong_Enabled', 'OGNI2CTXEnabled', 'GPS_Enabled', 'IMU_Sensor_Enabled',
  'BMP_Sensor_Enabled', 'DEBUG', 'DisplayTrafficSource', 'ReplayLog', 'TraceLog', 'AHRSLog',
  'PersistentLogging', 'IMUMapping', 'Dump1090Gain', 'PPM', 'AltitudeOffset', 'RadarLimits',
  'RadarRange', 'WatchList', 'GLimits', 'OwnshipModeS', 'StaticIps', 'WiFiCountry', 'WiFiSSID',
  'WiFiChannel', 'WiFiSecurityEnabled', 'WiFiPassphrase', 'WiFiIPAddress', 'WiFiMode',
  'WiFiDirectPin', 'WiFiClientNetworks', 'WiFiInternetPassThroughEnabled',
  'EstimateBearinglessDist', 'OGNAddrType', 'OGNAddr', 'OGNAcftType', 'OGNPilot', 'OGNReg',
  'OGNTxPower', 'PWMDutyMin',
]);

// ------------------------------------------------------------ HTTP routes ---

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.map': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.appcache': 'text/cache-manifest',
};

const LOG_FILES = ['stratux.log', 'stratux_1.log', 'ahrs.log'];

function synthLog(name) {
  const lines = [];
  const now = new Date();
  const samples = [
    'INFO: main: stratuxrun starting. version=v2.0-pre5 build=73987695',
    'INFO: gps: GPS detected. type=ublox9 baud=115200',
    'INFO: sdr: found 2 device(s)',
    'INFO: traffic: UAT target 1104123 position update 38.85/-77.04 alt 3200',
    'INFO: mgmt: websocket client connected',
    'INFO: weather: METAR KBOS 18/10 A3012',
    'WARN: sensors: BMP280 read retry',
    'INFO: traffic: ES target 1115544 position update alt 5200',
    'DEBUG: network: UDP keepalive to 192.168.10.1:4000',
  ];
  for (let i = 40; i >= 0; i--) {
    const t = new Date(now.getTime() - i * 7000);
    lines.push(`[${t.toISOString()}] ${samples[i % samples.length]}`);
  }
  return `# ${name} (synthetic, generated by dev/server.mjs)\n${lines.join('\n')}\n`;
}

function sendJson(res, body) {
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store, must-revalidate',
  });
  res.end(JSON.stringify(body) + '\n');
}

function sendText(res, status, text, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(text);
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', () => resolve(''));
  });
}

// ------------------------------------------------------------------ log dir --

function logsIndexHtml() {
  const rows = LOG_FILES.map(
    (f) => `<li><a href="/logs/${f}">${f}</a></li>`,
  ).join('\n    ');
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>/logs/</title></head>
<body><h1>Index of /logs/</h1>
<ul>
    ${rows}
</ul>
</body></html>
`;
}

// -------------------------------------------------------------- WS plumbing --

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

function encodeFrame(data, opcode = 0x1) {
  const payload = Buffer.isBuffer(data) ? data : Buffer.from(data, 'utf8');
  const len = payload.length;
  let header;
  if (len < 126) {
    header = Buffer.from([0x80 | opcode, len]);
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | opcode;
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | opcode;
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, payload]);
}

function attachClientFrameReader(socket) {
  let buf = Buffer.alloc(0);
  socket.on('data', (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    for (;;) {
      if (buf.length < 2) return;
      const opcode = buf[0] & 0x0f;
      const masked = (buf[1] & 0x80) !== 0;
      let len = buf[1] & 0x7f;
      let off = 2;
      if (len === 126) {
        if (buf.length < 4) return;
        len = buf.readUInt16BE(2);
        off = 4;
      } else if (len === 127) {
        if (buf.length < 10) return;
        len = Number(buf.readBigUInt64BE(2));
        off = 10;
      }
      let mask = null;
      if (masked) {
        if (buf.length < off + 4) return;
        mask = buf.subarray(off, off + 4);
        off += 4;
      }
      if (buf.length < off + len) return;

      let payload = buf.subarray(off, off + len);
      if (mask) {
        payload = Buffer.from(payload);
        for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
      }
      buf = buf.subarray(off + len);

      if (opcode === 0x8) {
        try { socket.write(encodeFrame(Buffer.alloc(0), 0x8)); } catch { /* already gone */ }
        socket.end();
        return;
      }
      if (opcode === 0x9) {
        try { socket.write(encodeFrame(payload, 0xA)); } catch { /* already gone */ }
      }
      // text/binary frames from the client are not used by the UI - ignored.
    }
  });
}

const channels = {
  status: new Set(),
  situation: new Set(),
  traffic: new Set(),
  weather: new Set(),
  radar: new Set(),
};

function send(socket, payload) {
  if (socket.destroyed || socket.writableEnded) return;
  try {
    socket.write(encodeFrame(typeof payload === 'string' ? payload : JSON.stringify(payload)));
  } catch {
    /* client vanished mid-write */
  }
}

function broadcast(channel, payload) {
  for (const socket of channels[channel]) send(socket, payload);
}

function subscribe(channel, socket) {
  channels[channel].add(socket);
  const drop = () => channels[channel].delete(socket);
  socket.on('close', drop);
  socket.on('error', drop);
}

// ----------------------------------------------------------------- WS state --

function statusSnapshot() { return buildStatus(); }
function situationSnapshot() { return buildSituation(); }

let weatherCursor = 0;

// ---------------------------------------------------------------- HTTP app ---

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = decodeURIComponent(url.pathname);
  const method = req.method || 'GET';

  // ---- REST ----
  if (method === 'GET') {
    if (pathname === '/getStatus') return sendJson(res, statusSnapshot());
    if (pathname === '/getSituation') return sendJson(res, situationSnapshot());
    if (pathname === '/getSettings') return sendJson(res, settings);
    if (pathname === '/getTowers') return sendJson(res, buildTowers());
    if (pathname === '/getSatellites') return sendJson(res, buildSatellites());
    if (pathname === '/getRegion') return sendJson(res, buildRegion());
    // `{}` so map.js runs its tileset callback - that is where it attaches the
    // aircraft layers. A 404 here leaves the map with no aircraft at all.
    if (pathname === '/tiles/tilesets') return sendJson(res, {});
    if (pathname === '/develmodetoggle') return sendJson(res, {});
    if (pathname === '/updatePong') return sendJson(res, {});

    if (pathname === '/logs/' || pathname === '/logs') {
      return sendText(res, 200, logsIndexHtml(), 'text/html; charset=utf-8');
    }
    const logMatch = pathname.match(/^\/logs\/([^/]+)$/);
    if (logMatch && LOG_FILES.includes(logMatch[1])) {
      res.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': `inline; filename="${logMatch[1]}"`,
        'Cache-Control': 'no-store',
      });
      return res.end(synthLog(logMatch[1]));
    }
    if (pathname === '/downloadlog') {
      res.writeHead(200, {
        'Content-Type': 'text/plain; charset=utf-8',
        'Content-Disposition': 'attachment; filename="stratux.log"',
      });
      return res.end(synthLog('stratux.log'));
    }
  }

  if (method === 'POST') {
    if (pathname === '/setSettings') {
      const raw = await readBody(req);
      let patch = {};
      try { patch = JSON.parse(raw || '{}'); } catch { /* ignore malformed */ }
      const radarKeysChanged =
        ('RadarLimits' in patch && patch.RadarLimits !== settings.RadarLimits) ||
        ('RadarRange' in patch && patch.RadarRange !== settings.RadarRange);
      for (const [k, v] of Object.entries(patch)) {
        if (SETTABLE_KEYS.has(k)) settings[k] = v;
      }
      if (radarKeysChanged) broadcast('radar', settings);
      return sendJson(res, settings);
    }
    if (pathname === '/setRegion') {
      const raw = await readBody(req);
      try {
        const { Region } = JSON.parse(raw || '{}');
        settings.RegionSelected = Region === 'US' ? 1 : Region === 'EU' ? 2 : 0;
      } catch { /* ignore malformed */ }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end('{}');
    }
    // Destructive or hardware actions: acknowledge, do nothing.
    if (
      ['/reboot', '/shutdown', '/restart', '/cageAHRS', '/calibrateAHRS', '/orientAHRS',
       '/resetGMeter', '/deletelogfile', '/deleteahrslogfiles'].includes(pathname)
    ) {
      return sendJson(res, {});
    }
  }

  // ---- static files from web/ ----
  if (method === 'GET' || method === 'HEAD') {
    let rel = pathname === '/' ? '/index.html' : pathname;
    const filePath = path.normalize(path.join(WEB_DIR, rel));
    if (!filePath.startsWith(WEB_DIR + path.sep) && filePath !== WEB_DIR) {
      return sendText(res, 403, 'Forbidden');
    }
    let stat;
    try { stat = fs.statSync(filePath); } catch { stat = null; }
    if (stat && stat.isDirectory()) {
      return sendText(res, 404, 'Not found');
    }
    if (!stat) return sendText(res, 404, 'Not found');

    const ext = path.extname(filePath).toLowerCase();
    // main.js hardcodes ws://, which browsers block on HTTPS pages (e.g. behind a tunnel).
    if (rel === '/js/main.js') {
      const body = fs.readFileSync(filePath, 'utf8')
        .replaceAll('"ws://"', '(window.location.protocol === "https:" ? "wss://" : "ws://")');
      res.writeHead(200, {
        'Content-Type': MIME[ext],
        'Cache-Control': 'no-store, must-revalidate',
        'Content-Length': Buffer.byteLength(body),
      });
      return res.end(method === 'HEAD' ? undefined : body);
    }
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-store, must-revalidate',
      'Content-Length': stat.size,
    });
    if (method === 'HEAD') return res.end();
    return fs.createReadStream(filePath).pipe(res);
  }

  return sendText(res, 405, 'Method not allowed');
});

// ------------------------------------------------------------ WS handshake ---

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const route = url.pathname;

  const known = ['/status', '/situation', '/traffic', '/weather', '/radar', '/developer'];
  const key = req.headers['sec-websocket-key'];
  if (!known.includes(route) || !key || req.headers.upgrade?.toLowerCase() !== 'websocket') {
    socket.write('HTTP/1.1 404 Not Found\r\nConnection: close\r\n\r\n');
    socket.destroy();
    return;
  }

  const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
  socket.write(
    'HTTP/1.1 101 Switching Protocols\r\n' +
      'Upgrade: websocket\r\n' +
      'Connection: Upgrade\r\n' +
      `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
  );
  socket.setNoDelay(true);
  attachClientFrameReader(socket);
  if (head && head.length) socket.unshift(head);

  const channel = route === '/developer' ? 'status' : route.slice(1);

  if (channel === 'status') {
    subscribe('status', socket);
    send(socket, statusSnapshot());
  } else if (channel === 'situation') {
    subscribe('situation', socket);
    send(socket, situationSnapshot());
  } else if (channel === 'traffic') {
    subscribe('traffic', socket);
    for (const t of buildTraffic()) send(socket, t);
  } else if (channel === 'radar') {
    subscribe('radar', socket);
    send(socket, settings);
    for (const t of buildRadarTargets()) send(socket, t);
  } else if (channel === 'weather') {
    subscribe('weather', socket);
    for (const m of fixtureWeather) send(socket, buildWeatherMessage(m));
  }
});

// ---------------------------------------------------------------- tickers ----
// Cadence matches main/managementinterface.go: /status 1s, /situation 100ms,
// /traffic and /radar 1s per target. Weather is drip-fed rather than burst-only
// because the real /weather socket sends no history on connect.

setInterval(() => broadcast('status', statusSnapshot()), 1000);
setInterval(() => broadcast('situation', situationSnapshot()), 100);
setInterval(() => {
  const traffic = buildTraffic();
  for (const t of traffic) broadcast('traffic', t);
  for (const t of buildRadarTargets()) broadcast('radar', t);
}, 1000);
setInterval(() => {
  if (!fixtureWeather.length) return;
  broadcast('weather', buildWeatherMessage(fixtureWeather[weatherCursor % fixtureWeather.length]));
  weatherCursor++;
}, 4000);

server.listen(PORT, HOST, () => {
  console.log(`Stratux UI dev server`);
  console.log(`  UI       http://${HOST}:${PORT}/`);
  console.log(`  static   ${WEB_DIR}`);
  console.log(`  fixtures ${FIXTURES_DIR}`);
  console.log(`\nEdit files under web/ and refresh the browser.`);
});
