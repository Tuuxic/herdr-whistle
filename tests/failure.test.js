// Failure behaviour (Failure behaviour, issue #10): broken files run on their last good version
// (else they're left out, and with no defaults whistle runs on built-in safety own keys), bad
// entries are skipped, every config problem is listed for settings with a marker on the bar, a
// failed press only flashes, and keys.json is never written while a source is broken.

import { suite, TEST_DEFAULTS } from "./harness.js";
import * as core from "./step.js";
import { IN_TERMINAL } from "./worlds.js";

const json = (v) => JSON.stringify(v);
const pretty = (v) => `${JSON.stringify(v, null, 2)}\n`;
const DEFAULTS = json({ keys: TEST_DEFAULTS.keys, map: { n: ["Next tab", "tab.next"] } });
// whistle.json (null: none; a string: as written) over the defaults.
const text = (v) => (v == null || typeof v === "string" ? v : json(v));
const files = (user, defaults = DEFAULTS) => ({ configFiles: { defaults: text(defaults), user: text(user) } });
const world = (user, defaults) => ({ ...IN_TERMINAL, ...files(user, defaults) });
const IN = [{ command: "whistle" }, { world: { barFocused: true }, tick: 120 }];
const ran = (command) => [{ run: command, args: {} }, { focusBar: true }];
const TO_TYPE = [{ run: "pane.focus", args: { pane: "p1" } }];
const SPACE = { map: { n: ["Next space", "space.next"] } };

// keys.json, for the claims: Ctrl+H/J/K/L are the only chords the test defaults need.
const KEYS = { global: {} };
const CLAIMED = { global: {}, "mod:whistle": {
  "ctrl-h": "whistle.key-ctrl-h", "ctrl-j": "whistle.key-ctrl-j", "ctrl-k": "whistle.key-ctrl-k", "ctrl-l": "whistle.key-ctrl-l",
} };
const keysFile = (t, extra = {}) => ({ keysFile: { text: t, error: null, at: 0, ...extra } });
const claiming = (user, defaults) => ({ ...world(user, defaults), platform: "linux", layoutName: "main", ...keysFile(json(KEYS)) });
const CLAIM = { write: "keys.json", text: pretty(CLAIMED), expected: json(KEYS) };

const COMMANDS = [
  { name: "tab.next", args: [] }, { name: "tab.prev", args: [] }, { name: "space.next", args: [] },
  { name: "space.select", args: [{ name: "index", required: true }] }, { name: "pane.close", args: [] },
];

const SCENARIOS = [
  // Broken files.
  {
    name: "A whistle.json that doesn't parse, with no last good version, is left out and listed",
    world: world("{ nope"),
    steps: [...IN, { key: "n", effects: ran("tab.next"),
      model: { problems: [{ source: "whistle.json", detail: "doesn't parse; whistle leaves it out until it parses" }] } }],
  },
  {
    name: "A whistle.json that breaks runs on its last good version",
    world: world(SPACE),
    steps: [...IN, { world: files("{ nope"), tick: 120,
      model: { problems: [{ source: "whistle.json", detail: "doesn't parse; whistle runs on its last good version" }] } },
    { key: "n", effects: ran("space.next") }],
  },
  {
    name: "A broken whistle.json fixed: the problem goes and the new version counts",
    world: world(SPACE),
    steps: [...IN, { world: files("{ nope"), tick: 120 },
      { world: files({ map: { n: ["Previous tab", "tab.prev"] } }), tick: 120, model: { problems: [] } },
      { key: "n", effects: ran("tab.prev") }],
  },
  {
    name: "A whistle.json taken away takes its mappings with it, and isn't a problem",
    world: world(SPACE),
    steps: [...IN, { world: files(null), tick: 120, model: { problems: [] } }, { key: "n", effects: ran("tab.next") }],
  },
  {
    name: "A mappings.json that doesn't parse, with no last good version: the safety own keys, a broken install",
    world: world(null, "{ nope"),
    steps: [...IN,
      { key: "n", effects: [], handled: false,
        model: { problems: [{ source: "mappings.json", detail: "doesn't parse: a broken install; whistle runs on its built-in safety keys" }] } },
      { key: "ctrl-l", handled: true },
      { key: "escape", effects: [], handled: true },
      { key: "i", effects: TO_TYPE, model: { mode: "type" } }],
  },
  {
    name: "A missing mappings.json: the safety own keys, a broken install",
    world: world(null, null),
    steps: [...IN, { key: "i", effects: TO_TYPE,
      model: { problems: [{ source: "mappings.json", detail: "is missing: a broken install; whistle runs on its built-in safety keys" }] } }],
  },
  {
    name: "A mappings.json that breaks runs on its last good version",
    world: world(null),
    steps: [...IN, { world: files(null, "{ nope"), tick: 120,
      model: { problems: [{ source: "mappings.json", detail: "doesn't parse; whistle runs on its last good version" }] } },
    { key: "n", effects: ran("tab.next") }],
  },
  {
    name: "A file that parses to something other than an object is broken",
    world: world("[1, 2]"),
    steps: [...IN, { key: "n", effects: ran("tab.next"),
      model: { problems: [{ source: "whistle.json", detail: "isn't a JSON object; whistle leaves it out until it parses" }] } }],
  },

  // Bad entries.
  {
    name: "A bad entry is skipped and listed; the rest of the file counts",
    world: { ...world({
      map: {
        p: ["Previous tab", "tab.prev"],
        x: ["Nope", "tab.nope"],
        "option-x": ["Nope", "tab.prev"],
        y: "tab.prev",
        z: ["Zap", "tab.prev", 1],
        w: { name: "Panes", map: { q: ["Close pane", "pane.close"], v: ["Split", 5] } },
        g: { name: "No map" },
        1: ["Space 1", "space.select:1"],
        m: ["A mod's", "picker.open"],
      },
      keys: { fly: ["f"], type: ["q", "ctrl-"], back: "backspace" },
    }), commands: COMMANDS },
    steps: [...IN,
      { key: "p", effects: ran("tab.prev"), model: { problems: [
        { source: "whistle.json", detail: "map › x: unknown command tab.nope" },
        { source: "whistle.json", detail: "map › option-x: \"option-x\" isn't a key name" },
        { source: "whistle.json", detail: "map › y: should be [label, command] or a group { name, map }" },
        { source: "whistle.json", detail: "map › z: its args should be an object" },
        { source: "whistle.json", detail: "map › w › v: should be [label, command] or a group { name, map }" },
        { source: "whistle.json", detail: "map › g: a group should be { name, map }" },
        { source: "whistle.json", detail: "keys › fly: unknown action" },
        { source: "whistle.json", detail: "keys › type: \"ctrl-\" isn't a key name" },
        { source: "whistle.json", detail: "keys › back: should be a list of keys" },
      ] } },
      { key: "x", effects: [], handled: false },
      { key: "w" }, { key: "q", effects: [{ run: "pane.focus", args: { pane: "p1" } }, ...ran("pane.close")] },
      { key: "1", effects: [{ run: "space.select", args: { index: "1" } }, { focusBar: true }] },
      { key: "m", effects: ran("picker.open") },
      { key: "q", effects: TO_TYPE, model: { mode: "type" } },
    ],
  },
  {
    name: "A bad entry in the layout's whistle block is listed under the layout",
    world: { ...world(null), commands: COMMANDS, layout: { id: "root", type: "column", children: [
      { id: "main", type: "block", content: { pane: {} } },
      { id: "bar", type: "block", content: { mod: "whistle", props: { mappings: { x: ["Nope", "tab.nope"] } } } },
    ] } },
    steps: [...IN, { tick: 120, model: { problems: [{ source: "layout", detail: "map › x: unknown command tab.nope" }] } }],
  },

  // The bar and settings.
  {
    name: "While there are problems the bar shows a marker, in TYPE and WHISTLE alike",
    world: world("{ nope"),
    steps: [
      { tick: 120, bar: { badge: "TYPE", label: "Terminal", marker: "⚠ 1" } },
      { command: "whistle" },
      { world: { barFocused: true }, tick: 120, bar: { badge: "WHISTLE", label: "Terminal · zsh", marker: "⚠ 1" } },
      { world: files(null), tick: 120, bar: { marker: null } },
    ],
  },
  {
    name: "A keys.json problem counts toward the bar's marker",
    world: { ...world(null), ...keysFile("{ nope") },
    steps: [{ tick: 120, bar: { marker: "⚠ 1" } }],
  },

  // Failed presses.
  {
    name: "A command that fails when pressed flashes, and isn't a problem",
    world: world(null),
    steps: [...IN,
      { key: "n", effects: ran("tab.next") },
      { ran: "tab.next", error: "no next tab", effects: [], bar: { label: "tab.next failed: no next tab", marker: null }, model: { problems: [] } },
      { tick: 120, bar: { label: "tab.next failed: no next tab" } },
      { key: "j", bar: { label: "Terminal · zsh" } }],
  },
  {
    name: "A flash is gone with the switch key too",
    world: world(null),
    steps: [...IN, { key: "n" }, { ran: "tab.next", error: "no next tab" },
      { command: "whistle", bar: { badge: "TYPE", label: "Terminal" } }],
  },
  {
    name: "A key that isn't mapped in a key sequence flashes and ends it",
    world: world({ map: { w: { name: "Panes", map: { q: ["Close pane", "pane.close"] } } } }),
    steps: [...IN,
      { key: "w", model: { sequence: ["w"] } },
      { key: "x", effects: [], handled: true, model: { sequence: null }, bar: { label: "w x is not mapped" } }],
  },

  // keys.json.
  {
    name: "No keys.json write while whistle.json doesn't parse, even with a last good version",
    world: { ...claiming({ map: {} }), ...keysFile(json(CLAIMED)) },
    steps: [{ tick: 120, effects: [] }, { world: { ...files("{ nope"), ...keysFile(json(KEYS)) }, tick: 120, effects: [] }],
  },
  {
    name: "No keys.json write while whistle.json doesn't parse, with no last good version",
    world: claiming("{ nope"),
    steps: [{ tick: 120, effects: [] }],
  },
  {
    name: "No keys.json write while mappings.json is missing",
    world: claiming(null, null),
    steps: [{ tick: 120, effects: [] }],
  },
  {
    name: "No keys.json write before whistle's files are read",
    world: { ...claiming(null), configFiles: {} },
    steps: [{ tick: 120, effects: [] }],
  },
  {
    name: "A broken whistle.json fixed: keys.json is written again",
    world: claiming("{ nope"),
    steps: [{ tick: 120, effects: [] }, { world: files({ map: {} }), tick: 120, effects: [CLAIM] }],
  },
  {
    name: "A keys.json that doesn't parse is checked again until it's fixed",
    world: { ...claiming(null), ...keysFile("{ nope") },
    steps: [
      { tick: 120, effects: [] },
      { tick: 120, effects: [] },
      { world: keysFile(json(KEYS)), tick: 120, effects: [CLAIM] },
    ],
  },
  {
    name: "keys.error cleared: claims come back",
    world: { ...claiming(null), ...keysFile(json(KEYS), { error: "bad key" }) },
    steps: [{ tick: 120, effects: [] }, { world: keysFile(json(KEYS)), tick: 120, effects: [CLAIM] }],
  },
  {
    name: "A bad entry doesn't stop keys.json being written; the bad entry's key isn't claimed",
    world: claiming({ map: { "ctrl-x": "bad" } }),
    steps: [{ tick: 120, effects: [CLAIM] }],
  },
];

export default suite("failure behaviour", (t) => {
  for (const sc of SCENARIOS) t.scenario(sc, core);
  // The settings' list: the config problems, then keys.json's.
  const m = { ...core.start(), problems: [{ source: "whistle.json", detail: "doesn't parse" }], claimProblem: "keys.json doesn't parse" };
  t.check("problems() lists config problems, then keys.json's", core.problems(m), [
    { source: "whistle.json", detail: "doesn't parse" }, { source: "keys.json", detail: "keys.json doesn't parse" },
  ]);
});
