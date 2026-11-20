// The layout's whistle block (docs/contracts/layout-block.md): its props in their 1.0 form.
// `enabled`, `hints`, `nav`, `bar` and the hints' placement props; a bad prop is skipped and
// listed as a config problem (source "layout").

import { suite, TEST_DEFAULTS, DEFAULT_WORLD } from "./harness.js";
import * as core from "./step.js";
import { IN_TERMINAL, withProps, term, bar } from "./worlds.js";

const SWITCH = [{ section: "global", keys: "ctrl-space", action: "whistle.whistle" }];
const inTerminal = (props, extra = {}) => ({ ...IN_TERMINAL, layout: withProps(props), keys: SWITCH, ...extra });
const IN = [{ command: "whistle" }, { world: { barFocused: true }, tick: 120 }];

const user = (v) => ({ configFiles: { defaults: JSON.stringify(TEST_DEFAULTS), user: JSON.stringify(v) } });

// GRID (a and b side by side over c) with whistle's block carrying props.
const grid = (props) => ({ id: "root", type: "column", children: [
  { id: "top", type: "row", children: [term("a"), term("b")] }, term("c"), { ...bar, content: { mod: "whistle", props } },
] });
const onA = (props) => ({ layout: grid(props), focused: { pane: "p1", terminal: "t1" }, keys: SWITCH });

// Two bar spots: "Bottom" shown, "Top" hidden.
const spot = (id, name, hidden) => ({ id, type: "block", hidden, content: { mod: "whistle", props: { bar: name } } });
const TWO_SPOTS = { id: "root", type: "column", children: [spot("top-bar", "Top", true), term("main"), spot("bottom-bar", "Bottom", false)] };
const spots = (u) => ({ ...IN_TERMINAL, layout: TWO_SPOTS, ...user(u) });

// The two spots with an anchor after them (ADR 0018).
const ANCHOR = { id: "whistle-anchor", type: "block", content: { mod: "whistle", props: { anchor: true } } };
const ANCHORED = { ...IN_TERMINAL, layout: { ...TWO_SPOTS, children: [...TWO_SPOTS.children, ANCHOR] } };

const SCENARIOS = [
  {
    name: "enabled: false sends the switch key to the terminal",
    world: inTerminal({ enabled: false }),
    steps: [{ command: "whistle", effects: [{ typeKey: "ctrl-space", terminal: "t1" }], model: { mode: "type" } }],
  },
  {
    name: "Switched off, the bar shows no mode badge",
    world: inTerminal({ enabled: false }),
    steps: [{ tick: 120, bar: { badge: null, label: "Whistle off", marker: null } }],
  },
  {
    name: "whistle.json's enabled goes over the layout's",
    world: inTerminal({ enabled: false }, user({ enabled: true })),
    steps: [{ command: "whistle", effects: [{ focusBar: true }], model: { mode: "whistle" } }],
  },
  {
    name: "whistle.json can switch whistle off in a layout that has it on",
    world: inTerminal({ enabled: true }, user({ enabled: false })),
    steps: [{ command: "whistle", effects: [{ typeKey: "ctrl-space", terminal: "t1" }] }],
  },
  {
    name: "Switched off while in WHISTLE, whistle goes back to TYPE",
    world: inTerminal({}),
    steps: [...IN, { world: user({ enabled: false }), tick: 120,
      effects: [{ run: "pane.focus", args: { pane: "p1" } }], model: { mode: "type" } }],
  },
  {
    name: "Switched off, keys pressed on the bar aren't whistle's",
    world: inTerminal({}),
    steps: [...IN, { world: user({ enabled: false }), key: "ctrl-l", handled: false, model: { mode: "type" } }],
  },
  {
    name: "A nav override picks the field in that direction",
    world: onA({ nav: { a: { down: "b" } } }),
    model: { recent: ["a"] },
    steps: [{ command: "whistle", model: { field: "a" } }, { key: "ctrl-j", model: { field: "b" } }],
  },
  {
    name: "Directions a nav override leaves out follow the layout",
    world: onA({ nav: { a: { down: "b" } } }),
    model: { recent: ["a"] },
    steps: [{ command: "whistle" }, { key: "ctrl-l", model: { field: "b" } }, { key: "ctrl-j", model: { field: "c" } }],
  },
  {
    name: "A nav override on a group counts for the fields inside it",
    world: onA({ nav: { top: { up: "c" } } }),
    model: { recent: ["b"] },
    steps: [{ command: "whistle", model: { field: "b" } }, { key: "ctrl-k", model: { field: "c" } }],
  },
  {
    name: "A nav override to a block with no field doesn't move",
    world: onA({ nav: { a: { down: "bar" } } }),
    model: { recent: ["a"] },
    steps: [{ command: "whistle" }, { key: "ctrl-j", model: { field: "a" } }],
  },

  // A bad prop is skipped and listed; the rest of the block still counts.
  {
    name: "A bad enabled prop is skipped and listed, and whistle stays on",
    world: inTerminal({ enabled: "no" }),
    steps: [{ command: "whistle", effects: [{ focusBar: true }],
      model: { problems: [{ source: "layout", detail: "enabled should be true or false" }] }, bar: { marker: "⚠ 1" } }],
  },
  {
    name: "A bad nav entry is skipped and listed, the good ones still count",
    world: onA({ nav: { a: { down: "b", below: "c", right: 3, up: "nowhere" }, ghost: { down: "c" } } }),
    model: { recent: ["a"] },
    steps: [{ command: "whistle", model: { problems: [
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
    name: "Bad hints, bar and placement props and an unknown prop are listed",
    world: inTerminal({ hints: 1, bar: 2, hintsGap: "6", hintsAlignRight: 4, colour: "red" }),
    steps: [{ tick: 120, model: { problems: [
      { source: "layout", detail: "hints should be true or false" },
      { source: "layout", detail: "bar should be the spot's name, a string" },
      { source: "layout", detail: "hintsGap should be a number (px)" },
      { source: "layout", detail: "colour: not a whistle block prop" },
    ] } }],
  },
  {
    name: "The old names of the hints placement props aren't read: each is listed",
    world: inTerminal({ hintsInset: 4, hintsBorder: 1, hintsLift: 6 }),
    steps: [{ tick: 120, model: { problems: [
      { source: "layout", detail: "hintsInset: not a whistle block prop" },
      { source: "layout", detail: "hintsBorder: not a whistle block prop" },
      { source: "layout", detail: "hintsLift: not a whistle block prop" },
    ] } }],
  },
  {
    name: "The private part prop isn't a problem",
    world: inTerminal({ part: "hints" }),
    steps: [{ tick: 120, model: { problems: [] } }],
  },
  {
    name: "A bad enabled in whistle.json is listed and the layout's counts",
    world: inTerminal({ enabled: false }, user({ enabled: "yes" })),
    steps: [{ command: "whistle", effects: [{ typeKey: "ctrl-space", terminal: "t1" }],
      model: { problems: [{ source: "whistle.json", detail: "enabled should be true or false" }] } }],
  },

  // Bar spots.
  {
    name: "whistle.json's bar moves the bar to that spot",
    world: spots({ bar: "Top" }),
    steps: [{ tick: 120, effects: [{ run: "layout.show", args: { id: "top-bar" } }, { run: "layout.hide", args: { id: "bottom-bar" } }] }],
  },
  {
    name: "The bar already in its spot: nothing to do",
    world: spots({ bar: "Bottom" }),
    steps: [{ tick: 120, effects: [] }],
  },
  {
    name: "whistle.json's bar naming a spot the layout doesn't have is listed, and the bar stays",
    world: spots({ bar: "Left" }),
    steps: [{ tick: 120, effects: [],
      model: { problems: [{ source: "whistle.json", detail: 'bar: this layout has no spot "Left"; the bar stays where it is' }] } }],
  },

  // A hidden bar copy rests (ADR 0011): each spot is a copy of whistle, known by its props.
  {
    name: "A hidden bar copy rests: it claims nothing, publishes nothing and sets no views, the bar's included",
    world: { ...spots({}), props: { bar: "Top" }, platform: "linux", keysFile: { text: "{}", error: null, at: 0 } },
    steps: [{ tick: 120, effects: [], published: null, shared: { "whistle.settings": undefined, "whistle.hints": undefined, "whistle.bar:whistle": undefined } }],
  },
  {
    name: "The shown bar copy runs: it claims its keys and publishes",
    world: { ...spots({}), props: { bar: "Bottom" }, platform: "linux", keysFile: { text: "{}", error: null, at: 0 } },
    steps: [{ tick: 120, published: { v: 1, mode: "type", enabled: true, sequence: null, pane: null, onTerminal: false },
      effects: [{ write: "keys.json", text: `${JSON.stringify({ "mod:whistle": {
        "ctrl-h": "whistle.key-ctrl-h", "ctrl-j": "whistle.key-ctrl-j", "ctrl-k": "whistle.key-ctrl-k", "ctrl-l": "whistle.key-ctrl-l" } }, null, 2)}
`, expected: "{}" }] }],
  },
  {
    name: "A hidden bar copy doesn't move the bar: the shown copy does",
    world: { ...spots({ bar: "Top" }), props: { bar: "Top" } },
    steps: [{ tick: 120, effects: [] }],
  },
  {
    name: "A resting copy in WHISTLE goes back to TYPE",
    world: { ...spots({}), props: { bar: "Top" } }, model: { mode: "whistle" },
    steps: [{ tick: 120, effects: [], model: { mode: "type" } }],
  },
  {
    name: "A copy publishes its state and its bar's model again when shown after resting: the other spot's copy wrote them meanwhile",
    world: { ...spots({}), props: { bar: "Bottom" } },
    steps: [{ tick: 120, published: { v: 1, mode: "type", enabled: true, sequence: null, pane: null, onTerminal: false } },
      { world: { layout: { ...TWO_SPOTS, children: [spot("top-bar", "Top", false), term("main"), spot("bottom-bar", "Bottom", true)] } }, tick: 120, published: null },
      { world: { layout: TWO_SPOTS }, tick: 120, published: { v: 1, mode: "type", enabled: true, sequence: null, pane: null, onTerminal: false },
        shared: { "whistle.hints": null, "whistle.bar:whistle": { badge: "TYPE", label: "Terminal", marker: null } } }],
  },
  {
    name: "A bar copy shown again stops resting",
    world: { ...spots({}), props: { bar: "Top" } },
    steps: [{ tick: 120, published: null },
      { world: { layout: { ...TWO_SPOTS, children: [spot("top-bar", "Top", false), term("main"), spot("bottom-bar", "Bottom", true)] } }, tick: 120,
        published: { v: 1, mode: "type", enabled: true, sequence: null, pane: null, onTerminal: false } }],
  },

  // The anchor (ADR 0018): a bar's copy in an anchored layout is a view.
  {
    name: "A bar's copy in an anchored layout sets no shared key, the bar's and the views' included",
    world: { ...ANCHORED, props: { bar: "Bottom" }, platform: "linux", keysFile: { text: "{}", error: null, at: 0 } },
    steps: [{ tick: 120, effects: [], published: null, hintsWindow: [],
      shared: { "whistle.settings": undefined, "whistle.hints": undefined, "whistle.bar:whistle": undefined, keynav: undefined, "whistle.copies": undefined } }],
  },
];

export default suite("layout block", (t) => {
  for (const sc of SCENARIOS) t.scenario(sc, core);

  // hints (for the hints view): whistle.json's over the layout's, on by default.
  const hints = (props, u) => core.step(core.start(), { tick: true }, { ...DEFAULT_WORLD, ...inTerminal(props, u ? user(u) : {}) }).model.config.hints;
  t.check("hints are on by default", hints({}), true);
  t.check("a layout can switch the hints off", hints({ hints: false }), false);
  t.check("whistle.json's hints go over the layout's", hints({ hints: false }, { hints: true }), true);
});
