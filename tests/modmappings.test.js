// Mod mappings (issue #6, ADR 0007) and mapping conflicts (issue #7, ADR 0008): mods offer
// add-only mappings in shared("whistle.mappings") under their name, as the layer between the
// defaults and the layout, counting only while the mod has a block in the shown layout. Two mods
// on one key, or a mod on an own key, count for neither until a higher layer maps the key or a
// mod is switched off.

import { suite, TEST_DEFAULTS, DEFAULT_WORLD } from "./harness.js";
import * as core from "./step.js";
import { term, bar } from "./worlds.js";

const json = (v) => JSON.stringify(v);
const pretty = (v) => `${JSON.stringify(v, null, 2)}\n`;
const block = (mod) => ({ id: mod, type: "block", content: { mod } });
// The usual layout with the named mods' blocks, in order, and whistle's block with props.
const layout = (mods = [], props) => ({ id: "root", type: "column", children: [
  term("main"), ...mods.map(block), props ? { ...bar, content: { mod: "whistle", props } } : bar,
] });
// A world in a terminal: the mods shown, their entries, the defaults' map, whistle.json.
const world = ({ mods = ["alpha", "beta"], entries = {}, map = {}, keys, props, user } = {}) => ({
  layout: layout(mods, props), focused: { pane: "p1", terminal: "t1" }, panes: [{ pane: "p1", title: "zsh" }],
  modMappings: entries,
  configFiles: { defaults: json({ keys: keys ?? TEST_DEFAULTS.keys, map }), user: user === undefined ? null : json(user) },
});
const entry = (map) => ({ v: 1, map });
const IN = [{ command: "whistle" }, { world: { barFocused: true }, tick: 120 }];
const ran = (command, args = {}) => [{ run: command, args }, { focusBar: true }];

const SCENARIOS = [
  {
    name: "A mod mapping counts while the mod is in the layout",
    world: world({ entries: { alpha: entry({ g: ["Go", "alpha.go"] }) } }),
    steps: [...IN, { key: "g", effects: ran("alpha.go"), handled: true }],
  },
  {
    name: "A mod mapping stops counting when the mod leaves the layout",
    world: world({ entries: { alpha: entry({ g: ["Go", "alpha.go"] }) } }),
    steps: [...IN, { world: { layout: layout(["beta"]) }, tick: 120 }, { key: "g", effects: [], handled: false }],
  },
  {
    name: "An entry left behind by a mod not in the layout doesn't count",
    world: world({ mods: ["beta"], entries: { alpha: entry({ g: ["Go", "alpha.go"] }) } }),
    steps: [...IN, { key: "g", effects: [], handled: false }],
  },
  {
    name: "A mod mapping goes over the defaults'",
    world: world({ map: { n: ["Next tab", "tab.next"] }, entries: { alpha: entry({ n: ["Next", "alpha.next"] }) } }),
    steps: [...IN, { key: "n", effects: ran("alpha.next") }],
  },

  // Conflicts.
  {
    name: "Two mods on one key count for neither: the key falls through to the defaults",
    world: world({ map: { g: ["Next tab", "tab.next"] },
      entries: { alpha: entry({ g: ["Go", "alpha.go"] }), beta: entry({ g: ["Go", "beta.go"] }) } }),
    steps: [...IN, { key: "g", effects: ran("tab.next") }],
  },
  {
    name: "Two mods on one key the defaults don't map: the key is unmapped",
    world: world({ entries: { alpha: entry({ g: ["Go", "alpha.go"] }), beta: entry({ g: ["Go", "beta.go"] }) } }),
    steps: [...IN, { key: "g", effects: [], handled: false }],
  },
  {
    name: "A mapping conflict is in the model for settings, with its sources",
    world: world({ entries: { alpha: entry({ g: ["Go", "alpha.go"] }), beta: entry({ g: ["Go", "beta.go"] }) } }),
    steps: [{ tick: 120, model: { conflicts: [{ seq: ["g"], mods: ["alpha", "beta"] }], overrides: [] } }],
  },
  {
    name: "A new mapping conflict flashes once",
    world: world({ entries: { alpha: entry({ g: ["Go", "alpha.go"] }), beta: entry({ g: ["Go", "beta.go"] }) } }),
    steps: [
      { tick: 120, bar: { label: "g: 2 mods want it, see settings" } },
      { tick: 120, bar: { label: "g: 2 mods want it, see settings" } },
      { command: "whistle", bar: { label: "Terminal · zsh" } },
      { world: { barFocused: true }, tick: 120, bar: { label: "Terminal · zsh" } },
    ],
  },
  {
    name: "A mod registering a conflicting key mid-session flashes",
    world: world({ entries: { alpha: entry({ g: ["Go", "alpha.go"] }) } }),
    steps: [
      { tick: 120, bar: { label: "Terminal" } },
      { world: { modMappings: { alpha: entry({ g: ["Go", "alpha.go"] }), beta: entry({ g: ["Go", "beta.go"] }) } }, tick: 120,
        bar: { label: "g: 2 mods want it, see settings" } },
    ],
  },
  {
    name: "A command against a group is a conflict",
    world: world({ entries: { alpha: entry({ g: ["Go", "alpha.go"] }), beta: entry({ g: { name: "Beta", map: { d: ["Do", "beta.do"] } } }) } }),
    steps: [...IN, { key: "g", effects: [], handled: false, model: { conflicts: [{ seq: ["g"], mods: ["alpha", "beta"] }] } }],
  },
  {
    name: "Two groups on one key merge; only keys both offer inside conflict; the title is the first mod's in layout order",
    world: world({ mods: ["beta", "alpha"], entries: {
      alpha: entry({ g: { name: "Alpha", map: { a: ["A", "alpha.a"], d: ["D", "alpha.d"] } } }),
      beta: entry({ g: { name: "Beta", map: { b: ["B", "beta.b"], d: ["D", "beta.d"] } } }),
    } }),
    steps: [...IN,
      { key: "g", handled: true, model: { sequence: ["g"], conflicts: [{ seq: ["g", "d"], mods: ["beta", "alpha"] }] },
        bar: { label: "Terminal · zsh" } },
      { key: "a", effects: ran("alpha.a") },
      { key: "g" }, { key: "b", effects: ran("beta.b") },
      { key: "g" }, { key: "d", effects: [], bar: { label: "g d is not mapped" } }],
  },
  {
    name: "A mapping conflict inside merged groups flashes with its key sequence",
    world: world({ entries: {
      alpha: entry({ g: { name: "Alpha", map: { d: ["D", "alpha.d"] } } }),
      beta: entry({ g: { name: "Beta", map: { d: ["D", "beta.d"] } } }),
    } }),
    steps: [{ tick: 120, bar: { label: "g d: 2 mods want it, see settings" } }],
  },

  // A mod on an own key.
  {
    name: "A mod on an own key counts for neither: the own key acts",
    world: world({ entries: { alpha: entry({ j: ["Down", "alpha.down"] }) } }),
    steps: [...IN, { key: "j", effects: [{ run: "pane.focus", args: { pane: "p1" } }, { run: "pane.go", args: { direction: "down" } }, { focusBar: true }],
      model: { conflicts: [{ seq: ["j"], mods: ["alpha"], own: "down" }] } }],
  },
  {
    name: "A mod on an own key flashes once, naming the mod",
    world: world({ entries: { alpha: entry({ "ctrl-h": ["Left", "alpha.left"] }) } }),
    steps: [{ tick: 120, bar: { label: "Ctrl+H: alpha wants an own key, see settings" } }],
  },
  {
    name: "A mod on a key whose own action was taken away isn't a conflict",
    world: world({ entries: { alpha: entry({ j: ["Down", "alpha.down"] }) }, user: { keys: { down: null } } }),
    steps: [...IN, { key: "j", effects: ran("alpha.down"), model: { conflicts: [] } }],
  },
  {
    name: "Inside a group a mod's key isn't held against the own keys",
    world: world({ entries: { alpha: entry({ g: { name: "Alpha", map: { j: ["Down", "alpha.down"] } } }) } }),
    steps: [...IN, { key: "g" }, { key: "j", effects: ran("alpha.down"), model: { conflicts: [] } }],
  },

  // Settled by a layer above.
  {
    name: "A conflict is settled by the layout mapping the key: an override, no flash",
    world: world({ props: { mappings: { g: ["Previous tab", "tab.prev"] } },
      entries: { alpha: entry({ g: ["Go", "alpha.go"] }), beta: entry({ g: ["Go", "beta.go"] }) } }),
    steps: [...IN, { key: "g", effects: ran("tab.prev"), bar: { label: "Terminal · zsh" },
      model: { conflicts: [], overrides: [{ seq: ["g"], source: "layout", over: ["alpha", "beta"] }] } }],
  },
  {
    name: "A conflict is settled by whistle.json setting the key to null",
    world: world({ map: { g: ["Next tab", "tab.next"] }, user: { map: { g: null } },
      entries: { alpha: entry({ g: ["Go", "alpha.go"] }), beta: entry({ g: ["Go", "beta.go"] }) } }),
    steps: [...IN, { key: "g", effects: [], handled: false,
      model: { conflicts: [], overrides: [{ seq: ["g"], source: "whistle.json", over: ["alpha", "beta"] }] } }],
  },
  {
    name: "A conflict inside merged groups is settled by a mapping over the whole group",
    world: world({ user: { map: { g: ["Go", "tab.next"] } }, entries: {
      alpha: entry({ g: { name: "Alpha", map: { d: ["D", "alpha.d"] } } }),
      beta: entry({ g: { name: "Beta", map: { d: ["D", "beta.d"] } } }),
    } }),
    steps: [{ tick: 120, bar: { label: "Terminal" },
      model: { conflicts: [], overrides: [{ seq: ["g", "d"], source: "whistle.json", over: ["alpha", "beta"] }] } }],
  },
  {
    name: "A group added over a conflict inside merged groups doesn't settle it",
    world: world({ user: { map: { g: { map: { x: ["X", "tab.next"] } } } }, entries: {
      alpha: entry({ g: { name: "Alpha", map: { d: ["D", "alpha.d"] } } }),
      beta: entry({ g: { name: "Beta", map: { d: ["D", "beta.d"] } } }),
    } }),
    steps: [{ tick: 120, model: { conflicts: [{ seq: ["g", "d"], mods: ["alpha", "beta"] }] } }],
  },
  {
    name: "The layout mapping over an own key a mod wants settles the conflict",
    world: world({ props: { mappings: { j: ["Next tab", "tab.next"] } }, entries: { alpha: entry({ j: ["Down", "alpha.down"] }) } }),
    steps: [...IN, { key: "j", effects: ran("tab.next"),
      model: { conflicts: [], overrides: [{ seq: ["j"], source: "layout", over: ["alpha"] }] } }],
  },
  {
    name: "A layer above mapping over one mod's key is an override, labelled with the last layer, no flash",
    world: world({ props: { mappings: { g: ["Previous tab", "tab.prev"] } }, user: { map: { g: ["Next space", "space.next"] } },
      entries: { alpha: entry({ g: ["Go", "alpha.go"] }) } }),
    steps: [...IN, { key: "g", effects: ran("space.next"), bar: { label: "Terminal · zsh" },
      model: { conflicts: [], overrides: [{ seq: ["g"], source: "whistle.json", over: ["alpha"] }] } }],
  },

  // Switched off.
  {
    name: "whistle.json switches a mod off whole: its mappings go, and its conflicts with them",
    world: world({ user: { mods: { beta: false } },
      entries: { alpha: entry({ g: ["Go", "alpha.go"] }), beta: entry({ g: ["Go", "beta.go"], b: ["B", "beta.b"] }) } }),
    steps: [...IN, { key: "g", effects: ran("alpha.go"), model: { conflicts: [] } }, { key: "b", effects: [], handled: false }],
  },
  {
    name: "The layout switches a mod off, and whistle.json back on",
    world: world({ props: { mods: { alpha: false } }, entries: { alpha: entry({ g: ["Go", "alpha.go"] }) } }),
    steps: [...IN, { key: "g", effects: [], handled: false },
      { world: { configFiles: { defaults: json({ keys: TEST_DEFAULTS.keys, map: {} }), user: json({ mods: { alpha: true } }) } }, tick: 120 },
      { key: "g", effects: ran("alpha.go") }],
  },
  {
    name: "A mod switched off settles a conflict as it goes",
    world: world({ entries: { alpha: entry({ g: ["Go", "alpha.go"] }), beta: entry({ g: ["Go", "beta.go"] }) } }),
    steps: [...IN, { key: "g", effects: [], handled: false },
      { world: { configFiles: { defaults: json({ keys: TEST_DEFAULTS.keys, map: {} }), user: json({ mods: { alpha: false } }) } }, tick: 120,
        model: { conflicts: [] } },
      { key: "g", effects: ran("beta.go") }],
  },

  // Bad entries.
  {
    name: "A mod's entry of another version or form is skipped and listed under the mod",
    world: world({ entries: { alpha: { v: 2, map: { g: ["Go", "alpha.go"] } }, beta: "nope" } }),
    steps: [...IN, { key: "g", effects: [], handled: false, model: { problems: [
      { source: "alpha", detail: "its entry is v 2; whistle reads v 1" },
      { source: "beta", detail: "its entry should be { v: 1, map }" },
    ] } }],
  },
  {
    name: "A mod can only add keys: a null is skipped and listed, and so is a bad mapping",
    world: { ...world({ map: { n: ["Next tab", "tab.next"] },
      entries: { alpha: entry({ n: null, x: ["X", "tab.nope"], g: ["Go", "alpha.go"] }) } }),
    commands: [{ name: "tab.next", args: [] }] },
    steps: [...IN, { key: "n", effects: ran("tab.next"), model: { problems: [
      { source: "alpha", detail: "map › n: a mod can only add keys, not take them away" },
      { source: "alpha", detail: "map › x: unknown command tab.nope" },
    ] } }, { key: "g", effects: ran("alpha.go") }],
  },
  {
    name: "A mods switch that isn't true or false is listed",
    world: world({ user: { mods: { alpha: "off" } }, entries: { alpha: entry({ g: ["Go", "alpha.go"] }) } }),
    steps: [...IN, { key: "g", effects: ran("alpha.go"),
      model: { problems: [{ source: "whistle.json", detail: "mods › alpha: should be true or false" }] } }],
  },

  // Claims.
  {
    name: "A mod's chord is claimed in keys.json",
    world: { ...world({ keys: { type: ["i"] }, entries: { alpha: entry({ "ctrl-g": ["Go", "alpha.go"] }) } }),
      platform: "linux", layoutName: "main", keysFile: { text: json({ global: {} }), error: null, at: 0 } },
    steps: [{ tick: 120, effects: [{ write: "keys.json",
      text: pretty({ global: {}, "mod:whistle": { "ctrl-g": "whistle.key-ctrl-g" } }), expected: json({ global: {} }) }] }],
  },
  {
    name: "A conflicting chord isn't claimed while no lower layer maps it",
    world: { ...world({ keys: { type: ["i"] }, entries: { alpha: entry({ "ctrl-g": ["Go", "alpha.go"] }), beta: entry({ "ctrl-g": ["Go", "beta.go"] }) } }),
      platform: "linux", layoutName: "main", keysFile: { text: json({ global: {} }), error: null, at: 0 } },
    steps: [{ tick: 120, effects: [] }],
  },
  {
    name: "A conflicting chord the defaults map stays claimed",
    world: { ...world({ keys: { type: ["i"] }, map: { "ctrl-g": ["Next tab", "tab.next"] },
      entries: { alpha: entry({ "ctrl-g": ["Go", "alpha.go"] }), beta: entry({ "ctrl-g": ["Go", "beta.go"] }) } }),
      platform: "linux", layoutName: "main", keysFile: { text: json({ global: {} }), error: null, at: 0 } },
    steps: [{ tick: 120, effects: [{ write: "keys.json",
      text: pretty({ global: {}, "mod:whistle": { "ctrl-g": "whistle.key-ctrl-g" } }), expected: json({ global: {} }) }] }],
  },
];

export default suite("mod mappings", (t) => {
  for (const sc of SCENARIOS) t.scenario(sc, core);

  // The merged group's title, for the hints: the first mod's in layout order.
  const w = { ...DEFAULT_WORLD, ...world({ mods: ["beta", "alpha"], entries: {
    alpha: entry({ g: { name: "Alpha", map: { a: ["A", "alpha.a"] } } }),
    beta: entry({ g: { name: "Beta", map: { b: ["B", "beta.b"] } } }),
  } }) };
  const m = core.step(core.start(), { tick: true }, w).model;
  t.check("Two mods' groups merged take the title of the first mod in layout order", m.config.map.g.name, "Beta");
});
