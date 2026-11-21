// The switch key of a renamed copy (issue #35): Herdr hands a keys.json action to the mod its
// prefix names, so a copy in mods/whistle-2/ answers only to "whistle-2.*". When the global key
// bound to the switch command names another folder, the running copy lists a config problem
// (source keys.json). Whistle only reads global; it never writes it (ADR 0009).

import { suite, TEST_DEFAULTS } from "./harness.js";
import * as core from "./step.js";
import { term } from "./worlds.js";
import { VERSION } from "./version.js";

const json = (v) => JSON.stringify(v);
const keysFile = (keys) => ({ keysFile: { text: json(keys), error: null, at: 0 } });
const bar2 = { id: "bar2", type: "block", content: { mod: "whistle-2" } };
// The copy in mods/whistle-2/, running alone (mods/whistle/ left the layout and Herdr's mods).
const COPY2 = {
  layout: { id: "root", type: "column", children: [term("main"), bar2] },
  focused: { pane: "p1", terminal: "t1" }, panes: [{ pane: "p1", title: "zsh" }],
  folder: "whistle-2", copies: { "whistle-2": VERSION },
};
// Herdr's key bindings (keys()) for the copy in mods/whistle-2/: its switch key and a jump key.
const KEYS2 = [{ section: "global", keys: "ctrl-space", action: "whistle-2.switch-mode" },
  { section: "global", keys: "alt-a", action: "whistle-2.focus:agents" }];
const OFF = { configFiles: { defaults: json({ ...TEST_DEFAULTS, map: {} }), user: json({ enabled: false }) } };
const THROUGH = (key) => ({ model: { mode: "type" }, effects: [{ typeKey: key, terminal: "t1" }] });
const PROBLEM = { source: "keys.json", detail: "global › ctrl-space runs whistle.switch-mode, but this copy is whistle-2: make it whistle-2.switch-mode" };

const SCENARIOS = [
  {
    name: "A copy in mods/whistle-2/ whose switch key runs whistle.switch-mode lists a config problem",
    world: { ...COPY2, ...keysFile({ global: { "ctrl-space": "whistle.switch-mode", "alt-a": "whistle.focus:agents" } }) },
    steps: [{ tick: 120, model: { problems: [PROBLEM] }, problems: 1 }],
  },
  {
    name: "A copy in mods/whistle-2/ whose switch key runs whistle-2.switch-mode lists no problem",
    world: { ...COPY2, ...keysFile({ global: { "ctrl-space": "whistle-2.switch-mode", "alt-a": "whistle-2.focus:agents" } }) },
    steps: [{ tick: 120, model: { problems: [] }, problems: 0 }],
  },
  {
    name: "The copy in mods/whistle/ never lists the switch-key problem for whistle.switch-mode",
    world: { ...COPY2, folder: "whistle", copies: { whistle: VERSION },
      layout: { id: "root", type: "column", children: [term("main"), { ...bar2, content: { mod: "whistle" } }] },
      ...keysFile({ global: { "ctrl-space": "whistle.switch-mode" } }) },
    steps: [{ tick: 120, model: { problems: [] }, problems: 0 }],
  },
  {
    name: "A switch key outside global is not the switch-key problem (whistle only reads global)",
    world: { ...COPY2, ...keysFile({ global: { "ctrl-space": "whistle-2.switch-mode" }, terminal: { "ctrl-q": "whistle.switch-mode" } }) },
    steps: [{ tick: 120, model: { problems: [] } }],
  },

  // Switched off or inert, a renamed copy's switch key and jump keys type into the terminal
  // (#31 rule 5): Herdr hands it "whistle-2.*" lines, so it looks its keys up under its folder.
  {
    name: "Switched off, a copy in mods/whistle-2/ types its switch key and a jump key through",
    world: { ...COPY2, keys: KEYS2, ...OFF },
    steps: [{ command: "switch-mode", ...THROUGH("ctrl-space") }, { command: "focus:agents", ...THROUGH("alt-a") }],
  },
  {
    name: "Inert, a copy in mods/whistle-2/ types its switch key and a jump key through",
    world: { ...COPY2, keys: KEYS2, herdr: "0.1.14" },
    steps: [{ command: "switch-mode", ...THROUGH("ctrl-space") }, { command: "focus:agents", ...THROUGH("alt-a") }],
  },
];

export default suite("a renamed copy's switch key", (t) => {
  for (const sc of SCENARIOS) t.scenario(sc, core);
});
