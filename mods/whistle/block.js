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
const KNOWN = ["mappings", "keys", "mods", "enabled", "hints", "nav", "bar", ...NUMBERS, "part", "anchor"];


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
// block's own, so it is only checked here. In a layout with an anchor (ADR 0018), the
// behaviour props (BEHAVIOUR) come from the first anchor alone and the place props (NUMBERS)
// from the bars alone; either on the other kind of block is skipped and listed (a further
// anchor's behaviour props are skipped unlisted: that anchor is the problem).
export function blockProps(layout, folder = FOLDER) {
  const problems = [];
  const problem = (d) => { if (!problems.includes(d)) problems.push(d); };
  const known = ids(layout);
  const props = {};
  const blocks = bars(layout, folder);
  const anchor = blocks.find((b) => b.props.anchor === true); // one of blocks: compared by identity below
  for (const b of blocks) {
    for (const [k, v] of Object.entries(b.props)) {
      if (!KNOWN.includes(k)) { problem(`${k}: not a whistle block prop`); continue; }
      if (k === "part" || k === "anchor" || v === undefined) continue;
      if (k === "bar") { if (typeof v !== "string") problem("bar should be the spot's name, a string"); continue; }
      if (anchor && BEHAVIOUR.includes(k) && b !== anchor) {
        if (b.props.anchor !== true) problem(`${k}: a bar's is skipped in a layout with an anchor; put it on the anchor`);
        continue;
      }
      if (b.props.anchor === true && NUMBERS.includes(k)) { problem(`${k}: the anchor's is skipped; put it on the bar it places`); continue; }
      if (k in props) continue;
      if (BOOLEANS.includes(k) && typeof v !== "boolean") problem(`${k} should be true or false`);
      else if (NUMBERS.includes(k) && !Number.isFinite(v)) problem(`${k} should be a number (px)`);
      else if (k === "nav") props.nav = readNav(v, known, problem);
      else props[k] = v;
    }
  }
  const [first, ...extra] = anchors(layout, folder);
  for (const b of extra) problem(`anchor: ${b.id} is a second anchor and stands aside; ${first.id} runs whistle`);
  return { props, problems };
}

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

// This copy's anchors (blocks with `anchor: true`), in layout order: the first drives (ADR 0018).
const anchors = (layout, folder) => bars(layout, folder).filter((b) => b.props.anchor === true);

// Whether this copy is a view (ADR 0018): the layout has an anchor (a block of this copy with
// `anchor: true`) and this copy's props aren't the first anchor's, so it is a bar's copy, which
// only draws, or a further anchor, which stands aside the same way. Unknown props: it isn't.
export function viewing(layout, folder, props) {
  if (props === undefined) return false;
  const [first] = anchors(layout, folder);
  return first !== undefined && fieldKey(folder, first.props) !== fieldKey(folder, isObject(props) ? props : {});
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
