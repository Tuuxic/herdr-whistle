// The layout's whistle block (docs/contracts/layout-block.md), a public contract: the props a
// layout gives whistle's blocks, read and checked. Pure: it reads only the layout it is given.
//
// Stable props: `mappings` and `keys` (the layout's config layer, checked by config.js),
// `mods` (switching mods' mappings off, checked by config.js),
// `enabled`, `hints`, `nav` and `bar`. `hintsInset`, `hintsBorder` and `hintsLift` place the
// hints box and may change in a minor release. `part` is private (whistle's own overlay
// copies). A bad prop is skipped and listed as a config problem; the rest still count.
//
// whistle.json's `enabled`, `hints` and `bar` go over the layout's (settings()).

export const DIRS = ["left", "down", "up", "right"];
const BOOLEANS = ["enabled", "hints"];
const NUMBERS = ["hintsInset", "hintsBorder", "hintsLift"];
const KNOWN = ["mappings", "keys", "mods", "enabled", "hints", "nav", "bar", ...NUMBERS, "part"];

const isObject = (v) => Boolean(v) && typeof v === "object" && !Array.isArray(v);

// Every block id in the layout.
function ids(layout) {
  const out = new Set();
  const walk = (n) => { if (!n) return; if (n.id) out.add(n.id); for (const c of n.children ?? []) walk(c); };
  walk(layout);
  return out;
}

// This copy's blocks in the layout (not whistle's own overlay copies): [{ id, hidden, props }],
// in layout order. hidden: the block or one of its groups is hidden.
export function bars(layout, folder = "whistle") {
  const out = [];
  const walk = (n, hidden) => {
    if (!n) return;
    const h = hidden || Boolean(n.hidden);
    const c = n.content;
    if (c?.mod === folder && !(isObject(c.props) && c.props.part)) out.push({ id: n.id, hidden: h, props: isObject(c.props) ? c.props : {} });
    for (const k of n.children ?? []) walk(k, h);
  };
  walk(layout, false);
  return out;
}

// nav as written: { "<block id>": { "<direction>": "<block id>" } }, checked.
function readNav(nav, known, problem) {
  if (!isObject(nav)) { problem("nav should be an object: { \"<block id>\": { \"<direction>\": \"<block id>\" } }"); return {}; }
  const out = {};
  for (const [from, moves] of Object.entries(nav)) {
    if (!known.has(from)) { problem(`nav › ${from}: no block ${from} in this layout`); continue; }
    if (!isObject(moves)) { problem(`nav › ${from}: should be an object of directions`); continue; }
    for (const [dir, to] of Object.entries(moves)) {
      const at = `nav › ${from} › ${dir}`;
      if (!DIRS.includes(dir)) problem(`${at}: unknown direction (${DIRS.join(", ")})`);
      else if (typeof to !== "string") problem(`${at}: should be a block id`);
      else if (!known.has(to)) problem(`${at}: no block ${to} in this layout`);
      else (out[from] ??= {})[dir] = to;
    }
  }
  return out;
}

// The props of this copy's blocks, checked: { props, problems: [detail] }. Each prop comes from
// the first block that has it (a second bar needn't repeat the mappings); `bar` is each
// block's own, so it is only checked here.
export function blockProps(layout, folder = "whistle") {
  const problems = [];
  const problem = (d) => { if (!problems.includes(d)) problems.push(d); };
  const known = ids(layout);
  const props = {};
  for (const b of bars(layout, folder)) {
    for (const [k, v] of Object.entries(b.props)) {
      if (!KNOWN.includes(k)) { problem(`${k}: not a whistle block prop`); continue; }
      if (k === "part" || v === undefined) continue;
      if (k === "bar") { if (typeof v !== "string") problem("bar should be the spot's name, a string"); continue; }
      if (k in props) continue;
      if (BOOLEANS.includes(k) && typeof v !== "boolean") problem(`${k} should be true or false`);
      else if (NUMBERS.includes(k) && !Number.isFinite(v)) problem(`${k} should be a number (px)`);
      else if (k === "nav") props.nav = readNav(v, known, problem);
      else props[k] = v;
    }
  }
  return { props, problems };
}

// The bar spots: this copy's blocks named by a `bar` prop.
export const spots = (layout, folder) => bars(layout, folder).filter((b) => typeof b.props.bar === "string");

// whistle.json's `enabled`, `hints` and `bar` over the layout's props: { settings, problems }.
// settings: { enabled, hints, nav, bar: the spot whistle.json picks | null, place: the hints'
// placement props }.
export function settings(props, user, layout, folder) {
  const problems = [];
  const own = {};
  for (const k of BOOLEANS) {
    if (user?.[k] === undefined) continue;
    if (typeof user[k] === "boolean") own[k] = user[k];
    else problems.push(`${k} should be true or false`);
  }
  let bar = null;
  if (user?.bar != null) {
    if (typeof user.bar !== "string") problems.push("bar should be the spot's name, a string");
    else if (!spots(layout, folder).some((s) => s.props.bar === user.bar))
      problems.push(`bar: this layout has no spot "${user.bar}"; the bar stays where it is`);
    else bar = user.bar;
  }
  const place = {};
  for (const k of NUMBERS) if (k in props) place[k] = props[k];
  return {
    settings: {
      enabled: own.enabled ?? props.enabled ?? true,
      hints: own.hints ?? props.hints ?? true,
      nav: props.nav ?? {},
      bar,
      place,
    },
    problems,
  };
}
