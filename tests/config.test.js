// Config layers (ADR 0004, ADR 0007): the defaults (mappings.json), the layout's whistle block
// and whistle.json, each over the one before; mappings ("map") and own keys ("keys") apart.

import { suite, TEST_DEFAULTS } from "./harness.js";
import * as core from "./step.js";
import { IN_TERMINAL, withProps } from "./worlds.js";

const json = (v) => JSON.stringify(v);
// A world in a terminal: defaults with map added, a layout block with props, whistle.json.
const world = ({ map = {}, keys, props, user } = {}) => ({
  ...IN_TERMINAL,
  ...(props ? { layout: withProps(props) } : {}),
  configFiles: { defaults: json({ keys: keys ?? TEST_DEFAULTS.keys, map }), user: user === undefined ? null : json(user) },
});
// Into WHISTLE, the bar holding the keyboard.
const IN = [{ command: "whistle" }, { world: { barFocused: true }, tick: 120 }];
const ran = (command, args = {}) => [{ run: command, args }, { focusBar: true }];
const TO_TYPE = [{ run: "pane.focus", args: { pane: "p1" } }];

const SCENARIOS = [
  {
    name: "A mapping in the defaults runs its command",
    world: world({ map: { n: ["Next tab", "tab.next"] } }),
    steps: [...IN, { key: "n", effects: ran("tab.next"), handled: true, model: { mode: "whistle" } }],
  },
  {
    name: "The layout's mapping goes over the defaults'",
    world: world({ map: { n: ["Next tab", "tab.next"] }, props: { mappings: { n: ["Previous tab", "tab.prev"] } } }),
    steps: [...IN, { key: "n", effects: ran("tab.prev") }],
  },
  {
    name: "whistle.json's mapping goes over the layout's",
    world: world({ map: { n: ["Next tab", "tab.next"] }, props: { mappings: { n: ["Previous tab", "tab.prev"] } },
      user: { map: { n: ["Next space", "space.next"] } } }),
    steps: [...IN, { key: "n", effects: ran("space.next") }],
  },
  {
    name: "A key set to null in whistle.json takes the mapping away",
    world: world({ map: { n: ["Next tab", "tab.next"] }, user: { map: { n: null } } }),
    steps: [...IN, { key: "n", effects: [], handled: false }],
  },
  {
    name: "A key set to null in the layout takes the defaults' mapping away",
    world: world({ map: { n: ["Next tab", "tab.next"] }, props: { mappings: { n: null } } }),
    steps: [...IN, { key: "n", effects: [], handled: false }],
  },
  {
    name: "Groups merge key by key across layers",
    world: world({ map: { w: { name: "Panes", map: { q: ["Close pane", "pane.close"] } } },
      user: { map: { w: { map: { z: ["Zoom pane", "pane.zoom"] } } } } }),
    steps: [
      ...IN,
      { key: "w", effects: [], handled: true, model: { sequence: ["w"] } },
      { key: "q", effects: [{ run: "pane.focus", args: { pane: "p1" } }, ...ran("pane.close")], model: { sequence: null } },
      { key: "w" },
      { key: "z", effects: [{ run: "pane.focus", args: { pane: "p1" } }, ...ran("pane.zoom")] },
    ],
  },
  {
    name: "A mapping goes over an own key",
    world: world({ user: { map: { j: ["Next tab", "tab.next"] } } }),
    steps: [...IN, { key: "j", effects: ran("tab.next") }],
  },
  {
    name: "whistle.json's own keys replace an action's keys",
    world: world({ user: { keys: { type: ["q"] } } }),
    steps: [...IN, { key: "i", effects: [], handled: false, model: { mode: "whistle" } },
      { key: "q", effects: TO_TYPE, model: { mode: "type" } }],
  },
  {
    name: "The layout's own keys replace the defaults', whistle.json's the layout's",
    world: world({ props: { keys: { type: ["q"], "field-right": ["ctrl-n"] } }, user: { keys: { type: ["x"] } } }),
    steps: [...IN, { key: "q", effects: [], handled: false }, { key: "x", effects: TO_TYPE, model: { mode: "type" } }],
  },
  {
    name: "An own-key action set to null has no keys",
    world: world({ user: { keys: { type: null } } }),
    steps: [...IN, { key: "i", effects: [], handled: false, model: { mode: "whistle" } }],
  },
  {
    name: "pick, Enter by default, goes back to TYPE on the terminal field",
    world: world(),
    steps: [...IN, { key: "enter", effects: TO_TYPE, model: { mode: "type" } }],
  },
  {
    name: "A layer that still sets \"open\" is honoured as pick, and listed as a config problem asking to rename it",
    world: world({ user: { keys: { open: ["o"] } } }),
    steps: [...IN, { key: "enter", effects: [], handled: false, model: { mode: "whistle",
      problems: [{ source: "whistle.json", detail: 'keys › open is now "pick": rename it' }] } },
      { key: "o", effects: TO_TYPE, model: { mode: "type" } }],
  },
  {
    name: "A layer that sets both \"pick\" and \"open\": pick wins, and open is still listed",
    world: world({ user: { keys: { open: ["o"], pick: ["p"] } } }),
    steps: [...IN, { key: "o", effects: [], handled: false, model: { mode: "whistle",
      problems: [{ source: "whistle.json", detail: 'keys › open is now "pick": rename it' }] } },
      { key: "p", effects: TO_TYPE, model: { mode: "type" } }],
  },
  {
    name: "\"open\" set to null in a layer takes pick's keys away",
    world: world({ props: { keys: { open: null } } }),
    steps: [...IN, { key: "enter", effects: [], handled: false, model: { mode: "whistle" } }],
  },
  {
    name: "Own keys are claimed from the layers too",
    world: { ...world({ user: { keys: { "field-left": ["alt-h"], "field-down": null, "field-up": null, "field-right": null } } }),
      platform: "linux", layoutName: "main",
      keysFile: { text: json({ global: {} }), error: null, at: 0 } },
    steps: [{ tick: 120, effects: [{ write: "keys.json",
      text: `${JSON.stringify({ global: {}, "mod:whistle": { "alt-h": "whistle.key-alt-h" } }, null, 2)}\n`,
      expected: json({ global: {} }) }] }],
  },
  {
    name: "Chords inside groups are claimed",
    world: { ...world({ keys: { type: ["i"] }, map: { w: { name: "Panes", map: { "ctrl-x": ["Close pane", "pane.close"] } } } }),
      platform: "linux", layoutName: "main",
      keysFile: { text: json({ global: {} }), error: null, at: 0 } },
    steps: [{ tick: 120, effects: [{ write: "keys.json",
      text: `${JSON.stringify({ global: {}, "mod:whistle": { "ctrl-x": "whistle.key-ctrl-x" } }, null, 2)}\n`,
      expected: json({ global: {} }) }] }],
  },

  // Key sequences.
  {
    name: "Groups nest: each key goes one level deeper, the last runs",
    world: world({ map: { w: { name: "Panes", map: { m: { name: "More", map: { z: ["Zoom pane", "pane.zoom"] } } } } } }),
    steps: [...IN,
      { key: "w", effects: [], handled: true, model: { sequence: ["w"] } },
      { key: "m", effects: [], handled: true, model: { sequence: ["w", "m"] } },
      { key: "z", effects: [{ run: "pane.focus", args: { pane: "p1" } }, ...ran("pane.zoom")], model: { sequence: null } }],
  },
  {
    name: "The cancel key ends a key sequence",
    world: world({ keys: { ...TEST_DEFAULTS.keys, cancel: ["escape"] }, map: { w: { name: "Panes", map: { q: ["Close pane", "pane.close"] } } } }),
    steps: [...IN, { key: "w" }, { key: "escape", effects: [], handled: true, model: { sequence: null } },
      { key: "q", effects: [], handled: false }],
  },
  {
    name: "The back key goes up one level, and out of the first",
    world: world({ keys: { ...TEST_DEFAULTS.keys, back: ["backspace"] },
      map: { w: { name: "Panes", map: { m: { name: "More", map: { z: ["Zoom pane", "pane.zoom"] } } } } } }),
    steps: [...IN, { key: "w" }, { key: "m" },
      { key: "backspace", handled: true, model: { sequence: ["w"] } },
      { key: "backspace", handled: true, model: { sequence: null } }],
  },
  {
    name: "Inside a key sequence an own key is just a key of the group",
    world: world({ map: { w: { name: "Panes", map: { j: ["Close pane", "pane.close"] } } } }),
    steps: [...IN, { key: "w" }, { key: "j", effects: [{ run: "pane.focus", args: { pane: "p1" } }, ...ran("pane.close")] }],
  },
  {
    name: "Cancel with nothing pending does nothing",
    world: world({ keys: { ...TEST_DEFAULTS.keys, cancel: ["escape"] } }),
    steps: [...IN, { key: "escape", effects: [], handled: true, model: { mode: "whistle", sequence: null } }],
  },
  {
    name: "A mapping written in another spelling is the same key",
    world: world({ map: { "CTRL-n": ["Next tab", "tab.next"] } }),
    steps: [...IN, { key: "ctrl-n", effects: ran("tab.next") }],
  },
  {
    name: "A dialog command doesn't hold the keyboard",
    world: world({ map: { p: ["Palette", "app.palette"] } }),
    steps: [...IN, { key: "p", effects: [{ run: "app.palette", args: {} }] }],
  },
];

export default suite("config layers", (t) => {
  for (const sc of SCENARIOS) t.scenario(sc, core);
});

