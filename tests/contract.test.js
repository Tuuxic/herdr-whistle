// Whistle's public contract for clients (spec #57, 2.0.0): the keys whistle.hints,
// whistle.events and whistle.config, the whistle state's inert field, and the settings
// commands. Each key is written by the running copy only, and only when it changes.

import { suite, TEST_DEFAULTS } from "./harness.js";
import * as core from "./step.js";
import { term, anchor } from "./worlds.js";
import { VERSION, MIN_HERDR } from "./version.js";
import { readState, hintsOf, eventsSince, configOf } from "./whistle.js";

// Each kind's groups, as docs/contracts/events.md lists them.
const G = {
  "command-failed": ["command", "problem"], "verb-failed": ["command", "problem"], "cant-select": ["field", "problem"],
  "key-unmapped": ["sequence", "problem"], "conflict-new": ["config", "problem"], "mod-problem-new": ["config", "problem"],
  "settings-unread": ["settings", "problem"], "settings-broken": ["settings", "problem"], "settings-write-failed": ["settings", "problem"],
  "whistle-inert": ["whistle", "problem"],
};

// The event a command whistle doesn't know raises when run (c: as Herdr hands it over).
const UNKNOWN = (seq, c) => ({ seq, kind: "command-failed", groups: G["command-failed"], command: `whistle.${c}`,
  error: `unknown whistle command whistle.${c}`, text: `unknown whistle command whistle.${c}` });

const json = (v) => JSON.stringify(v);
const IN = [{ command: "switch-mode" }, { world: { anchorFocused: true }, tick: 120 }];
const block = (mod) => ({ id: mod, type: "block", content: { mod } });
const entry = (map) => ({ v: 1, map });
// A world in a terminal: the mods shown, their entries, the defaults' map, the layout's whistle
// block props, whistle.json (undefined: no file; a string: its text as it is).
const world = ({ map = {}, user, mods = [], entries = {}, props, layout } = {}) => ({
  layout: layout ?? { id: "root", type: "column", children: [term("main"), ...mods.map(block), props ? { ...anchor, content: { mod: "whistle", props } } : anchor] },
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
      { command: "switch-mode", shared: { "whistle.hints": undefined } },
      { world: { anchorFocused: true }, key: "w", shared: { "whistle.hints": PANES_HINTS } },
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
    name: "whistle.events starts empty, and an unmapped key adds key-unmapped with its keys, ending the sequence",
    world: world({ map: PANES }),
    steps: [
      { tick: 120, shared: { "whistle.events": { v: 1, events: [] } } },
      ...IN.slice(0, 1),
      { world: { anchorFocused: true }, key: "w", raised: [{ kind: "sequence-started" }] },
      { key: "x", raised: [{ seq: 4, kind: "key-unmapped", groups: G["key-unmapped"], keys: ["w", "x"], text: "w x is not mapped" },
        { seq: 5, kind: "sequence-ended", keys: ["w"], by: "unmapped" }] },
      { tick: 120, shared: { "whistle.events": undefined } },
    ],
  },
  {
    name: "Several events in one step get consecutive seqs: two new conflicts and a new mod problem",
    world: world({ mods: ["alpha", "beta"], entries: {
      alpha: entry({ g: { name: "Alpha", map: { d: ["D", "alpha.d"], e: ["E", "alpha.e"] } }, z: "nope" }),
      beta: entry({ g: { name: "Beta", map: { d: ["D", "beta.d"], e: ["E", "beta.e"] } } }),
    } }),
    steps: [{ tick: 120, shared: { "whistle.events": { v: 1, events: [
      { seq: 1, kind: "conflict-new", groups: G["conflict-new"], keys: ["g", "d"], mods: ["alpha", "beta"], text: "g d: 2 mods want it, see settings" },
      { seq: 2, kind: "conflict-new", groups: G["conflict-new"], keys: ["g", "e"], mods: ["alpha", "beta"], text: "g e: 2 mods want it, see settings" },
      { seq: 3, kind: "mod-problem-new", groups: G["mod-problem-new"], source: "alpha", detail: "map › z: should be [label, command] or a group { name, map }",
        text: "alpha's mappings have a problem, see settings" },
    ] } } }],
  },
  {
    name: "The feed keeps the last 32 events, their seqs rising on",
    world: world(),
    steps: [{ tick: 120 }, ...Array.from({ length: 32 }, (_, i) => ({ command: `focus:nope${i + 1}` })),
      { command: "focus:nope33", shared: { "whistle.events": { v: 1, events: Array.from({ length: 32 }, (_, i) => i + 2).map((n) => (
        { seq: n, kind: "verb-failed", groups: G["verb-failed"], block: `nope${n}`, reason: "missing", text: `No nope${n} in this layout` })) } } }],
  },
  {
    name: "A block that can't be selected raises cant-select, and a verb on a block the layout lacks raises verb-failed",
    world: world({ layout: { id: "root", type: "column", children: [term("main"), { id: "notes", type: "block", hidden: true, content: { pane: {} } },
        { ...anchor, content: { mod: "whistle", props: { mappings: { n: ["Notes", "whistle.field:notes"], m: ["Missing", "whistle.toggle:gone"] } } } }] } }),
    steps: [...IN,
      { key: "n", shared: { "whistle.events": { v: 1, events: [
        { seq: 1, kind: "cant-select", groups: G["cant-select"], block: "notes", reason: "hidden", text: "notes can't be selected now" }] } } },
      { key: "m", shared: { "whistle.events": { v: 1, events: [
        { seq: 1, kind: "cant-select", groups: G["cant-select"], block: "notes", reason: "hidden", text: "notes can't be selected now" },
        { seq: 2, kind: "verb-failed", groups: G["verb-failed"], block: "gone", reason: "missing", text: "No gone in this layout" }] } } }],
  },
  {
    name: "A jump key in TYPE on a block the layout lacks raises verb-failed",
    world: world(),
    steps: [{ tick: 120 }, { command: "focus:gone", raised: [{ text: "No gone in this layout" }], shared: { "whistle.events": { v: 1, events: [
      { seq: 1, kind: "verb-failed", groups: G["verb-failed"], block: "gone", reason: "missing", text: "No gone in this layout" }] } } }],
  },
  {
    name: "A command that failed raises command-failed",
    world: world(),
    steps: [{ tick: 120 }, { ran: "pane.split", error: "boom", shared: { "whistle.events": { v: 1, events: [
      { seq: 1, kind: "command-failed", groups: G["command-failed"], command: "pane.split", error: "boom", text: "pane.split failed: boom" }] } } }],
  },
  {
    name: "whistle.on before whistle.json is read raises settings-unread",
    world: { ...world(), configFiles: { defaults: json({ keys: TEST_DEFAULTS.keys, map: {} }) } },
    steps: [{ command: "on", effects: [], shared: { "whistle.events": { v: 1, events: [
      { seq: 1, kind: "settings-unread", groups: G["settings-unread"], text: "whistle.json isn't read yet" }] } } }],
  },
  {
    name: "whistle.off on a whistle.json that doesn't parse raises settings-broken and writes nothing",
    world: world({ user: "{ nope" }),
    steps: [{ command: "off", effects: [], shared: { "whistle.events": { v: 1, events: [
      { seq: 1, kind: "settings-broken", groups: G["settings-broken"], detail: "doesn't parse", text: "whistle.json doesn't parse; fix it first" }] } } }],
  },
  {
    name: "A failed write of whistle.json raises settings-write-failed",
    world: world(),
    steps: [{ tick: 120 }, { wrote: "whistle.json", ok: false, error: "denied", raised: [{ text: "couldn't write whistle.json: denied" }],
      shared: { "whistle.events": { v: 1, events: [
        { seq: 1, kind: "settings-write-failed", groups: G["settings-write-failed"], error: "denied", text: "couldn't write whistle.json: denied" }] } } }],
  },

  // The settings commands: whistle writes whistle.json itself.
  {
    name: "The switch-mod command writes the mod off into whistle.json, keeping the rest, even while switched off",
    world: world({ mods: ["alpha"], entries: { alpha: entry({ g: ["Go", "alpha.go"] }) }, user: { enabled: false } }),
    steps: [{ tick: 120 }, { command: "mappings-off:alpha", effects: [
      { write: "whistle.json", text: `${JSON.stringify({ enabled: false, mods: { alpha: false } }, null, 2)}\n`, expected: json({ enabled: false }) }] }],
  },
  {
    name: "The switch-mod command writes the mod on into a whistle.json that isn't there yet",
    world: world(),
    steps: [{ command: "mappings-on:alpha", effects: [
      { write: "whistle.json", text: `${JSON.stringify({ mods: { alpha: true } }, null, 2)}\n`, expected: null }] }],
  },
  {
    name: "The keep command writes the mod's mapping, as the mod wrote it, at the key sequence into whistle.json",
    world: { ...world({ mods: ["alpha", "beta"], entries: {
      alpha: entry({ g: { name: "Alpha", map: { "Ctrl-d": ["D", "alpha.d"] } } }),
      beta: entry({ g: { name: "Beta", map: { "ctrl-d": ["D", "beta.d"] } } }),
    } }), platform: "linux" },
    steps: [{ tick: 120 }, { command: 'keep-mapping:{"mod":"alpha","keys":["g","ctrl-d"]}', effects: [
      { write: "whistle.json", text: `${JSON.stringify({ map: { g: { map: { "ctrl-d": ["D", "alpha.d"] } } } }, null, 2)}\n`, expected: null }] }],
  },
  {
    name: "The keep command on a key sequence the mod doesn't map raises command-failed and writes nothing",
    world: world({ mods: ["alpha"], entries: { alpha: entry({ g: ["Go", "alpha.go"] }) } }),
    steps: [{ tick: 120 }, { command: 'keep-mapping:{"mod":"alpha","keys":["x","y"]}', effects: [],
      shared: { "whistle.events": { v: 1, events: [{ seq: 1, kind: "command-failed", groups: G["command-failed"], command: 'whistle.keep-mapping:{"mod":"alpha","keys":["x","y"]}',
        error: "alpha maps nothing at x y", text: "alpha maps nothing at x y" }] } } }],
  },
  {
    name: "A settings command on a whistle.json that doesn't parse raises settings-broken and writes nothing",
    world: world({ user: "[1]" }),
    steps: [{ command: "mappings-off:alpha", effects: [], shared: { "whistle.events": { v: 1, events: [
      { seq: 1, kind: "settings-broken", groups: G["settings-broken"], detail: "isn't a JSON object", text: "whistle.json isn't a JSON object; fix it first" }] } } }],
  },
  {
    name: "The settings commands spell as the commands contract says",
    world: world({ mods: ["claude-hints"], entries: { "claude-hints": entry({ g: { name: "Hints", map: { q: ["Q", "claude-hints.q"] } } }) } }),
    steps: [{ tick: 120 },
      { command: "mappings-off:claude-hints", effects: [
        { write: "whistle.json", text: `${JSON.stringify({ mods: { "claude-hints": false } }, null, 2)}\n`, expected: null }] },
      { command: 'keep-mapping:{"mod":"claude-hints","keys":["g","q"]}', effects: [
        { write: "whistle.json", text: `${JSON.stringify({ map: { g: { map: { q: ["Q", "claude-hints.q"] } } } }, null, 2)}\n`, expected: null }] }],
  },
  {
    name: "A keep-mapping whose argument isn't JSON with a mod and keys is an unknown command: it raises command-failed and writes nothing",
    world: world(),
    steps: [{ tick: 120 },
      { command: "keep-mapping:{nope", effects: [], shared: { "whistle.events": { v: 1, events: [UNKNOWN(1, "keep-mapping:{nope")] } } },
      { command: 'keep-mapping:{"mod":"alpha"}', effects: [], shared: { "whistle.events": { v: 1, events: [
        UNKNOWN(1, "keep-mapping:{nope"), UNKNOWN(2, 'keep-mapping:{"mod":"alpha"}')] } } }],
  },
  {
    name: "keys.json may bind the settings commands; a keep-mapping with bad JSON and a mode that isn't one are config problems",
    world: { ...world(), keysFile: { text: json({ global: {
      "f7": "whistle.mappings-off:alpha", "f8": 'whistle.keep-mapping:{"mod":"alpha","keys":["g","d"]}',
      "f9": "whistle.keep-mapping:{nope", "f10": "whistle.mode:foo", "f11": "whistle.mode:whistle" } }), error: null, at: 0 } },
    steps: [{ tick: 120, shared: { "whistle.config": { v: 1, problems: [
      { source: "keys.json", detail: "global › f9: unknown whistle command whistle.keep-mapping:{nope" },
      { source: "keys.json", detail: "global › f10: unknown whistle command whistle.mode:foo" }], mods: [], conflicts: [], overrides: [] } } }],
  },

  // The mode commands (docs/contracts/commands.md).
  {
    name: "mode:whistle goes to WHISTLE from TYPE, and stays in WHISTLE",
    world: world(),
    steps: [{ command: "mode:whistle", model: { mode: "whistle" }, effects: [{ focusAnchor: true }] },
      { world: { anchorFocused: true }, command: "mode:whistle", model: { mode: "whistle" }, effects: [] }],
  },
  {
    name: "mode:type goes to TYPE from WHISTLE, and does nothing in TYPE",
    world: world(),
    steps: [{ command: "switch-mode" }, { world: { anchorFocused: true }, command: "mode:type", model: { mode: "type" },
      effects: [{ run: "pane.focus", args: { pane: "p1" } }] },
    { world: { anchorFocused: false }, command: "mode:type", model: { mode: "type" }, effects: [] }],
  },
  {
    name: "Switched off, mode:whistle types its key into the terminal, as switch-mode does",
    world: { ...world({ user: { enabled: false } }), keys: [{ section: "global", keys: "f12", action: "whistle.mode:whistle" }] },
    steps: [{ tick: 120 }, { command: "mode:whistle", model: { mode: "type" }, effects: [{ typeKey: "f12", terminal: "t1" }] }],
  },
  {
    name: "The old names whistle and type, and a mode that isn't one, are unknown commands: command-failed, nothing else",
    world: world(),
    steps: [{ tick: 120 },
      { command: "whistle", model: { mode: "type" }, effects: [], shared: { "whistle.events": { v: 1, events: [UNKNOWN(1, "whistle")] } } },
      { command: "mode:foo", model: { mode: "type" }, effects: [], shared: { "whistle.events": { v: 1, events: [UNKNOWN(1, "whistle"), UNKNOWN(2, "mode:foo")] } } }],
  },
  {
    name: "A mod's name may hold any characters: whistle takes its mappings and switches it by name",
    world: world({ mods: ["my mod:2"], entries: { "my mod:2": entry({ z: ["Zap", "my.zap"] }) } }),
    steps: [{ tick: 120, shared: { "whistle.config": { v: 1, problems: [], mods: [{ name: "my mod:2", on: true, problems: [] }], conflicts: [], overrides: [] } } },
      { command: "mappings-off:my mod:2", effects: [
        { write: "whistle.json", text: `${JSON.stringify({ mods: { "my mod:2": false } }, null, 2)}\n`, expected: null }] }],
  },

  // The whistle state's inert field.
  {
    name: "A copy inert on an old Herdr, with no other copy running, publishes the state with inert and whistle-inert, once",
    world: { herdr: "0.1.0", focused: { pane: "p1" } },
    steps: [
      { tick: 120, published: { v: 1, mode: "type", enabled: true, sequence: null, pane: null, onTerminal: false, field: null,
        inert: { problem: `Whistle needs Herdr ≥ ${MIN_HERDR} (this is 0.1.0)`, fix: "Update Herdr." } },
        shared: { "whistle.hints": undefined, "whistle.config": undefined, "whistle.events": { v: 1, events: [{ seq: 1, kind: "whistle-inert", groups: G["whistle-inert"],
          text: `Whistle needs Herdr ≥ ${MIN_HERDR} (this is 0.1.0)`, problem: `Whistle needs Herdr ≥ ${MIN_HERDR} (this is 0.1.0)`, fix: "Update Herdr." }] } } },
      { tick: 120, published: null },
      { world: { herdr: MIN_HERDR }, tick: 120, published: { v: 1, mode: "type", enabled: true, sequence: null, pane: null, onTerminal: false, field: null, inert: null } },
    ],
  },
  {
    name: "A new inert copy doesn't raise whistle-inert again when the whistle state already says that reason",
    world: { herdr: "0.1.0", focused: { pane: "p1" }, state: { v: 1, mode: "type", enabled: true, sequence: null, pane: null, onTerminal: false, field: null,
      inert: { problem: `Whistle needs Herdr ≥ ${MIN_HERDR} (this is 0.1.0)`, fix: "Update Herdr." } } },
    steps: [{ tick: 120, raised: [] }, { tick: 120, raised: [] },
      { world: { herdr: "0.0.1" }, tick: 120, raised: [{ kind: "whistle-inert", problem: `Whistle needs Herdr ≥ ${MIN_HERDR} (this is 0.0.1)` }] }],
  },
  {
    name: "A copy inert while another copy runs writes no state",
    world: { folder: "whistle-2", copies: { whistle: VERSION, "whistle-2": VERSION },
      layout: { id: "root", type: "column", children: [term("main"), anchor, { id: "anchor-2", type: "block", content: { mod: "whistle-2" } }] } },
    steps: [{ tick: 120, published: null, shared: { "whistle.hints": undefined, "whistle.events": undefined, "whistle.config": undefined } }],
  },
  {
    name: "A copy inert on an old Herdr writes no state while another copy would run",
    world: { herdr: "0.1.0", folder: "whistle-2", copies: { whistle: VERSION, "whistle-2": VERSION },
      layout: { id: "root", type: "column", children: [term("main"), anchor, { id: "anchor-2", type: "block", content: { mod: "whistle-2" } }] } },
    steps: [{ tick: 120, published: null }],
  },

  // Subscriptions (events.md): kept in the private whistle.subscribers, pushed only to mods that show.
  {
    name: "subscribe keeps the filter in whistle.subscribers; the same filter again writes nothing; unsubscribe removes it",
    world: world({ mods: ["notes"] }),
    steps: [{ tick: 120 },
      { command: 'subscribe:{"mod":"notes","groups":["mode"],"kinds":["command-ran"]}',
        effects: [{ setShared: "whistle.subscribers", value: { notes: { groups: ["mode"], kinds: ["command-ran"] } } }] },
      { command: 'subscribe:{"mod":"notes","groups":["mode"],"kinds":["command-ran"]}', effects: [] },
      { command: "unsubscribe:notes", effects: [{ setShared: "whistle.subscribers", value: {} }] },
      { command: "unsubscribe:notes", effects: [], raised: [] }],
  },
  {
    name: "A new copy of whistle reads the subscriptions back and pushes to them",
    world: { ...world({ mods: ["notes"] }), subscribers: { notes: {} } },
    steps: [{ tick: 120 }, { command: "switch-mode", effects: [{ focusAnchor: true },
      { run: 'notes.whistle-event:{"seq":1,"kind":"mode-switched","groups":["mode"],"text":"WHISTLE","from":"type","to":"whistle"}' },
      { run: 'notes.whistle-event:{"seq":2,"kind":"field-selected","groups":["field"],"text":"main selected","block":"main"}' }] }],
  },
  {
    name: "whistle.subscribers is the source of truth: a subscribe builds on what another copy wrote since",
    world: world({ mods: ["notes", "tree"] }),
    steps: [{ tick: 120 },
      { command: 'subscribe:{"mod":"notes"}', effects: [{ setShared: "whistle.subscribers", value: { notes: {} } }] },
      { world: { subscribers: {} }, command: 'subscribe:{"mod":"tree"}', effects: [{ setShared: "whistle.subscribers", value: { tree: {} } }] }],
  },
  {
    name: "subscribe and unsubscribe work while WHISTLE is switched off",
    world: world({ mods: ["notes"], user: { enabled: false } }),
    steps: [{ tick: 120 }, { command: 'subscribe:{"mod":"notes"}', effects: [{ setShared: "whistle.subscribers", value: { notes: {} } }] }],
  },
  {
    name: "A subscribe whose groups aren't strings raises command-failed and keeps nothing",
    world: world({ mods: ["notes"] }),
    steps: [{ tick: 120 }, { command: 'subscribe:{"mod":"notes","groups":"mode"}', effects: [], raised: [{ kind: "command-failed" }] }],
  },
  {
    name: "A lone inert copy keeps the subscriptions: subscribe and unsubscribe write whistle.subscribers",
    world: { ...world({ mods: ["notes"] }), herdr: "0.1.0" },
    steps: [{ tick: 120 },
      { command: 'subscribe:{"mod":"notes"}', effects: [{ setShared: "whistle.subscribers", value: { notes: {} } }] },
      { command: "unsubscribe:notes", effects: [{ setShared: "whistle.subscribers", value: {} }] }],
  },
  {
    name: "A copy standing aside for another copy leaves the subscriptions to it",
    world: { ...world({ mods: ["notes"] }), folder: "whistle-2", copies: { whistle: VERSION, "whistle-2": VERSION },
      layout: { id: "root", type: "column", children: [term("main"), block("notes"), anchor, { id: "anchor-2", type: "block", content: { mod: "whistle-2" } }] } },
    steps: [{ tick: 120 }, { command: 'subscribe:{"mod":"notes"}', effects: [], raised: [] }],
  },
  {
    name: "A lone inert copy pushes nothing to its subscribers",
    world: { ...world({ mods: ["notes"] }), herdr: "0.1.0", subscribers: { notes: {} } },
    steps: [{ tick: 120, effects: [], raised: [{ kind: "whistle-inert" }] }],
  },
  {
    name: "A mapping to whistle's own verb, and the layout.show it runs to reveal a block, raise no command-ran",
    world: world({ layout: { id: "root", type: "column", children: [term("main"), { id: "log", type: "block", hidden: true, content: { pane: {} } },
      { ...anchor, content: { mod: "whistle", props: { mappings: { g: ["Log", "whistle.focus:log"], s: ["Split", "pane.split"] } } } }] } }),
    steps: [...IN, { key: "g", effects: [{ run: "layout.show", args: { id: "log" } }, { focusAnchor: true }], raised: [] },
      { key: "s", raised: [{ kind: "command-ran", command: "pane.split" }] }],
  },
  {
    name: "A move sent to a keynav field raises no command-ran",
    world: { ...world({ layout: { id: "root", type: "column", children: [{ id: "top", type: "row", children: [term("main"), { id: "tree", type: "block", content: { mod: "tree" } }] }, anchor] } }),
      shared: { "keynav.field:tree {}": { v: 3, label: "Tree", keys: {} } } },
    steps: [...IN, { key: "ctrl-l", raised: [{ kind: "field-selected", block: "tree" }] },
      { key: "l", effects: [{ run: "tree.keynav-right", args: {} }, { focusAnchor: true }], raised: [] }],
  },
  {
    name: "A keynav field's declared key, pressed, raises command-ran",
    world: { ...world({ layout: { id: "root", type: "column", children: [{ id: "top", type: "row", children: [term("main"), { id: "tree", type: "block", content: { mod: "tree" } }] }, anchor] } }),
      shared: { "keynav.field:tree {}": { v: 3, label: "Tree", keys: { d: "Delete" } } } },
    steps: [...IN, { key: "ctrl-l" },
      { key: "d", effects: [{ run: "tree.keynav-key-d", args: {} }, { focusAnchor: true }],
        raised: [{ kind: "command-ran", groups: ["command"], command: "tree.keynav-key-d", text: "ran tree.keynav-key-d" }] }],
  },
];

const EV = (seq) => ({ seq, kind: "key-unmapped", groups: ["sequence", "problem"], keys: ["x"], text: "x is not mapped" });
const MODE = (seq) => ({ seq, kind: "mode-switched", groups: ["mode"], from: "type", to: "whistle", text: "WHISTLE" });

export default suite("contract", (t) => {
  for (const sc of SCENARIOS) t.scenario(sc, core);

  // The copyable readers (whistle.js).
  const RUNNING = { v: 1, mode: "whistle", enabled: true, sequence: null, pane: "p1", onTerminal: false, field: "spaces", inert: null };
  t.check("readState gives the v1 fields, field and inert among them, and ignores the rest",
    [readState({ ...RUNNING, later: 1 }), readState({ ...RUNNING, mode: "type", field: null, inert: { problem: "p", fix: "f" } }).inert, readState({ v: 2 })],
    [{ mode: "whistle", enabled: true, sequence: null, pane: "p1", onTerminal: false, field: "spaces", inert: null }, { problem: "p", fix: "f" }, null]);
  t.check("hintsOf gives the v1 hints, else null", [hintsOf(PANES_HINTS), hintsOf(null), hintsOf({ ...PANES_HINTS, v: 2 })],
    [{ keys: "w", title: "Panes", items: PANES_HINTS.items, exit: null }, null, null]);
  t.check("configOf gives the v1 config, else null", [configOf({ v: 1, problems: [], mods: [], conflicts: [], overrides: [], later: 1 }), configOf({ v: 2 })],
    [{ problems: [], mods: [], conflicts: [], overrides: [] }, null]);
  const feed = { v: 1, events: [EV(3), EV(4), EV(5)] };
  t.check("eventsSince gives the events after the last seq handled, the new last, and none missed", eventsSince(feed, 3), { events: [EV(4), EV(5)], last: 5, missed: 0 });
  t.check("eventsSince gives nothing new when nothing came", eventsSince(feed, 5), { events: [], last: 5, missed: 0 });
  t.check("eventsSince counts the events that fell out of the window before they were read", eventsSince(feed, 0), { events: [EV(3), EV(4), EV(5)], last: 5, missed: 2 });
  t.check("eventsSince starts over when the seqs went back (whistle started again), missing none", eventsSince({ v: 1, events: [EV(4)] }, 9), { events: [EV(4)], last: 4, missed: 0 });
  t.check("eventsSince gives nothing for no feed or another v, keeping the last", [eventsSince(null, 4), eventsSince({ v: 2, events: [EV(9)] }, 4)],
    [{ events: [], last: 4, missed: 0 }, { events: [], last: 4, missed: 0 }]);
  const mixed = { v: 1, events: [MODE(1), EV(2), MODE(3)] };
  t.check("a groups filter keeps the events in any listed group, and last moves past every event read",
    eventsSince(mixed, 0, { groups: ["problem"] }), { events: [EV(2)], last: 3, missed: 0 });
  t.check("a kinds filter keeps the events of any listed kind", eventsSince(mixed, 1, { kinds: ["mode-switched"] }), { events: [MODE(3)], last: 3, missed: 0 });
  t.check("groups and kinds together keep an event that matches either",
    eventsSince(mixed, 0, { groups: ["problem"], kinds: ["mode-switched"] }).events, [MODE(1), EV(2), MODE(3)]);
  t.check("a filter naming neither groups nor kinds keeps every event", eventsSince(mixed, 0, {}).events, [MODE(1), EV(2), MODE(3)]);
  t.check("a predicate filter keeps the events it returns true for", eventsSince(mixed, 0, (e) => e.seq % 2 === 1).events, [MODE(1), MODE(3)]);
});
