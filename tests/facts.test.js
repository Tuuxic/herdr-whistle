// The facts whistle publishes beside its state (ADR 0006, facts.js): the hint items
// (whistle.hints) list the choices of the current key sequence; the config (whistle.config)
// lists config problems, mapping conflicts and labelled overrides, and the mods whose mappings
// can be switched off (issue #7, issue #10). Clients show them; whistle draws nothing.

import { suite, TEST_DEFAULTS } from "./harness.js";
import * as core from "./step.js";
import { switchMod, keepMapping } from "./config.js";
import { term, anchor } from "./worlds.js";

const json = (v) => JSON.stringify(v);
const pretty = (v) => `${JSON.stringify(v, null, 2)}
`;
const IN = [{ command: "switch-mode" }, { world: { anchorFocused: true }, tick: 120 }];
const block = (mod) => ({ id: mod, type: "block", content: { mod } });
const entry = (map) => ({ v: 1, map });
// A world in a terminal: the mods shown, their entries, the defaults' map, the layout's whistle
// block props, whistle.json.
const world = ({ map = {}, keys = TEST_DEFAULTS.keys, user, mods = [], entries = {}, props } = {}) => ({
  layout: { id: "root", type: "column", children: [term("main"), ...mods.map(block), props ? { ...anchor, content: { mod: "whistle", props } } : anchor] },
  focused: { pane: "p1", terminal: "t1" }, panes: [{ pane: "p1", title: "zsh" }], modMappings: entries,
  configFiles: { defaults: json({ keys, map }), user: user === undefined ? null : json(user) },
});
const PANES = { w: { name: "Panes", map: {
  v: ["Split right", "pane.split", { direction: "right" }],
  m: { name: "Move", map: { h: ["Move left", "pane.move"] } },
} } };

const SCENARIOS = [
  {
    name: "Whistle opens no hints window and sets no private key: a group's first key only publishes whistle.hints",
    world: { ...world({ map: PANES }), viewport: { width: 1000, height: 600 } },
    steps: [...IN, { key: "w", effects: [], shared: { "whistle.hints": { v: 1, keys: "w", title: "Panes", exit: null, items: [
      { key: "v", label: "Split right", group: false }, { key: "m", label: "Move", group: true }] } } },
    { key: "escape", effects: [], shared: { "whistle.hints": null } }],
  },
  {
    name: "Hints list the choices of the current key sequence",
    world: world({ map: PANES }),
    steps: [...IN, { key: "w", hints: { keys: "w", title: "Panes", exit: null, items: [
      { key: "v", label: "Split right", group: false },
      { key: "m", label: "Move", group: true },
    ] } }],
  },
  {
    name: "Hints name the key that cancels the sequence, if one does",
    world: world({ map: PANES, keys: { ...TEST_DEFAULTS.keys, cancel: ["escape", "ctrl-g"] } }),
    steps: [...IN, { key: "w", hints: { exit: "Esc cancels" } }],
  },
  {
    // Switching the hints off is a client's prop (whistle-ui's `hints`), never whistle's.
    name: "whistle.json's hints is a key whistle doesn't know: the hint items are published all the same",
    world: world({ map: PANES, user: { hints: false } }),
    steps: [...IN, { key: "w", hints: { keys: "w", title: "Panes" } }],
  },
  {
    name: "No hints outside a key sequence, nor once it ends",
    world: world({ map: { ...PANES, n: ["Next tab", "tab.next"] } }),
    steps: [...IN, { key: "n", hints: null }, { key: "w" }, { key: "v", hints: null }],
  },
  {
    name: "Hints follow the sequence into a nested group",
    world: world({ map: PANES }),
    steps: [...IN, { key: "w" }, { key: "m", hints: { keys: "w m", title: "Move", items: [{ key: "h", label: "Move left", group: false }] } }],
  },

  // whistle.config.
  {
    name: "Config lists each config problem with its file",
    world: world({ map: { n: ["Next tab", 42] }, user: { keys: { jump: ["x"] } } }),
    steps: [{ tick: 120, config: { problems: [
      { source: "mappings.json", detail: "map › n: should be [label, command] or a group { name, map }" },
      { source: "whistle.json", detail: "keys › jump: unknown action" },
    ] } }],
  },
  {
    name: "Config lists keys.json's problem with the config's",
    world: world(),
    model: { claimProblem: "keys.json has an error (keys.error); whistle left it alone" },
    steps: [{ tick: 120, config: { problems: [
      { source: "keys.json", detail: "keys.json has an error (keys.error); whistle left it alone" },
    ] } }],
  },
  {
    name: "Config lists a mapping conflict between two mods with its key sequence and its mods",
    world: world({ mods: ["alpha", "beta"], entries: {
      alpha: entry({ g: { name: "Alpha", map: { d: ["D", "alpha.d"] } } }),
      beta: entry({ g: { name: "Beta", map: { d: ["D", "beta.d"] } } }),
    } }),
    steps: [{ tick: 120, config: { conflicts: [
      { keys: "g d", seq: ["g", "d"], mods: ["alpha", "beta"], own: null, text: "alpha and beta both want g d",
        keep: [{ mod: "alpha", value: ["D", "alpha.d"] }, { mod: "beta", value: ["D", "beta.d"] }] },
    ] } }],
  },
  {
    name: "Config lists a mod on an own key with the own key's action",
    world: world({ mods: ["alpha"], entries: { alpha: entry({ "ctrl-h": ["Left", "alpha.left"] }) } }),
    steps: [{ tick: 120, config: { conflicts: [
      { keys: "Ctrl+H", seq: ["ctrl-h"], mods: ["alpha"], own: "Field to the left",
        text: "alpha wants Ctrl+H, whistle's own key for Field to the left", keep: [{ mod: "alpha", value: ["Left", "alpha.left"] }] },
    ] } }],
  },
  {
    name: "Config labels an override by you over a mod's key",
    world: world({ mods: ["alpha"], entries: { alpha: entry({ g: ["Go", "alpha.go"] }) }, user: { map: { g: ["Next tab", "tab.next"] } } }),
    steps: [{ tick: 120, config: { conflicts: [], overrides: [
      { keys: "g", seq: ["g"], by: "whistle.json", over: ["alpha"], text: "g: you, over alpha" },
    ] } }],
  },
  {
    name: "Config labels an override by the layout over a conflict",
    world: world({ mods: ["alpha", "beta"], props: { mappings: { g: ["Previous tab", "tab.prev"] } },
      entries: { alpha: entry({ g: ["Go", "alpha.go"] }), beta: entry({ g: ["Go", "beta.go"] }) } }),
    steps: [{ tick: 120, config: { conflicts: [], overrides: [
      { keys: "g", seq: ["g"], by: "layout", over: ["alpha", "beta"], text: "g: the layout, over alpha and beta" },
    ] } }],
  },
  {
    name: "Config lists the layout's mods that offer mappings, each on or off",
    world: world({ mods: ["alpha", "beta", "gamma"], user: { mods: { alpha: false } },
      entries: { alpha: entry({ g: ["Go", "alpha.go"] }), beta: entry({ b: ["B", "beta.b"] }), delta: entry({ d: ["D", "delta.d"] }) } }),
    steps: [{ tick: 120, config: { mods: [{ name: "alpha", on: false, problems: [] }, { name: "beta", on: true, problems: [] }] } }],
  },
  {
    name: "A mod's problems are listed under it in config, not among the config problems",
    world: world({ mods: ["alpha"], entries: { alpha: { v: 2, map: {} } } }),
    steps: [{ tick: 120, problems: 0,
      config: { problems: [], mods: [{ name: "alpha", on: true, problems: ["its entry is v 2; whistle reads v 1"] }] } }],
  },
];

// Switching a mod off (whistle.mappings-off writes whistle.json through config.js's switchMod),
// and whistle picks the new text up on its next read (ADR 0004).
const MINE = { map: { n: ["Next tab", "tab.next"] } };
const switched = switchMod(json(MINE), "alpha", false);
const CONFLICT = { mods: ["alpha", "beta"], entries: { alpha: entry({ g: ["Go", "alpha.go"] }), beta: entry({ g: ["Go", "beta.go"] }) } };
SCENARIOS.push({
  name: "A mod switched off in whistle.json is off in config, and its conflict is gone",
  world: world({ ...CONFLICT, user: MINE }),
  steps: [...IN, { key: "g", effects: [], handled: false },
    { world: { configFiles: { defaults: json({ keys: TEST_DEFAULTS.keys, map: {} }), user: switched.text } }, tick: 120,
      config: { conflicts: [], mods: [{ name: "alpha", on: false, problems: [] }, { name: "beta", on: true, problems: [] }] } },
    { key: "g", effects: [{ run: "beta.go", args: {} }, { focusAnchor: true }] }],
});
// Keeping one mod's mapping (whistle.keep-mapping): written into whistle.json, where it settles
// the conflict as an override of yours.
const kept = keepMapping(json(MINE), ["g"], ["Go", "alpha.go"]);
SCENARIOS.push({
  name: "A mod's mapping kept in whistle.json settles the conflict as an override",
  world: world({ ...CONFLICT, user: MINE }),
  steps: [...IN,
    { world: { configFiles: { defaults: json({ keys: TEST_DEFAULTS.keys, map: {} }), user: kept.text } }, tick: 120,
      config: { conflicts: [], overrides: [{ keys: "g", seq: ["g"], by: "whistle.json", over: ["alpha", "beta"], text: "g: you, over alpha and beta" }] } },
    { key: "g", effects: [{ run: "alpha.go", args: {} }, { focusAnchor: true }] }],
});

export default suite("facts", (t) => {
  for (const sc of SCENARIOS) t.scenario(sc, core);

  t.check("Switching a mod off adds it to whistle.json's mods, keeping the rest",
    switched, { text: pretty({ ...MINE, mods: { alpha: false } }) });
  t.check("Switching a mod back on writes it as on", switchMod(json({ mods: { alpha: false, beta: false } }), "alpha", true),
    { text: pretty({ mods: { alpha: true, beta: false } }) });
  t.check("With no whistle.json, switching a mod off starts one", switchMod(null, "alpha", false), { text: pretty({ mods: { alpha: false } }) });
  t.check("Keeping a mod's mapping adds it to whistle.json's map", kept, { text: pretty({ map: { ...MINE.map, g: ["Go", "alpha.go"] } }) });
  t.check("A mapping kept inside a group goes in a group of whistle.json's, beside its keys",
    keepMapping(json({ map: { g: { name: "Go", map: { x: ["X", "tab.next"] } } } }), ["g", "d"], ["D", "alpha.d"]),
    { text: pretty({ map: { g: { name: "Go", map: { x: ["X", "tab.next"], d: ["D", "alpha.d"] } } } }) });
  t.check("A mapping kept inside a group whistle.json doesn't have starts the group",
    keepMapping(null, ["g", "d"], ["D", "alpha.d"]), { text: pretty({ map: { g: { map: { d: ["D", "alpha.d"] } } } }) });
  t.check("A whistle.json that doesn't parse isn't written", switchMod("{ nope", "alpha", false),
    { problem: "whistle.json doesn't parse: fix it first" });
  t.check("A whistle.json whose mods isn't an object isn't written", switchMod(json({ mods: [] }), "alpha", false),
    { problem: "whistle.json's mods isn't an object: fix it first" });
});
