// Jump keys (ADR 0014, docs/contracts/commands.md "Jump keys"): a keys.json line
// "whistle.<verb>:<block>" runs a verb on a block from either mode and goes to WHISTLE.
// Herdr hands the command over as the text after "whistle.", so the scenarios send
// { command: "focus:agents" }.

import { suite, TEST_DEFAULTS } from "./harness.js";
import * as core from "./step.js";
import { STOCK, term, bar, stock } from "./worlds.js";

const json = (v) => JSON.stringify(v);
const IN_STOCK = { layout: STOCK, focused: { pane: "p1", terminal: "t1" }, panes: [{ pane: "p1", title: "zsh" }] };
const IN = [{ command: "switch-mode" }, { world: { barFocused: true }, tick: 120 }];
const HOLD = { focusBar: true };
// Blocks whose ids hold colons: "test" and "test:stay" (ADR 0014's example).
const COLONS = { id: "root", type: "column", children: [
  { id: "top", type: "row", children: [term("main"), term("test"), term("test:stay")] }, bar] };
// Herdr's stock layout with a hidden "log" terminal under it.
const WITH_LOG = { ...STOCK, children: [STOCK.children[0], { ...term("log"), hidden: true }, bar] };
// Herdr's key bindings (keys()): the switch key and a jump key.
const KEYS = [{ section: "global", keys: "ctrl-space", action: "whistle.switch-mode" },
  { section: "global", keys: "alt-a", action: "whistle.focus:agents" }];
const keysFile = (keys) => ({ text: json(keys), error: null, at: 0 });
const files = (map, user = null) => ({ configFiles: { defaults: json({ ...TEST_DEFAULTS, map }), user } });

const SCENARIOS = [
  // Rule 2: a jump key runs its verb and goes to WHISTLE.
  {
    name: "A jump key in TYPE goes to WHISTLE with its block's field selected",
    world: IN_STOCK,
    steps: [{ command: "focus:agents", model: { mode: "whistle", field: "agents" }, effects: [HOLD], bar: { badge: "WHISTLE" } }],
  },

  // Rule 1: everything after the first colon is the block id, exactly as written.
  {
    name: "A jump key's block id may hold colons",
    world: { ...IN_STOCK, layout: COLONS },
    steps: [{ command: "field:test:stay", model: { mode: "whistle", field: "test:stay" } }],
  },
  {
    name: "A jump key names the block by its whole id, not the part before a second colon",
    world: { ...IN_STOCK, layout: COLONS },
    steps: [{ command: "field:test:other", model: { mode: "type" }, bar: { label: "test:other can't be selected now" } }],
  },

  // Rule 4: a verb that can't run stays in TYPE and flashes, for a short time.
  {
    name: "A jump key to a block the layout lacks stays in TYPE and flashes",
    world: IN_STOCK,
    steps: [{ command: "focus:ghost", model: { mode: "type" }, effects: [], bar: { badge: "TYPE", label: "No ghost in this layout" } }],
  },
  {
    name: "A jump key's flash in TYPE ends after a short time",
    world: IN_STOCK,
    steps: [{ command: "focus:ghost" }, { tick: 500, bar: { label: "No ghost in this layout" } },
      { tick: 2000, bar: { label: "Terminal" } }],
  },
  {
    name: "whistle.field on a hidden block from TYPE stays in TYPE and flashes",
    world: { ...IN_STOCK, layout: WITH_LOG },
    steps: [{ command: "field:log", model: { mode: "type" }, effects: [], bar: { label: "log can't be selected now" } }],
  },
  {
    name: "A jump key that can't run in WHISTLE stays in WHISTLE and flashes",
    world: IN_STOCK,
    steps: [...IN, { command: "focus:ghost", model: { mode: "whistle", field: "main" }, effects: [], bar: { label: "No ghost in this layout" } }],
  },

  // Rule 2: every verb goes to WHISTLE; only toggle-keep-mode keeps the mode.
  {
    name: "whistle.field as a jump key in TYPE goes to WHISTLE on that field",
    world: IN_STOCK,
    steps: [{ command: "field:spaces", model: { mode: "whistle", field: "spaces" }, effects: [HOLD] }],
  },
  {
    name: "whistle.focus as a jump key shows a hidden block, goes to WHISTLE and selects it once it shows",
    world: { ...IN_STOCK, layout: WITH_LOG },
    steps: [
      { command: "focus:log", model: { mode: "whistle", field: "main" }, effects: [{ run: "layout.show", args: { id: "log" } }, HOLD] },
      { world: { barFocused: true, layout: { ...WITH_LOG, children: [WITH_LOG.children[0], term("log"), bar] } }, tick: 120, model: { mode: "whistle", field: "log" } },
    ],
  },
  {
    name: "whistle.toggle as a jump key in TYPE hides the block and goes to WHISTLE",
    world: IN_STOCK,
    steps: [{ command: "toggle:sidebar", model: { mode: "whistle", field: "main" }, effects: [{ run: "layout.hide", args: { id: "sidebar" } }, HOLD] }],
  },
  {
    name: "whistle.toggle-keep-mode in TYPE hides the block and stays in TYPE",
    world: IN_STOCK,
    steps: [{ command: "toggle-keep-mode:sidebar", model: { mode: "type" }, effects: [{ run: "layout.hide", args: { id: "sidebar" } }], bar: { badge: "TYPE" } }],
  },
  {
    name: "whistle.toggle-keep-mode in TYPE shows a hidden block and stays in TYPE",
    world: { ...IN_STOCK, layout: WITH_LOG },
    steps: [{ command: "toggle-keep-mode:log", model: { mode: "type" }, effects: [{ run: "layout.show", args: { id: "log" } }] }],
  },
  {
    name: "whistle.toggle-keep-mode in WHISTLE hides the block and stays in WHISTLE",
    world: IN_STOCK,
    steps: [...IN, { command: "toggle-keep-mode:sidebar", model: { mode: "whistle", field: "main" }, effects: [{ run: "layout.hide", args: { id: "sidebar" } }, HOLD] }],
  },
  {
    name: "whistle.toggle-keep-mode on a block the layout lacks flashes in TYPE",
    world: IN_STOCK,
    steps: [{ command: "toggle-keep-mode:ghost", model: { mode: "type" }, effects: [], bar: { label: "No ghost in this layout" } }],
  },
  {
    name: "field-keep-mode and focus-keep-mode are unknown commands: nothing happens",
    world: IN_STOCK,
    steps: [{ command: "field-keep-mode:agents", model: { mode: "type" }, effects: [] },
      { command: "focus-keep-mode:agents", model: { mode: "type" }, effects: [] }],
  },

  // Rule 6: in WHISTLE a jump key ends a key sequence and runs its verb; it never goes to TYPE.
  {
    name: "A jump key in a key sequence ends the sequence and runs its verb",
    world: { ...IN_STOCK, ...files({ w: { name: "Windows", map: { v: ["Split", "pane.split"] } } }) },
    steps: [...IN, { key: "w", model: { sequence: ["w"] } },
      { command: "focus:agents", model: { mode: "whistle", sequence: null, field: "agents" } }],
  },
  {
    name: "A jump key on the field already selected keeps it selected and stays in WHISTLE",
    world: IN_STOCK,
    steps: [{ command: "focus:agents" }, { world: { barFocused: true }, tick: 120 },
      { command: "focus:agents", model: { mode: "whistle", field: "agents" } },
      { command: "field:agents", model: { mode: "whistle", field: "agents" } }],
  },

  // Rule 5: switched off or inert, a jump key types into the terminal, as the switch key does.
  {
    name: "Switched off, a jump key types into the terminal",
    world: { ...IN_STOCK, keys: KEYS, ...files({}, json({ enabled: false })) },
    steps: [{ command: "focus:agents", model: { mode: "type" }, effects: [{ typeKey: "alt-a", terminal: "t1" }] }],
  },
  {
    name: "Inert, a jump key types into the terminal",
    world: { ...IN_STOCK, keys: KEYS, herdr: "0.1.14" },
    steps: [{ command: "focus:agents", model: { mode: "type" }, effects: [{ typeKey: "alt-a", terminal: "t1" }] }],
  },

  // Rule 3: a mapping accepts toggle-keep-mode and runs it as toggle.
  {
    name: "A mapping runs whistle.toggle-keep-mode as whistle.toggle",
    world: { ...IN_STOCK, ...files({ b: ["Sidebar", "whistle.toggle-keep-mode:sidebar"] }) },
    steps: [...IN, { key: "b", model: { mode: "whistle", problems: [] }, effects: [{ run: "layout.hide", args: { id: "sidebar" } }, HOLD] }],
  },

  // Rule 7: a keys.json jump key with an unknown verb is a config problem; a block the layout
  // lacks isn't.
  {
    name: "A keys.json jump key with an unknown verb is listed as a config problem",
    world: { ...IN_STOCK, keysFile: keysFile({ global: { "alt-a": "whistle.fcous:agents", "alt-s": "whistle.focus:spaces" } }) },
    steps: [{ tick: 120, model: { problems: [{ source: "keys.json", detail: "global › alt-a: unknown whistle command whistle.fcous:agents" }] }, bar: { marker: "⚠ 1" } }],
  },
  {
    name: "A keys.json field-keep-mode jump key is a config problem",
    world: { ...IN_STOCK, keysFile: keysFile({ global: { "alt-a": "whistle.field-keep-mode:agents" } }) },
    steps: [{ tick: 120, model: { problems: [{ source: "keys.json", detail: "global › alt-a: unknown whistle command whistle.field-keep-mode:agents" }] } }],
  },
  {
    name: "A keys.json jump key to a block the shown layout lacks is not a config problem",
    world: { ...IN_STOCK, keysFile: keysFile({ global: { "alt-g": "whistle.focus:ghost", "alt-c": "whistle.toggle-keep-mode:a:b" }, "mod:whistle": { j: "whistle.key-j" } }) },
    steps: [{ tick: 120, model: { problems: [] }, bar: { marker: null } }],
  },
];

export default suite("jump keys", (t) => {
  for (const sc of SCENARIOS) t.scenario(sc, core);
});
