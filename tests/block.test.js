// The layout's whistle block (docs/contracts/layout-block.md): every whistle block is the anchor
// (ADR 0018, ADR 0020). Its props `mappings`, `keys`, `mods`, `enabled` and `nav`; a bad or
// unknown prop is skipped and listed as a config problem (source "layout"). The first block runs
// whistle, the others are listed and left out; blocks with the same props make whistle inert.

import { suite, TEST_DEFAULTS } from "./harness.js";
import * as core from "./step.js";
import { IN_TERMINAL, withProps, term, anchor } from "./worlds.js";

const SWITCH = [{ section: "global", keys: "ctrl-space", action: "whistle.switch-mode" }];
const inTerminal = (props, extra = {}) => ({ ...IN_TERMINAL, layout: withProps(props), keys: SWITCH, ...extra });
const IN = [{ command: "switch-mode" }, { world: { anchorFocused: true }, tick: 120 }];

const user = (v) => ({ configFiles: { defaults: JSON.stringify(TEST_DEFAULTS), user: JSON.stringify(v) } });

// GRID (a and b side by side over c) with whistle's block carrying props.
const grid = (props) => ({ id: "root", type: "column", children: [
  { id: "top", type: "row", children: [term("a"), term("b")] }, term("c"), { ...anchor, content: { mod: "whistle", props } },
] });
const onA = (props) => ({ layout: grid(props), focused: { pane: "p1", terminal: "t1" }, keys: SWITCH });

// A whistle block with props, and a layout of a terminal and whistle blocks.
const block = (id, props, hidden) => ({ id, type: "block", ...(hidden ? { hidden } : {}), content: { mod: "whistle", ...(props ? { props } : {}) } });
const withBlocks = (...blocks) => ({ id: "root", type: "column", children: [term("main"), ...blocks] });

// Two whistle blocks with props of their own: the first runs, the second is extra.
const TWO = { ...IN_TERMINAL, keys: SWITCH, layout: withBlocks(block("first", { enabled: true }), block("second", { mappings: {} })) };
// Two whistle blocks with the same props: no copy can tell which one it is.
const TWINS = { ...IN_TERMINAL, keys: SWITCH, layout: withBlocks(block("one"), block("two")) };
const TOLD_TWINS = { title: "Whistle stands aside",
  body: "Whistle blocks one and two have the same props, so whistle can't tell which one runs. Keep one.", level: "error" };

const SCENARIOS = [
  {
    name: "enabled: false sends the switch key to the terminal",
    world: inTerminal({ enabled: false }),
    steps: [{ command: "switch-mode", effects: [{ typeKey: "ctrl-space", terminal: "t1" }], model: { mode: "type" } }],
  },
  {
    name: "Switched off, the whistle state says so and the mode is TYPE",
    world: inTerminal({ enabled: false }),
    steps: [{ tick: 120, state: { mode: "type", enabled: false }, problems: 0 }],
  },
  {
    name: "whistle.json's enabled goes over the layout's",
    world: inTerminal({ enabled: false }, user({ enabled: true })),
    steps: [{ command: "switch-mode", effects: [{ focusAnchor: true }], model: { mode: "whistle" } }],
  },
  {
    name: "whistle.json can switch whistle off in a layout that has it on",
    world: inTerminal({ enabled: true }, user({ enabled: false })),
    steps: [{ command: "switch-mode", effects: [{ typeKey: "ctrl-space", terminal: "t1" }] }],
  },
  {
    name: "Switched off while in WHISTLE, whistle goes back to TYPE",
    world: inTerminal({}),
    steps: [...IN, { world: user({ enabled: false }), tick: 120,
      effects: [{ run: "pane.focus", args: { pane: "p1" } }], model: { mode: "type" } }],
  },
  {
    name: "Switched off, keys pressed on the anchor aren't whistle's",
    world: inTerminal({}),
    steps: [...IN, { world: user({ enabled: false }), key: "ctrl-l", handled: false, model: { mode: "type" } }],
  },
  {
    name: "A nav override picks the field in that direction",
    world: onA({ nav: { a: { down: "b" } } }),
    model: { recent: ["a"] },
    steps: [{ command: "switch-mode", model: { field: "a" } }, { key: "ctrl-j", model: { field: "b" } }],
  },
  {
    name: "Directions a nav override leaves out follow the layout",
    world: onA({ nav: { a: { down: "b" } } }),
    model: { recent: ["a"] },
    steps: [{ command: "switch-mode" }, { key: "ctrl-l", model: { field: "b" } }, { key: "ctrl-j", model: { field: "c" } }],
  },
  {
    name: "A nav override on a group counts for the fields inside it",
    world: onA({ nav: { top: { up: "c" } } }),
    model: { recent: ["b"] },
    steps: [{ command: "switch-mode", model: { field: "b" } }, { key: "ctrl-k", model: { field: "c" } }],
  },
  {
    name: "A nav override to a block with no field doesn't move",
    world: onA({ nav: { a: { down: "anchor" } } }),
    model: { recent: ["a"] },
    steps: [{ command: "switch-mode" }, { key: "ctrl-j", model: { field: "a" } }],
  },

  // A bad prop is skipped and listed; the rest of the block still counts.
  {
    name: "A bad enabled prop is skipped and listed, and whistle stays on",
    world: inTerminal({ enabled: "no" }),
    steps: [{ command: "switch-mode", effects: [{ focusAnchor: true }],
      model: { problems: [{ source: "layout", detail: "enabled should be true or false" }] }, problems: 1 }],
  },
  {
    name: "A bad nav entry is skipped and listed, the good ones still count",
    world: onA({ nav: { a: { down: "b", below: "c", right: 3, up: "nowhere" }, ghost: { down: "c" } } }),
    model: { recent: ["a"] },
    steps: [{ command: "switch-mode", model: { problems: [
      { source: "layout", detail: "nav › a › below: unknown direction (left, down, up, right)" },
      { source: "layout", detail: "nav › a › right: should be a block id" },
      { source: "layout", detail: "nav › a › up: no block nowhere in this layout" },
      { source: "layout", detail: "nav › ghost: no block ghost in this layout" },
    ] } }, { key: "ctrl-j", model: { field: "b" } }],
  },
  {
    name: "A nav that isn't an object is listed",
    world: inTerminal({ nav: ["a"] }),
    steps: [{ tick: 120, model: { problems: [
      { source: "layout", detail: 'nav should be an object: { "<block id>": { "<direction>": "<block id>" } }' },
    ] } }],
  },
  {
    // whistle-ui's props and 1.x's are props whistle doesn't know, like any other.
    name: "A prop whistle doesn't know is listed, the hints, bar and anchor props among them",
    world: inTerminal({ hints: false, bar: "Bottom", hintsGap: 6, anchor: true, colour: "red" }),
    steps: [{ tick: 120, model: { problems: [
      { source: "layout", detail: "hints: not a whistle block prop" },
      { source: "layout", detail: "bar: not a whistle block prop" },
      { source: "layout", detail: "hintsGap: not a whistle block prop" },
      { source: "layout", detail: "anchor: not a whistle block prop" },
      { source: "layout", detail: "colour: not a whistle block prop" },
    ] } }],
  },
  {
    name: "A bad enabled in whistle.json is listed and the layout's counts",
    world: inTerminal({ enabled: false }, user({ enabled: "yes" })),
    steps: [{ command: "switch-mode", effects: [{ typeKey: "ctrl-space", terminal: "t1" }],
      model: { problems: [{ source: "whistle.json", detail: "enabled should be true or false" }] } }],
  },
  {
    name: "whistle.json's hints and bar are keys whistle doesn't know: they list nothing",
    world: inTerminal({}, user({ hints: false, bar: "Top" })),
    steps: [{ tick: 120, effects: [], problems: 0 }],
  },

  // Every whistle block is the anchor: the first runs, the others are extra.
  {
    name: "Of two whistle blocks, the first runs and the second is listed as extra",
    world: { ...TWO, props: { enabled: true } },
    steps: [{ command: "switch-mode", model: { mode: "whistle", problems: [
      { source: "layout", detail: "second: a second whistle block, left out; first runs whistle" }] } }],
  },
  {
    name: "An extra block's props count for nothing and aren't checked",
    world: { ...TWO, layout: withBlocks(block("first", {}), block("second", { enabled: false, colour: "red" })), props: {} },
    steps: [{ command: "switch-mode", model: { mode: "whistle", problems: [
      { source: "layout", detail: "second: a second whistle block, left out; first runs whistle" }] } }],
  },
  {
    name: "An extra block's copy acts on nothing: no effects, no shared keys, no claims",
    world: { ...TWO, props: { mappings: {} }, platform: "linux", keysFile: { text: "{}", error: null, at: 0 } },
    steps: [
      { tick: 120, effects: [], published: null, unset: ["whistle.hints", "whistle.events", "whistle.config", "whistle.copies", "keynav"] },
      { command: "switch-mode", effects: [], published: null, model: { mode: "type" }, handled: false },
    ],
  },
  {
    name: "A hidden whistle block still runs whistle, and it holds no bar to hide",
    world: { ...IN_TERMINAL, keys: SWITCH, layout: withBlocks(block("only", {}, true)), props: {} },
    steps: [{ command: "switch-mode", model: { mode: "whistle" }, state: { mode: "whistle" } }],
  },
  {
    name: "Whistle blocks with the same props make whistle inert, and one notification says to keep one",
    world: { ...TWINS, props: {} },
    steps: [
      { command: "switch-mode", model: { mode: "type" }, effects: [{ typeKey: "ctrl-space", terminal: "t1" }],
        notified: [TOLD_TWINS],
        state: { inert: { problem: "Whistle blocks one and two have the same props, so whistle can't tell which one runs", fix: "Keep one." } } },
      { command: "switch-mode", notified: [] },
    ],
  },
  {
    // Herdr runs one copy per block: the twin's copy sees the first's state, saying the same.
    name: "Whistle blocks with the same props: a copy whose twin already said why posts no notification",
    world: { ...TWINS, props: {}, state: { v: 1, mode: "type", enabled: true, sequence: null, pane: null, onTerminal: false, field: null,
      inert: { problem: "Whistle blocks one and two have the same props, so whistle can't tell which one runs", fix: "Keep one." } } },
    steps: [{ command: "mode:type", notified: [] }],
  },
  {
    name: "Twins make whistle inert even beside a block with props of its own",
    world: { ...TWINS, layout: withBlocks(block("one"), block("two"), block("three", { enabled: true })), props: { enabled: true } },
    steps: [{ command: "switch-mode", model: { mode: "type" },
      state: { inert: { problem: "Whistle blocks one and two have the same props, so whistle can't tell which one runs", fix: "Keep one." } } }],
  },
  {
    name: "In a layout with no whistle block, whistle doesn't run: no effects, no shared keys",
    world: { ...IN_TERMINAL, keys: SWITCH, layout: { id: "root", type: "column", children: [term("main")] }, props: {},
      platform: "linux", keysFile: { text: "{}", error: null, at: 0 } },
    steps: [
      { tick: 120, effects: [], published: null, notified: [], unset: ["whistle.hints", "whistle.events", "whistle.config", "whistle.copies"] },
      { command: "switch-mode", effects: [], published: null, model: { mode: "type" }, handled: false },
    ],
  },
];

export default suite("layout block", (t) => {
  for (const sc of SCENARIOS) t.scenario(sc, core);
});
