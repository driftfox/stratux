// Selector syntax: plain CSS, or `panel:<heading>` for the prototype's
// `section.panel` / the reskin's `section.sx-panel` whose h2 reads <heading>
// (a trailing `*` matches by prefix, for headings with live counts),
// optionally followed by ` >> <css>` for a descendant of that panel.
export async function measure(page, selectors) {
  return page.evaluate((selectors) => {
    window.scrollTo(0, 0);
    for (const el of document.querySelectorAll('.scrollable-content, .scrollable, .app-body')) el.scrollTop = 0;

    const half = (n) => Math.round(n * 2) / 2;
    const hundredth = (n) => Math.round(n * 100) / 100;

    function candidates(selector) {
      if (!selector.startsWith('panel:')) return [...document.querySelectorAll(selector)];
      const [head, ...rest] = selector.slice('panel:'.length).split(' >> ');
      const want = head.trim();
      const prefix = want.endsWith('*');
      const title = prefix ? want.slice(0, -1) : want;
      const panels = [...document.querySelectorAll('section.panel, section.sx-panel')]
        .filter((p) => {
          const text = p.querySelector('h2')?.textContent.trim() ?? '';
          return prefix ? text.startsWith(title) : text === title;
        });
      if (!rest.length) return panels;
      return panels.flatMap((p) => [...p.querySelectorAll(rest.join(' '))]);
    }

    function visible(el) {
      const r = el.getBoundingClientRect();
      if (r.width <= 0 || r.height <= 0) return false;
      if (el.checkVisibility && !el.checkVisibility({ visibilityProperty: true })) return false;
      return true;
    }

    const out = {};
    for (const [id, selector] of Object.entries(selectors)) {
      const all = candidates(selector);
      if (!all.length) { out[id] = { found: false, reason: 'no-match' }; continue; }
      const el = all.find(visible);
      if (!el) { out[id] = { found: false, reason: 'hidden' }; continue; }
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      out[id] = {
        found: true,
        x: hundredth(r.left), y: hundredth(r.top), w: hundredth(r.width), h: hundredth(r.height),
        padTop: half(parseFloat(cs.paddingTop)), padRight: half(parseFloat(cs.paddingRight)),
        padBottom: half(parseFloat(cs.paddingBottom)), padLeft: half(parseFloat(cs.paddingLeft)),
      };
    }
    return out;
  }, selectors);
}
