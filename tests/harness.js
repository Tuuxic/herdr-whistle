// The test harness: suites, the step scenario runner and the spec-example fixture reader.
// Pure, like the core it tests. tests/run.sh copies it next to the core's modules.
//
// A suite file exports `suite(name, (t) => { ... })`; the test mod (main.js) imports every suite
// through the generated suites.js and throws one Error listing every failure, grouped by suite.
//
// A scenario is data:
//   {
//     name: "Ctrl+Space in TYPE enters WHISTLE",
//     world: { layout, focused, panes, barFocused, now },   // over DEFAULT_WORLD
//     model: { ... },                                       // optional, over start()
//     steps: [
//       // One input each: { command: "whistle" }, { key: "ctrl-l" }, { tick: 120 } (the
//       // clock moves on by 120 ms, then a tick), or { wrote: path, ok, error } (a write's
//       // outcome). `world` first changes the world (shallow, before the input).
//       { world: { barFocused: true }, command: "whistle",
//         // What it should produce; each is checked only when given:
//         effects: [{ focusBar: true }],   // exactly these effects, in order
//         model: { mode: "whistle" },      // these model fields (deep equal per field)
//         bar: { badge: "WHISTLE" },       // these fields of the bar's view model
//         handled: true },                 // whether a key was handled
//     ],
//   }

import { VERSION, MIN_HERDR } from "./version.js";

// A world whistle runs in: the minimum Herdr, this copy in mods/whistle/ and announced.
export const DEFAULT_WORLD = {
  now: 0, layout: null, focused: null, panes: [], barFocused: false, keys: [],
  herdr: MIN_HERDR, folder: "whistle", copies: { whistle: VERSION },
};

// JSON with object keys sorted, so two values compare equal whatever order their fields were
// made in.
export const show = (v) => JSON.stringify(v, (_k, x) => (x && typeof x === "object" && !Array.isArray(x)
  ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, x[k]])) : x));

const INPUTS = ["command", "key", "tick", "wrote"];

// The input a step gives step(), and the world it sees (the clock moved on for a tick).
function inputOf(s, world) {
  const kinds = INPUTS.filter((k) => k in s);
  if (kinds.length !== 1) throw new Error(`a step needs exactly one of ${INPUTS.join(", ")}, got ${show(s)}`);
  const kind = kinds[0];
  if (kind === "tick") return { input: { tick: true }, world: { ...world, now: world.now + s.tick } };
  if (kind === "wrote") return { input: { wrote: s.wrote, ok: s.ok !== false, error: s.error ?? null }, world };
  return { input: { [kind]: s[kind] }, world };
}

// Runs one scenario through core ({ start, step, bar }): its failures as lines.
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
      const before = show(model);
      const out = core.step(model, next.input, world);
      if (show(model) !== before) fails.push(`${at}: step changed the model it was given`);
      if ("effects" in s && show(out.effects) !== show(s.effects))
        fails.push(`${at}: effects ${show(out.effects)}, want ${show(s.effects)}`);
      for (const [k, want] of Object.entries(s.model ?? {}))
        if (show(out.model[k]) !== show(want)) fails.push(`${at}: model.${k} ${show(out.model[k])}, want ${show(want)}`);
      if (s.bar) {
        const bar = core.bar(out.model, world);
        for (const [k, want] of Object.entries(s.bar))
          if (show(bar[k]) !== show(want)) fails.push(`${at}: bar.${k} ${show(bar[k])}, want ${show(want)}`);
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
