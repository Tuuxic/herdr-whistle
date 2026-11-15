// Inert (ADR 0012): whistle stands aside on a Herdr older than MIN_HERDR, or when another copy
// of whistle runs, and the bar says why.

import { suite } from "./harness.js";
import * as core from "./step.js";
import { IN_TERMINAL, term, bar } from "./worlds.js";
import { VERSION } from "./version.js";

// Herdr's key bindings (keys()): Ctrl+Space bound to whistle.whistle everywhere.
const KEYS = [{ section: "global", keys: "ctrl-space", action: "whistle.whistle" }];
const OLD = { ...IN_TERMINAL, keys: KEYS, herdr: "0.1.14" };

// Two copies of whistle, each with a bar: mods/whistle/ and a renamed mods/whistle-2/.
const bar2 = { id: "bar2", type: "block", content: { mod: "whistle-2" } };
const TWO = {
  ...IN_TERMINAL, keys: KEYS,
  layout: { id: "root", type: "column", children: [term("main"), bar, bar2] },
  copies: { "whistle": "1.0.0", "whistle-2": "1.0.0" },
};
// Herdr hands the copy in mods/whistle-2/ only the lines named after its folder.
const RENAMED = { ...TWO, folder: "whistle-2", keys: [{ section: "global", keys: "ctrl-space", action: "whistle-2.whistle" }] };

const SCENARIOS = [
  {
    name: "On a Herdr older than the minimum, Ctrl+Space types through and whistle stays in TYPE",
    world: OLD,
    steps: [
      { command: "whistle", model: { mode: "type" },
        effects: [{ typeKey: "ctrl-space", terminal: "t1" }],
        bar: { badge: null, problem: "Whistle needs Herdr ≥ 0.1.15 (this is 0.1.14)" } },
    ],
  },
  {
    name: "On a Herdr older than the minimum, keys and a click on the bar don't enter WHISTLE",
    world: OLD,
    steps: [
      { world: { barFocused: true }, tick: 120, model: { mode: "type" }, effects: [] },
      { key: "ctrl-l", handled: false, effects: [], model: { mode: "type" } },
    ],
  },
  {
    name: "Inert, the switch key types through as it is bound in a terminal",
    world: { ...OLD, keys: [...KEYS, { section: "terminal", keys: "ctrl-shift-space", action: "whistle.whistle" }] },
    steps: [{ command: "whistle", effects: [{ typeKey: "ctrl-shift-space", terminal: "t1" }] }],
  },
  {
    name: "Inert, a layout's binding of the switch key comes before the global one",
    world: { ...OLD, keys: [...KEYS, { section: "layout:main", keys: "ctrl-alt-space", action: "whistle.whistle" }] },
    steps: [{ command: "whistle", effects: [{ typeKey: "ctrl-alt-space", terminal: "t1" }] }],
  },
  {
    name: "Inert, with no terminal focused, the switch key goes nowhere",
    world: { ...OLD, focused: null },
    steps: [{ command: "whistle", effects: [], model: { mode: "type" } }],
  },
  {
    name: "Whistle is inert when it can't read Herdr's version",
    world: { ...OLD, herdr: null },
    steps: [{ command: "whistle", model: { mode: "type" }, bar: { badge: null, problem: "Whistle needs Herdr ≥ 0.1.15" } }],
  },
  {
    name: "On a Herdr newer than the minimum, whistle runs",
    world: { ...OLD, herdr: "0.2.0" },
    steps: [{ command: "whistle", model: { mode: "whistle" }, bar: { badge: "WHISTLE" } }],
  },
  {
    name: "A renamed copy is inert while the copy in mods/whistle/ runs, and says so",
    world: RENAMED,
    steps: [
      { command: "whistle", model: { mode: "type" }, effects: [{ typeKey: "ctrl-space", terminal: "t1" }],
        bar: { badge: null, problem: "Another whistle runs, from mods/whistle/" } },
    ],
  },
  {
    name: "The copy in mods/whistle/ runs beside a renamed copy",
    world: TWO,
    steps: [{ command: "whistle", model: { mode: "whistle" }, bar: { badge: "WHISTLE" } }],
  },
  {
    name: "Of renamed copies only, the first folder by name runs",
    world: {
      ...TWO, folder: "whistle-3",
      layout: { id: "root", type: "column", children: [term("main"), bar2, { ...bar2, id: "bar3", content: { mod: "whistle-3" } }] },
      copies: { "whistle-3": "1.0.0", "whistle-2": "1.0.0", "whistle": "1.0.0" },
    },
    steps: [{ command: "whistle", model: { mode: "type" }, bar: { problem: "Another whistle runs, from mods/whistle-2/" } }],
  },
  {
    name: "A copy announced but not in the shown layout doesn't count",
    world: { ...RENAMED, layout: { id: "root", type: "column", children: [term("main"), bar2] } },
    steps: [{ command: "whistle", model: { mode: "whistle" }, bar: { badge: "WHISTLE" } }],
  },
  {
    name: "A copy announces its folder in whistle.copies when it isn't there yet",
    world: { ...TWO, folder: "whistle-2", copies: { whistle: "1.0.0" } },
    steps: [
      { tick: 120, effects: [{ setShared: "whistle.copies", value: { "whistle": "1.0.0", "whistle-2": VERSION } }, { run: "layout.hide", args: { id: "bar2" } }] },
      { world: { copies: { "whistle": "1.0.0", "whistle-2": VERSION } }, tick: 120, effects: [] },
    ],
  },
  {
    name: "An inert copy hides its bar, and shows it again once it is the copy that runs",
    world: { ...RENAMED, copies: { "whistle": "1.0.0", "whistle-2": VERSION } },
    steps: [
      { tick: 120, effects: [{ run: "layout.hide", args: { id: "bar2" } }] },
      { world: { layout: { ...RENAMED.layout, children: [term("main"), bar, { ...bar2, hidden: true }] } },
        tick: 120, effects: [] },
      { world: { layout: { id: "root", type: "column", children: [term("main"), { ...bar2, hidden: true }] } },
        tick: 120, effects: [{ run: "layout.show", args: { id: "bar2" } }], bar: { badge: "TYPE" } },
    ],
  },
  {
    // The hand pass (#33): the shell gives the copy its props ({} for a bar without any), so with
    // its own bars hidden it would rest (layout-block.md rule 6) and never show them again.
    name: "A copy that stood aside shows its bars again when the other copy's blocks go, though it hid them itself",
    world: { ...RENAMED, props: {}, copies: { "whistle": "1.0.0", "whistle-2": VERSION } },
    steps: [
      { tick: 120, effects: [{ run: "layout.hide", args: { id: "bar2" } }] },
      { world: { layout: { ...RENAMED.layout, children: [term("main"), bar, { ...bar2, hidden: true }] } },
        tick: 120, effects: [] },
      { world: { layout: { id: "root", type: "column", children: [term("main"), { ...bar2, hidden: true }] } },
        tick: 120, effects: [{ run: "layout.show", args: { id: "bar2" } }], bar: { badge: "TYPE" } },
    ],
  },
  {
    name: "A bar hidden before the copy went inert stays hidden",
    world: { ...RENAMED, copies: { "whistle": "1.0.0", "whistle-2": VERSION },
      layout: { ...RENAMED.layout, children: [term("main"), bar, { ...bar2, hidden: true }] } },
    steps: [
      { tick: 120, effects: [] },
      { world: { layout: { id: "root", type: "column", children: [term("main"), { ...bar2, hidden: true }] } },
        tick: 120, effects: [] },
    ],
  },
  {
    name: "In WHISTLE, a copy that goes inert hands the keyboard back and leaves WHISTLE",
    world: { ...IN_TERMINAL, keys: KEYS },
    steps: [
      { command: "whistle", model: { mode: "whistle" } },
      { world: { barFocused: true, herdr: "0.1.0" }, tick: 120, model: { mode: "type" },
        effects: [{ run: "pane.focus", args: { pane: "p1" } }] },
    ],
  },
];

export default suite("inert", (t) => {
  for (const sc of SCENARIOS) t.scenario(sc, core);
});
