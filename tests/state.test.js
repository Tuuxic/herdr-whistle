// Whistle state (ADR 0010, docs/contracts/state.md): shared("whistle") = { v: 1, mode, enabled,
// sequence, pane, onTerminal } (onTerminal: ADR 0016), published as an effect when it changes and only then, never by an inert
// copy. Also the copyable reader in whistle.js.

import { suite, DEFAULT_WORLD } from "./harness.js";
import * as core from "./step.js";
import { readState } from "./whistle.js";
import { IN_TERMINAL, GRID, STOCK, term, bar } from "./worlds.js";

const json = (v) => JSON.stringify(v);
const KEYS = { "field-left": ["ctrl-h"], "field-right": ["ctrl-l"], "field-down": ["ctrl-j"], "field-up": ["ctrl-k"], left: ["h"], right: ["l"], type: ["i"], cancel: ["escape"] };
// Defaults with a group: w then v splits.
const DEFAULTS = json({ keys: KEYS, map: { w: { name: "Panes", map: { v: ["Split right", "pane.split", { direction: "right" }] } }, n: ["Next tab", "tab.next"] } });
const WORLD = { ...IN_TERMINAL, configFiles: { defaults: DEFAULTS, user: null } };
const state = (patch) => ({ v: 1, mode: "type", enabled: true, sequence: null, pane: null, onTerminal: false, ...patch });
const WHISTLE = state({ mode: "whistle", pane: "p1", onTerminal: true });
// The terminal with a keynav field (a files mod that announced itself) to its right.
const FILES_KEY = "files {}";
const WITH_KEYNAV = {
  ...WORLD,
  layout: { id: "root", type: "column", children: [{ id: "top", type: "row", children: [term("main"), { id: "files", type: "block", content: { mod: "files" } }] }, bar] },
  shared: { [`keynav.field:${FILES_KEY}`]: { v: 2, label: "Files", keys: {} } },
};
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
    name: "onTerminal is true on entering WHISTLE on the terminal",
    world: WORLD,
    steps: [{ tick: 120, published: state() }, { command: "whistle", published: WHISTLE }],
  },
  {
    name: "onTerminal is false while a keynav field is selected, and true again back on the terminal",
    world: WITH_KEYNAV,
    steps: [...IN,
      { key: "ctrl-l", model: { field: "files" }, published: { ...WHISTLE, onTerminal: false } },
      { key: "ctrl-h", model: { field: "main" }, published: WHISTLE }],
  },
  {
    name: "onTerminal is false while a stock field is selected, and true again back on the terminal",
    world: { ...WORLD, layout: STOCK },
    steps: [...IN,
      { key: "ctrl-h", model: { field: "spaces" }, published: { ...WHISTLE, onTerminal: false } },
      { key: "ctrl-l", model: { field: "main" }, published: WHISTLE }],
  },
  {
    name: "onTerminal is false in TYPE",
    world: WORLD,
    steps: [...IN, { command: "whistle", published: state({ pane: "p1" }) }],
  },
  {
    name: "Moving between stock fields leaves onTerminal false and publishes nothing",
    world: { ...WORLD, layout: STOCK },
    steps: [...IN, { key: "ctrl-h", model: { field: "spaces" } }, { key: "ctrl-j", model: { field: "agents" }, published: null }],
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
    name: "Another terminal field selected, its pane not yet focused, publishes nothing",
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
    world: { ...WORLD, barFocused: true, configFiles: { defaults: DEFAULTS, user: json({ enabled: false }) } }, model: { mode: "whistle" },
    steps: [{ tick: 0, published: state({ enabled: false }) }],
  },
  {
    name: "whistle.off and whistle.on change enabled in the whistle state, once whistle.json says so",
    world: WORLD,
    steps: [
      { tick: 120, published: state() },
      // whistle.off writes whistle.json; enabled changes when whistle reads it back.
      { command: "off", effects: [{ write: "whistle.json", text: `${JSON.stringify({ enabled: false }, null, 2)}
`, expected: null }], published: null },
      { world: { configFiles: { defaults: DEFAULTS, user: `${JSON.stringify({ enabled: false }, null, 2)}
` } }, wrote: "whistle.json", published: null },
      { tick: 120, published: state({ enabled: false }) },
      { command: "on", effects: [{ write: "whistle.json", text: `${JSON.stringify({ enabled: true }, null, 2)}
`, expected: `${JSON.stringify({ enabled: false }, null, 2)}
` }], published: null },
      { world: { configFiles: { defaults: DEFAULTS, user: `${JSON.stringify({ enabled: true }, null, 2)}
` } }, tick: 120, published: state() },
    ],
  },
  {
    name: "An inert copy publishes nothing",
    world: { ...WORLD, herdr: "0.1.14" },
    steps: [{ tick: 120, published: null }, { command: "whistle", published: null }],
  },
];

export default suite("whistle state", (t) => {
  for (const sc of SCENARIOS) t.scenario(sc, core);

  // Switched back on in whistle.json: enabled true is published again.
  const w = { ...DEFAULT_WORLD, ...WORLD };
  const user = (u) => ({ ...w, configFiles: { defaults: DEFAULTS, user: json(u) } });
  const off = core.step(core.start(), { tick: true }, user({ enabled: false }));
  const on = core.step(off.model, { tick: true }, user({ enabled: true }));
  t.check("switched back on, enabled true is published", on.effects.find((e) => e.setShared === "whistle")?.value?.enabled, true);

  // The reader (whistle.js), as a mod would use it.
  t.check("the reader gives v1's fields", readState(WHISTLE), { mode: "whistle", enabled: true, sequence: null, pane: "p1", onTerminal: true });
  t.check("the reader ignores fields it doesn't know", readState({ ...WHISTLE, later: 1 }), { mode: "whistle", enabled: true, sequence: null, pane: "p1", onTerminal: true });
  t.check("the reader gives onTerminal false from a whistle that doesn't publish it yet", readState({ v: 1, mode: "whistle", enabled: true, sequence: null, pane: "p1" }).onTerminal, false);
  t.check("the reader gives null before whistle publishes", readState(undefined), null);
  t.check("the reader gives null for a later, breaking v", readState({ ...WHISTLE, v: 2 }), null);
  t.check("the reader reads a sequence", readState({ ...WHISTLE, sequence: { keys: ["w"], group: "Panes" } }).sequence, { keys: ["w"], group: "Panes" });
});
