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
//          sequence: the key sequence so far (["w"]) | null, flash: the bar's flash | null,
//          keynavActive: what whistle last wrote as shared("keynav").active, requestAt: the
//          selected field's requests count after this ms, fieldProblems: keynav fields'
//          problems [{ source: "keynav", detail }],
//          enabled: whether WHISTLE is switched on, published: the whistle state last
//          published (state() below, as JSON) | null }
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
//          commands: Herdr's commands [{ name, args }] | null (unknown: not checked),
//          shared: keynav's shared state by key ("keynav", "keynav.fields", and each shown
//                  mod block's "keynav.field:<key>" and "keynav.request:<key>") }
//
// effects, a closed set of data:
//   { run: "<command>", args }          run a Herdr command
//   { focusBar: true }                  the bar takes the keyboard
//   { setShared: key, value }           set shared state; step adds { setShared: "whistle" }
//                                       last whenever the public state changes (state())
//   { write: path, text, expected }     write a file (path relative to Herdr's home: "keys.json");
//                                       the outcome comes back as { wrote }
//   { openOverlay: name, spec }         open an overlay, known by name
//   { closeOverlay: name }              close it
//   { typeKey: key, terminal }          type a key into a terminal
//
// handled: for a key, whether whistle used it (else it goes on to whatever else wants it).

import { fieldAt, fields, terminal, neighbour, modBlocks, declaredKeys, requestKey, TERMINAL, STOCK, STOCK_FIELDS, KEYNAV, KEYNAV_V, has, showing, reveal, hideTarget, within, terminalOutside } from "./fields.js";
import { canonicalKey, keyLabel } from "./keynames.js";
import { claim } from "./claims.js";
import { compose, readFile, usedKeys, isGroup, ACTIONS, SAFETY, DEFAULTS, USER, LAYOUT, MODS } from "./config.js";
import { resolve } from "./keymap.js";
import { blockProps, settings, spots } from "./block.js";
import { inert, announce, ownBars, COPIES } from "./inert.js";
import { VERSION } from "./version.js";

// claims: { pending: the write on its way { text, raw, revert } | null, check: a write waiting
// for Herdr's verdict { until, text, raw } | null, failed: a text that failed or Herdr rejected,
// not tried again | null }
const CLAIMS = { pending: null, check: null, failed: null };

export const start = () => ({
  mode: "type", field: null, recent: [], pane: null, holdUntil: 0, claims: CLAIMS, claimProblem: null, aside: false, hid: [],
  files: { defaults: null, user: null }, config: null, problems: [], conflicts: [], overrides: [], sequence: null, flash: null, waitFor: null,
  enabled: true, published: null,
});

// The model with block selected as the field (or the field inside it), if one shows.
function select(model, world, block) {
  const f = fieldAt(world.layout, block, model.recent, world.shared);
  if (!f) return null;
  return {
    ...model, field: f.block, recent: [f.block, ...model.recent.filter((b) => b !== f.block)].slice(0, 20),
    // A field's requests count from when it was selected (keynav's request slot).
    requestAt: f.block === model.field ? model.requestAt : world.now,
  };
}

// WHISTLE on the terminal (the one used last), its pane the one the keyboard just left.
function whistle(model, world) {
  const t = terminal(world.layout, model.recent);
  const m = (t && select(model, world, t.block)) ?? model;
  return { model: { ...m, mode: "whistle", pane: world.focused?.pane ?? m.pane }, effects: [{ focusBar: true }] };
}

const onTerminal = (model, world) => fieldAt(world.layout, model.field, model.recent, world.shared)?.kind === TERMINAL;

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

// The mods with a block in the shown layout, in layout order (hidden blocks count).
function modsShown(world) {
  const out = [];
  const walk = (n) => {
    if (!n) return;
    const m = n.content?.mod;
    if (m && m !== (world.folder ?? "whistle") && !out.includes(m)) out.push(m);
    for (const c of n.children ?? []) walk(c);
  };
  walk(world.layout);
  return out;
}

// What the bar flashes for a new mapping conflict.
function conflictFlash(c) {
  const seq = c.seq.map(keyLabel).join(" ");
  if (c.own && c.mods.length === 1) return `${seq}: ${c.mods[0]} wants an own key, see settings`;
  return `${seq}: ${c.mods.length} mods want it, see settings`;
}
const conflictId = (c) => JSON.stringify([c.seq, c.mods]);

// The model with its config brought in line with the world: the files (each run on its last
// good version while it doesn't parse), the mods' mappings (those of mods in the shown layout),
// the layout's whistle block, Herdr's commands. Unchanged when none of them changed. A mapping
// conflict that wasn't there before flashes, once.
function configured(model, world) {
  const texts = world.configFiles ?? {};
  const folder = world.folder ?? "whistle";
  const block = blockProps(world.layout, folder);
  const props = block.props;
  const offered = world.modMappings ?? {};
  const offers = modsShown(world).filter((name) => offered[name] !== undefined).map((name) => ({ name, entry: offered[name] }));
  const sig = JSON.stringify([texts.defaults, texts.user, props, block.problems, spots(world.layout, folder).map((s) => s.props.bar),
    offers, world.commands?.length ?? null, world.platform ?? null]);
  if (model.config?.sig === sig) return model;
  const files = model.files ?? {};
  const d = readFile(files.defaults, texts.defaults), u = readFile(files.user, texts.user);
  const fileProblems = [];
  const why = (r) => (r.missing ? "is missing" : r.broken);
  if ((d.missing || d.broken) && d.good) fileProblems.push({ source: DEFAULTS, detail: `${why(d)}; whistle runs on its last good version` });
  else if (d.missing || d.broken) fileProblems.push({ source: DEFAULTS, detail: `${why(d)}: a broken install; whistle runs on its built-in safety keys` });
  if (u.broken) fileProblems.push({ source: USER, detail: `${u.broken}; ${u.good ? "whistle runs on its last good version" : "whistle leaves it out until it parses"}` });
  const userGood = u.missing ? null : u.good;
  const set = settings(props, userGood?.json, world.layout, folder);
  const c = compose([
    { source: DEFAULTS, ...(d.good?.json ?? SAFETY) },
    { source: MODS, offers },
    { source: LAYOUT, map: props.mappings, keys: props.keys, mods: props.mods },
    { source: USER, ...(userGood?.json ?? {}) },
  ], { commands: world.commands ?? null, platform: world.platform ?? null });
  // Broken (or not read yet): keys.json isn't written until every source reads.
  const before = new Set((model.conflicts ?? []).map(conflictId));
  const fresh = c.conflicts.find((x) => !before.has(conflictId(x)));
  const broken = Boolean(d.unread || d.missing || d.broken || u.unread || u.broken);
  return {
    ...model,
    files: { defaults: d.good, user: userGood },
    config: { sig, map: c.map, keys: c.keys, own: c.own, broken, ...set.settings },
    enabled: set.settings.enabled,
    problems: [
      ...fileProblems,
      ...block.problems.map((detail) => ({ source: LAYOUT, detail })),
      ...set.problems.map((detail) => ({ source: USER, detail })),
      ...c.problems,
    ],
    conflicts: c.conflicts,
    overrides: c.overrides,
    flash: fresh ? conflictFlash(fresh) : model.flash,
  };
}

// Commands that take the keyboard themselves (a dialog, a prompt): whistle doesn't hold it.
const takesKeyboard = (name) => /^(mod\.open|app\.)/.test(name) || /rename/.test(name);

// A mapping pressed: its command (pane and terminal commands on the terminal's selected pane),
// then the bar holds the keyboard. A mapping that ends in TYPE goes to TYPE instead, and holds
// the keyboard for the terminal (modeTick): the command may have made one, which Herdr focuses.
function runMapping(model, world, e) {
  if (e.run.startsWith("whistle.")) return verb(model, world, e.run.slice(8), e.args?.block);
  const effects = [];
  const pane = onTerminal(model, world) && model.pane;
  if (/^(pane|terminal)\./.test(e.run) && pane) effects.push({ run: "pane.focus", args: { pane } });
  effects.push({ run: e.run, args: e.args });
  if (e.then === "type") return { model: { ...model, mode: "type", holdUntil: world.now + HOLD_MS }, effects, handled: true };
  if (takesKeyboard(e.run)) return { model, effects, handled: true };
  effects.push({ focusBar: true });
  return { model: { ...model, holdUntil: world.now + HOLD_MS }, effects, handled: true };
}

// A move or a declared key sent to a keynav field as <mod>.keynav-<what>; the bar holds the
// keyboard, as after a mapping.
const toField = (model, world, field, what) => runMapping(model, world, { run: `${field.mod}.keynav-${what}`, args: {} });

// How long whistle.focus waits for a block it showed to show a field (ms).
export const WAIT_MS = 1500;

const flash = (model, text) => ({ model: { ...model, flash: text }, effects: [], handled: true });
const held = (model, world, effects) => ({ model: { ...model, holdUntil: world.now + HOLD_MS }, effects: [...effects, { focusBar: true }], handled: true });
const revealing = (world, block) => reveal(world.layout, block).map((r) => (r.show
  ? { run: "layout.show", args: { id: r.show } } : { run: "layout.select", args: { stack: r.stack, child: r.child } }));

// A whistle.<verb> from a mapping (docs/contracts/commands.md).
function verb(model, world, v, block) {
  if (v === "field") {
    const m = select(model, world, block);
    return m ? { model: m, effects: [], handled: true } : flash(model, `${block} can't be selected now`);
  }
  if (v === "focus" || v === "toggle") {
    if (!has(world.layout, block)) return flash(model, `No ${block} in this layout`);
    if (v === "toggle" && showing(world.layout, block)) {
      const target = hideTarget(world.layout, block);
      let m = model;
      if (model.field && within(world.layout, target, model.field)) {
        const t = terminalOutside(world.layout, target, model.recent);
        m = t ? select(model, world, t.block) : { ...model, field: null };
      }
      return held(m, world, [{ run: "layout.hide", args: { id: target } }]);
    }
    const effects = revealing(world, block);
    if (v === "toggle") return held(model, world, effects);
    const m = select(model, world, block);
    return held(m ?? { ...model, waitFor: { block, until: world.now + WAIT_MS } }, world, effects);
  }
  return { ...command(model, world, v), handled: true };
}

// whistle.json with one setting changed, as a write effect (a flash if it can't be).
function setUser(model, world, key, value) {
  const text = world.configFiles?.user;
  if (text === undefined) return { model: { ...model, flash: "whistle.json isn't read yet" }, effects: [] };
  let json = {};
  if (text != null) {
    const r = readFile(null, text);
    if (r.broken) return { model: { ...model, flash: `whistle.json ${r.broken}; fix it first` }, effects: [] };
    json = r.good.json;
  }
  return { model, effects: [{ write: USER, text: `${JSON.stringify({ ...json, [key]: value }, null, 2)}
`, expected: text }] };
}

// In WHISTLE, back to TYPE before out (a dialog takes the keyboard, or whistle switches off).
function leaving(model, world, out) {
  if (model.mode !== "whistle") return out(model);
  const t = type(model, world);
  const o = out(t.model);
  return { model: o.model, effects: [...t.effects, ...o.effects] };
}

const SETTINGS = (world) => ({ openOverlay: "settings",
  spec: { mod: world.folder ?? "whistle", kind: "dialog", width: 640, height: 0.8, props: { part: "settings" } } });

// whistle.on, whistle.off, whistle.settings: they work whether whistle is on or off.
function command(model, world, c) {
  if (c === "on") return setUser(model, world, "enabled", true);
  if (c === "off") return leaving(model, world, (m) => setUser(m, world, "enabled", false));
  if (c === "settings") return leaving(model, world, (m) => ({ model: m, effects: [SETTINGS(world)] }));
  if (c === "whistle") return model.mode === "whistle" ? type(model, world) : whistle(model, world);
  if (c === "type") return model.mode === "whistle" ? type(model, world) : { model, effects: [] };
  return { model, effects: [] };
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
    const next = neighbour(world.layout, model.field, own.dir, model.recent, world.shared, model.config?.nav);
    return { ...done, model: (next && select(model, world, next.block)) || model };
  }
  const field = fieldAt(world.layout, model.field, model.recent, world.shared);
  if (field?.kind === KEYNAV && (own.kind === "open" || own.kind === "move")) return toField(model, world, field, own.dir ?? "open");
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

// The model with its keynav problems (model.fieldProblems) brought in line with the fields
// that show: declared keys whistle ignores, and copies still on keynav v1. Unchanged when they
// are the same.
function fieldsChecked(model, world) {
  if (!world.shared && !model.fieldProblems?.length) return model; // no keynav state: nothing to check
  const out = [];
  const all = fields(world.layout, world.shared);
  for (const f of all) {
    if (f.kind !== KEYNAV) continue;
    for (const detail of declaredKeys(f, model.config?.own, world.platform).problems) out.push({ source: "keynav", detail });
  }
  const v1 = world.shared?.["keynav.fields"] ?? {};
  const seen = new Set();
  for (const b of modBlocks(world.layout)) {
    if (seen.has(b.key) || v1[b.key]?.v !== 1 || all.some((f) => f.key === b.key)) continue;
    seen.add(b.key);
    out.push({ source: "keynav", detail: `${b.mod} speaks keynav v1, which whistle no longer drives; update its keynav.js` });
  }
  return JSON.stringify(out) === JSON.stringify(model.fieldProblems ?? []) ? model : { ...model, fieldProblems: out };
}

// A key pressed in WHISTLE: a flash lasts until the next key.
function key(model, world, name) {
  const m0 = fieldsChecked(configured(model, world), world);
  const field = fieldAt(world.layout, m0.field, m0.recent, world.shared);
  const declared = field?.kind === KEYNAV ? declaredKeys(field, m0.config.own, world.platform).keys : null;
  const r = resolve(m0.config, m0.sequence, name, declared);
  const m = { ...m0, sequence: r.sequence, flash: r.act?.flash ?? null };
  if (!r.act) return { model: m, effects: [], handled: false };
  if (r.act.declared !== undefined) return toField(m, world, field, `key-${r.act.declared}`);
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
  if (input.wrote === USER) return input.ok ? { model, effects: [] }
    : { model: { ...model, flash: `couldn't write whistle.json: ${input.error ?? "unknown error"}` }, effects: [] };
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

// A selected field that left (its block gone, or its keynav entry): the terminal instead.
function stillThere(model, world) {
  if (model.mode !== "whistle" || !model.field || fieldAt(world.layout, model.field, model.recent, world.shared)) return model;
  const t = terminal(world.layout, model.recent);
  return (t && select(model, world, t.block)) ?? { ...model, field: null };
}

// The selected keynav field's request slot, shared("keynav.request:<fieldKey>"), once per
// request made since it was selected: { to: "terminal" } (it focused one: whistle selects the
// terminal on that pane) or { hold: true } (it moved the keyboard: whistle takes it back).
// Either way the bar holds the keyboard for HOLD_MS; modeTick takes it back.
function requests(model, world) {
  if (model.mode !== "whistle" || !world.shared) return model;
  const f = fieldAt(world.layout, model.field, model.recent, world.shared);
  const r = f?.kind === KEYNAV ? world.shared?.[requestKey(f.key)] : null;
  if (!r || typeof r.at !== "number" || !(r.at > (model.requestAt ?? 0))) return model;
  let m = { ...model, requestAt: r.at, holdUntil: world.now + HOLD_MS };
  if (r.to === TERMINAL) {
    const t = terminal(world.layout, m.recent);
    if (t) m = { ...select(m, world, t.block), pane: world.focused?.pane ?? m.pane };
  }
  return m;
}

// whistle.focus waiting for the block it showed: selected once it shows, given up at the deadline.
function waitTick(model, world) {
  const w = model.waitFor;
  if (!w) return model;
  if (model.mode !== "whistle" || world.now > w.until) return { ...model, waitFor: null };
  const m = select(model, world, w.block);
  return m ? { ...m, waitFor: null } : model;
}

function tick(model, world) {
  const m = modeTick(waitTick(fieldsChecked(requests(stillThere(configured(model, world), world), world), world), world), world);
  const c = claimsTick(m.model, world);
  return { model: c.model, effects: [...m.effects, ...c.effects, ...spotTick(c.model, world)] };
}

// The bar in the spot whistle.json picks (block.js checked it exists): that spot shown, the
// layout's other spots hidden.
function spotTick(model, world) {
  const want = model.config?.bar;
  if (!want) return [];
  const effects = [];
  for (const s of spots(world.layout, world.folder ?? "whistle")) {
    const mine = s.props.bar === want;
    if (mine && s.hidden) effects.push({ run: "layout.show", args: { id: s.id } });
    if (!mine && !s.hidden) effects.push({ run: "layout.hide", args: { id: s.id } });
  }
  return effects;
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
  if (input.command === "whistle") return typeThrough(m, world);
  return { model: m, effects: [], handled: false };
}

// The switch key typed through into the focused terminal, as if whistle weren't there.
function typeThrough(model, world) {
  const k = boundKey(world, "whistle.whistle"), t = world.focused?.terminal;
  return { model, effects: k && t ? [{ typeKey: k, terminal: t }] : [] };
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
  const done = input.tick ? chores(out, world, why) : out;
  return why ? done : publish(done);
}

// The shared key whistle's public state goes in (docs/contracts/state.md).
export const STATE = "whistle";

// Whistle's public state (ADR 0010): { v: 1, mode, enabled, sequence: null | { keys, group },
// pane }. mode is "type" while WHISTLE is switched off; group is the name of the group the
// sequence has reached.
export function state(model) {
  const enabled = model.enabled !== false;
  const keys = model.sequence ?? null;
  let group = null, map = model.config?.map ?? {};
  for (const k of keys ?? []) { group = isGroup(map[k]) ? map[k] : null; map = group?.map ?? {}; }
  return {
    v: 1, mode: enabled && model.mode === "whistle" ? "whistle" : "type", enabled,
    sequence: keys && keys.length ? { keys: [...keys], group: group?.name ?? null } : null,
    pane: model.pane ?? null,
  };
}

// The state published after a step, when it changed (and only then).
function publish(out) {
  const value = state(out.model);
  const sig = JSON.stringify(value);
  if (out.model.published === sig) return out;
  return { ...out, model: { ...out.model, published: sig }, effects: [...out.effects, { setShared: STATE, value }] };
}

// A step while whistle runs, then keynav told which field is selected.
function active(model, input, world) {
  return publishKeynav(running(model, input, world), world);
}

// shared("keynav") = { v: 2, active }: the selected keynav field's key while in WHISTLE, else
// null. Written only when it changes (model.keynavActive: what whistle last wrote; before its
// first write, what the world says).
function publishKeynav(out, world) {
  const m = out.model;
  // Without keynav state there's no keynav field to name.
  const f = m.mode === "whistle" && world.shared ? fieldAt(world.layout, m.field, m.recent, world.shared) : null;
  const want = f?.kind === KEYNAV ? f.key : null;
  const known = m.keynavActive !== undefined ? m.keynavActive : (world.shared?.keynav?.active ?? null);
  if (m.keynavActive === want && known === want) return out;
  const effects = known === want ? out.effects : [...out.effects, { setShared: "keynav", value: { v: KEYNAV_V, active: want } }];
  return { ...out, model: { ...m, keynavActive: want }, effects };
}

function running(model, input, world) {
  // A flash lasts until the next key, the switch key included.
  if ("command" in input && model.flash) model = { ...model, flash: null };
  model = configured(model, world);
  const none = { model, effects: [] };
  if (["on", "off", "settings"].includes(input.command)) return command(model, world, input.command);
  // Switched off: no WHISTLE, and the switch key types through.
  if (model.enabled === false) {
    if (model.mode === "whistle") return { ...type(model, world), handled: false };
    if (input.command === "whistle") return typeThrough(model, world);
    if (input.tick) { const c = claimsTick(model, world); return { ...c, effects: [...c.effects, ...spotTick(c.model, world)] }; }
    return { ...none, handled: false };
  }
  const pressed = (name) => (model.mode === "whistle" && name ? key(model, world, name) : { ...none, handled: false });
  if (input.command === "whistle") return model.mode === "whistle" ? type(model, world) : whistle(model, world);
  if (input.command === "type") return model.mode === "whistle" ? type(model, world) : none;
  if (typeof input.command === "string" && input.command.startsWith("key-"))
    return pressed(canonicalKey(input.command.slice(4), world.platform));
  if ("key" in input) return pressed(input.key);
  if (input.tick) return tick(model, world);
  return none;
}

// Every config problem, for settings: [{ source, detail }], whistle's config first, then the
// keynav fields', then keys.json's.
export function problems(model) {
  return [...(model.problems ?? []), ...(model.fieldProblems ?? []), ...(model.claimProblem ? [{ source: "keys.json", detail: model.claimProblem }] : [])];
}

// Where the keyboard is, for the bar's label.
function where(model, world) {
  if (model.mode !== "whistle") return world.focused?.pane ? "Terminal" : "";
  const f = fieldAt(world.layout, model.field, model.recent, world.shared);
  if (f?.kind !== TERMINAL) return f?.label ?? "";
  const p = (world.panes ?? []).find((x) => x.pane === model.pane);
  const name = (p?.title || p?.program?.name || "").slice(0, 40);
  return name ? `Terminal · ${name}` : "Terminal";
}

// The bar's view model: { badge: "TYPE" | "WHISTLE" | null (inert, switched off), label: where the keyboard
// is, or a flash, marker: "⚠ <count>" while there are config problems | null, problem: why
// whistle is inert, if it is }.
export function bar(model, world) {
  const why = inert(world);
  if (why) return { badge: null, label: "", marker: null, problem: why.problem };
  const n = problems(model).length;
  const marker = n ? `⚠ ${n}` : null;
  if (model.enabled === false) return { badge: null, label: model.flash ?? "Whistle off", marker };
  return { badge: model.mode === "whistle" ? "WHISTLE" : "TYPE", label: model.flash ?? where(model, world), marker };
}
