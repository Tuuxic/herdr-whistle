// Whistle's core (ADR 0011): step(model, input, world) -> { model, effects, handled }.
// Pure and synchronous: it imports nothing from `herdr`, never awaits, and never changes the
// model it is given. main.js (the shell) reads Herdr into `world`, calls step, and carries out
// the effects.
//
// model: { mode: "type" | "whistle", field: block id | null, recent: block ids (the field used
//          last first), pane: the terminal's selected pane | null, holdUntil: ms,
//          aside: whether this copy stands aside for another (inert.js), hid: the bars it
//          hid for that, to show again }
//
// input: { command: "whistle" | "type" }  a whistle.<command> from Herdr (keys.json)
//        { key: "ctrl-l" }                 a key pressed on the bar in WHISTLE (keynames.js)
//        { tick: true }                    the shell's timer; world.now and world.barFocused
//                                          say what changed (a click away, a late focus)
//        { wrote: path, ok, error }        a write effect's outcome
//
// world: { now: ms, layout: Herdr's layout tree, focused: { pane, terminal } | null,
//          panes: [{ pane, title, program }], barFocused: whether the bar holds the keyboard,
//          keys: Herdr's key bindings [{ section, keys, action }], herdr: Herdr's version,
//          folder: this copy's folder, copies: shared("whistle.copies") (inert.js) }
//
// effects, a closed set of data:
//   { run: "<command>", args }          run a Herdr command
//   { focusBar: true }                  the bar takes the keyboard
//   { setShared: key, value }           set shared state
//   { write: path, text, expected }     write a file; the outcome comes back as { wrote }
//   { openOverlay: name, spec }         open an overlay, known by name
//   { closeOverlay: name }              close it
//   { typeKey: key, terminal }          type a key into a terminal
//
// handled: for a key, whether whistle used it (else it goes on to whatever else wants it).

import { fieldAt, terminal, neighbour, TERMINAL } from "./fields.js";
import { inert, announce, ownBars, COPIES } from "./inert.js";
import { VERSION } from "./version.js";

export const start = () => ({ mode: "type", field: null, recent: [], pane: null, holdUntil: 0, aside: false, hid: [] });

// The model with block selected as the field (or the field inside it), if one shows.
function select(model, world, block) {
  const f = fieldAt(world.layout, block, model.recent);
  if (!f) return null;
  return { ...model, field: f.block, recent: [f.block, ...model.recent.filter((b) => b !== f.block)].slice(0, 20) };
}

// WHISTLE on the terminal (the one used last), its pane the one the keyboard just left.
function whistle(model, world) {
  const t = terminal(world.layout, model.recent);
  const m = (t && select(model, world, t.block)) ?? model;
  return { model: { ...m, mode: "whistle", pane: world.focused?.pane ?? m.pane }, effects: [{ focusBar: true }] };
}

const onTerminal = (model, world) => fieldAt(world.layout, model.field, model.recent)?.kind === TERMINAL;

// Back to TYPE, the keyboard to the terminal's selected pane (else the focused one).
function type(model, world) {
  const pane = (onTerminal(model, world) && model.pane) || world.focused?.pane;
  return { model: { ...model, mode: "type", holdUntil: 0 }, effects: pane ? [{ run: "pane.focus", args: { pane } }] : [] };
}

// Whistle's own keys in WHISTLE, key -> action. Fixed for now; config makes them configurable.
const OWN = {
  "ctrl-h": { kind: "field", dir: "left" }, "ctrl-j": { kind: "field", dir: "down" },
  "ctrl-k": { kind: "field", dir: "up" }, "ctrl-l": { kind: "field", dir: "right" },
  h: { kind: "move", dir: "left" }, j: { kind: "move", dir: "down" },
  k: { kind: "move", dir: "up" }, l: { kind: "move", dir: "right" },
  left: { kind: "move", dir: "left" }, down: { kind: "move", dir: "down" },
  up: { kind: "move", dir: "up" }, right: { kind: "move", dir: "right" },
  i: { kind: "type" },
  enter: { kind: "type" },
};

// How long whistle holds the keyboard after moving it away (ms): Herdr can hand it back to a
// pane late, so until then the bar takes it back instead of leaving WHISTLE.
export const HOLD_MS = 600;

// h/j/k/l over split panes: from the selected pane, let pane.go find the neighbour, then hold
// the keyboard (the tick follows the pane it lands on).
function paneMove(model, world, direction) {
  const from = model.pane ?? world.focused?.pane;
  const effects = [
    ...(from ? [{ run: "pane.focus", args: { pane: from } }] : []),
    { run: "pane.go", args: { direction } },
    { focusBar: true },
  ];
  return { model: { ...model, pane: from ?? null, holdUntil: world.now + HOLD_MS }, effects, handled: true };
}

// A key pressed in WHISTLE.
function key(model, world, name) {
  const own = OWN[name];
  const pass = { model, effects: [], handled: false };
  if (!own) return pass;
  if (own.kind === "type") return { ...type(model, world), handled: true };
  if (own.kind === "field") {
    const next = neighbour(world.layout, model.field, own.dir, model.recent);
    return { model: (next && select(model, world, next.block)) || model, effects: [], handled: true };
  }
  // A move acts inside the field; with none selected, the terminal stands in.
  const field = fieldAt(world.layout, model.field, model.recent);
  const t = field ? null : terminal(world.layout, model.recent);
  if (field?.kind === TERMINAL) return paneMove(model, world, own.dir);
  if (t) return paneMove(select(model, world, t.block), world, own.dir);
  return pass;
}

// The shell's timer: the bar losing or taking the keyboard.
function tick(model, world) {
  const none = { model, effects: [] };
  if (model.mode === "whistle" && world.now < model.holdUntil) {
    const m = onTerminal(model, world) && world.focused?.pane ? { ...model, pane: world.focused.pane } : model;
    return { model: m, effects: world.barFocused ? [] : [{ focusBar: true }] };
  }
  if (model.mode === "whistle" && !world.barFocused) return { model: { ...model, mode: "type", holdUntil: 0 }, effects: [] };
  if (model.mode === "type" && world.barFocused) return { ...whistle(model, world), effects: [] };
  return none;
}

// The key Herdr binds to action as it resolves from a terminal: terminal, a layout, global.
function boundKey(world, action) {
  const rank = (s) => (s === "terminal" ? 0 : s.startsWith("layout") ? 1 : s === "global" ? 2 : 9);
  const found = (world.keys ?? []).filter((k) => k.action === action && rank(k.section) < 9)
    .sort((a, b) => rank(a.section) - rank(b.section));
  return found[0]?.keys ?? null;
}

// Inert: no WHISTLE, and the switch key types through into the focused terminal.
function inertStep(model, input, world) {
  if (model.mode === "whistle") return { ...type(model, world), handled: false };
  const m = { ...model, mode: "type", holdUntil: 0 };
  if (input.command === "whistle") {
    const k = boundKey(world, "whistle.whistle"), t = world.focused?.terminal;
    return { model: m, effects: k && t ? [{ typeKey: k, terminal: t }] : [] };
  }
  return { model: m, effects: [], handled: false };
}

// On each tick, whatever the mode: this copy announces itself in whistle.copies, and hides its
// bars while it stands aside for another copy (showing again those it hid once it doesn't).
function chores(out, world, why) {
  const effects = [...out.effects];
  const copies = announce(world, VERSION);
  if (copies) effects.push({ setShared: COPIES, value: copies });
  let m = out.model;
  const aside = why?.reason === "copy";
  if (aside && !m.aside) {
    const hid = ownBars(world);
    for (const id of hid) effects.push({ run: "layout.hide", args: { id } });
    m = { ...m, aside, hid };
  } else if (!aside && m.aside) {
    for (const id of m.hid) effects.push({ run: "layout.show", args: { id } });
    m = { ...m, aside, hid: [] };
  }
  return { ...out, model: m, effects };
}

export function step(model, input, world) {
  const why = inert(world);
  const out = why ? inertStep(model, input, world) : active(model, input, world);
  return input.tick ? chores(out, world, why) : out;
}

// A step while whistle runs.
function active(model, input, world) {
  const none = { model, effects: [] };
  if (input.command === "whistle") return model.mode === "whistle" ? type(model, world) : whistle(model, world);
  if (input.command === "type") return model.mode === "whistle" ? type(model, world) : none;
  if ("key" in input) return model.mode === "whistle" ? key(model, world, input.key) : { ...none, handled: false };
  if (input.tick) return tick(model, world);
  return none;
}

// The bar's view model: { badge: "TYPE" | "WHISTLE" | null (inert), label: where the keyboard
// is, problem: why whistle is inert, if it is }.
export function bar(model, world) {
  const why = inert(world);
  if (why) return { badge: null, label: "", problem: why.problem };
  if (model.mode !== "whistle") return { badge: "TYPE", label: world.focused?.pane ? "Terminal" : "" };
  const f = fieldAt(world.layout, model.field, model.recent);
  if (f?.kind !== TERMINAL) return { badge: "WHISTLE", label: f?.label ?? "" };
  const p = (world.panes ?? []).find((x) => x.pane === model.pane);
  const name = (p?.title || p?.program?.name || "").slice(0, 40);
  return { badge: "WHISTLE", label: name ? `Terminal · ${name}` : "Terminal" };
}
