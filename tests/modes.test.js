// Mode changes: TYPE and WHISTLE, the switch key's commands, click-away, the anchor taking the keyboard.

import { suite } from "./harness.js";
import * as core from "./step.js";
import { IN_TERMINAL } from "./worlds.js";

const SCENARIOS = [
  {
    name: "Ctrl+Space in TYPE enters WHISTLE on the terminal and takes the keyboard",
    world: IN_TERMINAL,
    steps: [
      { command: "switch-mode", effects: [{ focusAnchor: true }],
        model: { mode: "whistle", field: "main", pane: "p1" } },
    ],
  },
  {
    name: "Ctrl+Space in WHISTLE goes back to TYPE in the selected pane",
    world: IN_TERMINAL,
    steps: [
      { command: "switch-mode" },
      { world: { anchorFocused: true, focused: { pane: "p2" } }, command: "switch-mode",
        effects: [{ run: "pane.focus", args: { pane: "p1" } }], model: { mode: "type" } },
    ],
  },
  {
    name: "whistle.mode:type (Ctrl+Space on the anchor) goes back to TYPE",
    world: IN_TERMINAL,
    steps: [
      { command: "switch-mode" },
      { world: { anchorFocused: true }, command: "mode:type",
        effects: [{ run: "pane.focus", args: { pane: "p1" } }], model: { mode: "type" } },
    ],
  },
  {
    name: "whistle.mode:type in TYPE does nothing",
    world: IN_TERMINAL,
    steps: [{ command: "mode:type", effects: [], model: { mode: "type" } }],
  },
  {
    name: "i in WHISTLE goes back to TYPE",
    world: IN_TERMINAL,
    steps: [
      { command: "switch-mode" },
      { world: { anchorFocused: true }, key: "i", handled: true,
        effects: [{ run: "pane.focus", args: { pane: "p1" } }], model: { mode: "type" } },
    ],
  },
  {
    name: "A click away from the anchor ends WHISTLE",
    world: IN_TERMINAL,
    steps: [
      { command: "switch-mode" },
      { world: { anchorFocused: true }, tick: 120, effects: [], model: { mode: "whistle" } },
      { world: { anchorFocused: false }, tick: 120, effects: [], model: { mode: "type" } },
    ],
  },
  {
    name: "The bar taking the keyboard (a click on it) enters WHISTLE on the terminal",
    world: IN_TERMINAL,
    steps: [
      { world: { anchorFocused: true }, tick: 120, effects: [], model: { mode: "whistle", field: "main", pane: "p1" } },
    ],
  },
  {
    name: "The bar shows the mode and where the keyboard is",
    world: IN_TERMINAL,
    steps: [
      { tick: 120, state: { mode: "type" } },
      { command: "switch-mode", state: { mode: "whistle", onTerminal: true } },
      { world: { anchorFocused: true }, key: "i", state: { mode: "type" } },
    ],
  },
  {
    name: "The bar names the selected pane by its program when it has no title",
    world: { ...IN_TERMINAL, panes: [{ pane: "p1", title: "", program: { name: "vim" } }] },
    steps: [{ command: "switch-mode", state: { mode: "whistle", onTerminal: true } }],
  },
  {
    name: "The bar says nothing of where the keyboard is in TYPE outside a terminal",
    world: { ...IN_TERMINAL, focused: { pane: null } },
    steps: [{ tick: 120, state: { mode: "type" } }],
  },
  {
    name: "Nothing changes on a tick while TYPE keeps out of the anchor",
    world: IN_TERMINAL,
    steps: [{ tick: 120, effects: [], model: { mode: "type", field: null } }],
  },
];

export default suite("modes", (t) => {
  for (const sc of SCENARIOS) t.scenario(sc, core);
});
