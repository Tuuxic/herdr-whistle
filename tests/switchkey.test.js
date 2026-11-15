// The switch key of a renamed copy (issue #35): Herdr hands a keys.json action to the mod its
// prefix names, so a copy in mods/whistle-2/ answers only to "whistle-2.*". When the global key
// bound to the switch command names another folder, the running copy lists a config problem
// (source keys.json). Whistle only reads global; it never writes it (ADR 0001).

import { suite } from "./harness.js";
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
const PROBLEM = { source: "keys.json", detail: "global › ctrl-space runs whistle.whistle, but this copy is whistle-2: make it whistle-2.whistle" };

const SCENARIOS = [
  {
    name: "A copy in mods/whistle-2/ whose switch key runs whistle.whistle lists a config problem",
    world: { ...COPY2, ...keysFile({ global: { "ctrl-space": "whistle.whistle", "alt-a": "whistle.focus:agents" } }) },
    steps: [{ tick: 120, model: { problems: [PROBLEM] }, bar: { marker: "⚠ 1" } }],
  },
  {
    name: "A copy in mods/whistle-2/ whose switch key runs whistle-2.whistle lists no problem",
    world: { ...COPY2, ...keysFile({ global: { "ctrl-space": "whistle-2.whistle", "alt-a": "whistle-2.focus:agents" } }) },
    steps: [{ tick: 120, model: { problems: [] }, bar: { marker: null } }],
  },
  {
    name: "The copy in mods/whistle/ never lists the switch-key problem for whistle.whistle",
    world: { ...COPY2, folder: "whistle", copies: { whistle: VERSION },
      layout: { id: "root", type: "column", children: [term("main"), { ...bar2, content: { mod: "whistle" } }] },
      ...keysFile({ global: { "ctrl-space": "whistle.whistle" } }) },
    steps: [{ tick: 120, model: { problems: [] }, bar: { marker: null } }],
  },
  {
    name: "A switch key outside global is not the switch-key problem (whistle only reads global)",
    world: { ...COPY2, ...keysFile({ global: { "ctrl-space": "whistle-2.whistle" }, terminal: { "ctrl-q": "whistle.whistle" } }) },
    steps: [{ tick: 120, model: { problems: [] } }],
  },
];

export default suite("a renamed copy's switch key", (t) => {
  for (const sc of SCENARIOS) t.scenario(sc, core);
});
