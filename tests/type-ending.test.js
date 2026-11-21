// A mapping that ends in TYPE (its 4th item "type"): the command runs, whistle goes to TYPE
// and the keyboard goes to the terminal. A command that makes a terminal (a new tab, a split)
// leaves Herdr's focus on it, so until the hold is over, a bar still holding the keyboard
// hands it to the pane Herdr focused instead of going back to WHISTLE.

import { suite } from "./harness.js";
import * as core from "./step.js";
import { IN_TERMINAL } from "./worlds.js";

const HOLD = 600;
const defaults = (map) => ({ configFiles: { defaults: JSON.stringify({ keys: { type: ["i"] }, map }), user: null } });
const world = (map) => ({ ...IN_TERMINAL, ...defaults(map) });
const IN = [{ command: "switch-mode" }, { world: { barFocused: true }, tick: 120 }];

const SCENARIOS = [
  {
    name: "A TYPE-ending mapping runs its command and goes to TYPE",
    world: world({ "ctrl-n": ["New tab", "tab.new", null, "type"] }),
    steps: [...IN, { key: "ctrl-n", handled: true, effects: [{ run: "tab.new", args: {} }],
      model: { mode: "type", holdUntil: 120 + HOLD }, state: { mode: "type" } }],
  },
  {
    name: "After a TYPE-ending mapping the anchor hands the keyboard to the terminal Herdr focused",
    world: world({ "ctrl-n": ["New tab", "tab.new", null, "type"] }),
    steps: [...IN, { key: "ctrl-n" },
      { world: { focused: { pane: "p2", terminal: "t2" } }, tick: 120,
        effects: [{ run: "pane.focus", args: { pane: "p2" } }], model: { mode: "type" } },
      { world: { barFocused: false }, tick: 120, effects: [], model: { mode: "type" } }],
  },
  {
    name: "Once that hold is over, the anchor taking the keyboard is WHISTLE again",
    world: world({ "ctrl-n": ["New tab", "tab.new", null, "type"] }),
    steps: [...IN, { key: "ctrl-n" }, { world: { barFocused: false }, tick: HOLD },
      { world: { barFocused: true }, tick: 120, model: { mode: "whistle" } }],
  },
  {
    name: "A TYPE-ending terminal mapping acts on the selected pane and focuses it",
    world: world({ f: ["Find", "terminal.search", null, "type"] }),
    steps: [...IN, { key: "f", handled: true,
      effects: [{ run: "pane.focus", args: { pane: "p1" } }, { run: "terminal.search", args: {} }],
      model: { mode: "type" } }],
  },
  {
    name: "A TYPE-ending mapping in a group ends the key sequence",
    world: world({ w: { name: "Panes", map: { v: ["Split right", "pane.split", { direction: "right" }, "type"] } } }),
    steps: [...IN, { key: "w", model: { sequence: ["w"] } },
      { key: "v", effects: [{ run: "pane.focus", args: { pane: "p1" } }, { run: "pane.split", args: { direction: "right" } }],
        model: { mode: "type", sequence: null } }],
  },
];

export default suite("type-ending mappings", (t) => {
  for (const sc of SCENARIOS) t.scenario(sc, core);
});
