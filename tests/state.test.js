// Whistle state (ADR 0010, docs/contracts/state.md): shared("whistle") = { v: 1, mode, enabled,
// sequence, pane }, published as an effect when it changes and only then, never by an inert
// copy. Also the copyable reader in whistle.js.

import { suite, DEFAULT_WORLD } from "./harness.js";
import * as core from "./step.js";
import { readState } from "./whistle.js";
import { IN_TERMINAL, GRID } from "./worlds.js";

const json = (v) => JSON.stringify(v);
const KEYS = { "field-left": ["ctrl-h"], "field-right": ["ctrl-l"], left: ["h"], right: ["l"], type: ["i"], cancel: ["escape"] };
// Defaults with a group: w then v splits.
const DEFAULTS = json({ keys: KEYS, map: { w: { name: "Panes", map: { v: ["Split right", "pane.split", { direction: "right" }] } }, n: ["Next tab", "tab.next"] } });
const WORLD = { ...IN_TERMINAL, configFiles: { defaults: DEFAULTS, user: null } };
const state = (patch) => ({ v: 1, mode: "type", enabled: true, sequence: null, pane: null, ...patch });
const WHISTLE = state({ mode: "whistle", pane: "p1" });
// In WHISTLE with the bar holding the keyboard, the state already published.
const IN = [{ command: "whistle" }, { world: { barFocused: true }, tick: 120 }];

const SCENARIOS = [
  {
    name: "Whistle publishes its state on the first step",
    world: WORLD,
    steps: [{ tick: 120, published: state() }],
  },
  {
    name: "Nothing changed: nothing published",
    world: WORLD,
    steps: [{ tick: 120, published: state() }, { tick: 120, published: null }, { tick: 120, published: null }],
  },
  {
    name: "The mode changing is published, with the selected pane",
    world: WORLD,
    steps: [
      { command: "whistle", published: WHISTLE },
      { world: { barFocused: true }, tick: 120, published: null },
      { command: "whistle", published: state({ pane: "p1" }) },
    ],
  },
  {
    name: "A key sequence is published with its keys and its group's name",
    world: WORLD,
    steps: [...IN, { key: "w", published: { ...WHISTLE, sequence: { keys: ["w"], group: "Panes" } } }],
  },
  {
    name: "A key sequence ending is published as null",
    world: WORLD,
    steps: [...IN, { key: "w" }, { key: "escape", published: WHISTLE }],
  },
  {
    name: "A key sequence ending in a command is published as null",
    world: WORLD,
    steps: [...IN, { key: "w" }, { key: "v", published: WHISTLE }],
  },
  {
    name: "The selected pane changing is published",
    world: WORLD,
    steps: [...IN, { key: "l", published: null }, { world: { focused: { pane: "p2", terminal: "t1" } }, tick: 120, published: { ...WHISTLE, pane: "p2" } }],
  },
  {
    name: "A field selected that isn't a pane is not published",
    world: { ...WORLD, layout: GRID },
    steps: [...IN, { key: "ctrl-l", model: { field: "b" }, published: null }],
  },
  {
    name: "A key that isn't mapped changes nothing published",
    world: WORLD,
    steps: [...IN, { key: "x", published: null }, { key: "n", published: null }],
  },
  {
    name: "Switched off, whistle publishes enabled false and mode type",
    world: { ...WORLD, barFocused: true }, model: { enabled: false, mode: "whistle" },
    steps: [{ tick: 0, published: state({ enabled: false }) }],
  },
  {
    name: "An inert copy publishes nothing",
    world: { ...WORLD, herdr: "0.1.14" },
    steps: [{ tick: 120, published: null }, { command: "whistle", published: null }],
  },
];

export default suite("whistle state", (t) => {
  for (const sc of SCENARIOS) t.scenario(sc, core);

  // Switched back on: the model's enabled flips (no command does that yet: the layout's
  // `enabled` prop, #27).
  const w = { ...DEFAULT_WORLD, ...WORLD };
  const off = core.step({ ...core.start(), enabled: false }, { tick: true }, w);
  const on = core.step({ ...off.model, enabled: true }, { tick: true }, w);
  t.check("switched back on, enabled true is published", on.effects.find((e) => e.setShared === "whistle")?.value?.enabled, true);

  // The reader (whistle.js), as a mod would use it.
  t.check("the reader gives v1's fields", readState(WHISTLE), { mode: "whistle", enabled: true, sequence: null, pane: "p1" });
  t.check("the reader ignores fields it doesn't know", readState({ ...WHISTLE, later: 1 }), { mode: "whistle", enabled: true, sequence: null, pane: "p1" });
  t.check("the reader gives null before whistle publishes", readState(undefined), null);
  t.check("the reader gives null for a later, breaking v", readState({ ...WHISTLE, v: 2 }), null);
  t.check("the reader reads a sequence", readState({ ...WHISTLE, sequence: { keys: ["w"], group: "Panes" } }).sequence, { keys: ["w"], group: "Panes" });
});
