// whistle-ui's core: ui(published, world) -> { model, effects }, and command(c, published,
// world) -> effects. Pure and synchronous like whistle's (ADR 0011): it imports nothing from
// Herdr, and main.js (the shell) reads Herdr into its arguments and carries out the effects.
// It reads only whistle's public contract (docs/contracts/), never whistle's own modules.
//
// published: whistle's public keys as Herdr holds them: { whistle: shared("whistle"),
//            hints: shared("whistle.hints"), events: shared("whistle.events"),
//            config: shared("whistle.config") } (each undefined or null while unset).
//
// world: { folder: this mod's folder ("whistle-ui"), props: this copy's block props,
//          size: its drawn size { width, height } | null (not measured), viewport: the window's
//          drawable size | null, layout: Herdr's layout tree, focused: { pane, terminal } | null,
//          panes: [{ pane, title, program }], shared: { keynav: shared("keynav"),
//          "keynav.field:<active>": that field's entry }, now: ms,
//          and what this copy kept from its last call (the model's fields): last: the seq of
//          the last event it handled (null: none read yet, a new copy), flash: the bar's flash
//          { text, until, sequence } | null, box: the hints box it opened, as JSON (null: none;
//          undefined: unknown, a new copy) }
//
// model: { bar: what the bar draws { badge, label, marker, problem? }, null for the corner
//          block; last, flash, box: to hand back in the next world }
//
// effects: { openOverlay: name, spec } (closing the one open under that name first),
//          { closeOverlay: name }, { run: "<command>" }.

import { readState, hintsOf, eventsSince, configOf } from "./read.js";
import { hintsBox } from "./box.js";

// How long a flash shows (ms), unless the key sequence changes first.
export const FLASH_MS = 2000;
// The hints box's overlay name, and the settings dialog's.
const HINTS = "hints", SETTINGS = "settings";

const isObject = (v) => Boolean(v) && typeof v === "object" && !Array.isArray(v);
const propsOf = (n) => (isObject(n.content?.props) ? n.content.props : {});
// Props as text, object keys sorted at every depth: copies tell their blocks apart by props.
const stable = (v) => {
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  if (isObject(v)) return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(",")}}`;
  return JSON.stringify(v ?? null);
};

// The corner block (`corner: true`, sized 0 px): it draws nothing and shows the hints with no
// bar shown.
export const isCorner = (props) => isObject(props) && props.corner === true;

// This mod's blocks in the layout, in layout order: [{ id, props, shown }].
function blocks(layout, folder) {
  const out = [];
  const walk = (n, hidden) => {
    if (!n) return;
    const h = hidden || Boolean(n.hidden);
    if (n.content?.mod === folder) out.push({ id: n.id, props: propsOf(n), shown: !h });
    for (const c of n.children ?? []) walk(c, h);
  };
  walk(layout, false);
  return out;
}

// The block that shows the hints and opens the settings: the first bar that shows, else the
// corner block if it shows, else none.
export function lead(layout, folder) {
  const all = blocks(layout, folder).filter((b) => b.shown);
  return all.find((b) => !isCorner(b.props)) ?? all.find((b) => isCorner(b.props)) ?? null;
}

// Whether this copy is the lead's (copies know their block only by its props).
const leads = (world) => {
  const l = lead(world.layout, world.folder);
  return Boolean(l) && stable(l.props) === stable(world.props ?? {});
};

// Where the keyboard is, as the bar says it: in TYPE, the terminal if a pane is focused; in
// WHISTLE, the terminal and its selected pane's title, or the selected keynav field's label
// (docs/contracts/keynav.md), else nothing.
function where(state, world) {
  if (state.mode !== "whistle") return world.focused?.pane ? "Terminal" : "";
  if (state.onTerminal) {
    const p = (world.panes ?? []).find((x) => x.pane === state.pane);
    const name = (p?.title || p?.program?.name || "").slice(0, 40);
    return name ? `Terminal · ${name}` : "Terminal";
  }
  const active = world.shared?.keynav?.active;
  if (typeof active !== "string") return "";
  const label = world.shared?.[`keynav.field:${active}`]?.label;
  return typeof label === "string" ? label : active.split(" ")[0];
}

// The bar: inert, why; whistle not running, that; switched off, "Whistle off"; else the mode
// badge and where the keyboard is. A flash shows over the label; the marker counts config
// problems.
function bar(state, config, flash, world) {
  if (!state) return { badge: null, label: "Whistle isn't running", marker: null };
  if (state.inert) return { badge: null, label: "", marker: null, problem: state.inert.problem };
  const n = config?.problems?.length ?? 0;
  const marker = n ? `⚠ ${n}` : null;
  if (state.enabled === false) return { badge: null, label: flash?.text ?? "Whistle off", marker };
  return { badge: state.mode === "whistle" ? "WHISTLE" : "TYPE", label: flash?.text ?? where(state, world), marker };
}

const sequenceOf = (state) => JSON.stringify(state?.sequence?.keys ?? null);

// The flash after this call: the new events' texts, else the one kept while it lasts and the key
// sequence hasn't changed. A new copy (last null) handles the events already there unshown.
function flashed(published, state, world) {
  const fresh = world.last == null;
  const { events, last } = eventsSince(published.events, fresh ? Infinity : world.last);
  if (fresh) return { last: last === Infinity ? 0 : last, flash: null };
  const sequence = sequenceOf(state);
  if (events.length) return { last, flash: { text: events.map((e) => e.text).join(" · "), until: world.now + FLASH_MS, sequence } };
  const f = world.flash;
  return { last, flash: f && world.now < f.until && f.sequence === sequence ? f : null };
}

// The hints box this copy should have open: the lead's, while whistle runs in WHISTLE with hints
// to show and the block's `hints` isn't false. Docked on the bar, or at the corner.
function box(published, state, world) {
  if (!state || state.inert || state.mode !== "whistle" || !leads(world) || world.props?.hints === false) return null;
  const h = hintsOf(published.hints);
  if (!h) return null;
  const b = hintsBox(h.items, world.viewport, isCorner(world.props) ? null : { place: world.props ?? {}, size: world.size ?? null });
  return { mod: world.folder, kind: "window", frame: "none", width: b.width, height: b.height, ...(b.at ? { at: b.at } : {}),
    props: { part: "hints", width: b.width } };
}

export function ui(published, world) {
  const state = readState(published.whistle);
  const { last, flash } = flashed(published, state, world);
  const spec = box(published, state, world);
  const sent = spec ? JSON.stringify(spec) : null;
  const effects = [];
  // Only the lead closes a box: another copy's close would close the lead's (the shell finds
  // the box open under the name, whichever copy opened it).
  if (spec && sent !== world.box) effects.push({ openOverlay: HINTS, spec });
  else if (!spec && world.box !== null && leads(world)) effects.push({ closeOverlay: HINTS });
  return {
    model: { bar: isCorner(world.props) ? null : bar(state, configOf(published.config), flash, world), last, flash, box: sent },
    effects,
  };
}

// whistle-ui's commands, as Herdr hands them over ("settings"): the effects to carry out. Every
// copy gets each command; only the lead acts. `settings` goes back to TYPE (whistle's
// mode:type, while whistle runs: a dialog takes the keyboard), then opens the settings dialog.
export function command(c, published, world) {
  if (c !== "settings" || !leads(world)) return [];
  const dialog = { openOverlay: SETTINGS, spec: { mod: world.folder, kind: "dialog", width: 640, height: 0.8, props: { part: SETTINGS } } };
  return readState(published.whistle) ? [{ run: "whistle.mode:type" }, dialog] : [dialog];
}

// The settings commands the dialog runs (docs/contracts/commands.md, Settings commands): a mod's
// mappings on or off, and keeping one mod's mapping at a conflicting key sequence (keys: Herdr
// key names, as whistle.config's conflicts give them in `seq`).
export const mappingsCommand = (mod, on) => `whistle.mappings-${on ? "on" : "off"}:${mod}`;
export const keepCommand = (mod, keys) => `whistle.keep-mapping:${JSON.stringify({ mod, keys })}`;
