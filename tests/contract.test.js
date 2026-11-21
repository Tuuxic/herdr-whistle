// Whistle's public contract for clients (spec #57, 1.4.0): the keys whistle.hints,
// whistle.events and whistle.config, the whistle state's inert field, and the settings
// commands. Each key is written by the running copy only, and only when it changes.

import { suite, TEST_DEFAULTS } from "./harness.js";
import * as core from "./step.js";
import { term, bar } from "./worlds.js";
import { settingsCommandFor } from "./config.js";
import { VERSION, MIN_HERDR } from "./version.js";
import { readState, hintsOf, eventsSince, configOf } from "./whistle.js";

// The problem listed for a mod offering mappings under a name whistle doesn't take.
const BAD_NAME = "offers mappings under a name with characters other than letters, digits, \".\", \"_\" and \"-\": whistle skips them";

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

  // The settings commands: whistle writes whistle.json itself.
  {
    name: "The switch-mod command writes the mod off into whistle.json, keeping the rest, even while switched off",
    world: world({ mods: ["alpha"], entries: { alpha: entry({ g: ["Go", "alpha.go"] }) }, user: { enabled: false } }),
    steps: [{ tick: 120 }, { command: settingsCommandFor.switchMod("alpha", false), effects: [
      { write: "whistle.json", text: `${JSON.stringify({ enabled: false, mods: { alpha: false } }, null, 2)}\n`, expected: json({ enabled: false }) }] }],
  },
  {
    name: "The switch-mod command writes the mod on into a whistle.json that isn't there yet",
    world: world(),
    steps: [{ command: settingsCommandFor.switchMod("alpha", true), effects: [
      { write: "whistle.json", text: `${JSON.stringify({ mods: { alpha: true } }, null, 2)}\n`, expected: null }] }],
  },
  {
    name: "The keep command writes the mod's mapping, as the mod wrote it, at the key sequence into whistle.json",
    world: { ...world({ mods: ["alpha", "beta"], entries: {
      alpha: entry({ g: { name: "Alpha", map: { "Ctrl-d": ["D", "alpha.d"] } } }),
      beta: entry({ g: { name: "Beta", map: { "ctrl-d": ["D", "beta.d"] } } }),
    } }), platform: "linux" },
    steps: [{ tick: 120 }, { command: settingsCommandFor.keep("alpha", ["g", "ctrl-d"]), effects: [
      { write: "whistle.json", text: `${JSON.stringify({ map: { g: { map: { "ctrl-d": ["D", "alpha.d"] } } } }, null, 2)}\n`, expected: null }] }],
  },
  {
    name: "The keep command on a key sequence the mod doesn't map raises command-failed and writes nothing",
    world: world({ mods: ["alpha"], entries: { alpha: entry({ g: ["Go", "alpha.go"] }) } }),
    steps: [{ tick: 120 }, { command: settingsCommandFor.keep("alpha", ["x", "y"]), effects: [],
      shared: { "whistle.events": { v: 1, events: [{ seq: 1, kind: "command-failed", command: `whistle.${settingsCommandFor.keep("alpha", ["x", "y"])}`,
        error: "alpha maps nothing at x y", text: "alpha maps nothing at x y" }] } } }],
  },
  {
    name: "A settings command on a whistle.json that doesn't parse raises settings-broken and writes nothing",
    world: world({ user: "[1]" }),
    steps: [{ command: settingsCommandFor.switchMod("alpha", false), effects: [], shared: { "whistle.events": { v: 1, events: [
      { seq: 1, kind: "settings-broken", detail: "isn't a JSON object", text: "whistle.json isn't a JSON object; fix it first" }] } } }],
  },
  {
    name: "A mappings command whose state isn't on or off is no command: it writes nothing and raises nothing",
    world: world(),
    steps: [{ tick: 120 }, { command: "mappings:alpha:maybe", effects: [], shared: { "whistle.events": undefined } }],
  },
  {
    name: "keys.json may bind the settings commands, and not a mappings command without a state",
    world: { ...world(), keysFile: { text: json({ global: {
      "f7": `whistle.${settingsCommandFor.switchMod("alpha", false)}`, "f8": `whistle.${settingsCommandFor.keep("alpha", ["g", "d"])}`,
      "f9": "whistle.mappings:alpha" } }), error: null, at: 0 } },
    steps: [{ tick: 120, shared: { "whistle.config": { v: 1, problems: [
      { source: "keys.json", detail: "global › f9: unknown whistle command whistle.mappings:alpha" }], mods: [], conflicts: [], overrides: [] } } }],
  },

  // Mod names (docs/contracts/mod-mappings.md): letters, digits, ".", "_" and "-" only.
  {
    name: "A mod offering mappings under a name with other characters is skipped and listed as a problem, which raises mod-problem-new",
    world: world({ mods: ["my mod", "alpha"], entries: { "my mod": entry({ g: ["Go", "my.go"] }), alpha: entry({ z: ["Zap", "alpha.zap"] }) } }),
    steps: [{ tick: 120,
      shared: {
        "whistle.config": { v: 1, problems: [{ source: "my mod", detail: BAD_NAME }], mods: [{ name: "alpha", on: true, problems: [] }], conflicts: [], overrides: [] },
        "whistle.events": { v: 1, events: [{ seq: 1, kind: "mod-problem-new", source: "my mod", detail: BAD_NAME, text: "my mod's mappings have a problem, see settings" }] },
      } },
      { tick: 120, shared: { "whistle.events": undefined } }],
  },

  // The whistle state's inert field.
  {
    name: "A copy inert on an old Herdr, with no other copy running, publishes the state with inert, once",
    world: { herdr: "0.1.0", focused: { pane: "p1" } },
    steps: [
      { tick: 120, published: { v: 1, mode: "type", enabled: true, sequence: null, pane: null, onTerminal: false,
        inert: { problem: `Whistle needs Herdr ≥ ${MIN_HERDR} (this is 0.1.0)`, fix: "Update Herdr." } },
        shared: { "whistle.hints": undefined, "whistle.events": undefined, "whistle.config": undefined } },
      { tick: 120, published: null },
      { world: { herdr: MIN_HERDR }, tick: 120, published: { v: 1, mode: "type", enabled: true, sequence: null, pane: null, onTerminal: false } },
    ],
  },
  {
    name: "A copy inert while another copy runs writes no state",
    world: { folder: "whistle-2", copies: { whistle: VERSION, "whistle-2": VERSION },
      layout: { id: "root", type: "column", children: [term("main"), bar, { id: "bar-2", type: "block", content: { mod: "whistle-2" } }] } },
    steps: [{ tick: 120, published: null, shared: { "whistle.hints": undefined, "whistle.events": undefined, "whistle.config": undefined } }],
  },
  {
    name: "A copy inert on an old Herdr writes no state while another copy would run",
    world: { herdr: "0.1.0", folder: "whistle-2", copies: { whistle: VERSION, "whistle-2": VERSION },
      layout: { id: "root", type: "column", children: [term("main"), bar, { id: "bar-2", type: "block", content: { mod: "whistle-2" } }] } },
    steps: [{ tick: 120, published: null }],
  },
];

const EV = (seq) => ({ seq, kind: "unmapped", keys: ["x"], text: "x is not mapped" });

export default suite("contract", (t) => {
  for (const sc of SCENARIOS) t.scenario(sc, core);

  // The copyable readers (whistle.js).
  t.check("readState gives inert, null while whistle runs", [readState({ v: 1, mode: "type" }).inert,
    readState({ v: 1, mode: "type", inert: { problem: "p", fix: "f" } }).inert], [null, { problem: "p", fix: "f" }]);
  t.check("hintsOf gives the v1 hints, else null", [hintsOf(PANES_HINTS), hintsOf(null), hintsOf({ ...PANES_HINTS, v: 2 })],
    [{ keys: "w", title: "Panes", items: PANES_HINTS.items, exit: null }, null, null]);
  t.check("configOf gives the v1 config, else null", [configOf({ v: 1, problems: [], mods: [], conflicts: [], overrides: [], later: 1 }), configOf({ v: 2 })],
    [{ problems: [], mods: [], conflicts: [], overrides: [] }, null]);
  const feed = { v: 1, events: [EV(3), EV(4), EV(5)] };
  t.check("eventsSince gives the events after the last seq handled, and the new last", eventsSince(feed, 3), { events: [EV(4), EV(5)], last: 5 });
  t.check("eventsSince gives nothing new when nothing came", eventsSince(feed, 5), { events: [], last: 5 });
  t.check("eventsSince starts over when the seqs went back (whistle started again)", eventsSince({ v: 1, events: [EV(1)] }, 5), { events: [EV(1)], last: 1 });
  t.check("eventsSince gives nothing for no feed or another v, keeping the last", [eventsSince(null, 4), eventsSince({ v: 2, events: [EV(9)] }, 4)],
    [{ events: [], last: 4 }, { events: [], last: 4 }]);
});
