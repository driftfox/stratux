import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WEB = path.join(ROOT, 'web');

// ---------------------------------------------------------------------------
// Exported primitives (covered by check-contract.tests.mjs).
// ---------------------------------------------------------------------------

// Returns the subset of `required` that does not occur as a substring of `text`.
export function missingFrom(text, required) {
  const haystack = String(text ?? '');
  return (required || []).filter((item) => !haystack.includes(String(item)));
}

// Returns an array of banned CSS usage hits found in `css`.
export function cssBannedHits(css) {
  const src = String(css ?? '');
  const hits = [];

  // Flex containers may not use `gap` (2015 floor). Grid `gap` is allowed.
  // A selector is flagged when it declares `display:flex` anywhere in the file
  // (including inside @media) and `gap` anywhere under the same selector text.
  const flexSelectors = new Set();
  const gapRules = [];
  const walkRules = (text) => {
    let pos = 0;
    while (true) {
      const open = text.indexOf('{', pos);
      if (open === -1) break;
      const header = text.slice(pos, open).trim();
      let depth = 1;
      let close = open + 1;
      while (close < text.length && depth > 0) {
        if (text[close] === '{') depth += 1;
        else if (text[close] === '}') depth -= 1;
        close += 1;
      }
      const block = text.slice(open + 1, close - 1);
      if (header.startsWith('@')) {
        walkRules(block);
      } else if (header) {
        const selector = header.replace(/\s+/g, ' ').trim();
        if (/\bdisplay\s*:\s*[^;{}]*?(?:inline-)?flex\b/i.test(block)) {
          for (const part of selector.split(',')) {
            const normalized = part.replace(/\s+/g, ' ').trim();
            if (normalized) flexSelectors.add(normalized);
          }
        }
        if (/\bgap\s*:/i.test(block)) {
          gapRules.push(selector);
        }
      }
      pos = close;
    }
  };
  walkRules(src);
  for (const selector of gapRules) {
    const parts = selector.split(',').map((part) => part.replace(/\s+/g, ' ').trim());
    if (parts.some((part) => flexSelectors.has(part))) {
      hits.push('flex-gap');
    }
  }

  // Other §5.1.2 browser-floor bans.
  for (const rx of [
    /\bposition\s*:\s*sticky\b/gi,
    /:has\s*\(/gi,
    /\baspect-ratio\s*:/gi,
    /\bbackdrop-filter\s*:/gi,
    /@container\b/gi,
    /\bplace-items\s*:/gi,
    /\bcolor-scheme\s*:/gi,
    /\bmin\s*\(/gi,
  ]) {
    for (const m of src.matchAll(rx)) hits.push(m[0].trim());
  }

  // @font-face may not fetch a network font. Local src URLs are allowed (R9).
  for (const m of src.matchAll(/@font-face\s*\{[^{}]*\}/gi)) {
    const block = m[0];
    if (/src\s*:[^}]*url\(\s*['"]?\s*https?:\/\//i.test(block)) {
      hits.push('font-face-network');
    }
  }

  // CSS nesting and @media container queries are not detectable here without a
  // parser; the bans above cover the grep-able cases from §5.1.2.

  return hits;
}

// Returns each <form name> that occurs more than once in `html`.
export function duplicateFormNames(html) {
  const counts = new Map();
  for (const m of String(html ?? '').matchAll(/<form\b[^>]*?\sname\s*=\s*["']([^"']*)["']/gi)) {
    counts.set(m[1], (counts.get(m[1]) || 0) + 1);
  }
  return [...counts].filter(([, n]) => n > 1).map(([name]) => name);
}

// Returns on-disk entries (verbatim) that are not present in the manifest list.
export function appcacheMissing(onDisk, listed) {
  const norm = (p) => {
    let s = String(p).trim();
    s = s.replace(/^\.\//, '');
    if (s.startsWith('web/')) s = '/' + s.slice(4);
    if (!s.startsWith('/')) s = '/' + s;
    return s;
  };
  const have = new Set((listed || []).map(norm));
  return (onDisk || []).filter((entry) => !have.has(norm(entry)));
}

// ---------------------------------------------------------------------------
// Main contract run.
// ---------------------------------------------------------------------------

function readText(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function walkFiles(dir, exts, skipDirs) {
  const out = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(path.join(ROOT, d), { withFileTypes: true })) {
      const rel = path.join(d, e.name);
      if (e.isDirectory()) {
        if (skipDirs.has(e.name) || skipDirs.has(rel)) continue;
        walk(rel);
      } else if (exts.has(path.extname(e.name).toLowerCase())) {
        out.push(rel.split(path.sep).join('/'));
      }
    }
  };
  walk(dir);
  return out.sort();
}

function customProps(css) {
  const set = new Set();
  const rx = /(?:^|[{;])\s*(--[a-zA-Z0-9_-]+)\s*:/g;
  let m;
  while ((m = rx.exec(css)) !== null) set.add(m[1]);
  return set;
}

// Transcribed from §5.4 (expanded slash-shorthand into individual names).
const statusRequired = [
  'Version', 'Build', 'ConnectState', 'DeveloperMode', 'Connected_Users', 'Pong_Heartbeats', 'Pong_connected', 'Devices',
  'Ping_connected', 'uatStyleColor', 'esStyleColor', 'aisStyleColor', 'ognStyleColor',
  'UAT_messages_last_minute', 'UAT_messages_max', 'UAT_messages_total',
  'ES_messages_last_minute', 'ES_messages_max', 'ES_messages_total',
  'AIS_messages_last_minute', 'AIS_messages_max', 'AIS_messages_total',
  'AIS_connected',
  'OGN_messages_last_minute', 'OGN_messages_max', 'OGN_messages_total',
  'OGN_connected', 'OGN_noise_db', 'OGN_noise_color', 'OGN_gain_db', 'OGN_range_loss_factor',
  'OGN_Status_url', 'UAT_Towers', 'UAT_METAR_total', 'UAT_TAF_total', 'UAT_NEXRAD_total',
  'UAT_PIREP_total', 'UAT_SIGMET_total', 'UAT_NOTAM_total', 'UAT_OTHER_total',
  'GPS_hardware', 'GPS_protocol', 'GPS_NetworkRemoteIp', 'GPS_solution', 'GPS_position_accuracy',
  'GPS_satellites_locked', 'GPS_satellites_seen', 'GPS_satellites_tracked',
  'Uptime', 'CPUTemp', 'CPUTempMin', 'CPUTempMax', 'DiskSpace', 'Errors',
  'visible_uat', 'visible_es', 'visible_ogn', 'visible_ais', 'visible_ping',
  'visible_pong', 'visible_gps', 'visible_errors', 'Region',
  'VersionClick', 'setRegionClick', 'Clamp',
  'ui-content-for="modals"', 'ui-if="RegionSelect"', 'ui-state="RegionSelect"', 'ui-turn-off="RegionSelect"',
];

const trafficRequired = [
  'ConnectState', 'data_list', 'data_list_invalid', 'showReg', 'showSquawk', 'showCategory', 'RelDist', 'GPS_connected',
  'aircraft.reg', '.tail', '.icao', '.squawk', '.addr_type', '.category', '.lat', '.lon', '.dist', '.bearing',
  '.alt', '.vspeed', '.speed', '.heading', '.signal', '.Age', '.distEst', '.trafficColor', '.addr_symb', '.isStratux',
];

const mapRequired = [
  'ConnectState', 'map_display',
];

const gpsRequired = [
  'ConnectState', 'IsCaging', 'IMU_Sensor_Enabled', 'ahrs_heading', 'ahrs_pitch', 'ahrs_roll', 'ahrs_alt',
  'ahrs_heading_mag', 'ahrs_slip_skid', 'ahrs_turn_rate', 'ahrs_gload',
  'map_pos_x', 'map_pos_y', 'map_width', 'map_height', 'map_opacity', 'map_mark_x', 'map_mark_y', 'map_mark_opacity',
  'data_list', 'SolutionText', 'GPS_PositionSampleRate', 'Satellites', 'GPS_satellites_seen', 'GPS_satellites_tracked',
  'SatelliteID', 'InSolution', 'Elevation', 'Azimuth', 'Signal', 'SatelliteNMEA',
  'gps_lat', 'gps_lon', 'gps_horizontal_accuracy', 'gps_alt', 'gps_vertical_accuracy', 'gps_vert_speed',
  'gps_height_above_ellipsoid', 'gps_track', 'gps_speed',
  'hideClick', 'AHRSCage', 'AHRSCalibrate', 'GMeterReset',
  'ahrs_display', 'gMeter_display', 'map_display',
  'status-calibrating', 'status-gps', 'status-imu', 'status-bmp', 'hider',
];

const radarRequired = [
  'ConnectState', 'BaroAltValid', 'GPSValid', 'CPUTemp', 'radar_display',
];

const weatherRequired = [
  'ConnectState', 'watching', 'watch_count', 'watch_list', 'data_count', 'data_list',
  'location', 'type', 'update', 'flight_condition', 'age', 'time', 'data', 'backcolor',
  'ui-state="weatherAccordion"', 'ui-default="1"', "ui-set=\"{'weatherAccordion':1}\"", 'ui-if="weatherAccordion == 1"',
  'flight_condition_', 'report_',
];

const towersRequired = [
  'ConnectState', 'data_list', 'tower.lat', 'tower.lon', 'tower.power', 'tower.power_last_min', 'tower.power_max', 'tower.messages',
];

const settingsRequired = [
  'DarkMode', 'EstimateBearinglessDist', 'UAT_Enabled', 'ES_Enabled', 'OGN_Enabled', 'AIS_Enabled', 'APRS_Enabled',
  'GPS_Enabled', 'IMU_Sensor_Enabled', 'BMP_Sensor_Enabled', 'Ping_Enabled', 'Pong_Enabled', 'OGNI2CTXEnabled',
  'DisplayTrafficSource', 'DEBUG', 'ReplayLog', 'TraceLog', 'AHRSLog', 'PersistentLogging',
  'GLimits', 'OwnshipModeS', 'WatchList', 'PPM', 'Dump1090Gain', 'Baud', 'StaticIps', 'AltitudeOffset',
  'PWMDutyMin', 'updatePWMDutyMin',
  'WiFiMode', 'WiFiCountry', 'WiFiSSID', 'WiFiSecurityEnabled', 'WiFiPassphrase', 'WiFiDirectPin', 'WiFiChannel',
  'WiFiIPAddress', 'WiFiInternetPassThroughEnabled', 'WiFiClientNetworks',
  'Network.SSID', 'Network.Password',  'OGNAddrType', 'OGNAddr', 'OGNAcftType', 'OGNPilot', 'OGNReg', 'OGNTxPower',
  'DeveloperMode', 'hasTracker', 'gpsHardwareCode', 'BMP_Sensor_Enabled', 'IMU_Sensor_Enabled', 'Pong_Enabled',
  'visible_serialout', 'WiFiMode', 'update_files', 'uploading_update',
  'updateGLimits', 'updatemodes', 'updatewatchlist', 'updateppm', 'updategain', 'updateBaud', 'updatestaticips',
  'updatealtitudeoffset', 'updateOgnTrackerConfig', 'updateWiFi', 'addWiFiClientNetwork', 'removeWiFiClientNetwork',
  'resetSettings', 'setOrientation', 'postReboot', 'postShutdown', 'setUploadFile', 'uploadFile', 'setPongUploadFile',
  'uploadPongFile', 'wifiModeStr',
  'hex-input', 'watchlist-input', 'ssid-input', 'wpa-input', 'pin-input', 'ip-list-input', 'ip-addr-input',
  'g-limits-input', 'pilotname-input', 'ognreg-input',
  'modalReboot', 'modalRebootRequired', 'modalShutdown', 'modalCalibrateForward', 'modalCalibrateDone',
  'modalCalibrateFailed', 'modalSuccessWiFi', 'modalErrorWiFi', 'modalCancelWiFi', 'rebooting', 'shuttingdown',
];

// Checked against the template alone: the controller already contains these
// names, so the concatenated plate+JS text would pass vacuously.
const settingsHtmlRequired = ['uploading_pong_update'];
// §4 drops the WiFiRestart banner (nothing sets it); §5.8 defect 7 is the
// template's misspelling of the controller's uploading_pong_update.
const settingsHtmlForbidden = ['WiFiRestart', 'pong_uploading_update'];

const logsRequired = [
  'userAgent', 'deviceViewport', '../logs/stratux.log', '../logs/',
];

const developerRequired = [
  'ui-content-for="title"', 'Logfile_Size', 'AHRS_LogFiles_Size', 'postRestart', 'postDownloadLog',
  'postDeleteLog', 'postDownloadAHRSLogs', 'postDeleteAHRSLogs', 'postDownloadDB',
];

const indexRequiredStrings = [
  '<body ng-app="stratux" ng-controller="MainCtrl" ui-prevent-touchmove-defaults>',
  'id="themeStylesheet"',
  'ui-yield-to="modals"',
  'ui-yield-to="title"',
  'ui-yield-to="navbarAction"',
  'ui-toggle="uiSidebarLeft"',
  'ui-toggle="uiSidebarRight"',
  "ui-track-as-search-param='true'",
  'ui-turn-off=\'uiSidebarLeft\'',
  'ui-swipe-right',
  'ui-swipe-left',
  'ng-include="helppage"',
  'app-body', 'app-content', 'scrollable', 'scrollable-content', 'ui-view',
  '#/', '#/weather', '#/traffic', '#/gps', '#/towers', '#/logs', '#/settings', '#/radar', '#/map', '#/developer',
  'UAT_Enabled || Ping_Enabled || Pong_Enabled', 'DeveloperMode',
];

function plateChecks() {
  const plates = [
    ['status', statusRequired],
    ['traffic', trafficRequired],
    ['map', mapRequired],
    ['gps', gpsRequired],
    ['radar', radarRequired],
    ['weather', weatherRequired],
    ['towers', towersRequired],
    ['settings', settingsRequired],
    ['logs', logsRequired],
    ['developer', developerRequired],
  ];
  const failures = [];
  for (const [name, required] of plates) {
    let text = readText(`web/plates/${name}.html`);
    const jsRel = `web/plates/js/${name}.js`;
    const jsAbs = path.join(ROOT, jsRel);
    if (fs.existsSync(jsAbs)) text += '\n' + readText(jsRel);
    const missing = missingFrom(text, required);
    if (missing.length) failures.push(`FAIL plates/${name}.html: ${missing.join(', ')}`);
    const dupForms = duplicateFormNames(readText(`web/plates/${name}.html`));
    if (dupForms.length) failures.push(`FAIL plates/${name}.html: duplicate form name ${dupForms.join(', ')}`);
  }

  const settingsHtml = readText('web/plates/settings.html');
  const missingHtml = missingFrom(settingsHtml, settingsHtmlRequired);
  if (missingHtml.length) failures.push(`FAIL plates/settings.html: ${missingHtml.join(', ')}`);
  const forbidden = settingsHtmlForbidden.filter((s) => settingsHtml.includes(s));
  if (forbidden.length) failures.push(`FAIL plates/settings.html: must not contain ${forbidden.join(', ')}`);

  // Shell (index.html).
  const indexHtml = readText('web/index.html');
  const missingIndex = missingFrom(indexHtml, indexRequiredStrings);
  if (missingIndex.length) failures.push(`FAIL web/index.html: ${missingIndex.join(', ')}`);

  return failures;
}

function cssChecks() {
  const failures = [];
  const cssDir = 'web/css';
  // First-party stylesheets: exclude vendored ol/addtohomescreen sheets.
  const vendoredCss = new Set(['ol.css', 'ol-layerswitcher.css', 'addtohomescreen.css']);
  const files = fs.readdirSync(path.join(ROOT, cssDir))
    .filter((f) => f.endsWith('.css') && !vendoredCss.has(f));
  for (const f of files) {
    const css = readText(`${cssDir}/${f}`);
    const hits = cssBannedHits(css);
    if (hits.length) failures.push(`FAIL web/css/${f}: banned CSS (${hits.join(', ')})`);
  }

  // Custom property sync between main.css and dark-mode.css.
  const mainProps = customProps(readText('web/css/main.css'));
  const darkProps = customProps(readText('web/css/dark-mode.css'));
  const missingProps = [...mainProps].filter((p) => !darkProps.has(p));
  if (missingProps.length) {
    failures.push(`FAIL css/dark-mode.css: missing custom properties ${missingProps.join(', ')}`);
  }

  return failures;
}

function appcacheCheck() {
  const onDisk = walkFiles('web', new Set(['.css', '.js']), new Set(['maui']));
  const manifest = readText('web/stratux.appcache');
  const listed = manifest.split(/\r?\n/).map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && !/^(CACHE MANIFEST|NETWORK:|CACHE:|FALLBACK:)/i.test(l));
  const missing = appcacheMissing(onDisk, listed);
  return missing.map((p) => `FAIL appcache: ${p}`);
}

export function main() {
  const failures = [
    ...plateChecks(),
    ...cssChecks(),
    ...appcacheCheck(),
  ];
  if (!failures.length) {
    console.log('Contract check: PASS (0 failures)');
    process.exit(0);
  }
  console.log(`Contract check: ${failures.length} failure(s)`);
  for (const f of failures) console.log(f);
  process.exit(1);
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  main();
}
