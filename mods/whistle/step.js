// Whistle's core (ADR 0011): step(model, input, world) -> { model, effects, handled }.
// Pure and synchronous: it imports nothing from `herdr`, never awaits, and never changes the
// model it is given. main.js (the shell) reads Herdr into `world`, calls step, and carries out
// the effects.
//
// model: { mode: "type" | "whistle", field: block id | null, recent: block ids (the field used
//          last first), pane: the terminal's selected pane | null, holdUntil: ms until which
//          whistle holds the keyboard (in WHISTLE: for the bar; in TYPE, after a mapping that
//          ends in TYPE: for the terminal Herdr focused),
//          claims: keys.json as whistle keeps it (claimsTick below), claimProblem: what went
//          wrong keeping it, for the views | null,
//          aside: whether this copy stands aside for another (inert.js), hid: the bars it
//          hid for that, to show again,
//          files: { defaults, user }: mappings.json's and whistle.json's last good versions
//          ({ text, json } | null), config: the layers composed (config.js) and whether a
//          source is broken, problems: config problems [{ source, detail }] for the views,
//          sequence: the key sequence so far (["w"]) | null, flash: the bar's flash | null }
//
// input: { command: "whistle" | "type" }  a whistle.<command> from Herdr (keys.json)
//        { command: "key-<key>" }          a claimed key (claims.js), as if pressed
//        { key: "ctrl-l" }                 a key pressed on the bar in WHISTLE (keynames.js)
//        { tick: true }                    the shell's timer; world.now and world.barFocused
//                                          say what changed (a click away, a late focus)
//        { wrote: path, ok, error }        a write effect's outcome
//        { ran: command, ok: false, error }  a run effect Herdr refused (it flashes)
//
// world: { now: ms, layout: Herdr's layout tree, focused: { pane, terminal } | null,
//          panes: [{ pane, title, program }], barFocused: whether the bar holds the keyboard,
//          keys: Herdr's key bindings [{ section, keys, action }], herdr: Herdr's version,
//          folder: this copy's folder, copies: shared("whistle.copies") (inert.js),
//          platform: "macos" | "linux" | "windows", layoutName: the shown layout's name,
//          keysFile: { text: keys.json (null: no file), error: keys.error (null: none),
//                      at: ms when the shell read them } | undefined (not read yet),
//          configFiles: { defaults: mappings.json, user: whistle.json } as texts (null: no
//                         file, undefined: not read yet),
//          commands: Herdr's commands [{ name, args }] | null (unknown: not checked) }
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

import { fieldAt, terminal, neighbour, TERMINAL, STOCK, STOCK_FIELDS } from "./fields.js";
import { canonicalKey } from "./keynames.js";
import { claim } from "./claims.js";
import { compose, readFile, usedKeys, ACTIONS, SAFETY, DEFAULTS, USER, LAYOUT } from "./config.js";
import { resolve } from "./keymap.js";
import { inert, announce, ownBars, COPIES } from "./inert.js";
import { VERSION } from "./version.js";

// claims: { pending: the write on its way { text, raw, revert } | null, check: a write waiting
// for Herdr's verdict { until, text, raw } | null, failed: a text that failed or Herdr rejected,
// not tried again | null }
const CLAIMS = { pending: null, check: null, failed: null };

export const start = () => ({
  mode: "type", field: null, recent: [], pane: null, holdUntil: 0, claims: CLAIMS, claimProblem: null, aside: false, hid: [],
  files: { defaults: null, user: null }, config: null, problems: [], sequence: null, flash: null,
});

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

// The props of this copy's whistle block in the shown layout (the first that has each).
function blockProps(world) {
  const out = {};
  const walk = (n) => {
    if (!n) return;
    const p = n.content?.mod === (world.folder ?? "whistle") ? n.content.props : null;
    if (p && typeof p === "object") for (const k of ["mappings", "keys"]) if (p[k] !== undefined && !(k in out)) out[k] = p[k];
    for (const c of n.children ?? []) walk(c);
  };
  walk(world.layout);
  return out;
}

// The model with its config brought in line with the world: the files (each run on its last
// good version while it doesn't parse), the layout's whistle block, Herdr's commands. Unchanged
// when none of them changed.
function configured(model, world) {
  const texts = world.configFiles ?? {};
  const props = blockProps(world);
  const sig = JSON.stringify([texts.defaults, texts.user, props, world.commands?.length ?? null, world.platform ?? null]);
  if (model.config?.sig === sig) return model;
  const files = model.files ?? {};
  const d = readFile(files.defaults, texts.defaults), u = readFile(files.user, texts.user);
  const fileProblems = [];
  const why = (r) => (r.missing ? "is missing" : r.broken);
  if ((d.missing || d.broken) && d.good) fileProblems.push({ source: DEFAULTS, detail: `${why(d)}; whistle runs on its last good version` });
  else if (d.missing || d.broken) fileProblems.push({ source: DEFAULTS, detail: `${why(d)}: a broken install; whistle runs on its built-in safety keys` });
  if (u.broken) fileProblems.push({ source: USER, detail: `${u.broken}; ${u.good ? "whistle runs on its last good version" : "whistle leaves it out until it parses"}` });
  const userGood = u.missing ? null : u.good;
  const c = compose([
    { source: DEFAULTS, ...(d.good?.json ?? SAFETY) },
    { source: LAYOUT, map: props.mappings, keys: props.keys },
    { source: USER, ...(userGood?.json ?? {}) },
  ], { commands: world.commands ?? null, platform: world.platform ?? null });
  // Broken (or not read yet): keys.json isn't written until every source reads.
  const broken = Boolean(d.unread || d.missing || d.broken || u.unread || u.broken);
  return {
    ...model,
    files: { defaults: d.good, user: userGood },
    config: { sig, map: c.map, keys: c.keys, own: c.own, broken },
    problems: [...fileProblems, ...c.problems],
  };
}

// Commands that take the keyboard themselves (a dialog, a prompt): whistle doesn't hold it.
const takesKeyboard = (name) => /^(mod\.open|app\.)/.test(name) || /rename/.test(name);

// A mapping pressed: its command (pane and terminal commands on the terminal's selected pane),
// then the bar holds the keyboard. A mapping that ends in TYPE goes to TYPE instead, and holds
// the keyboard for the terminal (modeTick): the command may have made one, which Herdr focuses.
function runMapping(model, world, e) {
  const effects = [];
  const pane = onTerminal(model, world) && model.pane;
  if (/^(pane|terminal)\./.test(e.run) && pane) effects.push({ run: "pane.focus", args: { pane } });
  effects.push({ run: e.run, args: e.args });
  if (e.then === "type") return { model: { ...model, mode: "type", holdUntil: world.now + HOLD_MS }, effects, handled: true };
  if (takesKeyboard(e.run)) return { model, effects, handled: true };
  effects.push({ focusBar: true });
  return { model: { ...model, holdUntil: world.now + HOLD_MS }, effects, handled: true };
}

// A move on a stock field: Herdr's command for that way, if it has one, then the bar holds the
// keyboard (the command shows another space, tab or agent).
function stockMove(model, world, field, dir) {
  if (dir === "right" && STOCK_FIELDS[field.stock].open === "terminal") return toTerminal(model, world);
  const command = STOCK_FIELDS[field.stock][dir];
  if (!command) return { model, effects: [], handled: true };
  return { model: { ...model, holdUntil: world.now + HOLD_MS }, effects: [{ run: command, args: {} }, { focusBar: true }], handled: true };
}

// From a stock field into what its item shows: the terminal field, at the pane Herdr focused
// (the agent's).
function toTerminal(model, world) {
  const t = terminal(world.layout, model.recent);
  const m = (t && select(model, world, t.block)) ?? model;
  return { model: { ...m, pane: world.focused?.pane ?? m.pane }, effects: [], handled: true };
}

// An own key's action.
function ownKey(model, world, action) {
  const own = ACTIONS[action];
  const done = { model, effects: [], handled: true };
  if (own.kind === "type") return { ...type(model, world), handled: true };
  if (own.kind === "field") {
    const next = neighbour(world.layout, model.field, own.dir, model.recent);
    return { ...done, model: (next && select(model, world, next.block)) || model };
  }
  const field = fieldAt(world.layout, model.field, model.recent);
  if (own.kind === "open") {
    if (!field || field.kind === TERMINAL) return { ...type(model, world), handled: true };
    return field.kind === STOCK && STOCK_FIELDS[field.stock].open === "terminal" ? toTerminal(model, world) : done;
  }
  if (own.kind !== "move") return done; // cancel, back: nothing pending
  // A move acts inside the field; with none selected, the terminal stands in.
  const t = field ? null : terminal(world.layout, model.recent);
  if (field?.kind === TERMINAL) return paneMove(model, world, own.dir);
  if (field?.kind === STOCK) return stockMove(model, world, field, own.dir);
  if (t) return paneMove(select(model, world, t.block), world, own.dir);
  return { model, effects: [], handled: false };
}

// A key pressed in WHISTLE: a flash lasts until the next key.
function key(model, world, name) {
  const m0 = configured(model, world);
  const r = resolve(m0.config, m0.sequence, name);
  const m = { ...m0, sequence: r.sequence, flash: r.act?.flash ?? null };
  if (!r.act) return { model: m, effects: [], handled: false };
  if (r.act.run) return runMapping(m, world, r.act.run);
  if (r.act.own) return ownKey(m, world, r.act.own);
  return { model: m, effects: [], handled: true };
}

// How long Herdr gets to load a written keys.json before whistle looks for keys.error (ms).
export const CHECK_MS = 600;

const KEYS_FILE = "keys.json";

// The shell's timer, for claims: keys.json brought in line with whistle's keys, one write at a
// time. A written text waits for Herdr's verdict (a keys.json read CHECK_MS after the write);
// if Herdr rejects it, the old text goes back. Nothing is written while keys.error exists.
function claimsTick(model, world) {
  const c = model.claims ?? CLAIMS, keys = world.keysFile, problem = model.claimProblem ?? null;
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
  if (model.config?.broken) return none;
  const r = claim(keys.text, usedKeys(model.config), world.layoutName, world.platform, world.folder ?? undefined);
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
  // After a mapping that ends in TYPE: the keyboard to the pane Herdr focused, not WHISTLE.
  if (model.mode === "type" && world.now < model.holdUntil) {
    const pane = world.barFocused && world.focused?.pane;
    return pane ? { model, effects: [{ run: "pane.focus", args: { pane } }] } : none;
  }
  if (model.mode === "whistle" && world.now < model.holdUntil) {
    const m = onTerminal(model, world) && world.focused?.pane ? { ...model, pane: world.focused.pane } : model;
    return { model: m, effects: world.barFocused ? [] : [{ focusBar: true }] };
  }
  if (model.mode === "whistle" && !world.barFocused) return { model: { ...model, mode: "type", holdUntil: 0 }, effects: [] };
  if (model.mode === "type" && world.barFocused) return { ...whistle(model, world), effects: [] };
  return none;
}

function tick(model, world) {
  const m = modeTick(configured(model, world), world);
  const c = claimsTick(m.model, world);
  return { model: c.model, effects: [...m.effects, ...c.effects] };
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
  // A write's outcome counts whether or not whistle is inert now.
  if ("wrote" in input) return wrote(model, world, input);
  // A command that failed when pressed only flashes.
  if ("ran" in input) return { model: { ...model, flash: `${input.ran} failed: ${input.error ?? "unknown error"}` }, effects: [] };
  const why = inert(world);
  const out = why ? inertStep(model, input, world) : active(model, input, world);
  return input.tick ? chores(out, world, why) : out;
}

// A step while whistle runs.
function active(model, input, world) {
  // A flash lasts until the next key, the switch key included.
  if ("command" in input && model.flash) model = { ...model, flash: null };
  const none = { model, effects: [] };
  const pressed = (name) => (model.mode === "whistle" && name ? key(model, world, name) : { ...none, handled: false });
  if (input.command === "whistle") return model.mode === "whistle" ? type(model, world) : whistle(model, world);
  if (input.command === "type") return model.mode === "whistle" ? type(model, world) : none;
  if (typeof input.command === "string" && input.command.startsWith("key-"))
    return pressed(canonicalKey(input.command.slice(4), world.platform));
  if ("key" in input) return pressed(input.key);
  if (input.tick) return tick(model, world);
  return none;
}

// Every config problem, for settings: [{ source, detail }], whistle's config first, then
// keys.json's.
export function problems(model) {
  return [...(model.problems ?? []), ...(model.claimProblem ? [{ source: "keys.json", detail: model.claimProblem }] : [])];
}

// Where the keyboard is, for the bar's label.
function where(model, world) {
  if (model.mode !== "whistle") return world.focused?.pane ? "Terminal" : "";
  const f = fieldAt(world.layout, model.field, model.recent);
  if (f?.kind !== TERMINAL) return f?.label ?? "";
  const p = (world.panes ?? []).find((x) => x.pane === model.pane);
  const name = (p?.title || p?.program?.name || "").slice(0, 40);
  return name ? `Terminal · ${name}` : "Terminal";
}

// The bar's view model: { badge: "TYPE" | "WHISTLE" | null (inert), label: where the keyboard
// is, or a flash, marker: "⚠ <count>" while there are config problems | null, problem: why
// whistle is inert, if it is }.
export function bar(model, world) {
  const why = inert(world);
  if (why) return { badge: null, label: "", marker: null, problem: why.problem };
  const n = problems(model).length;
  return { badge: model.mode === "whistle" ? "WHISTLE" : "TYPE", label: model.flash ?? where(model, world), marker: n ? `⚠ ${n}` : null };
}
