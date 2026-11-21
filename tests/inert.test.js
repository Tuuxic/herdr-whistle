// Inert (ADR 0012): whistle stands aside on a Herdr older than MIN_HERDR, or when another copy
// of whistle runs, and the bar and one Herdr notification say why.

import { suite } from "./harness.js";
import * as core from "./step.js";
import { IN_TERMINAL, term, bar } from "./worlds.js";
import { VERSION } from "./version.js";

// Herdr's key bindings (keys()): Ctrl+Space bound to whistle.switch-mode everywhere.
const KEYS = [{ section: "global", keys: "ctrl-space", action: "whistle.switch-mode" }];
const OLD = { ...IN_TERMINAL, keys: KEYS, herdr: "0.1.14" };

// Two copies of whistle, each with a bar: mods/whistle/ and a renamed mods/whistle-2/.
const bar2 = { id: "bar2", type: "block", content: { mod: "whistle-2" } };
const TWO = {
  ...IN_TERMINAL, keys: KEYS,
  layout: { id: "root", type: "column", children: [term("main"), bar, bar2] },
  copies: { "whistle": "1.0.0", "whistle-2": "1.0.0" },
};
// Herdr hands the copy in mods/whistle-2/ only the lines named after its folder.
// mods/whistle-2/'s anchor (ADR 0018).
const ANCHOR2 = { id: "anchor2", type: "block", content: { mod: "whistle-2", props: { anchor: true } } };
const RENAMED = {...TWO, folder: "whistle-2", keys: [{ section: "global", keys: "ctrl-space", action: "whistle-2.switch-mode" }] };

// The notification an inert whistle posts on a Herdr that's too old (0.1.14).
const TOLD_OLD = { title: "Whistle stands aside", body: "Whistle needs Herdr ≥ 0.1.15 (this is 0.1.14). Update Herdr.", level: "error" };
const spotBlock = (id, name, hidden) => ({ id, type: "block", hidden, content: { mod: "whistle", props: { bar: name } } });

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
    // Herdr makes a new copy whenever the layout changes or is shown again: the reason told
    // lives in a private shared key of the folder, so a new copy doesn't post it again.
    name: "Inert, a new copy doesn't post the notification an earlier copy of its folder posted",
    world: { ...OLD, told: "Whistle needs Herdr ≥ 0.1.15 (this is 0.1.14)" },
    steps: [{ command: "mode:type", notified: [] }],
  },
  {
    name: "Inert, whistle records the reason it told in its folder's private key, and clears it once it runs",
    world: OLD,
    steps: [
      { command: "mode:type", shared: { "whistle.told:whistle": "Whistle needs Herdr ≥ 0.1.15 (this is 0.1.14)" } },
      { world: { herdr: "0.1.15", told: "Whistle needs Herdr ≥ 0.1.15 (this is 0.1.14)" }, command: "mode:type", shared: { "whistle.told:whistle": null } },
    ],
  },
  {
    // Only the copy that would run posts it: one notification, however many blocks.
    name: "Inert, a hidden spot's copy posts no notification",
    world: { ...OLD, props: { bar: "Top" },
      layout: { id: "root", type: "column", children: [spotBlock("top", "Top", true), term("main"), spotBlock("bottom", "Bottom", false)] } },
    steps: [{ command: "mode:type", notified: [] }],
  },
  {
    name: "Inert, a bar's copy in a layout with an anchor posts no notification: the anchor's does",
    world: { ...OLD, props: { bar: "Bottom" },
      layout: { id: "root", type: "column", children: [term("main"), spotBlock("bottom", "Bottom", false),
        { id: "anchor", type: "block", content: { mod: "whistle", props: { anchor: true } } }] } },
    steps: [{ command: "mode:type", notified: [] }, { world: { props: { anchor: true } }, command: "mode:type", notified: [TOLD_OLD] }],
  },
  {
    name: "On a Herdr older than the minimum, Ctrl+Space types through and whistle stays in TYPE",
    world: OLD,
    steps: [
      { command: "switch-mode", model: { mode: "type" },
        effects: [{ typeKey: "ctrl-space", terminal: "t1" }],
        bar: { badge: null, problem: "Whistle needs Herdr ≥ 0.1.15 (this is 0.1.14)" } },
    ],
  },
  {
    // The bar draws only what its copy sets in its folder's key (#47), so an inert copy sets it too.
    name: "An inert copy sets its bar's model, saying why, in its own folder's key, once",
    world: OLD,
    steps: [
      { tick: 120, shared: { "whistle.bar:whistle": { badge: null, label: "", marker: null, problem: "Whistle needs Herdr ≥ 0.1.15 (this is 0.1.14)" } } },
      { tick: 120, shared: { "whistle.bar:whistle": undefined } },
    ],
  },
  {
    name: "A copy standing aside for another sets its own folder's bar key, never the running copy's",
    world: { ...RENAMED, copies: { "whistle": "1.0.0", "whistle-2": VERSION } },
    steps: [{ tick: 120, shared: { "whistle.bar:whistle": undefined,
      "whistle.bar:whistle-2": { badge: null, label: "", marker: null, problem: "Another whistle runs, from mods/whistle/" } } }],
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
    steps: [{ command: "switch-mode", model: { mode: "type" }, bar: { badge: null, problem: "Whistle needs Herdr ≥ 0.1.15" } }],
  },
  {
    name: "On a Herdr newer than the minimum, whistle runs",
    world: { ...OLD, herdr: "0.2.0" },
    steps: [{ command: "switch-mode", model: { mode: "whistle" }, bar: { badge: "WHISTLE" } }],
  },
  {
    name: "A renamed copy is inert while the copy in mods/whistle/ runs, and says so",
    world: RENAMED,
    steps: [
      { command: "switch-mode", model: { mode: "type" }, effects: [{ typeKey: "ctrl-space", terminal: "t1" }],
        bar: { badge: null, problem: "Another whistle runs, from mods/whistle/" } },
    ],
  },
  {
    name: "The copy in mods/whistle/ runs beside a renamed copy",
    world: TWO,
    steps: [{ command: "switch-mode", model: { mode: "whistle" }, bar: { badge: "WHISTLE" } }],
  },
  {
    name: "Of renamed copies only, the first folder by name runs",
    world: {
      ...TWO, folder: "whistle-3",
      layout: { id: "root", type: "column", children: [term("main"), bar2, { ...bar2, id: "bar3", content: { mod: "whistle-3" } }] },
      copies: { "whistle-3": "1.0.0", "whistle-2": "1.0.0", "whistle": "1.0.0" },
    },
    steps: [{ command: "switch-mode", model: { mode: "type" }, bar: { problem: "Another whistle runs, from mods/whistle-2/" } }],
  },
  {
    name: "A copy announced but not in the shown layout doesn't count",
    world: { ...RENAMED, layout: { id: "root", type: "column", children: [term("main"), bar2] } },
    steps: [{ command: "switch-mode", model: { mode: "whistle" }, bar: { badge: "WHISTLE" } }],
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
    // ADR 0018: Herdr doesn't run a hidden block's copy, so a hidden anchor could never come back.
    name: "An anchor standing aside hides its bars but never itself, and shows them again once it runs",
    world: { ...RENAMED, copies: { "whistle": "1.0.0", "whistle-2": VERSION }, props: { anchor: true },
      layout: { id: "root", type: "column", children: [term("main"), bar, bar2, ANCHOR2] } },
    steps: [
      { tick: 120, effects: [{ run: "layout.hide", args: { id: "bar2" } }] },
      { world: { layout: { id: "root", type: "column", children: [term("main"), { ...bar2, hidden: true }, ANCHOR2] } },
        tick: 120, effects: [{ run: "layout.show", args: { id: "bar2" } }] },
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
      { command: "switch-mode", model: { mode: "whistle" } },
      { world: { barFocused: true, herdr: "0.1.0" }, tick: 120, model: { mode: "type" },
        effects: [{ run: "pane.focus", args: { pane: "p1" } }] },
    ],
  },
];

export default suite("inert", (t) => {
  for (const sc of SCENARIOS) t.scenario(sc, core);
});
