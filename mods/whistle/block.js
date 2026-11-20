// The layout's whistle block (docs/contracts/layout-block.md), a public contract: the props a
// layout gives whistle's blocks, read and checked. Pure: it reads only the layout it is given.
//
// Stable props: `anchor` (the block whistle runs in, ADR 0018, which holds the layout's config
// layer), `mappings` and `keys` (the layout's config layer, checked by config.js),
// `mods` (switching mods' mappings off, checked by config.js),
// `enabled`, `hints`, `nav`, `bar`, and `hintsAlignRight`, `hintsAlignBorder` and `hintsGap`,
// which place the hints box. `part` is private (whistle's own overlay copies). A bad prop is skipped and listed as a config problem; the rest still count.
//
// whistle.json's `enabled`, `hints` and `bar` go over the layout's (settings()).

import { fieldKey, eachNode } from "./fields.js";
import { isObject } from "./config.js";
import { FOLDER } from "./version.js";

export const DIRS = ["left", "down", "up", "right"];
const BOOLEANS = ["enabled", "hints"];
const NUMBERS = ["hintsAlignRight", "hintsAlignBorder", "hintsGap"];
const BEHAVIOUR = ["mappings", "keys", "mods", "enabled", "hints", "nav"];
const KNOWN = [...BEHAVIOUR, "bar", ...NUMBERS, "part", "anchor"];

// Whether a block's props make it the anchor (ADR 0018): `anchor: true`.
export const isAnchor = (props) => isObject(props) && props.anchor === true;

// Every block id in the layout.
function ids(layout) {
  const out = new Set();
  eachNode(layout, (n) => { if (n.id) out.add(n.id); });
  return out;
}

// This copy's blocks in the layout (not whistle's own overlay copies): [{ id, hidden, props }],
// in layout order. hidden: the block or one of its groups is hidden.
export function bars(layout, folder = FOLDER) {
  const out = [];
  eachNode(layout, (n, _parent, hidden) => {
    const c = n.content;
    if (c?.mod === folder && !(isObject(c.props) && c.props.part)) out.push({ id: n.id, hidden, props: isObject(c.props) ? c.props : {} });
  });
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
// block's own, so it is only checked here. In a layout whose anchor runs whistle (ADR 0018,
// anchors() below), the behaviour props (BEHAVIOUR) come from that anchor alone and the place
// props (NUMBERS) from the bars alone; either on the other kind of block is skipped and listed.
// An anchor that is left out counts for nothing, unlisted but for being one.
export function blockProps(layout, folder = FOLDER) {
  const problems = [];
  const problem = (d) => { if (!problems.includes(d)) problems.push(d); };
  const known = ids(layout);
  const props = {};
  const blocks = bars(layout, folder);
  const { runs, extra, twins } = anchors(blocks, folder); // of blocks: compared by identity below
  for (const b of blocks) {
    const leftOut = isAnchor(b.props) && b !== runs;
    for (const [k, v] of Object.entries(b.props)) {
      if (!KNOWN.includes(k)) { problem(`${k}: not a whistle block prop`); continue; }
      if (leftOut || k === "part" || k === "anchor" || v === undefined) continue;
      if (k === "bar") { if (typeof v !== "string") problem("bar should be the spot's name, a string"); continue; }
      if (runs && BEHAVIOUR.includes(k) && b !== runs) { problem(`${k}: a bar's is skipped in a layout with an anchor; put it on the anchor`); continue; }
      if (isAnchor(b.props) && NUMBERS.includes(k)) { problem(`${k}: the anchor's is skipped; put it on the bar it places`); continue; }
      if (k in props) continue;
      if (BOOLEANS.includes(k) && typeof v !== "boolean") problem(`${k} should be true or false`);
      else if (NUMBERS.includes(k) && !Number.isFinite(v)) problem(`${k} should be a number (px)`);
      else if (k === "nav") props.nav = readNav(v, known, problem);
      else props[k] = v;
    }
  }
  for (const b of extra) problem(`anchor: ${b.id} is a second anchor and is left out; ${runs.id} runs whistle`);
  for (const group of twins) problem(`anchor: ${names(group.map((b) => b.id))} have the same props, so they can't tell which comes first and all are left out; keep one`);
  return { props, problems };
}

const names = (all) => (all.length > 1 ? `${all.slice(0, -1).join(", ")} and ${all.at(-1)}` : all[0] ?? "");

// Whether this copy rests (ADR 0011): every block of the layout with this copy's props (props(),
// which tell the copies of a layout's spots apart) is hidden. Unknown props: it doesn't rest.
// A block the copy hid itself, standing aside for another copy (hid: their ids), doesn't count
// as hidden: the copy shows it again once it runs.
export function resting(layout, folder, props, hid = []) {
  if (props === undefined) return false;
  const mine = fieldKey(folder, isObject(props) ? props : {});
  const blocks = bars(layout, folder).filter((b) => fieldKey(folder, b.props) === mine);
  return blocks.length > 0 && blocks.every((b) => b.hidden && !hid.includes(b.id));
}

// The anchors among this copy's blocks (bars(): those with `anchor: true`, ADR 0018), which copies tell apart only by
// their props: { runs: the anchor that runs whistle, the first in layout order whose props no
// other anchor shares | undefined, extra: the other anchors with props of their own, twins:
// groups of anchors that share their props [[block]] }. Every anchor but `runs` is left out.
function anchors(blocks, folder) {
  const all = blocks.filter((b) => isAnchor(b.props));
  const byKey = new Map();
  for (const b of all) {
    const k = fieldKey(folder, b.props);
    byKey.set(k, [...(byKey.get(k) ?? []), b]);
  }
  const twins = [...byKey.values()].filter((g) => g.length > 1);
  const runs = all.find((b) => byKey.get(fieldKey(folder, b.props)).length === 1);
  return { runs, extra: all.filter((b) => b !== runs && byKey.get(fieldKey(folder, b.props)).length === 1), twins };
}

// Whether this copy is a view (ADR 0018), acting on nothing: the layout's anchor runs whistle
// and this copy's props aren't that anchor's, so it is a bar's copy, which only draws, or another
// anchor, left out the same way. With no anchor that runs, a copy with the props of anchors that
// share them is left out too, and the bars stand in. Unknown props: it isn't.
export function viewing(layout, folder, props) {
  if (props === undefined) return false;
  const mine = fieldKey(folder, isObject(props) ? props : {});
  const { runs, twins } = anchors(bars(layout, folder), folder);
  if (runs) return fieldKey(folder, runs.props) !== mine;
  return twins.some((g) => fieldKey(folder, g[0].props) === mine);
}

// The bar spots: this copy's blocks named by a `bar` prop.
export const spots = (layout, folder) => bars(layout, folder).filter((b) => typeof b.props.bar === "string");

// Where the hints box docks (ADR 0018): { spot: the bar block it lines up with | null, shown }.
// The first of this copy's bars (its blocks but the anchor) that shows; with every bar hidden,
// the spot that would show (pick: whistle.json's `bar`, else the first bar in layout order),
// not shown; with no bar at all, no spot.
export function dock(layout, folder, pick) {
  const all = bars(layout, folder).filter((b) => !isAnchor(b.props));
  const shown = all.find((b) => !b.hidden);
  if (shown) return { spot: shown, shown: true };
  return { spot: all.find((b) => pick != null && b.props.bar === pick) ?? all[0] ?? null, shown: false };
}

// A block's place props (NUMBERS) as it writes them, the bad ones left out.
export function placeOf(props) {
  const place = {};
  for (const k of NUMBERS) if (Number.isFinite(props?.[k])) place[k] = props[k];
  return place;
}

// The spot a bar's props name (its `bar`), "" for a bar that names none.
export const spotName = (props) => (typeof props?.bar === "string" ? props.bar : "");

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
