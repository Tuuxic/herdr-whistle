// The test harness: suites, the step scenario runner and the spec-example fixture reader.
// Pure, like the core it tests. tests/run.sh copies it next to the core's modules.
//
// A suite file exports `suite(name, (t) => { ... })`; the test mod (main.js) imports the suite
// under check through the generated suites.js and throws one Error listing every failure, grouped by suite.
//
// A scenario is data:
//   {
//     name: "Ctrl+Space in TYPE enters WHISTLE",
//     world: { layout, focused, panes, barFocused, now },   // over DEFAULT_WORLD
//     model: { ... },                                       // optional, over start()
//     steps: [
//       // One input each: { command: "switch-mode" }, { key: "ctrl-l" }, { tick: 120 } (the
//       // clock moves on by 120 ms, then a tick), { wrote: path, ok, error } (a write's
//       // outcome) or { ran: command, error } (a run that failed). `world` first changes the
//       // world (shallow, before the input).
//       { world: { barFocused: true }, command: "switch-mode",
//         // What it should produce; each is checked only when given:
//         effects: [{ focusBar: true }],   // exactly these effects, in order, apart
//                                          // from whistle state (`published` checks it),
//                                          // the public keys whistle.hints, .events, .config,
//                                          // the views' models, the bar's included
//                                          // (`shared` checks them) and
//                                          // the hints window (`hintsWindow` checks it) and
//                                          // notifications (`notified` checks them)
//         published: { v: 1, mode: "whistle", ... },  // the whistle state published
//                                          // (shared("whistle")), or null: none
//         shared: { "whistle.hints": null }, // what these shared keys were set to
//                                          // in this step; a key given as undefined: not set
//         unset: ["whistle.hints"],        // these shared keys weren't set in this step
//                                          // (`shared` with undefined, as JSON can say it)
//         hintsWindow: [{ closeOverlay: "hints" }],  // exactly these hints window effects
//         notified: [{ title, body, level }],  // exactly these Herdr notifications posted
//         model: { mode: "whistle" },      // these model fields (deep equal per field)
//         bar: { badge: "WHISTLE" },       // these fields of the bar's view model
//         hints: { title: "Panes" },       // these fields of the hints' view model (null: none)
//         settings: { conflicts: [] },     // these fields of the settings' view model
//         handled: true },                 // whether a key was handled
//     ],
//   }

import { VERSION, MIN_HERDR } from "./version.js";
import * as views from "./views.js";

// The defaults scenarios run on (world.configFiles.defaults), unless they give their own: own
// keys only, so a scenario's mappings are the ones it writes. mappings.json's own text is in
// texts.js.
export const TEST_DEFAULTS = {
  keys: {
    "field-left": ["ctrl-h"], "field-down": ["ctrl-j"], "field-up": ["ctrl-k"], "field-right": ["ctrl-l"],
    left: ["h", "left"], down: ["j", "down"], up: ["k", "up"], right: ["l", "right"],
    pick: ["enter"], type: ["i"],
  },
  map: {},
};

// A world whistle runs in: the minimum Herdr, this copy in mods/whistle/ and announced, the
// test defaults and no whistle.json.
export const DEFAULT_WORLD = {
  now: 0, layout: null, focused: null, panes: [], barFocused: false, keys: [],
  herdr: MIN_HERDR, folder: "whistle", copies: { whistle: VERSION },
  configFiles: { defaults: JSON.stringify(TEST_DEFAULTS), user: null }, commands: null,
};

// JSON with object keys sorted, so two values compare equal whatever order their fields were
// made in.
export const show = (v) => JSON.stringify(v, (_k, x) => (x && typeof x === "object" && !Array.isArray(x)
  ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, x[k]])) : x));

// The shared key whistle state is published under (docs/contracts/state.md), the public keys
// beside it (step.js PUBLIC) and the private keys the views' models go in (step.js VIEWS): set
// on most steps, so `effects` leaves them out.
const STATE = "whistle";
const VIEW_KEYS = ["whistle.hints", "whistle.events", "whistle.config", "whistle.hintsbox", "whistle.settings"];
// The bar's model goes in a key per folder (step.js barKey), and so does the reason an inert
// whistle told (toldKey): `shared` checks them, `effects` leaves them out.
const isBarKey = (k) => typeof k === "string" && (k.startsWith("whistle.bar:") || k.startsWith("whistle.told:"));

const INPUTS = ["command", "key", "tick", "wrote", "ran"];

// The input a step gives step(), and the world it sees (the clock moved on for a tick).
function inputOf(s, world) {
  const kinds = INPUTS.filter((k) => k in s);
  if (kinds.length !== 1) throw new Error(`a step needs exactly one of ${INPUTS.join(", ")}, got ${show(s)}`);
  const kind = kinds[0];
  if (kind === "tick") return { input: { tick: true }, world: { ...world, now: world.now + s.tick } };
  if (kind === "wrote") return { input: { wrote: s.wrote, ok: s.ok !== false, error: s.error ?? null }, world };
  if (kind === "ran") return { input: { ran: s.ran, ok: false, error: s.error ?? null }, world };
  return { input: { [kind]: s[kind] }, world };
}

// Freezes v and everything in it that isn't frozen yet.
function freeze(v) {
  if (!v || typeof v !== "object" || Object.isFrozen(v)) return;
  Object.freeze(v);
  for (const x of Object.values(v)) freeze(x);
}

// Runs one scenario through core ({ start, step, bar }), with the views' models from views.js:
// its failures as lines.
export function runScenario(sc, core) {
  const fails = [];
  let world = { ...DEFAULT_WORLD, ...(sc.world ?? {}) };
  let model = { ...core.start(), ...(sc.model ?? {}) };
  (sc.steps ?? []).forEach((s, i) => {
    const at = `step ${i + 1} (${show(Object.fromEntries(INPUTS.filter((k) => k in s).map((k) => [k, s[k]])))})`;
    try {
      if (s.world) world = { ...world, ...s.world };
      const next = inputOf(s, world);
      world = next.world;
      // The model step is given is frozen, so changing it throws (modules are strict). Cheaper
      // than comparing it as JSON before and after: only objects not frozen yet are walked.
      freeze(model);
      let out;
      try { out = core.step(model, next.input, world); }
      catch (e) { if (e instanceof TypeError && /read-only|frozen|not extensible/i.test(String(e?.message))) { fails.push(`${at}: step changed the model it was given (${e.message})`); return; } throw e; }
      const isState = (e) => e?.setShared === STATE;
      const isView = (e) => VIEW_KEYS.includes(e?.setShared) || isBarKey(e?.setShared);
      const isWindow = (e) => e?.openOverlay === "hints" || e?.closeOverlay === "hints";
      const isNotify = (e) => e && "notify" in e;
      const effects = out.effects.filter((e) => !isState(e) && !isView(e) && !isWindow(e) && !isNotify(e));
      if ("notified" in s && show(out.effects.filter(isNotify).map((e) => e.notify)) !== show(s.notified))
        fails.push(`${at}: notified ${show(out.effects.filter(isNotify).map((e) => e.notify))}, want ${show(s.notified)}`);
      if ("hintsWindow" in s && show(out.effects.filter(isWindow)) !== show(s.hintsWindow))
        fails.push(`${at}: hintsWindow ${show(out.effects.filter(isWindow))}, want ${show(s.hintsWindow)}`);
      if ("effects" in s && show(effects) !== show(s.effects))
        fails.push(`${at}: effects ${show(effects)}, want ${show(s.effects)}`);
      if ("published" in s) {
        const pub = out.effects.filter(isState).map((e) => e.value);
        const got = pub;
        const want = s.published === null ? [] : [s.published];
        if (show(got) !== show(want)) fails.push(`${at}: published ${show(got)}, want ${show(want)}`);
      }
      const wants = { ...s.shared, ...Object.fromEntries((s.unset ?? []).map((k) => [k, undefined])) };
      for (const [k, want] of Object.entries(wants)) {
        const set = out.effects.filter((e) => e?.setShared === k);
        const got = set.length ? set.at(-1).value : undefined;
        if (set.length > 1 || show(got) !== show(want)) fails.push(`${at}: shared ${k} set to ${show(set.map((e) => e.value))}, want ${want === undefined ? "not set" : show(want)}`);
      }
      for (const [k, want] of Object.entries(s.model ?? {}))
        if (show(out.model[k]) !== show(want)) fails.push(`${at}: model.${k} ${show(out.model[k])}, want ${show(want)}`);
      if (s.bar) {
        const bar = core.bar(out.model, world);
        for (const [k, want] of Object.entries(s.bar))
          if (show(bar[k]) !== show(want)) fails.push(`${at}: bar.${k} ${show(bar[k])}, want ${show(want)}`);
      }
      for (const view of ["hints", "settings"]) {
        if (!(view in s)) continue;
        const vm = views[view](out.model, world);
        if (s[view] === null || vm === null) {
          if (show(vm) !== show(s[view])) fails.push(`${at}: ${view} ${show(vm)}, want ${show(s[view])}`);
          continue;
        }
        for (const [k, want] of Object.entries(s[view]))
          if (show(vm[k]) !== show(want)) fails.push(`${at}: ${view}.${k} ${show(vm[k])}, want ${show(want)}`);
      }
      if ("handled" in s && Boolean(out.handled) !== s.handled)
        fails.push(`${at}: handled ${Boolean(out.handled)}, want ${s.handled}`);
      model = out.model;
    } catch (e) {
      fails.push(`${at}: threw ${e?.message ?? e}`);
    }
  });
  return fails;
}

// The tagged example blocks of a Markdown text: fenced blocks whose info string is
// `json example <name>`, each holding one scenario as JSON (its name is the tag's). A block
// that doesn't parse comes back with `error` instead of `scenario`.
export function examples(text) {
  const out = [];
  text = String(text).replace(/\r\n/g, "\n");
  const re = /^(`{3,})[ \t]*json[ \t]+example[ \t]+([^\n`]*?)[ \t]*\n([\s\S]*?)^\1[ \t]*$/gm;
  for (const m of text.matchAll(re)) {
    const name = m[2];
    try { out.push({ name, scenario: { ...JSON.parse(m[3]), name } }); }
    catch (e) { out.push({ name, error: String(e?.message ?? e) }); }
  }
  return out;
}

// A suite: run(t) gets t.check(name, got, want), t.scenario(sc, core), t.fail(name, why).
export function suite(name, run) {
  const s = { name, fails: [], total: 0 };
  const t = {
    check(caseName, got, want) {
      s.total++;
      if (show(got) !== show(want)) s.fails.push(`${caseName}: got ${show(got)}, want ${show(want)}`);
    },
    scenario(sc, core) {
      s.total++;
      for (const f of runScenario(sc, core)) s.fails.push(`${sc.name}: ${f}`);
    },
    fail(caseName, why) { s.total++; s.fails.push(`${caseName}: ${why}`); },
  };
  try { run(t); } catch (e) { s.fails.push(`the suite threw: ${e?.message ?? e}`); }
  return s;
}
