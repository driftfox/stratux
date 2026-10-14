// Element map: which prototype element corresponds to which reskin element.
// Entry shape and measurement rules: lib/compare.mjs. Selector syntax:
// lib/measure.mjs. `proto: null` marks an element only the reskin has.
//
// Settings and Status reorder their panels (spec, *What is measured*), so every
// entry inside a panel there is `noPosition`: only sizes, padding, and the gap
// to the previous element in the same panel are compared.
const fixed = (id, proto, reskin, extra = {}) => ({ id, proto, reskin, kind: 'fixed', ...extra });
const variable = (id, proto, reskin, extra = {}) => ({ id, proto, reskin, kind: 'variable', ...extra });
const below = (id) => ({ after: { id, axis: 'y' } });
const beside = (id) => ({ after: { id, axis: 'x' } });
const unplaced = (extra = {}) => ({ noPosition: true, ...extra });

const titleRow = (screen) => fixed(`${screen}.title-row`, '.title-row', '.sx-title-row');

export const ELEMENTS = {
  status: [
    fixed('status.header', 'main.app > header', '.navbar-app'),
    fixed('status.menu-button', 'header button[aria-label="Open menu"]', '.navbar-app [aria-label="Menu"]'),
    fixed('status.header-actions', '.header-actions', '.sx-header-actions'),
    fixed('status.crumb', '.crumb', '.sx-crumb', below('status.header')),
    fixed('status.title-row', '.title-row', '.sx-title-row', below('status.crumb')),
    fixed('status.title-badge', '.title-row .badge', '.sx-title-row .sx-badge'),

    variable('status.health', 'panel:Receiver health', 'panel:Receiver health', unplaced({ firstVariable: true })),
    fixed('status.health.head', 'panel:Receiver health >> .section-head', 'panel:Receiver health >> .sx-section-head', unplaced()),
    fixed('status.health.badge', 'panel:Receiver health >> .section-head .badge', 'panel:Receiver health >> .sx-section-head .sx-badge', unplaced()),
    fixed('status.health.metric', 'panel:Receiver health >> .metric', 'panel:Receiver health >> .sx-metric', unplaced(below('status.health.head'))),

    variable('status.rate', 'panel:Message rate', 'panel:Message rate', unplaced()),
    fixed('status.rate.head', 'panel:Message rate >> .section-head', 'panel:Message rate >> .sx-section-head', unplaced()),
    fixed('status.rate.row', 'panel:Message rate >> .rate', 'panel:Message rate >> .sx-rate', unplaced(below('status.rate.head'))),

    variable('status.ogn', null, 'panel:OGN statistics', unplaced()),

    variable('status.uat', 'panel:UAT statistics', 'panel:UAT statistics', unplaced()),
    fixed('status.uat.head', 'panel:UAT statistics >> .section-head', 'panel:UAT statistics >> .sx-section-head', unplaced()),
    fixed('status.uat.metric', 'panel:UAT statistics >> .metric', 'panel:UAT statistics >> .sx-metric', unplaced(below('status.uat.head'))),

    variable('status.gps', 'panel:GPS', 'panel:GPS', unplaced()),
    fixed('status.gps.head', 'panel:GPS >> .section-head', 'panel:GPS >> .sx-section-head', unplaced()),
    fixed('status.gps.metric', 'panel:GPS >> .metric', 'panel:GPS >> .sx-metric', unplaced(below('status.gps.head'))),

    variable('status.system', 'panel:System', 'panel:System', unplaced()),
    fixed('status.system.head', 'panel:System >> .section-head', 'panel:System >> .sx-section-head', unplaced()),
    fixed('status.system.metric', 'panel:System >> .metric', 'panel:System >> .sx-metric', unplaced(below('status.system.head'))),

    variable('status.frames', 'panel:Frame totals', 'panel:Frame totals', unplaced()),
    fixed('status.frames.head', 'panel:Frame totals >> .section-head', 'panel:Frame totals >> .sx-section-head', unplaced()),
    fixed('status.frames.metric', 'panel:Frame totals >> .metric', 'panel:Frame totals >> .sx-metric', unplaced(below('status.frames.head'))),
  ],

  weather: [
    titleRow('weather'),
    variable('weather.watch', 'panel:Watch list', 'panel:Watching*', { firstVariable: true, ...below('weather.title-row') }),
    fixed('weather.watch.head', 'panel:Watch list >> .section-head', 'panel:Watching* >> .sx-section-head'),
    fixed('weather.watch.report', 'panel:Watch list >> .report', 'panel:Watching* >> .sx-report', below('weather.watch.head')),
    fixed('weather.watch.report-top', 'panel:Watch list >> .report-top', 'panel:Watching* >> .sx-report-top'),
    fixed('weather.watch.age', 'panel:Watch list >> .report-top time', 'panel:Watching* >> .sx-report-top time'),
    fixed('weather.badge-vfr', '.report .flight.vfr', '.sx-report .sx-flight.flight_condition_VFR'),
    fixed('weather.badge-ifr', '.report .flight.ifr', '.sx-report .sx-flight.flight_condition_IFR'),
    // The fixture carries no WINDS report, so there is no reskin WINDS badge to pair.
    fixed('weather.badge-taf', '.report .flight.taf', '.sx-report .sx-flight.report_TAF'),
    fixed('weather.badge-pirep', '.report .flight.pirep', '.sx-report .sx-flight.report_PIREP'),
    variable('weather.recent', 'panel:Recent reports', 'panel:Recent Reports*', below('weather.watch')),
    fixed('weather.recent.head', 'panel:Recent reports >> .section-head', 'panel:Recent Reports* >> .sx-section-head'),
    fixed('weather.recent.report', 'panel:Recent reports >> .report', 'panel:Recent Reports* >> .sx-report', below('weather.recent.head')),
  ],

  traffic: [
    titleRow('traffic'),
    variable('traffic.adsb', 'panel:ADS-B and TIS-B Traffic', 'panel:ADS-B and TIS-B Traffic', { firstVariable: true, ...below('traffic.title-row') }),
    fixed('traffic.adsb.head', 'panel:ADS-B and TIS-B Traffic >> .section-head', 'panel:ADS-B and TIS-B Traffic >> .sx-section-head'),
    fixed('traffic.adsb.badge', 'panel:ADS-B and TIS-B Traffic >> .section-head .badge', 'panel:ADS-B and TIS-B Traffic >> .sx-section-head .sx-badge'),
    fixed('traffic.adsb.thead', 'panel:ADS-B and TIS-B Traffic >> thead tr', 'panel:ADS-B and TIS-B Traffic >> thead tr', below('traffic.adsb.head')),
    fixed('traffic.adsb.th', 'panel:ADS-B and TIS-B Traffic >> thead th', 'panel:ADS-B and TIS-B Traffic >> thead th'),
    fixed('traffic.adsb.row', 'panel:ADS-B and TIS-B Traffic >> tbody tr', 'panel:ADS-B and TIS-B Traffic >> tbody tr', below('traffic.adsb.thead')),
    fixed('traffic.adsb.td', 'panel:ADS-B and TIS-B Traffic >> tbody td', 'panel:ADS-B and TIS-B Traffic >> tbody td'),
    variable('traffic.modes', 'panel:Basic Mode S and no-position messages', 'panel:Basic Mode S and No-Position Messages', below('traffic.adsb')),
    fixed('traffic.modes.head', 'panel:Basic Mode S and no-position messages >> .section-head', 'panel:Basic Mode S and No-Position Messages >> .sx-section-head'),
    fixed('traffic.modes.thead', 'panel:Basic Mode S and no-position messages >> thead tr', 'panel:Basic Mode S and No-Position Messages >> thead tr', below('traffic.modes.head')),
    fixed('traffic.modes.th', 'panel:Basic Mode S and no-position messages >> thead th', 'panel:Basic Mode S and No-Position Messages >> thead th'),
    fixed('traffic.modes.row', 'panel:Basic Mode S and no-position messages >> tbody tr', 'panel:Basic Mode S and No-Position Messages >> tbody tr', below('traffic.modes.thead')),
    fixed('traffic.modes.td', 'panel:Basic Mode S and no-position messages >> tbody td', 'panel:Basic Mode S and No-Position Messages >> tbody td'),
    fixed('traffic.toggles', '.toggle-strip', 'panel:Display options', below('traffic.modes')),
    fixed('traffic.toggle', '.toggle-strip label', 'panel:Display options >> .sx-switch-row'),
  ],

  towers: [
    titleRow('towers'),
    variable('towers.list', 'panel:UAT towers heard in last minute', 'panel:UAT towers heard in last minute', { firstVariable: true, ...below('towers.title-row') }),
    fixed('towers.head', 'panel:UAT towers heard in last minute >> .section-head', 'panel:UAT towers heard in last minute >> .sx-section-head'),
    fixed('towers.badge', 'panel:UAT towers heard in last minute >> .section-head .badge', 'panel:UAT towers heard in last minute >> .sx-section-head .sx-badge'),
    fixed('towers.thead', 'panel:UAT towers heard in last minute >> thead tr', 'panel:UAT towers heard in last minute >> thead tr', below('towers.head')),
    fixed('towers.th', 'panel:UAT towers heard in last minute >> thead th', 'panel:UAT towers heard in last minute >> thead th'),
    fixed('towers.row', 'panel:UAT towers heard in last minute >> tbody tr', 'panel:UAT towers heard in last minute >> tbody tr', below('towers.thead')),
    fixed('towers.td', 'panel:UAT towers heard in last minute >> tbody td', 'panel:UAT towers heard in last minute >> tbody td'),
  ],

  logs: [
    titleRow('logs'),
    variable('logs.panel', 'panel:Logs', 'panel:Logs', { firstVariable: true, ...below('logs.title-row') }),
    fixed('logs.head', 'panel:Logs >> .section-head', 'panel:Logs >> .sx-section-head'),
    fixed('logs.file-link', 'panel:Logs >> .file-link', 'panel:Logs >> .sx-file-link', below('logs.head')),
    fixed('logs.debug', 'panel:Logs >> .debug', 'panel:Logs >> .sx-debug'),
    fixed('logs.user-agent', 'panel:Logs >> .debug > span:nth-child(1)', 'panel:Logs >> .sx-debug > span:nth-child(1)'),
    fixed('logs.viewport', 'panel:Logs >> .debug > span:nth-child(2)', 'panel:Logs >> .sx-debug > span:nth-child(2)', beside('logs.user-agent')),
  ],

  settings: [
    titleRow('settings'),

    variable('settings.ahrs', 'panel:AHRS', 'panel:AHRS', unplaced({ firstVariable: true })),
    fixed('settings.ahrs.head', 'panel:AHRS >> .section-head', 'panel:AHRS >> .sx-section-head', unplaced()),
    fixed('settings.ahrs.button', 'panel:AHRS >> button.wide-button', 'panel:AHRS >> button.sx-wide-button', unplaced(below('settings.ahrs.head'))),
    fixed('settings.ahrs.field', 'panel:AHRS >> .field', 'panel:AHRS >> form.sx-field', unplaced(below('settings.ahrs.button'))),

    variable('settings.theme', 'panel:Theme', 'panel:Theme', unplaced()),
    fixed('settings.theme.head', 'panel:Theme >> .section-head', 'panel:Theme >> .sx-section-head', unplaced()),
    fixed('settings.theme.switch', 'panel:Theme >> .switch-row', 'panel:Theme >> .sx-switch-row', unplaced(below('settings.theme.head'))),

    variable('settings.config', 'panel:Configuration', 'panel:Configuration', unplaced()),
    fixed('settings.config.head', 'panel:Configuration >> .section-head', 'panel:Configuration >> .sx-section-head', unplaced()),
    fixed('settings.config.field', 'panel:Configuration >> .field', 'panel:Configuration >> .sx-field', unplaced(below('settings.config.head'))),
    fixed('settings.config.switch', 'panel:Configuration >> .switch-row', 'panel:Configuration >> .sx-switch-row', unplaced()),

    variable('settings.wifi', 'panel:WiFi Settings', 'panel:WiFi Settings', unplaced()),
    fixed('settings.wifi.head', 'panel:WiFi Settings >> .section-head', 'panel:WiFi Settings >> .sx-section-head', unplaced()),
    fixed('settings.wifi.field', 'panel:WiFi Settings >> .field', 'panel:WiFi Settings >> .sx-field', unplaced(below('settings.wifi.head'))),
    fixed('settings.wifi.switch', 'panel:WiFi Settings >> .switch-row', 'panel:WiFi Settings >> .sx-switch-row', unplaced()),
    fixed('settings.wifi.submit', 'panel:WiFi Settings >> button.primary', 'panel:WiFi Settings >> .sx-primary', unplaced()),

    variable('settings.tracker', 'panel:Tracker Configuration', 'panel:Tracker Configuration', unplaced()),
    fixed('settings.tracker.head', 'panel:Tracker Configuration >> .section-head', 'panel:Tracker Configuration >> .sx-section-head', unplaced()),
    fixed('settings.tracker.field', 'panel:Tracker Configuration >> .field', 'panel:Tracker Configuration >> .sx-field', unplaced(below('settings.tracker.head'))),
    fixed('settings.tracker.submit', 'panel:Tracker Configuration >> button.primary', 'panel:Tracker Configuration >> .sx-primary', unplaced()),

    variable('settings.commands', 'panel:Commands', 'panel:Commands', unplaced()),
    fixed('settings.commands.head', 'panel:Commands >> .section-head', 'panel:Commands >> .sx-section-head', unplaced()),
    fixed('settings.commands.update', 'panel:Commands >> .wide-button', 'panel:Commands >> .sx-single > div', unplaced(below('settings.commands.head'))),
    fixed('settings.commands.reboot', 'panel:Commands >> button.danger', 'panel:Commands >> button.sx-wide-button', unplaced(below('settings.commands.update'))),

    variable('settings.hardware', 'panel:Hardware', 'panel:Hardware', unplaced()),
    fixed('settings.hardware.head', 'panel:Hardware >> .section-head', 'panel:Hardware >> .sx-section-head', unplaced()),
    fixed('settings.hardware.switch', 'panel:Hardware >> .switch-row', 'panel:Hardware >> .sx-switch-row', unplaced(below('settings.hardware.head'))),
    fixed('settings.hardware.field', 'panel:Hardware >> .field', 'panel:Hardware >> .sx-field', unplaced()),

    variable('settings.diagnostics', null, 'panel:Diagnostics', unplaced()),
    variable('settings.raw-config', null, 'panel:Raw Configuration', unplaced()),
  ],

  // The scope and its controls are SVG drawn by radar.js inside #radar_display.
  radar: [
    fixed('radar.badges', '.instrument-top', '.sx-instrument-top'),
    fixed('radar.scope', '.radar-scope', '#radar_display'),
  ],

  developer: [
    titleRow('developer'),
    variable('developer.app', 'panel:Application', 'panel:Restart Stratux application', { firstVariable: true, ...below('developer.title-row') }),
    fixed('developer.app.head', 'panel:Application >> .section-head', 'panel:Restart Stratux application >> .sx-section-head'),
    fixed('developer.app.button', 'panel:Application >> .wide-button', 'panel:Restart Stratux application >> .sx-wide-button', below('developer.app.head')),
    variable('developer.logfile', 'panel:Logfile', 'panel:Logfile*', beside('developer.app')),
    fixed('developer.logfile.head', 'panel:Logfile >> .section-head', 'panel:Logfile* >> .sx-section-head'),
    fixed('developer.logfile.download', 'panel:Logfile >> .file-actions button', 'panel:Logfile* >> .sx-wide-button', below('developer.logfile.head')),
    fixed('developer.logfile.delete', 'panel:Logfile >> .file-actions .danger', 'panel:Logfile* >> .sx-danger', beside('developer.logfile.download')),
    variable('developer.ahrs', 'panel:AHRS Log Files', 'panel:AHRS Log Files*', below('developer.app')),
    fixed('developer.ahrs.head', 'panel:AHRS Log Files >> .section-head', 'panel:AHRS Log Files* >> .sx-section-head'),
    fixed('developer.ahrs.download', 'panel:AHRS Log Files >> .file-actions button', 'panel:AHRS Log Files* >> .sx-wide-button', below('developer.ahrs.head')),
    variable('developer.database', 'panel:Database', 'panel:Database', beside('developer.ahrs')),
    fixed('developer.database.head', 'panel:Database >> .section-head', 'panel:Database >> .sx-section-head'),
    fixed('developer.database.download', 'panel:Database >> .file-actions button', 'panel:Database >> .sx-wide-button', below('developer.database.head')),
  ],

  'shell:menu': [
    fixed('shell.menu.drawer', 'aside.drawer.left', '.sidebar-left'),
    fixed('shell.menu.head', 'aside.drawer.left .drawer-head', '.sidebar-left .sx-drawer-head'),
    fixed('shell.menu.item', 'aside.drawer.left .nav-item', '.sidebar-left .sx-nav-item', below('shell.menu.head')),
    fixed('shell.menu.footer', 'aside.drawer.left .drawer-footer', '.sidebar-left .sx-drawer-footer'),
  ],
  'shell:help': [
    fixed('shell.help.drawer', 'aside.drawer.right', '.sidebar-right'),
    fixed('shell.help.head', 'aside.drawer.right .drawer-head', '.sidebar-right .sx-drawer-head'),
    fixed('shell.help.title', 'aside.drawer.right .help-copy h2', '.sidebar-right .sx-help-copy h2'),
  ],
  'shell:shutdown': [
    fixed('shell.shutdown.dialog', '.confirm-dialog', '.sx-confirm-dialog'),
    fixed('shell.shutdown.icon', '.confirm-dialog .dialog-icon', '.sx-confirm-dialog .sx-dialog-icon'),
    fixed('shell.shutdown.title', '.confirm-dialog h2', '.sx-confirm-dialog h2', below('shell.shutdown.icon')),
    fixed('shell.shutdown.actions', '.confirm-dialog .dialog-actions', '.sx-confirm-dialog .sx-dialog-actions'),
    fixed('shell.shutdown.cancel', '.dialog-actions button:first-child', '.sx-dialog-actions button'),
  ],
};
