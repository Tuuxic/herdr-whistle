// Keynav v2 (ADR 0009, docs/contracts/keynav.md): a mod's block is a field once its entry
// shared("keynav.field:<fieldKey>") says v 2; whistle names the selected one in
// shared("keynav") = { v: 2, active }, sends it moves and its declared keys as
// <mod>.keynav-* commands, and reads only its request slot.

import { suite, TEST_DEFAULTS } from "./harness.js";
import * as core from "./step.js";
import { term, bar } from "./worlds.js";
import { fieldKey } from "./fields.js";
import * as helper from "./keynav.js";

// A terminal with a files block to its right, over the bar.
const files = (props) => ({ id: "files", type: "block", content: { mod: "files", ...(props ? { props } : {}) } });
const LAYOUT = { id: "root", type: "column", children: [{ id: "top", type: "row", children: [term("main"), files()] }, bar] };
const NO_FILES = { id: "root", type: "column", children: [{ id: "top", type: "row", children: [term("main")] }, bar] };
const KEY = "files {}";
const entry = (keys = {}, label = "Files") => ({ [`keynav.field:${KEY}`]: { v: 2, label, keys } });
const WORLD = { layout: LAYOUT, focused: { pane: "p1", terminal: "t1" }, panes: [{ pane: "p1", title: "zsh" }] };
const IN = [{ command: "whistle" }, { world: { barFocused: true }, tick: 120 }];
// Defaults with one mapping on d, over the test defaults' own keys.
const MAPPED = { configFiles: { defaults: JSON.stringify({ keys: TEST_DEFAULTS.keys, map: { d: ["Next tab", "tab.next"] } }), user: null } };
const ACTIVE = { setShared: "keynav", value: { v: 2, active: KEY } };

const SCENARIOS = [
  // A field appearing.
  {
    name: "A mod's block is a field once its entry announces v 2: Ctrl+L selects it and names it active",
    world: { ...WORLD, shared: entry() },
    steps: [...IN, { key: "ctrl-l", handled: true, effects: [ACTIVE], model: { field: "files" }, bar: { label: "Files" } }],
  },
  {
    name: "A field appearing: a block with no entry isn't a field until its mod announces",
    world: WORLD,
    steps: [...IN,
      { key: "ctrl-l", effects: [], model: { field: "main" } },
      { world: { shared: entry() }, key: "ctrl-l", effects: [ACTIVE], model: { field: "files" } }],
  },
  // Moves.
  ...[["j", "down"], ["k", "up"], ["h", "left"], ["l", "right"], ["enter", "open"]].map(([key, move]) => ({
    name: `${key} in a keynav field sends it ${move} as files.keynav-${move}`,
    world: { ...WORLD, shared: entry() },
    steps: [...IN, { key: "ctrl-l" },
      { key, handled: true, effects: [{ run: `files.keynav-${move}`, args: {} }, { focusBar: true }], model: { field: "files" } }],
  })),
  {
    name: "A field's moves go to its own mod, by the block's mod name",
    world: { ...WORLD, layout: { ...LAYOUT, children: [{ id: "top", type: "row", children: [term("main"), { id: "tree", type: "block", content: { mod: "tree", props: { root: "~" } } }] }, bar] },
      shared: { 'keynav.field:tree {"root":"~"}': { v: 2, label: "Tree", keys: {} } } },
    steps: [...IN, { key: "ctrl-l", effects: [{ setShared: "keynav", value: { v: 2, active: 'tree {"root":"~"}' } }] },
      { key: "j", effects: [{ run: "tree.keynav-down", args: {} }, { focusBar: true }] }],
  },
  {
    name: "A field whose props hold an object inside an array is found by its entry, keys sorted inside the array too",
    world: { ...WORLD, layout: { ...LAYOUT, children: [{ id: "top", type: "row", children: [term("main"),
      { id: "tree", type: "block", content: { mod: "tree", props: { roots: [{ name: "home", at: "~" }] } } }] }, bar] },
      shared: { 'keynav.field:tree {"roots":[{"at":"~","name":"home"}]}': { v: 2, label: "Tree", keys: {} } } },
    steps: [...IN, { key: "ctrl-l", model: { field: "tree" }, bar: { label: "Tree" } }],
  },
  // Declared keys.
  {
    name: "A declared key beats a mapping while its field is selected, and arrives as keynav-key-<name>",
    world: { ...WORLD, ...MAPPED, shared: entry({ d: "Delete" }) },
    steps: [...IN,
      { key: "d", effects: [{ run: "tab.next", args: {} }, { focusBar: true }] },
      { key: "ctrl-l" },
      { key: "d", handled: true, effects: [{ run: "files.keynav-key-d", args: {} }, { focusBar: true }] }],
  },
  {
    name: "An own key beats a declared key: the declared key is ignored and listed as a config problem",
    world: { ...WORLD, shared: entry({ j: "Jump", x: "Cut" }) },
    steps: [...IN, { key: "ctrl-l" },
      { key: "j", effects: [{ run: "files.keynav-down", args: {} }, { focusBar: true }],
        model: { fieldProblems: [{ source: "keynav", detail: "Files (files) declares j, one of whistle's own keys; it's ignored" }] } },
      { key: "x", effects: [{ run: "files.keynav-key-x", args: {} }, { focusBar: true }] },
      { tick: 120, bar: { marker: "⚠ 1" } }],
  },
  {
    name: "A key the field doesn't declare never reaches it",
    world: { ...WORLD, shared: entry({ d: "Delete" }) },
    steps: [...IN, { key: "ctrl-l" }, { key: "x", handled: false, effects: [] }],
  },
  {
    name: "A field declares its keys in any spelling and gets them back as it wrote them",
    world: { ...WORLD, platform: "linux", shared: entry({ D: "Delete all", Tab: "Next" }) },
    steps: [...IN, { key: "ctrl-l" },
      { key: "D", effects: [{ run: "files.keynav-key-D", args: {} }, { focusBar: true }] },
      { key: "tab", effects: [{ run: "files.keynav-key-Tab", args: {} }, { focusBar: true }] }],
  },
  {
    name: "A declared chord is ignored and listed: fields declare only keys without Ctrl, Alt or Super",
    world: { ...WORLD, shared: entry({ "ctrl-d": "Delete" }) },
    steps: [...IN, { key: "ctrl-l" },
      { key: "ctrl-d", handled: false, effects: [],
        model: { fieldProblems: [{ source: "keynav", detail: "Files (files) declares ctrl-d, a chord; fields declare only keys without Ctrl, Alt or Super" }] } }],
  },
  {
    name: "Declared keys count only while their field is selected",
    world: { ...WORLD, ...MAPPED, shared: entry({ d: "Delete" }) },
    steps: [...IN, { key: "ctrl-l" }, { key: "ctrl-h", model: { field: "main" } },
      { key: "d", effects: [{ run: "tab.next", args: {} }, { focusBar: true }] }],
  },
  {
    name: "A field announcing again changes its declared keys",
    world: { ...WORLD, shared: entry({ d: "Delete" }) },
    steps: [...IN, { key: "ctrl-l" },
      { world: { shared: entry({ r: "Rename" }) }, key: "d", handled: false, effects: [] },
      { key: "r", effects: [{ run: "files.keynav-key-r", args: {} }, { focusBar: true }] }],
  },
  {
    name: "Inside a key sequence, keys are the group's: a declared key doesn't count",
    world: { ...WORLD, configFiles: { defaults: JSON.stringify({ keys: TEST_DEFAULTS.keys, map: { g: { name: "Go", map: { d: ["Next tab", "tab.next"] } } } }), user: null },
      shared: entry({ d: "Delete" }) },
    steps: [...IN, { key: "ctrl-l" }, { key: "g" }, { key: "d", effects: [{ run: "tab.next", args: {} }, { focusBar: true }] }],
  },
  // A field leaving.
  {
    name: "A field leaving the layout while selected: the terminal is selected and keynav names none",
    world: { ...WORLD, shared: entry() },
    steps: [...IN, { key: "ctrl-l" },
      { world: { layout: NO_FILES }, tick: 120, effects: [{ setShared: "keynav", value: { v: 2, active: null } }],
        model: { field: "main" }, bar: { label: "Terminal · zsh" } },
      { tick: 120, effects: [] }],
  },
  {
    name: "A field whose entry goes away is no longer a field",
    world: { ...WORLD, shared: entry() },
    steps: [...IN, { key: "ctrl-l" },
      { world: { shared: {} }, tick: 120, effects: [{ setShared: "keynav", value: { v: 2, active: null } }], model: { field: "main" } }],
  },
  {
    name: "Back to TYPE, keynav names no field",
    world: { ...WORLD, shared: entry() },
    steps: [...IN, { key: "ctrl-l" },
      { command: "whistle", effects: [{ run: "pane.focus", args: { pane: "p1" } }, { setShared: "keynav", value: { v: 2, active: null } }] }],
  },
  {
    name: "A field another driver left named active is set straight on the first step",
    world: { ...WORLD, shared: { ...entry(), keynav: { v: 2, active: KEY } } },
    steps: [{ tick: 120, effects: [{ setShared: "keynav", value: { v: 2, active: null } }] }, { tick: 120, effects: [] }],
  },
  // Requests.
  {
    name: "A field asking for the terminal: whistle selects it on the pane the field focused, and holds the keyboard",
    world: { ...WORLD, shared: entry() },
    steps: [...IN, { key: "ctrl-l" },
      { world: { barFocused: false, focused: { pane: "p2", terminal: "t1" }, shared: { ...entry(), [`keynav.request:${KEY}`]: { to: "terminal", at: 150 } } },
        tick: 120, effects: [{ focusBar: true }, { setShared: "keynav", value: { v: 2, active: null } }],
        model: { mode: "whistle", field: "main", pane: "p2", holdUntil: 840 } }],
  },
  {
    name: "A field asking to hold: whistle takes the keyboard back instead of leaving WHISTLE",
    world: { ...WORLD, shared: entry() },
    steps: [...IN, { key: "ctrl-l" },
      { world: { barFocused: false, shared: { ...entry(), [`keynav.request:${KEY}`]: { hold: true, at: 150 } } },
        tick: 120, effects: [{ focusBar: true }], model: { mode: "whistle", field: "files", holdUntil: 840 } },
      { world: { barFocused: true }, tick: 120, effects: [] }],
  },
  {
    name: "A request is acted on once",
    world: { ...WORLD, shared: entry() },
    steps: [...IN, { key: "ctrl-l" },
      { world: { shared: { ...entry(), [`keynav.request:${KEY}`]: { hold: true, at: 150 } } }, tick: 120, model: { holdUntil: 840 } },
      { tick: 1000, model: { holdUntil: 840 } }],
  },
  {
    name: "A request from before the field was selected doesn't count",
    world: { ...WORLD, shared: { ...entry(), [`keynav.request:${KEY}`]: { to: "terminal", at: 100 } } },
    steps: [...IN, { key: "ctrl-l" }, { tick: 120, effects: [], model: { field: "files", holdUntil: 0 } }],
  },
  {
    name: "Only the selected field's request slot counts",
    world: { ...WORLD, shared: entry() },
    steps: [...IN,
      { world: { shared: { ...entry(), [`keynav.request:${KEY}`]: { to: "terminal", at: 150 } } }, tick: 120, effects: [], model: { field: "main", holdUntil: 0 } },
      { world: { shared: { ...entry(), 'keynav.request:tree {}': { hold: true, at: 400 } } }, key: "ctrl-l" },
      { tick: 120, effects: [], model: { field: "files", holdUntil: 0 } }],
  },
  {
    name: "In TYPE, requests are left alone",
    world: { ...WORLD, shared: entry() },
    steps: [...IN, { key: "ctrl-l" }, { world: { barFocused: false }, tick: 120, model: { mode: "type" } },
      { world: { shared: { ...entry(), [`keynav.request:${KEY}`]: { hold: true, at: 300 } } }, tick: 120, effects: [], model: { mode: "type" } }],
  },
  // Versions.
  {
    name: "A copy that announces keynav v1 isn't a field, and settings say to update its keynav.js",
    world: { ...WORLD, shared: { "keynav.fields": { [KEY]: { v: 1, mod: "files", props: {}, label: "Files" } } } },
    steps: [...IN, { key: "ctrl-l", effects: [], model: { field: "main",
      fieldProblems: [{ source: "keynav", detail: "files speaks keynav v1, which whistle no longer drives; update its keynav.js" }] } }],
  },
  {
    name: "An entry with a v this driver doesn't speak isn't a field",
    world: { ...WORLD, shared: { [`keynav.field:${KEY}`]: { v: 3, label: "Files", keys: {} } } },
    steps: [...IN, { key: "ctrl-l", effects: [], model: { field: "main" } }],
  },
];

export default suite("keynav", (t) => {
  for (const sc of SCENARIOS) t.scenario(sc, core);

  // keynav.js, the helper fields copy: it must spell what the driver reads.
  for (const [mod, props] of [["files", undefined], ["tree", { root: "~", b: [1, { y: 2, x: 1 }] }]])
    t.check(`keynav.js keys ${mod}'s field as whistle does`, helper.fieldKey(mod, props), fieldKey(mod, props));
  // The contract's form: object keys sorted at every depth, objects inside arrays too; arrays keep
  // their order.
  const nested = { root: "~", list: [{ y: 2, x: 1 }, 3], b: { d: 1, c: [] } };
  const want = 'tree {"b":{"c":[],"d":1},"list":[{"x":1,"y":2},3],"root":"~"}';
  t.check("whistle keys a field with objects inside arrays sorted at every depth", fieldKey("tree", nested), want);
  t.check("keynav.js keys a field with objects inside arrays sorted at every depth", helper.fieldKey("tree", nested), want);
  t.check("keynav.js's entry is v 2 with the label and declared keys", helper.entry("Files", { d: "Delete" }), { v: 2, label: "Files", keys: { d: "Delete" } });
  t.check("keynav.js's entry declares no keys by default", helper.entry("Files"), { v: 2, label: "Files", keys: {} });
  t.check("keynav.js reads a move", helper.move("keynav-down"), "down");
  t.check("keynav.js reads open", helper.move("keynav-open"), "open");
  t.check("a declared key isn't a move", helper.move("keynav-key-d"), null);
  t.check("keynav.js reads a declared key as the field wrote it", helper.declared("keynav-key-D"), "D");
  t.check("keynav.js ignores other commands", [helper.move("settings"), helper.declared("settings"), helper.move(null)], [null, null, null]);
  t.check("keynav.js's shared keys are whistle's", [helper.entryKey("files {}"), helper.requestKey("files {}")],
    ["keynav.field:files {}", "keynav.request:files {}"]);
});
