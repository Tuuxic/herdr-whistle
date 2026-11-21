// Whistle's public contract for clients (spec #57, 1.4.0): the keys whistle.hints,
// whistle.events and whistle.config, the whistle state's inert field, and the settings
// commands. Each key is written by the running copy only, and only when it changes.

import { suite, TEST_DEFAULTS } from "./harness.js";
import * as core from "./step.js";
import { term, bar } from "./worlds.js";

const json = (v) => JSON.stringify(v);
const IN = [{ command: "whistle" }, { world: { barFocused: true }, tick: 120 }];
const block = (mod) => ({ id: mod, type: "block", content: { mod } });
const entry = (map) => ({ v: 1, map });
// A world in a terminal: the mods shown, their entries, the defaults' map, the layout's whistle
// block props, whistle.json (undefined: no file; a string: its text as it is).
const world = ({ map = {}, user, mods = [], entries = {}, props, layout } = {}) => ({
  layout: layout ?? { id: "root", type: "column", children: [term("main"), ...mods.map(block), props ? { ...bar, content: { mod: "whistle", props } } : bar] },
  focused: { pane: "p1", terminal: "t1" }, panes: [{ pane: "p1", title: "zsh" }], modMappings: entries,
  configFiles: { defaults: json({ keys: TEST_DEFAULTS.keys, map }), user: user === undefined ? null : typeof user === "string" ? user : json(user) },
});
const PANES = { w: { name: "Panes", map: {
  v: ["Split right", "pane.split", { direction: "right" }],
  m: { name: "Move", map: { h: ["Move left", "pane.move"] } },
} } };
const PANES_HINTS = { v: 1, keys: "w", title: "Panes", exit: null, items: [
  { key: "v", label: "Split right", group: false }, { key: "m", label: "Move", group: true }] };

const SCENARIOS = [
  // whistle.hints
  {
    name: "whistle.hints is written when the hint items change, and only then, whether or not hints are on",
    world: world({ map: PANES, props: { hints: false } }),
    steps: [
      { tick: 120, shared: { "whistle.hints": null } },
      { command: "whistle", shared: { "whistle.hints": undefined } },
      { world: { barFocused: true }, key: "w", shared: { "whistle.hints": PANES_HINTS } },
      { tick: 120, shared: { "whistle.hints": undefined } },
      { key: "v", shared: { "whistle.hints": null } },
    ],
  },

  // whistle.config
  {
    name: "whistle.config is written once whistle runs, and again only when it changes",
    world: world({ mods: ["alpha"], entries: { alpha: entry({ g: ["Go", "alpha.go"] }) } }),
    steps: [
      { tick: 120, shared: { "whistle.config": { v: 1, problems: [], mods: [{ name: "alpha", on: true, problems: [] }], conflicts: [], overrides: [] } } },
      { tick: 120, shared: { "whistle.config": undefined } },
      { world: { configFiles: { defaults: json({ keys: TEST_DEFAULTS.keys, map: {} }), user: json({ mods: { alpha: false } }) } }, tick: 120,
        shared: { "whistle.config": { v: 1, problems: [], mods: [{ name: "alpha", on: false, problems: [] }], conflicts: [], overrides: [] } } },
    ],
  },

  // whistle.events
  {
    name: "whistle.events starts empty, and an unmapped key adds an unmapped event with its keys, while the bar still flashes",
    world: world({ map: PANES }),
    steps: [
      { tick: 120, shared: { "whistle.events": { v: 1, events: [] } } },
      ...IN.slice(0, 1),
      { world: { barFocused: true }, key: "w", shared: { "whistle.events": undefined } },
      { key: "x", bar: { label: "w x is not mapped" },
        shared: { "whistle.events": { v: 1, events: [{ seq: 1, kind: "unmapped", keys: ["w", "x"], text: "w x is not mapped" }] } } },
      { tick: 120, shared: { "whistle.events": undefined } },
    ],
  },
  {
    name: "Several events in one step get consecutive seqs: two new conflicts and a new mod problem; the bar flashes the first",
    world: world({ mods: ["alpha", "beta"], entries: {
      alpha: entry({ g: { name: "Alpha", map: { d: ["D", "alpha.d"], e: ["E", "alpha.e"] } }, z: "nope" }),
      beta: entry({ g: { name: "Beta", map: { d: ["D", "beta.d"], e: ["E", "beta.e"] } } }),
    } }),
    steps: [{ tick: 120, bar: { label: "g d: 2 mods want it, see settings" }, shared: { "whistle.events": { v: 1, events: [
      { seq: 1, kind: "conflict-new", keys: ["g", "d"], mods: ["alpha", "beta"], text: "g d: 2 mods want it, see settings" },
      { seq: 2, kind: "conflict-new", keys: ["g", "e"], mods: ["alpha", "beta"], text: "g e: 2 mods want it, see settings" },
      { seq: 3, kind: "mod-problem-new", source: "alpha", detail: "map › z: should be [label, command] or a group { name, map }",
        text: "alpha's mappings have a problem, see settings" },
    ] } } }],
  },
  {
    name: "The feed keeps the last 8 events, their seqs rising on",
    world: world(),
    steps: [{ tick: 120 }, ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => ({ command: `focus:nope${n}` })),
      { command: "focus:nope9", shared: { "whistle.events": { v: 1, events: [2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
        { seq: n, kind: "verb-failed", block: `nope${n}`, reason: "missing", text: `No nope${n} in this layout` })) } } }],
  },
  {
    name: "A block that can't be selected raises cant-select, and a verb on a block the layout lacks raises verb-failed",
    world: world({ layout: { id: "root", type: "column", children: [term("main"), { id: "notes", type: "block", hidden: true, content: { pane: {} } },
        { ...bar, content: { mod: "whistle", props: { mappings: { n: ["Notes", "whistle.field:notes"], m: ["Missing", "whistle.toggle:gone"] } } } }] } }),
    steps: [...IN,
      { key: "n", shared: { "whistle.events": { v: 1, events: [
        { seq: 1, kind: "cant-select", block: "notes", reason: "hidden", text: "notes can't be selected now" }] } } },
      { key: "m", shared: { "whistle.events": { v: 1, events: [
        { seq: 1, kind: "cant-select", block: "notes", reason: "hidden", text: "notes can't be selected now" },
        { seq: 2, kind: "verb-failed", block: "gone", reason: "missing", text: "No gone in this layout" }] } } }],
  },
  {
    name: "A jump key in TYPE on a block the layout lacks raises verb-failed",
    world: world(),
    steps: [{ tick: 120 }, { command: "focus:gone", bar: { label: "No gone in this layout" }, shared: { "whistle.events": { v: 1, events: [
      { seq: 1, kind: "verb-failed", block: "gone", reason: "missing", text: "No gone in this layout" }] } } }],
  },
  {
    name: "A command that failed raises command-failed",
    world: world(),
    steps: [{ tick: 120 }, { ran: "pane.split", error: "boom", shared: { "whistle.events": { v: 1, events: [
      { seq: 1, kind: "command-failed", command: "pane.split", error: "boom", text: "pane.split failed: boom" }] } } }],
  },
  {
    name: "whistle.on before whistle.json is read raises settings-unread",
    world: { ...world(), configFiles: { defaults: json({ keys: TEST_DEFAULTS.keys, map: {} }) } },
    steps: [{ command: "on", effects: [], shared: { "whistle.events": { v: 1, events: [
      { seq: 1, kind: "settings-unread", text: "whistle.json isn't read yet" }] } } }],
  },
  {
    name: "whistle.off on a whistle.json that doesn't parse raises settings-broken and writes nothing",
    world: world({ user: "{ nope" }),
    steps: [{ command: "off", effects: [], shared: { "whistle.events": { v: 1, events: [
      { seq: 1, kind: "settings-broken", detail: "doesn't parse", text: "whistle.json doesn't parse; fix it first" }] } } }],
  },
  {
    name: "A failed write of whistle.json raises settings-write-failed",
    world: world(),
    steps: [{ tick: 120 }, { wrote: "whistle.json", ok: false, error: "denied", bar: { label: "couldn't write whistle.json: denied" },
      shared: { "whistle.events": { v: 1, events: [
        { seq: 1, kind: "settings-write-failed", error: "denied", text: "couldn't write whistle.json: denied" }] } } }],
  },
];

export default suite("contract", (t) => {
  for (const sc of SCENARIOS) t.scenario(sc, core);
});
