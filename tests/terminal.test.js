// The terminal as a field: h/j/k/l and the arrows move between split panes, with the keyboard
// held on the bar through Herdr's late focus; Ctrl+H/J/K/L move between fields by the layout's
// rows and columns.

import { suite } from "./harness.js";
import * as core from "./step.js";
import { IN_TERMINAL, GRID } from "./worlds.js";

// After a pane move whistle holds the keyboard this long (ms).
const HOLD = 600;

const paneMove = (key, direction) => ({
  name: `${key} in WHISTLE moves to the split pane ${direction}`,
  world: IN_TERMINAL,
  steps: [
    { command: "switch-mode" },
    { world: { barFocused: true }, key, handled: true,
      effects: [
        { run: "pane.focus", args: { pane: "p1" } },
        { run: "pane.go", args: { direction } },
        { focusBar: true },
      ],
      model: { mode: "whistle", holdUntil: HOLD } },
  ],
});

const fieldMove = (name, from, key, to, recent = []) => ({
  name,
  world: { layout: GRID, focused: { pane: "p1" } },
  model: { mode: "whistle", field: from, recent: [from, ...recent], pane: "p1" },
  steps: [{ world: { barFocused: true }, key, handled: true, effects: [], model: { mode: "whistle", field: to } }],
});

const SCENARIOS = [
  paneMove("h", "left"), paneMove("j", "down"), paneMove("k", "up"), paneMove("l", "right"),
  paneMove("left", "left"), paneMove("down", "down"), paneMove("up", "up"), paneMove("right", "right"),
  {
    name: "A pane move holds the keyboard: the bar takes it back and follows the focused pane",
    world: IN_TERMINAL,
    steps: [
      { command: "switch-mode" },
      { world: { barFocused: true }, key: "l" },
      { world: { barFocused: false, focused: { pane: "p2" } }, tick: 120,
        effects: [{ focusBar: true }], model: { mode: "whistle", pane: "p2" } },
      { world: { barFocused: true }, tick: 120, effects: [], model: { mode: "whistle", pane: "p2" } },
      { world: { barFocused: false }, tick: 120,
        effects: [{ focusBar: true }], model: { mode: "whistle" } },
    ],
  },
  {
    name: "Once the hold is over, losing the keyboard ends WHISTLE",
    world: IN_TERMINAL,
    steps: [
      { command: "switch-mode" },
      { world: { barFocused: true }, key: "l" },
      { tick: HOLD, effects: [], model: { mode: "whistle" } },
      { world: { barFocused: false }, tick: 1, effects: [], model: { mode: "type" } },
    ],
  },
  {
    name: "Going back to TYPE in a hold ends the hold",
    world: IN_TERMINAL,
    steps: [
      { command: "switch-mode" },
      { world: { barFocused: true }, key: "l" },
      { world: { focused: { pane: "p2" } }, tick: 120, model: { pane: "p2" } },
      { key: "i", effects: [{ run: "pane.focus", args: { pane: "p2" } }], model: { mode: "type", holdUntil: 0 } },
      { world: { barFocused: false }, tick: 120, effects: [], model: { mode: "type" } },
    ],
  },
  fieldMove("Ctrl+L moves to the field on the right", "a", "ctrl-l", "b"),
  fieldMove("Ctrl+H moves to the field on the left", "b", "ctrl-h", "a"),
  fieldMove("Ctrl+J moves to the field below", "a", "ctrl-j", "c"),
  fieldMove("Ctrl+K enters a group at the field used last", "c", "ctrl-k", "b", ["b", "a"]),
  fieldMove("Ctrl+K enters a group at its terminal when none was used", "c", "ctrl-k", "a"),
  fieldMove("Ctrl+H at the window's edge stays put", "a", "ctrl-h", "a"),
  {
    name: "A field move skips a hidden block",
    world: {
      layout: { id: "root", type: "row", children: [
        { id: "a", type: "block", content: { pane: {} } },
        { id: "gone", type: "block", hidden: true, content: { pane: {} } },
        { id: "b", type: "block", content: { pane: {} } },
      ] },
      focused: { pane: "p1" },
    },
    model: { mode: "whistle", field: "a", recent: ["a"], pane: "p1" },
    steps: [{ key: "ctrl-l", handled: true, model: { field: "b", recent: ["b", "a"] } }],
  },
  {
    name: "A key whistle has no use for goes on",
    world: IN_TERMINAL,
    steps: [
      { command: "switch-mode" },
      { world: { barFocused: true }, key: "x", handled: false, effects: [], model: { mode: "whistle" } },
    ],
  },
  {
    name: "Keys in TYPE go on",
    world: IN_TERMINAL,
    steps: [{ key: "l", handled: false, effects: [] }],
  },
];

export default suite("terminal", (t) => {
  for (const sc of SCENARIOS) t.scenario(sc, core);
});
