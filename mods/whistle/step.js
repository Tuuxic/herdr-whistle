// Whistle's core (ADR 0011): step(model, input, world) -> { model, effects, handled }.
// Pure and synchronous: it imports nothing from `herdr`, never awaits, and never changes the
// model it is given. main.js (the shell) reads Herdr into `world`, calls step, and carries out
// the effects.
//
// model: { mode: "type" | "whistle", field: block id | null, recent: block ids (the field used
//          last first), pane: the terminal's selected pane | null, holdUntil: ms,
//          claims: keys.json as whistle keeps it (claimsTick below), claimProblem: what went
//          wrong keeping it, for the views | null }
//
// input: { command: "whistle" | "type" }  a whistle.<command> from Herdr (keys.json)
//        { command: "key-<key>" }          a claimed key (claims.js), as if pressed
//        { key: "ctrl-l" }                 a key pressed on the bar in WHISTLE (keynames.js)
//        { tick: true }                    the shell's timer; world.now and world.barFocused
//                                          say what changed (a click away, a late focus)
//        { wrote: path, ok, error }        a write effect's outcome
//
// world: { now: ms, layout: Herdr's layout tree, focused: { pane } | null,
//          panes: [{ pane, title, program }], barFocused: whether the bar holds the keyboard,
//          platform: "macos" | "linux" | "windows", layoutName: the shown layout's name,
//          keys: { text: keys.json (null: no file), error: keys.error (null: none),
//                  at: ms when the shell read them } | undefined (not read yet) }
//
// effects, a closed set of data:
//   { run: "<command>", args }          run a Herdr command
//   { focusBar: true }                  the bar takes the keyboard
//   { setShared: key, value }           set shared state
//   { write: path, text, expected }     write a file (path relative to Herdr's home: "keys.json");
//                                       the outcome comes back as { wrote }
//   { openOverlay: name, spec }         open an overlay, known by name
//   { closeOverlay: name }              close it
//   { typeKey: key, terminal }          type a key into a terminal
//
// handled: for a key, whether whistle used it (else it goes on to whatever else wants it).

import { fieldAt, terminal, neighbour, TERMINAL } from "./fields.js";
import { canonicalKey } from "./keynames.js";
import { claim } from "./claims.js";

// claims: { pending: the write on its way { text, raw, revert } | null, check: a write waiting
// for Herdr's verdict { until, text, raw } | null, failed: a text that failed or Herdr rejected,
// not tried again | null }
const CLAIMS = { pending: null, check: null, failed: null };

export const start = () => ({ mode: "type", field: null, recent: [], pane: null, holdUntil: 0, claims: CLAIMS, claimProblem: null });

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

// How long Herdr gets to load a written keys.json before whistle looks for keys.error (ms).
export const CHECK_MS = 600;

const KEYS_FILE = "keys.json";

// The shell's timer, for claims: keys.json brought in line with whistle's keys, one write at a
// time. A written text waits for Herdr's verdict (a keys.json read CHECK_MS after the write);
// if Herdr rejects it, the old text goes back. Nothing is written while keys.error exists.
function claimsTick(model, world) {
  const c = model.claims ?? CLAIMS, keys = world.keys, problem = model.claimProblem ?? null;
  const none = { model, effects: [] };
  const set = (patch, p = problem, effects = []) => ({ model: { ...model, claims: { ...c, ...patch }, claimProblem: p }, effects });
  if (!keys || c.pending) return none;
  if (c.check) {
    if (keys.at < c.check.until) return none;
    if (keys.error == null) return set({ check: null }, null);
    const why = `keys.json rejected whistle's keys: ${String(keys.error).trim().slice(0, 80)}`;
    return set({ check: null, failed: c.check.text, pending: { text: c.check.raw, raw: c.check.text, revert: true } }, why,
      [{ write: KEYS_FILE, text: c.check.raw, expected: c.check.text }]);
  }
  if (keys.error != null) {
    const why = "keys.json has an error (keys.error); whistle left it alone";
    return problem === why ? none : set({}, why);
  }
  const r = claim(keys.text, Object.keys(OWN), world.layoutName, world.platform);
  if (r.problem) return problem === r.problem ? none : set({}, r.problem);
  if (r.same) return problem == null && c.failed == null ? none : set({ failed: null }, null);
  if (r.text === c.failed) return none;
  return set({ pending: { text: r.text, raw: keys.text, revert: false } }, problem,
    [{ write: KEYS_FILE, text: r.text, expected: keys.text }]);
}

// A write's outcome: a claim waits for Herdr's verdict; a failure is a problem, and its text
// isn't tried again.
function wrote(model, world, input) {
  const c = model.claims ?? CLAIMS;
  if (input.wrote !== KEYS_FILE || !c.pending) return { model, effects: [] };
  const p = c.pending;
  if (!input.ok) {
    const claims = { ...c, pending: null, failed: p.revert ? c.failed : p.text };
    return { model: { ...model, claims, claimProblem: `couldn't write keys.json: ${input.error ?? "unknown error"}` }, effects: [] };
  }
  const claims = p.revert ? { ...c, pending: null } : { ...c, pending: null, check: { until: world.now + CHECK_MS, text: p.text, raw: p.raw } };
  return { model: { ...model, claims }, effects: [] };
}

// The shell's timer: the bar losing or taking the keyboard.
function modeTick(model, world) {
  const none = { model, effects: [] };
  if (model.mode === "whistle" && world.now < model.holdUntil) {
    const m = onTerminal(model, world) && world.focused?.pane ? { ...model, pane: world.focused.pane } : model;
    return { model: m, effects: world.barFocused ? [] : [{ focusBar: true }] };
  }
  if (model.mode === "whistle" && !world.barFocused) return { model: { ...model, mode: "type", holdUntil: 0 }, effects: [] };
  if (model.mode === "type" && world.barFocused) return { ...whistle(model, world), effects: [] };
  return none;
}

function tick(model, world) {
  const m = modeTick(model, world);
  const c = claimsTick(m.model, world);
  return { model: c.model, effects: [...m.effects, ...c.effects] };
}

export function step(model, input, world) {
  const none = { model, effects: [] };
  const pressed = (name) => (model.mode === "whistle" && name ? key(model, world, name) : { ...none, handled: false });
  if (input.command === "whistle") return model.mode === "whistle" ? type(model, world) : whistle(model, world);
  if (input.command === "type") return model.mode === "whistle" ? type(model, world) : none;
  if (typeof input.command === "string" && input.command.startsWith("key-"))
    return pressed(canonicalKey(input.command.slice(4), world.platform));
  if ("key" in input) return pressed(input.key);
  if (input.tick) return tick(model, world);
  if ("wrote" in input) return wrote(model, world, input);
  return none;
}

// The bar's view model: { badge: "TYPE" | "WHISTLE", label: where the keyboard is }.
export function bar(model, world) {
  if (model.mode !== "whistle") return { badge: "TYPE", label: world.focused?.pane ? "Terminal" : "" };
  const f = fieldAt(world.layout, model.field, model.recent);
  if (f?.kind !== TERMINAL) return { badge: "WHISTLE", label: f?.label ?? "" };
  const p = (world.panes ?? []).find((x) => x.pane === model.pane);
  const name = (p?.title || p?.program?.name || "").slice(0, 40);
  return { badge: "WHISTLE", label: name ? `Terminal · ${name}` : "Terminal" };
}
