// Whistle's core (ADR 0011): step(model, input, world) -> { model, effects, handled }.
// Pure and synchronous: it imports nothing from `herdr`, never awaits, and never changes the
// model it is given. main.js (the shell) reads Herdr into `world`, calls step, and carries out
// the effects.
//
// model: { mode: "type" | "whistle", field: block id | null, recent: block ids (the field used
//          last first), pane: the terminal's selected pane | null, holdUntil: ms until which
//          whistle holds the keyboard (in WHISTLE: for the bar; in TYPE, after a mapping that
//          ends in TYPE: for the terminal Herdr focused),
//          claims: keys.json as whistle keeps it (claims.js claimsTick), claimProblem: what went
//          wrong keeping it, for the views | null,
//          aside: whether this copy stands aside for another (inert.js), hid: the bars it
//          hid for that, to show again,
//          files: { defaults, user }: mappings.json's and whistle.json's last good versions
//          ({ text, json } | null), config: the layers composed (config.js) and whether a
//          source is broken, problems: config problems [{ source, detail }] for the views
//          (a mod's under its name), conflicts, overrides: mapping conflicts and the keys mapped
//          over mods' (config.js), mods: the shown layout's mods that offer mappings
//          [{ name, on }],
//          sequence: the key sequence so far (["w"]) | null, flash: the bar's flash | null,
//          flashUntil: ms when a flash with an end goes (a jump key's in TYPE) | 0,
//          keynavActive: what whistle last wrote as shared("keynav").active, requestAt: the
//          selected field's requests count after this ms, fieldProblems: keynav fields'
//          problems [{ source: "keynav", detail }],
//          enabled: whether WHISTLE is switched on, published: the whistle state last
//          published (state() below, as JSON) | null,
//          sent: the views' models last set in their shared keys and the hints window last
//          opened, as JSON ({ bar, hints, settings, box }; null: none yet / not open), and leftOpen:
//          a hints window an earlier copy may have left open (Herdr makes a new copy when the
//          layout changes), true when a copy starts, so its first step closes it }
//
// input: { command: "whistle" | "type" }  a whistle.<command> from Herdr (keys.json)
//        { command: "key-<key>" }          a claimed key (claims.js), as if pressed
//        { command: "<verb>:<block>" }     a jump key (ADR 0014): "whistle.focus:agents"
//        { key: "ctrl-l" }                 a key pressed on the bar in WHISTLE (keynames.js)
//        { tick: true }                    the shell's timer; world.now and world.barFocused
//                                          say what changed (a click away, a late focus)
//        { wrote: path, ok, error }        a write effect's outcome
//        { ran: command, ok: false, error }  a run effect that threw (it flashes; today's Herdr
//                                            doesn't throw, it shows its own error toast)
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
//                  mod block's "keynav.field:<key>" and "keynav.request:<key>"),
//          props: this copy's block props (props()), which tell the bar spots' copies apart
//                 | undefined (unknown),
//          viewport: the window's drawable size { width, height } | null (not measured),
//          barSize: this copy's bar's drawn size { width, height } | null (not measured, or
//                   no bar: the anchor draws none),
//          barSizes: the size each of this copy's bars last published, by its spot (spotName:
//                    its `bar`, "" for none): { "<spot>": { width, height } | null },
//          home: Herdr's home folder (appHome()) | undefined (unknown) }
//
// effects, a closed set of data:
//   { run: "<command>", args }          run a Herdr command
//   { focusBar: true }                  the bar takes the keyboard
//   { setShared: key, value }           set shared state; step adds { setShared: "whistle" }
//                                       last whenever the whistle state changes (state())
//   { write: path, text, expected }     write a file (path relative to Herdr's home: "keys.json");
//                                       the outcome comes back as { wrote }
//   { openOverlay: name, spec }         open an overlay, known by name (closing the one open
//                                       under that name first)
//   { closeOverlay: name }              close it
//   { typeKey: key, terminal }          type a key into a terminal
//
// handled: for a key, whether whistle used it (else it goes on to whatever else wants it).

import { fieldAt, fields, terminal, neighbour, modBlocks, eachNode, declaredKeys, requestKey, moveFor, requestOf, AFTER_TERMINAL, TERMINAL, STOCK, STOCK_FIELDS, KEYNAV, KEYNAV_V, has, showing, reveal, hideTarget, within, terminalOutside } from "./fields.js";
import { canonicalKey, keyLabel } from "./keynames.js";
import { claimsTick, claimWrote, CLAIMS } from "./claims.js";
import { compose, readFile, groupAt, ACTIONS, SAFETY, DEFAULTS, USER, LAYOUT, MODS, BLOCK_VERBS, JUMP_VERBS, KEEP_MODE, keysProblems, verbAndBlock, runsAs } from "./config.js";
import { resolve } from "./keymap.js";
import { blockProps, settings as blockSettings, spots, resting, viewing, dock, placeOf, spotName, isAnchor } from "./block.js";
import { inert, announce, ownBars, COPIES } from "./inert.js";
import { VERSION, FOLDER } from "./version.js";
import { problems, hints, settings, hintsBox } from "./views.js";

export const start = () => ({
  mode: "type", field: null, recent: [], pane: null, holdUntil: 0, claims: CLAIMS, claimProblem: null, aside: false, hid: [],
  files: { defaults: null, user: null }, config: null, problems: [], conflicts: [], overrides: [], mods: [], sequence: null, flash: null, flashUntil: 0, waitFor: null,
  enabled: true, published: null, sent: { bar: null, hints: null, settings: null, box: null, size: null, leftOpen: true },
});

// This copy's folder (world.folder), its blocks' mod name.
const folderOf = (world) => world.folder ?? FOLDER;

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

// The model with the terminal field selected (the one used last), its pane the one Herdr
// focused (else the one selected before).
function onTerminalPane(model, world) {
  const t = terminal(world.layout, model.recent);
  const m = (t && select(model, world, t.block)) ?? model;
  return { ...m, pane: world.focused?.pane ?? m.pane };
}

// WHISTLE on the terminal, its pane the one the keyboard just left.
const whistle = (model, world) => ({ model: { ...onTerminalPane(model, world), mode: "whistle" }, effects: [{ focusBar: true }] });

const onTerminal = (model, world) => fieldAt(world.layout, model.field, model.recent, world.shared)?.kind === TERMINAL;

// Back to TYPE, the keyboard to the terminal's selected pane (else the focused one).
function type(model, world) {
  const pane = (onTerminal(model, world) && model.pane) || world.focused?.pane;
  return { model: { ...model, mode: "type", holdUntil: 0 }, effects: pane ? [{ run: "pane.focus", args: { pane } }] : [] };
}

// How long whistle holds the keyboard after moving it away (ms): Herdr can hand it back to a
// pane late, so until then the bar takes it back instead of leaving WHISTLE.
export const HOLD_MS = 600;

// The effects, then the bar holds the keyboard for HOLD_MS (modeTick takes it back).
const held = (model, world, effects) => ({ model: { ...model, holdUntil: world.now + HOLD_MS }, effects: [...effects, { focusBar: true }], handled: true });

// h/j/k/l over split panes: from the selected pane, let pane.go find the neighbour, then hold
// the keyboard (the tick follows the pane it lands on).
function paneMove(model, world, direction) {
  const from = model.pane ?? world.focused?.pane;
  return held({ ...model, pane: from ?? null }, world, [
    ...(from ? [{ run: "pane.focus", args: { pane: from } }] : []),
    { run: "pane.go", args: { direction } },
  ]);
}

// The mods with a block in the shown layout, in layout order (hidden blocks count).
function modsShown(world) {
  const out = [];
  eachNode(world.layout, (n) => {
    const m = n.content?.mod;
    if (m && m !== (folderOf(world)) && !out.includes(m)) out.push(m);
  });
  return out;
}

// What the bar flashes for a new mapping conflict.
function conflictFlash(c) {
  const seq = c.seq.map(keyLabel).join(" ");
  if (c.own && c.mods.length === 1) return `${seq}: ${c.mods[0]} wants an own key, see settings`;
  return `${seq}: ${c.mods.length} mods want it, see settings`;
}
const conflictId = (c) => JSON.stringify([c.seq, c.mods]);
// What the bar flashes for a new problem in a mod's offered mappings (issue #10).
const modProblemFlash = (p) => `${p.source}'s mappings have a problem, see settings`;
const problemId = (p) => JSON.stringify([p.source, p.detail]);

// The model with its config brought in line with the world: the files (each run on its last
// good version while it doesn't parse), the mods' mappings (those of mods in the shown layout),
// the layout's whistle block, Herdr's commands. Unchanged when none of them changed. A mapping
// conflict, or a problem in a mod's mappings, that wasn't there before flashes, once.
function configured(model, world) {
  const texts = world.configFiles ?? {};
  const folder = folderOf(world);
  const block = blockProps(world.layout, folder);
  const props = block.props;
  const offered = world.modMappings ?? {};
  const offers = modsShown(world).filter((name) => offered[name] !== undefined).map((name) => ({ name, entry: offered[name] }));
  const sig = JSON.stringify([texts.defaults, texts.user, props, block.problems, spots(world.layout, folder).map((s) => s.props.bar),
    offers, world.commands?.length ?? null, world.platform ?? null, world.keysFile?.text ?? null]);
  if (model.config?.sig === sig) return model;
  const files = model.files ?? {};
  const defaults = readFile(files.defaults, texts.defaults), user = readFile(files.user, texts.user);
  const fileProblems = [];
  const why = (read) => (read.missing ? "is missing" : read.broken);
  if ((defaults.missing || defaults.broken) && defaults.good) fileProblems.push({ source: DEFAULTS, detail: `${why(defaults)}; whistle runs on its last good version` });
  else if (defaults.missing || defaults.broken) fileProblems.push({ source: DEFAULTS, detail: `${why(defaults)}: a broken install; whistle runs on its built-in safety keys` });
  if (user.broken) fileProblems.push({ source: USER, detail: `${user.broken}; ${user.good ? "whistle runs on its last good version" : "whistle leaves it out until it parses"}` });
  const userGood = user.missing ? null : user.good;
  const chosen = blockSettings(props, userGood?.json, world.layout, folder);
  const composed = compose([
    { source: DEFAULTS, ...(defaults.good?.json ?? SAFETY) },
    { source: MODS, offers },
    { source: LAYOUT, map: props.mappings, keys: props.keys, mods: props.mods },
    { source: USER, ...(userGood?.json ?? {}) },
  ], { commands: world.commands ?? null, platform: world.platform ?? null });
  // Broken (or not read yet): keys.json isn't written until every source reads.
  const before = new Set((model.conflicts ?? []).map(conflictId));
  const fresh = composed.conflicts.find((x) => !before.has(conflictId(x)));
  const offering = new Set(offers.map((o) => o.name));
  const known = new Set((model.problems ?? []).filter((p) => offering.has(p.source)).map(problemId));
  const freshModProblem = composed.problems.find((p) => offering.has(p.source) && !known.has(problemId(p)));
  const broken = Boolean(defaults.unread || defaults.missing || defaults.broken || user.unread || user.broken);
  return {
    ...model,
    files: { defaults: defaults.good, user: userGood },
    config: { sig, map: composed.map, keys: composed.keys, own: composed.own, broken, ...chosen.settings },
    enabled: chosen.settings.enabled,
    problems: [
      ...fileProblems,
      ...block.problems.map((detail) => ({ source: LAYOUT, detail })),
      ...chosen.problems.map((detail) => ({ source: USER, detail })),
      ...composed.problems,
      ...keysProblems(world.keysFile?.text, folder),
    ],
    conflicts: composed.conflicts,
    overrides: composed.overrides,
    mods: offers.map(({ name }) => ({ name, on: !composed.off.includes(name) })),
    flash: fresh ? conflictFlash(fresh) : freshModProblem ? modProblemFlash(freshModProblem) : model.flash,
  };
}

// Commands that take the keyboard themselves (a dialog, a prompt): whistle doesn't hold it.
const takesKeyboard = (name) => /^(mod\.open|app\.)/.test(name) || /rename/.test(name);

// A mapping pressed: its command (pane and terminal commands on the terminal's selected pane),
// then the bar holds the keyboard. A mapping that ends in TYPE goes to TYPE instead, and holds
// the keyboard for the terminal (modeTick): the command may have made one, which Herdr focuses.
function runMapping(model, world, e) {
  if (e.run.startsWith("whistle.")) return whistleMapping(model, world, e.run.slice(8), e.args?.block);
  const effects = [];
  const pane = onTerminal(model, world) && model.pane;
  if (/^(pane|terminal)\./.test(e.run) && pane) effects.push({ run: "pane.focus", args: { pane } });
  effects.push({ run: e.run, args: e.args });
  if (e.then === "type") return { model: { ...model, mode: "type", holdUntil: world.now + HOLD_MS }, effects, handled: true };
  if (takesKeyboard(e.run)) return { model, effects, handled: true };
  return held(model, world, effects);
}

// A move or a declared key sent to a keynav field as <mod>.keynav-<what>; the bar holds the
// keyboard, as after a mapping.
const toField = (model, world, field, what) => runMapping(model, world, { run: `${field.mod}.keynav-${what}`, args: {} });

// How long whistle.focus waits for a block it showed to show a field (ms).
export const WAIT_MS = 1500;

const flash = (model, text) => ({ model: { ...model, flash: text }, effects: [], handled: true });
const revealing = (world, block) => reveal(world.layout, block).map((r) => (r.show
  ? { run: "layout.show", args: { id: r.show } } : { run: "layout.select", args: { stack: r.stack, child: r.child } }));

// The flash when a block holds no field to select now.
const cantSelect = (block) => `${block} can't be selected now`;

// Why a verb can't run on block now (the bar flashes it), or null when it can.
function cantRun(model, world, v, block) {
  if (v === "field") return select(model, world, block) ? null : cantSelect(block);
  return has(world.layout, block) ? null : `No ${block} in this layout`;
}

// whistle.toggle on a block the layout has: hidden if it shows (a field selected in it moves to
// the terminal outside), else shown, without selecting it.
function toggled(model, world, block) {
  if (!showing(world.layout, block)) return { model, effects: revealing(world, block) };
  const target = hideTarget(world.layout, block);
  let m = model;
  if (model.field && within(world.layout, target, model.field)) {
    const t = terminalOutside(world.layout, target, model.recent);
    m = t ? select(model, world, t.block) : { ...model, field: null };
  }
  return { model: m, effects: [{ run: "layout.hide", args: { id: target } }] };
}

// A whistle.<verb> from a mapping (docs/contracts/commands.md), in WHISTLE.
function whistleMapping(model, world, v, block) {
  if (!BLOCK_VERBS.includes(v)) return { ...command(model, world, v), handled: true };
  if (v === "field") {
    const m = select(model, world, block);
    return m ? { model: m, effects: [], handled: true } : flash(model, cantSelect(block));
  }
  const why = cantRun(model, world, v, block);
  if (why) return flash(model, why);
  if (v === "toggle") {
    const t = toggled(model, world, block);
    return held(t.model, world, t.effects);
  }
  const m = select(model, world, block);
  return held(m ?? { ...model, waitFor: { block, until: world.now + WAIT_MS } }, world, revealing(world, block));
}

// How long a flash lasts in TYPE, where no key press ends it (ms).
export const FLASH_MS = 2000;

// A jump key (ADR 0014): "<verb>:<block>", everything after the first colon the block's id, as
// Herdr hands over "whistle.<verb>:<block>" from keys.json. It runs its verb and goes to
// WHISTLE from either mode (ending a key sequence); toggle-keep-mode keeps the mode. A verb
// that can't run flashes, in the mode it was pressed in.
function jump(model, world, c) {
  const { verb, block } = verbAndBlock(c);
  const v = runsAs(verb);
  if (model.mode === "whistle") return whistleMapping({ ...model, sequence: null }, world, v, block);
  const why = cantRun(model, world, v, block);
  if (why) return { model: { ...model, flash: why, flashUntil: world.now + FLASH_MS }, effects: [] };
  if (verb === KEEP_MODE) return toggled(model, world, block);
  const out = whistleMapping({ ...onTerminalPane(model, world), mode: "whistle" }, world, v, block);
  return held(out.model, world, out.effects.filter((e) => !e.focusBar));
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
  spec: { mod: folderOf(world), kind: "dialog", width: 640, height: 0.8, props: { part: "settings" } } });

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
  if (dir === "right" && STOCK_FIELDS[field.stock].pick === "terminal") return toTerminal(model, world);
  const command = STOCK_FIELDS[field.stock][dir];
  if (!command) return { model, effects: [], handled: true };
  return held(model, world, [{ run: command, args: {} }]);
}

// From a stock field into what its item shows: the terminal field, at the pane Herdr focused
// (the agent's).
const toTerminal = (model, world) => ({ model: onTerminalPane(model, world), effects: [], handled: true });

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
  if (field?.kind === KEYNAV && (own.kind === "pick" || own.kind === "move")) return toField(model, world, field, moveFor(field, own.dir ?? "pick"));
  if (own.kind === "pick") {
    if (!field || field.kind === TERMINAL) return { ...type(model, world), handled: true };
    return field.kind === STOCK && STOCK_FIELDS[field.stock].pick === "terminal" ? toTerminal(model, world) : done;
  }
  if (own.kind !== "move") return done; // cancel: nothing pending
  // A move acts inside the field; with none selected, the terminal stands in.
  const t = field ? null : terminal(world.layout, model.recent);
  if (field?.kind === TERMINAL) return paneMove(model, world, own.dir);
  if (field?.kind === STOCK) return stockMove(model, world, field, own.dir);
  if (t) return paneMove(select(model, world, t.block), world, own.dir);
  return { model, effects: [], handled: false };
}

// The model with its keynav problems (model.fieldProblems) brought in line with the fields
// that show: declared keys whistle ignores, copies still on keynav v2 (driven, but asked to
// update) and copies still on keynav v1 (not driven). Unchanged when they
// are the same.
function fieldsChecked(model, world) {
  if (!world.shared && !model.fieldProblems?.length) return model; // no keynav state: nothing to check
  const out = [];
  const all = fields(world.layout, world.shared);
  const seen = new Set();
  for (const f of all) {
    if (f.kind !== KEYNAV) continue;
    for (const detail of declaredKeys(f, model.config?.own, world.platform).problems) out.push({ source: "keynav", detail });
    if (f.v !== KEYNAV_V && !seen.has(f.key)) {
      seen.add(f.key);
      out.push({ source: "keynav", detail: `${f.mod} speaks keynav v${f.v}: whistle still drives it, but update its keynav.js to v${KEYNAV_V}` });
    }
  }
  const v1 = world.shared?.["keynav.fields"] ?? {};
  for (const b of modBlocks(world.layout)) {
    if (seen.has(b.key) || v1[b.key]?.v !== 1 || all.some((f) => f.key === b.key)) continue;
    seen.add(b.key);
    out.push({ source: "keynav", detail: `${b.mod} speaks keynav v1, which whistle no longer drives; update its keynav.js` });
  }
  return JSON.stringify(out) === JSON.stringify(model.fieldProblems ?? []) ? model : { ...model, fieldProblems: out };
}

// A key pressed in WHISTLE: a flash lasts until the next key.
function key(model, world, name) {
  const ready = fieldsChecked(configured(model, world), world);
  const field = fieldAt(world.layout, ready.field, ready.recent, world.shared);
  const declared = field?.kind === KEYNAV ? declaredKeys(field, ready.config.own, world.platform).keys : null;
  const { sequence, act } = resolve(ready.config, ready.sequence, name, declared);
  const m = { ...ready, sequence, flash: act?.flash ?? null, flashUntil: 0 };
  if (!act) return { model: m, effects: [], handled: false };
  if (act.declared !== undefined) return toField(m, world, field, `key-${act.declared}`);
  if (act.run) return runMapping(m, world, act.run);
  if (act.own) return ownKey(m, world, act.own);
  return { model: m, effects: [], handled: true };
}

// A write's outcome: whistle.json's flashes if it failed; keys.json's goes to the claims.
function wrote(model, world, input) {
  if (input.wrote === USER) return input.ok ? { model, effects: [] }
    : { model: { ...model, flash: `couldn't write whistle.json: ${input.error ?? "unknown error"}` }, effects: [] };
  return claimWrote(model, world, input);
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
// request made since it was selected (fields.js requestOf reads either version's shape):
// "terminal" (it focused one: whistle selects the terminal on that pane) or "hold" (it moved
// the keyboard: whistle takes it back). Either way the bar holds the keyboard for HOLD_MS;
// modeTick takes it back.
function requests(model, world) {
  if (model.mode !== "whistle" || !world.shared) return model;
  const f = fieldAt(world.layout, model.field, model.recent, world.shared);
  if (f?.kind !== KEYNAV) return model;
  const r = world.shared[requestKey(f.key)];
  const asks = requestOf(f, r);
  if (!asks || !(r.at > (model.requestAt ?? 0))) return model;
  const m = { ...model, requestAt: r.at, holdUntil: world.now + HOLD_MS };
  return asks === AFTER_TERMINAL && terminal(world.layout, m.recent) ? onTerminalPane(m, world) : m;
}

// whistle.focus waiting for the block it showed: selected once it shows, given up at the deadline.
function waitTick(model, world) {
  const w = model.waitFor;
  if (!w) return model;
  if (model.mode !== "whistle" || world.now > w.until) return { ...model, waitFor: null };
  const m = select(model, world, w.block);
  return m ? { ...m, waitFor: null } : model;
}

// A flash with an end (a jump key's in TYPE, which no key press ends): gone once it's over.
function flashTick(model, world) {
  return model.flashUntil && world.now >= model.flashUntil ? { ...model, flash: null, flashUntil: 0 } : model;
}

function tick(model, world) {
  const moded = modeTick(waitTick(fieldsChecked(requests(stillThere(flashTick(configured(model, world), world), world), world), world), world), world);
  const claimed = claimsTick(moded.model, world);
  return { model: claimed.model, effects: [...moded.effects, ...claimed.effects, ...spotTick(claimed.model, world)] };
}

// The bar in the spot whistle.json picks (block.js checked it exists): that spot shown, the
// layout's other spots hidden.
function spotTick(model, world) {
  const want = model.config?.bar;
  if (!want) return [];
  const effects = [];
  for (const s of spots(world.layout, folderOf(world))) {
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

// A jump key's command ("<verb>:<block>", ADR 0014) as Herdr hands it over.
function isJump(c) {
  if (typeof c !== "string") return false;
  const { verb, block } = verbAndBlock(c);
  return block !== null && JUMP_VERBS.includes(verb);
}

// Inert or switched off: no WHISTLE, and the switch key and jump keys type through into the
// focused terminal; every key and command goes on.
function standAside(model, input, world) {
  if (model.mode === "whistle") return { ...type(model, world), handled: false };
  const m = { ...model, mode: "type", holdUntil: 0 };
  if (input.command === "whistle" || isJump(input.command)) return typeThrough(m, world, input.command);
  return { model: m, effects: [], handled: false };
}

// The key bound to <folder>.<command> typed through into the focused terminal, as if whistle
// weren't there: Herdr hands a copy the lines named after its folder (whistle-2.whistle).
function typeThrough(model, world, command) {
  const k = boundKey(world, `${folderOf(world)}.${command}`), t = world.focused?.terminal;
  return { model, effects: k && t ? [{ typeKey: k, terminal: t }] : [] };
}

// On each tick, whatever the mode: this copy announces itself in whistle.copies, and hides its
// bars while it stands aside for another copy (showing again those it hid once it doesn't).
function copiesTick(out, world, why) {
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
  // What the views were last sent (model.sent) is read after every step below: a model from
  // before it was kept gets it here, once.
  const m = model.sent ? model : { ...model, sent: start().sent };
  return sizeSent(routed(m, input, world), world);
}

function routed(model, input, world) {
  // A bar's copy in a layout with an anchor only draws (ADR 0018): Herdr hands it every command
  // and claimed key the anchor gets, so it acts on none of them.
  if (viewing(world.layout, folderOf(world), world.props)) return { model, effects: [], handled: false };
  const why = inert(world);
  if (why) return barSent(hintsClosed(stepped(model, input, world, why)), world);
  if (resting(world.layout, folderOf(world), world.props, model.hid)) return rest(hintsClosed({ model, effects: [] }), input, world);
  return publish(viewsSent(stepped(model, input, world, why), world), world);
}

// A hidden bar copy rests while another spot's copy runs: in TYPE, it claims, publishes and
// moves nothing (its hints window closed), and lets every key and command go on. A write it
// made still reports back. It forgets what it published and shared, as the running copy writes
// them meanwhile: shown again, it sets them anew.
function rest(closed, input, world) {
  const out = "wrote" in input ? wrote(closed.model, world, input) : { model: closed.model, effects: [] };
  const m = out.model;
  const quiet = m.mode === "type" && m.published === null && m.sent.hints === null && m.sent.settings === null;
  const model = quiet ? m : { ...m, mode: "type", holdUntil: 0, sequence: null, published: null, sent: { ...start().sent, size: m.sent.size, leftOpen: false } };
  return { model, effects: [...closed.effects, ...out.effects], handled: false };
}

function stepped(model, input, world, why) {
  // A write's outcome counts whether or not whistle is inert now.
  if ("wrote" in input) return wrote(model, world, input);
  // A command that failed when pressed only flashes.
  if ("ran" in input) return { model: { ...model, flash: `${input.ran} failed: ${input.error ?? "unknown error"}` }, effects: [] };
  const out = why ? standAside(model, input, world) : active(model, input, world);
  return input.tick ? copiesTick(out, world, why) : out;
}

// The private shared keys the views' models go in (ADR 0010): the hints window and the
// settings dialog, whistle's own overlay copies, draw them. The bar draws its folder's key
// (barKey): an inert copy sets its own, so it never overwrites the running copy's.
export const VIEWS = { hints: "whistle.hints", settings: "whistle.settings" };
export const barKey = (folder) => `whistle.bar:${folder}`;
// The private shared key a bar's copy publishes its drawn size in, by its spot (block.js
// spotName), for the copy that docks the hints box on it (the anchor's).
export const barSizeKey = (folder, props) => `whistle.barsize:${folder}:${spotName(props)}`;
// The hints window's overlay name.
const HINTS_OVERLAY = "hints";

// After a step: the views' models set in their shared keys when they change, and the hints
// window opened, moved or closed to match the hints (docked on the bar: views.js hintsBox).
function viewsSent(out, world) {
  const barred = barSent(out, world);
  const m = barred.model, sent = m.sent, effects = [...barred.effects];
  const h = hints(m, world), s = settings(m, world), hs = JSON.stringify(h), ss = JSON.stringify(s);
  if (hs !== sent.hints) effects.push({ setShared: VIEWS.hints, value: h });
  if (ss !== sent.settings) effects.push({ setShared: VIEWS.settings, value: s });
  let box = null;
  if (h) {
    const d = dock(world.layout, folderOf(world), m.config?.bar);
    const b = hintsBox(h.items, world, d.spot && { place: d.shown ? m.config?.place ?? {} : placeOf(d.spot.props), size: sizeOf(d.spot, world) });
    const spec = { mod: folderOf(world), kind: "window", frame: "none", width: b.width, height: b.height,
      ...(b.at ? { at: b.at } : {}), props: { part: "hints", width: b.width } };
    box = JSON.stringify(spec);
    if (box !== sent.box) effects.push({ openOverlay: HINTS_OVERLAY, spec });
  } else if (sent.box || sent.leftOpen) effects.push({ closeOverlay: HINTS_OVERLAY });
  if (hs === sent.hints && ss === sent.settings && box === sent.box && !sent.leftOpen) return barred;
  return { ...barred, model: { ...m, sent: { ...sent, hints: hs, settings: ss, box, leftOpen: false } }, effects };
}

// A bar's drawn size: this copy's own, measured, unless it is the anchor (which draws no bar),
// else the size the spot's copy last published.
const sizeOf = (spot, world) => (!isAnchor(world.props) && world.barSize) || world.barSizes?.[spotName(spot.props)] || null;

// After every step of a bar's copy (whatever it does: running, resting, inert or only
// drawing): its measured size published in its spot's key when it changes.
function sizeSent(out, world) {
  if (!world.barSize || isAnchor(world.props)) return out;
  const sent = out.model.sent, size = JSON.stringify(world.barSize);
  if (size === sent.size) return out;
  return { ...out, model: { ...out.model, sent: { ...sent, size } },
    effects: [...out.effects, { setShared: barSizeKey(folderOf(world), world.props), value: world.barSize }] };
}

// After a step: the bar's model (barModel()) set in this folder's bar key when it changes.
function barSent(out, world) {
  const sent = out.model.sent;
  const b = barModel(out.model, world), bs = JSON.stringify(b);
  if (bs === sent.bar) return out;
  return { ...out, model: { ...out.model, sent: { ...sent, bar: bs } }, effects: [...out.effects, { setShared: barKey(folderOf(world)), value: b }] };
}

// An inert copy sets no shared keys but its bar's model (barSent); it closes its hints window, if open.
function hintsClosed(out) {
  const sent = out.model.sent;
  if (!sent.box && !sent.leftOpen) return out;
  return { ...out, model: { ...out.model, sent: { ...sent, box: null, leftOpen: false } }, effects: [...out.effects, { closeOverlay: HINTS_OVERLAY }] };
}

// The shared key the whistle state goes in (docs/contracts/state.md).
export const STATE = "whistle";

// The whistle state (ADR 0010): { v: 1, mode, enabled, sequence: null | { keys, group },
// pane, onTerminal }. mode is "type" while WHISTLE is switched off; group is the name of the
// group the sequence has reached; onTerminal says the terminal is the selected field in
// WHISTLE (ADR 0016: keynav's active can't say it).
export function state(model, world) {
  const enabled = model.enabled !== false;
  const keys = model.sequence ?? null;
  const group = keys?.length ? groupAt(model.config?.map, keys) : null;
  const mode = enabled && model.mode === "whistle" ? "whistle" : "type";
  return {
    v: 1, mode, enabled,
    sequence: keys && keys.length ? { keys: [...keys], group: group?.name ?? null } : null,
    pane: model.pane ?? null,
    onTerminal: mode === "whistle" && onTerminal(model, world),
  };
}

// The state published after a step, when it changed (and only then).
function publish(out, world) {
  const value = state(out.model, world);
  const sig = JSON.stringify(value);
  if (out.model.published === sig) return out;
  return { ...out, model: { ...out.model, published: sig }, effects: [...out.effects, { setShared: STATE, value }] };
}

// A step while whistle runs, then keynav told which field is selected.
function active(model, input, world) {
  return publishKeynav(running(model, input, world), world);
}

// shared("keynav") = { v: 3, active }: the selected keynav field's key while in WHISTLE, else
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
  if ("command" in input && model.flash) model = { ...model, flash: null, flashUntil: 0 };
  model = configured(model, world);
  const none = { model, effects: [] };
  if (["on", "off", "settings"].includes(input.command)) return command(model, world, input.command);
  // Switched off: standing aside, but still keeping its claims and the bar in its spot.
  if (model.enabled === false) {
    if (input.tick && model.mode !== "whistle") {
      const claimed = claimsTick(model, world);
      return { ...claimed, effects: [...claimed.effects, ...spotTick(claimed.model, world)] };
    }
    return standAside(model, input, world);
  }
  const pressed = (name) => (model.mode === "whistle" && name ? key(model, world, name) : { ...none, handled: false });
  if (input.command === "whistle" || input.command === "type") return command(model, world, input.command);
  if (isJump(input.command)) return jump(model, world, input.command);
  if (typeof input.command === "string" && input.command.startsWith("key-"))
    return pressed(canonicalKey(input.command.slice(4), world.platform));
  if ("key" in input) return pressed(input.key);
  if (input.tick) return tick(model, world);
  return none;
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

// The bar's model as the core sets it in this folder's bar key (barSent): { badge: "TYPE" |
// "WHISTLE" | null (inert, switched off), marker: "⚠ <count>" while there are config problems |
// null, problem: why whistle is inert, if it is, and either label: what the core decides the
// bar says (a flash, "Whistle off") or where: what the bar works out where the keyboard is from
// ({ mode, field, recent, pane }: drawnBar), so it follows focus and titles with no step between }.
function barModel(model, world) {
  const why = inert(world);
  if (why) return { badge: null, label: "", marker: null, problem: why.problem };
  const n = problems(model).length;
  const marker = n ? `⚠ ${n}` : null;
  if (model.enabled === false) return { badge: null, label: model.flash ?? "Whistle off", marker };
  const badge = model.mode === "whistle" ? "WHISTLE" : "TYPE";
  if (model.flash) return { badge, label: model.flash, marker };
  return { badge, marker, where: { mode: model.mode, field: model.field ?? null, recent: model.recent ?? [], pane: model.pane ?? null } };
}

// The bar as it draws, from its shared model (barModel; null: not set yet, drawn empty) and the
// world it draws in: { badge, label, marker, problem? }.
export function drawnBar(vm, world) {
  if (!vm) return { badge: null, label: "", marker: null };
  if (!vm.where) return vm;
  const { where: at, ...rest } = vm;
  return { ...rest, label: where(at, world) };
}

// The bar's view model, as it draws in this world: drawnBar of barModel.
export const bar = (model, world) => drawnBar(barModel(model, world), world);
