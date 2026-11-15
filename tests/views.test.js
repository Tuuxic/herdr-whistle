// The hints and settings views (ADR 0011: view-model functions, drawing only). Hints list the
// choices of the current key sequence; settings list config problems, mapping conflicts and
// labelled overrides, and the mods whose mappings can be switched off (issue #7, issue #10).

import { suite, TEST_DEFAULTS } from "./harness.js";
import * as core from "./step.js";
import { switchMod, keepMapping } from "./config.js";
import { term, bar } from "./worlds.js";

const json = (v) => JSON.stringify(v);
const pretty = (v) => `${JSON.stringify(v, null, 2)}
`;
const IN = [{ command: "whistle" }, { world: { barFocused: true }, tick: 120 }];
const block = (mod) => ({ id: mod, type: "block", content: { mod } });
const entry = (map) => ({ v: 1, map });
// A world in a terminal: the mods shown, their entries, the defaults' map, the layout's whistle
// block props, whistle.json.
const world = ({ map = {}, keys = TEST_DEFAULTS.keys, user, mods = [], entries = {}, props } = {}) => ({
  layout: { id: "root", type: "column", children: [term("main"), ...mods.map(block), props ? { ...bar, content: { mod: "whistle", props } } : bar] },
  focused: { pane: "p1", terminal: "t1" }, panes: [{ pane: "p1", title: "zsh" }], modMappings: entries,
  configFiles: { defaults: json({ keys, map }), user: user === undefined ? null : json(user) },
});
const PANES = { w: { name: "Panes", map: {
  v: ["Split right", "pane.split", { direction: "right" }],
  m: { name: "Move", map: { h: ["Move left", "pane.move"] } },
} } };

// The hints window as the core opens it: a window overlay of whistle's own "hints" part.
const HINTS = (width, height, at) => ({ openOverlay: "hints", spec: { mod: "whistle", kind: "window", frame: "none", width, height,
  ...(at ? { at } : {}), props: { part: "hints", width } } });
// A 1000 x 600 window with the bar along its bottom, 22 px high.
const MEASURED = { viewport: { width: 1000, height: 600 }, barSize: { width: 1000, height: 22 } };
// The Panes group's two items fit on one row: the window is 22 (title) + 18 (row) + 10 high.
const ONE_ROW = 50;

const SCENARIOS = [
  // The hints window: the core opens, docks and closes it; the shell only measures.
  {
    name: "Hints opening: a group's first key opens the hints window docked on top of the bar, as wide as it",
    world: { ...world({ map: PANES }), ...MEASURED },
    steps: [...IN, { key: "w", hintsWindow: [HINTS(1000, ONE_ROW, { x: 0, y: 600 - 22 - ONE_ROW - 6 })] }],
  },
  {
    name: "Hints closing: the sequence ending closes the hints window",
    world: { ...world({ map: PANES }), ...MEASURED },
    steps: [...IN, { key: "w" }, { key: "escape", hintsWindow: [{ closeOverlay: "hints" }] }],
  },
  {
    // Herdr makes a new copy of whistle when the layout changes; the old copy's hints window
    // stays open unless the new one closes it (hand pass, #33).
    name: "A copy that starts closes a hints window an earlier copy left open, before it opens one",
    world: { ...world({ map: PANES }), ...MEASURED },
    steps: [{ tick: 120, hintsWindow: [{ closeOverlay: "hints" }] }, { tick: 120, hintsWindow: [] },
      ...IN, { key: "w", hintsWindow: [HINTS(1000, ONE_ROW, { x: 0, y: 600 - 22 - ONE_ROW - 6 })] }],
  },
  {
    name: "A nested group of the same size keeps the hints window where it is",
    world: { ...world({ map: PANES }), ...MEASURED },
    steps: [...IN, { key: "w" }, { key: "m", hintsWindow: [] }],
  },
  {
    name: "A bar set in from the window's edge docks the hints by the layout's hintsAlignRight, hintsAlignBorder and hintsGap",
    world: { ...world({ map: PANES, props: { hintsAlignRight: 12, hintsAlignBorder: 1, hintsGap: 4 } }),
      viewport: { width: 1000, height: 600 }, barSize: { width: 800, height: 22 } },
    steps: [...IN, { key: "w", hintsWindow: [HINTS(802, ONE_ROW, { x: 1000 - 12 - 802, y: 600 - (22 + 2) - ONE_ROW - 4 })] }],
  },
  {
    // The hand pass's bar (#33): set in 200 px from the window's right edge, measured to the
    // bar block's outer edge, inside a 2 px border; the box ends where the border does.
    name: "hintsAlignRight measures to the bar block's outer edge: a bar 200 px in with a 2 px border gets a box as wide as it",
    world: { ...world({ map: PANES, props: { hintsAlignRight: 200, hintsAlignBorder: 2 } }),
      viewport: { width: 1000, height: 600 }, barSize: { width: 600, height: 22 } },
    steps: [...IN, { key: "w", hintsWindow: [HINTS(604, ONE_ROW, { x: 196, y: 600 - 26 - ONE_ROW - 6 })] }],
  },
  {
    name: "The hints gap counts from the bar's border: with a 2 px border and hintsGap 6 the box sits 6 px above the border",
    world: { ...world({ map: PANES, props: { hintsAlignBorder: 2, hintsGap: 6 } }), ...MEASURED },
    // The bar block: 22 px inside, 26 px with its border, so its outer top is at 574; the box ends 6 px above.
    steps: [...IN, { key: "w", hintsWindow: [HINTS(1004, ONE_ROW, { x: 0, y: 574 - 6 - ONE_ROW })] }],
  },
  {
    name: "The bar changing size moves the open hints window on the next tick",
    world: { ...world({ map: PANES }), ...MEASURED },
    steps: [...IN, { key: "w" },
      { world: { barSize: { width: 700, height: 30 } }, tick: 120, hintsWindow: [HINTS(700, ONE_ROW, { x: 300, y: 600 - 30 - ONE_ROW - 6 })] }],
  },
  {
    name: "Before the shell has measured anything, the hints window opens 900 wide where Herdr puts it",
    world: world({ map: PANES }),
    steps: [...IN, { key: "w", hintsWindow: [HINTS(900, ONE_ROW)] }],
  },
  {
    name: "An inert copy closes its hints window and sets no views' models",
    world: { ...world({ map: PANES }), ...MEASURED },
    steps: [...IN, { key: "w" }, { world: { herdr: "0.0.1" }, tick: 120,
      effects: [{ run: "pane.focus", args: { pane: "p1" } }], hintsWindow: [{ closeOverlay: "hints" }],
      shared: { "whistle.hints": undefined, "whistle.settings": undefined } }],
  },
  {
    name: "The hints' and settings' models go in their private shared keys when they change, and only then",
    world: world({ map: PANES }),
    steps: [
      { tick: 120, shared: { "whistle.hints": null, "whistle.settings": { problems: [], mods: [], conflicts: [], overrides: [] } } },
      { command: "whistle", shared: { "whistle.hints": undefined, "whistle.settings": undefined } },
      { world: { barFocused: true }, key: "w", shared: { "whistle.hints": { keys: "w", title: "Panes", exit: null, items: [
        { key: "v", label: "Split right", group: false }, { key: "m", label: "Move", group: true }] } } },
    ],
  },
  {
    name: "Hints list the choices of the current key sequence",
    world: world({ map: PANES }),
    steps: [...IN, { key: "w", hints: { keys: "w", title: "Panes", exit: null, items: [
      { key: "v", label: "Split right", group: false },
      { key: "m", label: "Move", group: true },
    ] } }],
  },
  {
    name: "Hints name the key that cancels the sequence, if one does",
    world: world({ map: PANES, keys: { ...TEST_DEFAULTS.keys, cancel: ["escape", "ctrl-g"] } }),
    steps: [...IN, { key: "w", hints: { exit: "Esc cancels" } }],
  },
  {
    name: "Hints switched off in the layout's whistle block show nothing",
    world: world({ map: PANES, props: { hints: false } }),
    steps: [...IN, { key: "w", model: { sequence: ["w"] }, hints: null }],
  },
  {
    name: "Hints switched off in whistle.json show nothing, over the layout's",
    world: world({ map: PANES, props: { hints: true }, user: { hints: false } }),
    steps: [...IN, { key: "w", hints: null }],
  },
  {
    name: "No hints outside a key sequence, nor once it ends",
    world: world({ map: { ...PANES, n: ["Next tab", "tab.next"] } }),
    steps: [...IN, { key: "n", hints: null }, { key: "w" }, { key: "v", hints: null }],
  },
  {
    name: "Hints follow the sequence into a nested group",
    world: world({ map: PANES }),
    steps: [...IN, { key: "w" }, { key: "m", hints: { keys: "w m", title: "Move", items: [{ key: "h", label: "Move left", group: false }] } }],
  },

  // Settings.
  {
    name: "Settings list each config problem with its file",
    world: world({ map: { n: ["Next tab", 42] }, user: { keys: { jump: ["x"] } } }),
    steps: [{ tick: 120, settings: { problems: [
      { source: "mappings.json", detail: "map › n: should be [label, command] or a group { name, map }" },
      { source: "whistle.json", detail: "keys › jump: unknown action" },
    ] } }],
  },
  {
    name: "Settings list keys.json's problem with the config's",
    world: world(),
    model: { claimProblem: "keys.json has an error (keys.error); whistle left it alone" },
    steps: [{ tick: 120, settings: { problems: [
      { source: "keys.json", detail: "keys.json has an error (keys.error); whistle left it alone" },
    ] } }],
  },
  {
    name: "Settings list a mapping conflict between two mods with its key sequence and its mods",
    world: world({ mods: ["alpha", "beta"], entries: {
      alpha: entry({ g: { name: "Alpha", map: { d: ["D", "alpha.d"] } } }),
      beta: entry({ g: { name: "Beta", map: { d: ["D", "beta.d"] } } }),
    } }),
    steps: [{ tick: 120, settings: { conflicts: [
      { keys: "g d", seq: ["g", "d"], mods: ["alpha", "beta"], own: null, text: "alpha and beta both want g d",
        keep: [{ mod: "alpha", value: ["D", "alpha.d"] }, { mod: "beta", value: ["D", "beta.d"] }] },
    ] } }],
  },
  {
    name: "Settings list a mod on an own key with the own key's action",
    world: world({ mods: ["alpha"], entries: { alpha: entry({ "ctrl-h": ["Left", "alpha.left"] }) } }),
    steps: [{ tick: 120, settings: { conflicts: [
      { keys: "Ctrl+H", seq: ["ctrl-h"], mods: ["alpha"], own: "Field to the left",
        text: "alpha wants Ctrl+H, whistle's own key for Field to the left", keep: [{ mod: "alpha", value: ["Left", "alpha.left"] }] },
    ] } }],
  },
  {
    name: "Settings label an override by you over a mod's key",
    world: world({ mods: ["alpha"], entries: { alpha: entry({ g: ["Go", "alpha.go"] }) }, user: { map: { g: ["Next tab", "tab.next"] } } }),
    steps: [{ tick: 120, settings: { conflicts: [], overrides: [
      { keys: "g", seq: ["g"], by: "whistle.json", over: ["alpha"], text: "g: you, over alpha" },
    ] } }],
  },
  {
    name: "Settings label an override by the layout over a conflict",
    world: world({ mods: ["alpha", "beta"], props: { mappings: { g: ["Previous tab", "tab.prev"] } },
      entries: { alpha: entry({ g: ["Go", "alpha.go"] }), beta: entry({ g: ["Go", "beta.go"] }) } }),
    steps: [{ tick: 120, settings: { conflicts: [], overrides: [
      { keys: "g", seq: ["g"], by: "layout", over: ["alpha", "beta"], text: "g: the layout, over alpha and beta" },
    ] } }],
  },
  {
    name: "Settings list the layout's mods that offer mappings, each on or off",
    world: world({ mods: ["alpha", "beta", "gamma"], user: { mods: { alpha: false } },
      entries: { alpha: entry({ g: ["Go", "alpha.go"] }), beta: entry({ b: ["B", "beta.b"] }), delta: entry({ d: ["D", "delta.d"] }) } }),
    steps: [{ tick: 120, settings: { mods: [{ name: "alpha", on: false, problems: [] }, { name: "beta", on: true, problems: [] }] } }],
  },
  {
    name: "A mod's problems are listed under it in settings, not counted in the bar's marker",
    world: world({ mods: ["alpha"], entries: { alpha: { v: 2, map: {} } } }),
    steps: [{ tick: 120, bar: { marker: null },
      settings: { problems: [], mods: [{ name: "alpha", on: true, problems: ["its entry is v 2; whistle reads v 1"] }] } }],
  },
];

// Switching a mod off from settings: the settings copy writes whistle.json through config.js's
// switchMod, and the bar picks the new text up on its next read (ADR 0011).
const MINE = { map: { n: ["Next tab", "tab.next"] } };
const switched = switchMod(json(MINE), "alpha", false);
const CONFLICT = { mods: ["alpha", "beta"], entries: { alpha: entry({ g: ["Go", "alpha.go"] }), beta: entry({ g: ["Go", "beta.go"] }) } };
SCENARIOS.push({
  name: "Switching a mod off from settings writes whistle.json and the bar picks it up",
  world: world({ ...CONFLICT, user: MINE }),
  steps: [...IN, { key: "g", effects: [], handled: false },
    { world: { configFiles: { defaults: json({ keys: TEST_DEFAULTS.keys, map: {} }), user: switched.text } }, tick: 120,
      settings: { conflicts: [], mods: [{ name: "alpha", on: false, problems: [] }, { name: "beta", on: true, problems: [] }] } },
    { key: "g", effects: [{ run: "beta.go", args: {} }, { focusBar: true }] }],
});
// Keeping one mod's mapping from settings: written into whistle.json, where it settles the
// conflict as an override of yours.
const kept = keepMapping(json(MINE), ["g"], ["Go", "alpha.go"]);
SCENARIOS.push({
  name: "Keeping a mod's mapping from settings writes it into whistle.json and settles the conflict",
  world: world({ ...CONFLICT, user: MINE }),
  steps: [...IN,
    { world: { configFiles: { defaults: json({ keys: TEST_DEFAULTS.keys, map: {} }), user: kept.text } }, tick: 120,
      settings: { conflicts: [], overrides: [{ keys: "g", seq: ["g"], by: "whistle.json", over: ["alpha", "beta"], text: "g: you, over alpha and beta" }] } },
    { key: "g", effects: [{ run: "alpha.go", args: {} }, { focusBar: true }] }],
});

export default suite("views", (t) => {
  for (const sc of SCENARIOS) t.scenario(sc, core);

  t.check("Switching a mod off adds it to whistle.json's mods, keeping the rest",
    switched, { text: pretty({ ...MINE, mods: { alpha: false } }) });
  t.check("Switching a mod back on writes it as on", switchMod(json({ mods: { alpha: false, beta: false } }), "alpha", true),
    { text: pretty({ mods: { alpha: true, beta: false } }) });
  t.check("With no whistle.json, switching a mod off starts one", switchMod(null, "alpha", false), { text: pretty({ mods: { alpha: false } }) });
  t.check("Keeping a mod's mapping adds it to whistle.json's map", kept, { text: pretty({ map: { ...MINE.map, g: ["Go", "alpha.go"] } }) });
  t.check("A mapping kept inside a group goes in a group of whistle.json's, beside its keys",
    keepMapping(json({ map: { g: { name: "Go", map: { x: ["X", "tab.next"] } } } }), ["g", "d"], ["D", "alpha.d"]),
    { text: pretty({ map: { g: { name: "Go", map: { x: ["X", "tab.next"], d: ["D", "alpha.d"] } } } }) });
  t.check("A mapping kept inside a group whistle.json doesn't have starts the group",
    keepMapping(null, ["g", "d"], ["D", "alpha.d"]), { text: pretty({ map: { g: { map: { d: ["D", "alpha.d"] } } } }) });
  t.check("A whistle.json that doesn't parse isn't written", switchMod("{ nope", "alpha", false),
    { problem: "whistle.json doesn't parse: fix it first" });
  t.check("A whistle.json whose mods isn't an object isn't written", switchMod(json({ mods: [] }), "alpha", false),
    { problem: "whistle.json's mods isn't an object: fix it first" });
});
