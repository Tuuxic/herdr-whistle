// Inert (ADR 0002): whistle stands aside on a Herdr older than MIN_HERDR, when another copy of
// whistle runs, or when whistle blocks share their props (block.test.js); the whistle state and
// one Herdr notification say why.

import { suite } from "./harness.js";
import * as core from "./step.js";
import { IN_TERMINAL, term, anchor } from "./worlds.js";
import { VERSION } from "./version.js";

// Herdr's key bindings (keys()): Ctrl+Space bound to whistle.switch-mode everywhere.
const KEYS = [{ section: "global", keys: "ctrl-space", action: "whistle.switch-mode" }];
const OLD = { ...IN_TERMINAL, keys: KEYS, herdr: "0.1.14" };

// Two copies of whistle, each with its block: mods/whistle/ and a renamed mods/whistle-2/.
const anchor2 = { id: "anchor2", type: "block", content: { mod: "whistle-2" } };
const TWO = {
  ...IN_TERMINAL, keys: KEYS,
  layout: { id: "root", type: "column", children: [term("main"), anchor, anchor2] },
  copies: { "whistle": "1.0.0", "whistle-2": "1.0.0" },
};
// Herdr hands the copy in mods/whistle-2/ only the lines named after its folder.
const RENAMED = { ...TWO, folder: "whistle-2", keys: [{ section: "global", keys: "ctrl-space", action: "whistle-2.switch-mode" }] };

// The notification an inert whistle posts on a Herdr that's too old (0.1.14), and why.
const WHY_OLD = { problem: "Whistle needs Herdr ≥ 0.1.15 (this is 0.1.14)", fix: "Update Herdr." };
const TOLD_OLD = { title: "Whistle stands aside", body: "Whistle needs Herdr ≥ 0.1.15 (this is 0.1.14). Update Herdr.", level: "error" };
const STATE_OLD = { v: 1, mode: "type", enabled: true, sequence: null, pane: null, onTerminal: false, field: null, inert: WHY_OLD };

const SCENARIOS = [
  {
    name: "Inert again after running, whistle posts its notification again",
    world: OLD,
    steps: [
      { command: "mode:type", notified: [TOLD_OLD] },
      { world: { herdr: "0.1.15" }, command: "mode:type", notified: [] },
      { world: { herdr: "0.1.14" }, command: "mode:type", notified: [TOLD_OLD] },
    ],
  },
  {
    // Herdr makes a new copy whenever the layout changes or is shown again: the whistle state
    // an earlier copy published says the reason, so a new copy doesn't post it again.
    name: "Inert, a new copy doesn't post the notification the whistle state already gives",
    world: { ...OLD, state: STATE_OLD },
    steps: [{ command: "mode:type", notified: [] }],
  },
  {
    name: "Inert, whistle publishes its state with why, once",
    world: OLD,
    steps: [
      { tick: 120, published: STATE_OLD },
      { tick: 120, published: null },
    ],
  },
  {
    name: "Running, the whistle state's inert is null",
    world: IN_TERMINAL,
    steps: [{ tick: 120, published: { v: 1, mode: "type", enabled: true, sequence: null, pane: null, onTerminal: false, field: null, inert: null } }],
  },
  {
    name: "On a Herdr older than the minimum, Ctrl+Space types through and whistle stays in TYPE",
    world: OLD,
    steps: [
      { command: "switch-mode", model: { mode: "type" },
        effects: [{ typeKey: "ctrl-space", terminal: "t1" }], state: { mode: "type", inert: WHY_OLD } },
    ],
  },
  {
    name: "A copy standing aside for another doesn't publish the whistle state: the running copy's stands",
    world: { ...RENAMED, copies: { "whistle": "1.0.0", "whistle-2": VERSION } },
    steps: [{ tick: 120, published: null, unset: ["whistle.hints", "whistle.events", "whistle.config"] }],
  },
  {
    name: "On a Herdr older than the minimum, keys and a click on the anchor don't enter WHISTLE",
    world: OLD,
    steps: [
      { world: { anchorFocused: true }, tick: 120, model: { mode: "type" }, effects: [] },
      { key: "ctrl-l", handled: false, effects: [], model: { mode: "type" } },
    ],
  },
  {
    name: "Inert, the switch key types through as it is bound in a terminal",
    world: { ...OLD, keys: [...KEYS, { section: "terminal", keys: "ctrl-shift-space", action: "whistle.switch-mode" }] },
    steps: [{ command: "switch-mode", effects: [{ typeKey: "ctrl-shift-space", terminal: "t1" }] }],
  },
  {
    name: "Inert, a layout's binding of the switch key comes before the global one",
    world: { ...OLD, keys: [...KEYS, { section: "layout:main", keys: "ctrl-alt-space", action: "whistle.switch-mode" }] },
    steps: [{ command: "switch-mode", effects: [{ typeKey: "ctrl-alt-space", terminal: "t1" }] }],
  },
  {
    name: "Inert, with no terminal focused, the switch key goes nowhere",
    world: { ...OLD, focused: null },
    steps: [{ command: "switch-mode", effects: [], model: { mode: "type" } }],
  },
  {
    name: "Whistle is inert when it can't read Herdr's version",
    world: { ...OLD, herdr: null },
    steps: [{ command: "switch-mode", model: { mode: "type" }, state: { inert: { problem: "Whistle needs Herdr ≥ 0.1.15", fix: "Update Herdr." } } }],
  },
  {
    name: "On a Herdr newer than the minimum, whistle runs",
    world: { ...OLD, herdr: "0.2.0" },
    steps: [{ command: "switch-mode", model: { mode: "whistle" }, state: { mode: "whistle", inert: null } }],
  },
  {
    name: "A renamed copy is inert while the copy in mods/whistle/ runs, and says so",
    world: RENAMED,
    steps: [
      { command: "switch-mode", model: { mode: "type" }, effects: [{ typeKey: "ctrl-space", terminal: "t1" }],
        state: { inert: { problem: "Another whistle runs, from mods/whistle/", fix: "Delete the copies you don't want." } } },
    ],
  },
  {
    name: "The copy in mods/whistle/ runs beside a renamed copy",
    world: TWO,
    steps: [{ command: "switch-mode", model: { mode: "whistle" }, state: { mode: "whistle" } }],
  },
  {
    name: "Of renamed copies only, the first folder by name runs",
    world: {
      ...TWO, folder: "whistle-3",
      layout: { id: "root", type: "column", children: [term("main"), anchor2, { ...anchor2, id: "anchor3", content: { mod: "whistle-3" } }] },
      copies: { "whistle-3": "1.0.0", "whistle-2": "1.0.0", "whistle": "1.0.0" },
    },
    steps: [{ command: "switch-mode", model: { mode: "type" }, state: { inert: { problem: "Another whistle runs, from mods/whistle-2/", fix: "Delete the copies you don't want." } } }],
  },
  {
    name: "A copy announced but not in the shown layout doesn't count",
    world: { ...RENAMED, layout: { id: "root", type: "column", children: [term("main"), anchor2] } },
    steps: [{ command: "switch-mode", model: { mode: "whistle" }, state: { mode: "whistle" } }],
  },
  {
    name: "A copy announces its folder in whistle.copies when it isn't there yet, and hides nothing",
    world: { ...TWO, folder: "whistle-2", copies: { whistle: "1.0.0" } },
    steps: [
      { tick: 120, effects: [{ setShared: "whistle.copies", value: { "whistle": "1.0.0", "whistle-2": VERSION } }] },
      { world: { copies: { "whistle": "1.0.0", "whistle-2": VERSION } }, tick: 120, effects: [] },
    ],
  },
  {
    name: "In WHISTLE, a copy that goes inert hands the keyboard back and leaves WHISTLE",
    world: { ...IN_TERMINAL, keys: KEYS },
    steps: [
      { command: "switch-mode", model: { mode: "whistle" } },
      { world: { anchorFocused: true, herdr: "0.1.0" }, tick: 120, model: { mode: "type" },
        effects: [{ run: "pane.focus", args: { pane: "p1" } }] },
    ],
  },
];

export default suite("inert", (t) => {
  for (const sc of SCENARIOS) t.scenario(sc, core);
});
