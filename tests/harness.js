// The test harness: suites, the step scenario runner and the spec-example fixture reader.
// Pure, like the core it tests. tests/run.sh copies it next to the core's modules.
//
// A suite file exports `suite(name, (t) => { ... })`; the test mod (main.js) imports the suite
// under check through the generated suites.js and throws one Error listing every failure, grouped by suite.
//
// A scenario is data:
//   {
//     name: "Ctrl+Space in TYPE enters WHISTLE",
//     world: { layout, focused, panes, anchorFocused, now },   // over DEFAULT_WORLD
//     model: { ... },                                       // optional, over start()
//     steps: [
//       // One input each: { command: "switch-mode" }, { key: "ctrl-l" }, { tick: 120 } (the
//       // clock moves on by 120 ms, then a tick), { wrote: path, ok, error } (a write's
//       // outcome) or { ran: command, error } (a run that failed). `world` first changes the
//       // world (shallow, before the input).
//       { world: { anchorFocused: true }, command: "switch-mode",
//         // What it should produce; each is checked only when given:
//         effects: [{ focusAnchor: true }],   // exactly these effects, in order, apart
//                                          // from whistle state (`published` checks it),
//                                          // the public keys whistle.hints, .events, .config
//                                          // (`shared` checks them) and
//                                          // notifications (`notified` checks them)
//         published: { v: 1, mode: "whistle", ... },  // the whistle state published
//                                          // (shared("whistle")), or null: none
//         state: { mode: "whistle" },      // these fields of the whistle state as it is
//                                          // now, published in this step or before
//         shared: { "whistle.hints": null }, // what these shared keys were set to
//                                          // in this step; a key given as undefined: not set
//         unset: ["whistle.hints"],        // these shared keys weren't set in this step
//                                          // (`shared` with undefined, as JSON can say it)
//         raised: [{ kind: "unmapped" }],  // exactly these events raised in this step, in
//                                          // order, each checked on the fields given
//         notified: [{ title, body, level }],  // exactly these Herdr notifications posted
//         model: { mode: "whistle" },      // these model fields (deep equal per field)
//         hints: { title: "Panes" },       // these fields of the hint items (whistle.hints
//                                          // without its v; null: none)
//         config: { conflicts: [] },       // these fields of whistle.config, without its v
//         problems: 1,                     // how many config problems whistle.config lists
//         handled: true },                 // whether a key was handled
//     ],
//
// Whatever a scenario checks, a step that sets a private shared key of whistle's (any
// "whistle.<name>" but the public keys, whistle.copies and whistle.subscribers) or opens or closes an overlay fails:
// whistle draws nothing and keeps no view state (ADR 0006).
//   }

import { VERSION, MIN_HERDR } from "./version.js";
import * as facts from "./facts.js";

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
  now: 0, layout: null, focused: null, panes: [], anchorFocused: false, keys: [],
  herdr: MIN_HERDR, folder: "whistle", copies: { whistle: VERSION },
  configFiles: { defaults: JSON.stringify(TEST_DEFAULTS), user: null }, commands: null,
};

// JSON with object keys sorted, so two values compare equal whatever order their fields were
// made in.
export const show = (v) => JSON.stringify(v, (_k, x) => (x && typeof x === "object" && !Array.isArray(x)
  ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, x[k]])) : x));

// The shared key whistle state is published under (docs/contracts/state.md) and the public
// keys beside it (step.js PUBLIC): set on most steps, so `effects` leaves them out.
const STATE = "whistle";
const PUBLIC_KEYS = ["whistle.hints", "whistle.events", "whistle.config"];
// The shared keys whistle may set: the public ones, whistle.copies (inert.js),
// whistle.subscribers (step.js SUBSCRIBERS) and keynav's.
const ALLOWED = [STATE, ...PUBLIC_KEYS, "whistle.copies", "whistle.subscribers"];
const isPrivate = (e) => typeof e?.setShared === "string" && e.setShared.startsWith("whistle.") && !ALLOWED.includes(e.setShared);
const isOverlay = (e) => Boolean(e) && ("openOverlay" in e || "closeOverlay" in e);

// Whether an object has the fields want gives (deep equal per field).
const fieldsMatch = (got, want) => Boolean(got) && Object.entries(want).every(([k, v]) => show(got[k]) === show(v));

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

// Runs one scenario through core ({ start, step, state }), with the public values from facts.js:
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
      const isPublic = (e) => PUBLIC_KEYS.includes(e?.setShared);
      const isNotify = (e) => Boolean(e) && "notify" in e;
      for (const e of out.effects.filter((x) => isPrivate(x) || isOverlay(x)))
        fails.push(`${at}: whistle set a private key or an overlay: ${show(e)}`);
      const effects = out.effects.filter((e) => !isState(e) && !isPublic(e) && !isNotify(e));
      if ("notified" in s && show(out.effects.filter(isNotify).map((e) => e.notify)) !== show(s.notified))
        fails.push(`${at}: notified ${show(out.effects.filter(isNotify).map((e) => e.notify))}, want ${show(s.notified)}`);
      if ("effects" in s && show(effects) !== show(s.effects))
        fails.push(`${at}: effects ${show(effects)}, want ${show(s.effects)}`);
      if ("published" in s) {
        const got = out.effects.filter(isState).map((e) => e.value);
        const want = s.published === null ? [] : [s.published];
        if (show(got) !== show(want)) fails.push(`${at}: published ${show(got)}, want ${show(want)}`);
      }
      if (s.state) {
        const st = core.state(out.model, world);
        for (const [k, want] of Object.entries(s.state))
          if (show(st[k]) !== show(want)) fails.push(`${at}: state.${k} ${show(st[k])}, want ${show(want)}`);
      }
      const wants = { ...s.shared, ...Object.fromEntries((s.unset ?? []).map((k) => [k, undefined])) };
      for (const [k, want] of Object.entries(wants)) {
        const set = out.effects.filter((e) => e?.setShared === k);
        const got = set.length ? set.at(-1).value : undefined;
        if (set.length > 1 || show(got) !== show(want)) fails.push(`${at}: shared ${k} set to ${show(set.map((e) => e.value))}, want ${want === undefined ? "not set" : show(want)}`);
      }
      if ("raised" in s) {
        const got = (out.model.events ?? []).filter((e) => e.seq > (model.eventSeq ?? 0));
        if (got.length !== s.raised.length || !s.raised.every((w, j) => fieldsMatch(got[j], w)))
          fails.push(`${at}: raised ${show(got)}, want ${show(s.raised)}`);
      }
      for (const [k, want] of Object.entries(s.model ?? {}))
        if (show(out.model[k]) !== show(want)) fails.push(`${at}: model.${k} ${show(out.model[k])}, want ${show(want)}`);
      if ("hints" in s) {
        const vm = facts.hints(out.model, world);
        if (s.hints === null || vm === null) {
          if (show(vm) !== show(s.hints)) fails.push(`${at}: hints ${show(vm)}, want ${show(s.hints)}`);
        } else for (const [k, want] of Object.entries(s.hints))
          if (show(vm[k]) !== show(want)) fails.push(`${at}: hints.${k} ${show(vm[k])}, want ${show(want)}`);
      }
      if (s.config) {
        const c = facts.config(out.model, world);
        for (const [k, want] of Object.entries(s.config))
          if (show(c[k]) !== show(want)) fails.push(`${at}: config.${k} ${show(c[k])}, want ${show(want)}`);
      }
      if ("problems" in s && facts.config(out.model, world).problems.length !== s.problems)
        fails.push(`${at}: problems ${show(facts.config(out.model, world).problems)}, want ${s.problems} of them`);
      if ("handled" in s && Boolean(out.handled) !== s.handled)
        fails.push(`${at}: handled ${Boolean(out.handled)}, want ${s.handled}`);
      model = out.model;
    } catch (e) {
      fails.push(`${at}: threw ${e?.message ?? e}`);
    }
  });
  return fails;
}

// The fenced blocks of a Markdown text whose info string is `json <tag> <name>`: [{ name, body }].
// A fence is 3 or more backticks, closed by the same run.
export function examplesIn(text, tag) {
  const re = new RegExp(`^(\`{3,})[ \\t]*json[ \\t]+${tag}[ \\t]+([^\\n\`]*?)[ \\t]*\\n([\\s\\S]*?)^\\1[ \\t]*$`, "gm");
  return [...String(text).replace(/\r\n/g, "\n").matchAll(re)].map((m) => ({ name: m[2], body: m[3] }));
}

// The tagged example blocks of a Markdown text (`json example <name>`), each holding one
// scenario as JSON (its name is the tag's). A block that doesn't parse comes back with `error`
// instead of `scenario`.
export function examples(text) {
  return examplesIn(text, "example").map(({ name, body }) => {
    try { return { name, scenario: { ...JSON.parse(body), name } }; }
    catch (e) { return { name, error: String(e?.message ?? e) }; }
  });
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
