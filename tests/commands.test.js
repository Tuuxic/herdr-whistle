// The stable command set (docs/contracts/commands.md): whistle.switch-mode and whistle.mode:type (modes
// suite), whistle.on, whistle.off and whistle.settings, and the verbs whistle.field,
// whistle.focus and whistle.toggle run by mappings (jump keys: the jump keys suite).

import { suite, TEST_DEFAULTS } from "./harness.js";
import * as core from "./step.js";
import { IN_TERMINAL, term, bar } from "./worlds.js";

const json = (v) => JSON.stringify(v);
const pretty = (v) => `${JSON.stringify(v, null, 2)}\n`;
const files = (u, map = {}) => ({ configFiles: { defaults: json({ ...TEST_DEFAULTS, map }), user: u } });
const IN = [{ command: "switch-mode" }, { world: { barFocused: true }, tick: 120 }];
const TO_TYPE = { run: "pane.focus", args: { pane: "p1" } };
const SETTINGS = { openOverlay: "settings", spec: { mod: "whistle", kind: "dialog", width: 640, height: 0.8, props: { part: "settings" } } };

// A terminal beside a sidebar (a stack of two terminals, "files" hidden behind "notes"), and
// a hidden "log" terminal under them.
const LAYOUT = { id: "root", type: "column", children: [
  { id: "top", type: "row", children: [
    term("main"),
    { id: "sidebar", type: "stack", active: "notes", children: [term("notes"), term("files")] },
  ] },
  { ...term("log"), hidden: true },
  bar,
] };
const mapped = (map) => ({ ...IN_TERMINAL, layout: LAYOUT, ...files(null, map) });
const HOLD = { focusBar: true };

const SCENARIOS = [
  // whistle.on / whistle.off: whistle.json's enabled.
  {
    name: "whistle.off writes enabled: false into whistle.json, keeping the rest",
    world: { ...IN_TERMINAL, ...files(json({ hints: false })) },
    steps: [{ command: "off", effects: [{ write: "whistle.json", text: pretty({ hints: false, enabled: false }), expected: json({ hints: false }) }] }],
  },
  {
    name: "whistle.on with no whistle.json writes one",
    world: { ...IN_TERMINAL, ...files(null) },
    steps: [{ command: "on", effects: [{ write: "whistle.json", text: pretty({ enabled: true }), expected: null }] }],
  },
  {
    name: "whistle.off in WHISTLE goes back to TYPE first",
    world: { ...IN_TERMINAL, ...files(null) },
    steps: [...IN, { command: "off", model: { mode: "type" },
      effects: [TO_TYPE, { write: "whistle.json", text: pretty({ enabled: false }), expected: null }] }],
  },
  {
    name: "whistle.on with a whistle.json that doesn't parse only flashes",
    world: { ...IN_TERMINAL, ...files("{ nope") },
    steps: [{ command: "on", effects: [], bar: { label: "whistle.json doesn't parse; fix it first" } }],
  },
  {
    name: "whistle.on works while whistle is switched off",
    world: { ...IN_TERMINAL, ...files(json({ enabled: false })) },
    steps: [{ command: "on", effects: [{ write: "whistle.json", text: pretty({ enabled: true }), expected: json({ enabled: false }) }] }],
  },
  {
    name: "A whistle.json write that fails flashes",
    world: { ...IN_TERMINAL, ...files(null) },
    steps: [{ command: "off" }, { wrote: "whistle.json", ok: false, error: "denied", bar: { label: "couldn't write whistle.json: denied" } }],
  },

  // whistle.settings.
  {
    name: "whistle.settings opens the settings",
    world: IN_TERMINAL,
    steps: [{ command: "settings", effects: [SETTINGS] }],
  },
  {
    name: "whistle.settings in WHISTLE goes back to TYPE first",
    world: IN_TERMINAL,
    steps: [...IN, { command: "settings", effects: [TO_TYPE, SETTINGS], model: { mode: "type" } }],
  },
  {
    name: "whistle.settings works while whistle is switched off",
    world: { ...IN_TERMINAL, ...files(json({ enabled: false })) },
    steps: [{ command: "settings", effects: [SETTINGS] }],
  },

  // whistle.field:<block>.
  {
    name: "whistle.field selects the field in that block",
    world: mapped({ n: ["Notes", "whistle.field:notes"] }),
    steps: [...IN, { key: "n", model: { field: "notes" }, effects: [], handled: true }],
  },
  {
    name: "whistle.field on a block that doesn't show flashes",
    world: mapped({ n: ["Log", "whistle.field:log"] }),
    steps: [...IN, { key: "n", model: { field: "main" }, bar: { label: "log can't be selected now" } }],
  },

  // whistle.focus:<block>.
  {
    name: "whistle.focus shows a hidden block and selects it once it shows",
    world: mapped({ g: ["Log", "whistle.focus:log"] }),
    steps: [...IN,
      { key: "g", effects: [{ run: "layout.show", args: { id: "log" } }, HOLD], model: { field: "main" } },
      { world: { layout: { ...LAYOUT, children: [LAYOUT.children[0], term("log"), bar] } }, tick: 120, model: { field: "log" } }],
  },
  {
    name: "whistle.focus selects a block behind another in a stack",
    world: mapped({ f: ["Files", "whistle.focus:files"] }),
    steps: [...IN, { key: "f", effects: [{ run: "layout.select", args: { stack: "sidebar", child: "files" } }, HOLD] }],
  },
  {
    name: "whistle.focus on a block that already shows selects it",
    world: mapped({ n: ["Notes", "whistle.focus:notes"] }),
    steps: [...IN, { key: "n", effects: [HOLD], model: { field: "notes" } }],
  },
  {
    name: "whistle.focus gives up on a block that doesn't show in time",
    world: mapped({ g: ["Log", "whistle.focus:log"] }),
    steps: [...IN, { key: "g" }, { tick: 2000, model: { field: "main", waitFor: null } }],
  },
  {
    name: "whistle.focus on a block the layout doesn't have flashes",
    world: mapped({ g: ["Ghost", "whistle.focus:ghost"] }),
    steps: [...IN, { key: "g", effects: [], bar: { label: "No ghost in this layout" } }],
  },

  // whistle.toggle:<block>.
  {
    name: "whistle.toggle hides a block that shows",
    world: mapped({ b: ["Sidebar", "whistle.toggle:sidebar"] }),
    steps: [...IN, { key: "b", effects: [{ run: "layout.hide", args: { id: "sidebar" } }, HOLD], model: { field: "main" } }],
  },
  {
    name: "whistle.toggle hiding the selected field moves WHISTLE to the terminal",
    world: mapped({ n: ["Notes", "whistle.field:notes"], b: ["Sidebar", "whistle.toggle:sidebar"] }),
    steps: [...IN, { key: "n", model: { field: "notes" } }, { key: "b", model: { field: "main" } }],
  },
  {
    name: "whistle.toggle shows a block that doesn't, without selecting it",
    world: mapped({ l: ["Log", "whistle.toggle:log"] }),
    steps: [...IN, { key: "l", effects: [{ run: "layout.show", args: { id: "log" } }, HOLD], model: { field: "main" } }],
  },

  // Bad verbs are config problems.
  {
    name: "An unknown whistle command in a mapping is skipped and listed",
    world: mapped({ x: ["Nope", "whistle.nope"], f: ["Field", "whistle.field"] }),
    steps: [{ tick: 120, model: { problems: [
      { source: "mappings.json", detail: "map › x: unknown whistle command whistle.nope" },
      { source: "mappings.json", detail: "map › f: whistle.field needs a block: whistle.field:<block>" },
    ] } }],
  },
];

export default suite("commands", (t) => {
  for (const sc of SCENARIOS) t.scenario(sc, core);
});
