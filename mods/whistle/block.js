// The layout's whistle block (docs/contracts/layout-block.md), a public contract: the props a
// layout gives whistle's blocks, read and checked. Pure: it reads only the layout it is given.
//
// Every whistle block is the anchor (ADR 0018, ADR 0020): the block whistle runs in, which holds
// the layout's config layer. The first in layout order runs; the others are extra, listed and left
// out. Blocks with the same props can't be told apart (a copy knows its block only by its props),
// so whistle is inert (inert.js). With no whistle block in the layout, nothing runs.
//
// Stable props: `mappings` and `keys` (the layout's config layer, checked by config.js), `mods`
// (switching mods' mappings off, checked by config.js), `enabled` and `nav`. A bad or unknown
// prop is skipped and listed as a config problem; the rest still count.
//
// whistle.json's `enabled` goes over the layout's (settings()).

import { fieldKey, eachNode } from "./fields.js";
import { isObject } from "./config.js";
import { FOLDER } from "./version.js";

export const DIRS = ["left", "down", "up", "right"];
const KNOWN = ["mappings", "keys", "mods", "enabled", "nav"];

// Every block id in the layout.
function ids(layout) {
  const out = new Set();
  eachNode(layout, (n) => { if (n.id) out.add(n.id); });
  return out;
}

// This copy's blocks in the layout: [{ id, props }], in layout order.
export function blocks(layout, folder = FOLDER) {
  const out = [];
  eachNode(layout, (n) => {
    const c = n.content;
    if (c?.mod === folder) out.push({ id: n.id, props: isObject(c.props) ? c.props : {} });
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

// The whistle blocks' roles, which copies tell apart only by their props: { runs: the block
// that runs whistle, the first in layout order | undefined (none, or twins), extra: the blocks
// left out, twins: the ids of the first group of blocks that share their props | null }. With
// twins nothing runs: no copy can tell whether it is the first.
export function roles(layout, folder = FOLDER) {
  const all = blocks(layout, folder);
  const byKey = new Map();
  for (const b of all) {
    const k = fieldKey(folder, b.props);
    byKey.set(k, [...(byKey.get(k) ?? []), b]);
  }
  const group = [...byKey.values()].find((g) => g.length > 1);
  if (group) return { runs: undefined, extra: [], twins: group.map((b) => b.id) };
  return { runs: all[0], extra: all.slice(1), twins: null };
}

// Whether this copy is left out, acting on nothing: the layout (when known) has no whistle
// block, or this copy's props aren't those of the block that runs (an extra block's copy).
// Unknown props or layout: it isn't.
export function leftOut(layout, folder, props) {
  if (!layout) return false;
  const all = blocks(layout, folder);
  if (!all.length) return true;
  const { runs } = roles(layout, folder);
  if (!runs || props === undefined) return false;
  return fieldKey(folder, runs.props) !== fieldKey(folder, isObject(props) ? props : {});
}

// The props of the block that runs, checked: { props, problems: [detail] }. Extra blocks are
// listed; their props count for nothing.
export function blockProps(layout, folder = FOLDER) {
  const problems = [];
  const problem = (d) => { if (!problems.includes(d)) problems.push(d); };
  const known = ids(layout);
  const props = {};
  const { runs, extra } = roles(layout, folder);
  for (const [k, v] of Object.entries(runs?.props ?? {})) {
    if (!KNOWN.includes(k)) { problem(`${k}: not a whistle block prop`); continue; }
    if (v === undefined) continue;
    if (k === "enabled" && typeof v !== "boolean") problem("enabled should be true or false");
    else if (k === "nav") props.nav = readNav(v, known, problem);
    else props[k] = v;
  }
  for (const b of extra) problem(`${b.id}: a second whistle block, left out; ${runs.id} runs whistle`);
  return { props, problems };
}

const names = (all) => (all.length > 1 ? `${all.slice(0, -1).join(", ")} and ${all.at(-1)}` : all[0] ?? "");

// Why whistle can't run in this layout, as inert.js gives it ({ problem, fix }), or null:
// whistle blocks with the same props.
export function twinsProblem(layout, folder = FOLDER) {
  const { twins } = layout ? roles(layout, folder) : { twins: null };
  if (!twins) return null;
  return { problem: `Whistle blocks ${names(twins)} have the same props, so whistle can't tell which one runs`, fix: "Keep one." };
}

// whistle.json's `enabled` over the layout's props: { settings, problems }.
// settings: { enabled, nav }.
export function settings(props, user) {
  const problems = [];
  let enabled = props.enabled ?? true;
  if (user?.enabled !== undefined) {
    if (typeof user.enabled === "boolean") enabled = user.enabled;
    else problems.push("enabled should be true or false");
  }
  return { settings: { enabled, nav: props.nav ?? {} }, problems };
}
