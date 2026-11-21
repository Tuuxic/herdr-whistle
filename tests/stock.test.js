// Stock fields (ADR 0006): Herdr's own spaces, tabs and agents blocks are fields whistle drives
// with Herdr's next/prev commands. They have no cursor: moving to an item opens it, and only
// the bar shows which one is selected. The files block is not a field.

import { suite } from "./harness.js";
import * as core from "./step.js";
import { STOCK } from "./worlds.js";

const HOLD = 600;
const IN_STOCK = { layout: STOCK, barFocused: true, focused: { pane: "p1", terminal: "t1" }, panes: [{ pane: "p1", title: "zsh" }] };
const on = (field) => ({ mode: "whistle", field, recent: [field, "main"], pane: "p1" });
const ran = (command) => [{ run: command, args: {} }, { focusBar: true }];

// A move key on a stock field runs Herdr's command and holds the keyboard.
const move = (field, key, command) => ({
  name: `${key} on the stock ${field} field runs ${command}`,
  world: IN_STOCK,
  model: on(field),
  steps: [{ key, handled: true, effects: ran(command),
    model: { mode: "whistle", field, holdUntil: HOLD } }],
});

// A key with nothing to do on a stock field: used, nothing runs, the field stays.
const stays = (field, key) => ({
  name: `${key} on the stock ${field} field does nothing and stays`,
  world: IN_STOCK,
  model: on(field),
  steps: [{ key, handled: true, effects: [], model: { mode: "whistle", field } }],
});

// Pick (and l) on the agents field: WHISTLE goes on to the terminal field, at the pane the
// agent shows.
const toTerminal = (key) => ({
  name: `${key} on the stock agents field goes on to the terminal, at the agent's pane`,
  world: { ...IN_STOCK, focused: { pane: "p2", terminal: "t2" } },
  model: on("agents"),
  steps: [{ key, handled: true, effects: [], model: { mode: "whistle", field: "main", pane: "p2" },
    bar: { label: "Terminal" } }],
});

const SCENARIOS = [
  move("spaces", "j", "space.next"), move("spaces", "k", "space.prev"),
  move("spaces", "down", "space.next"), move("spaces", "up", "space.prev"),
  move("tabs", "l", "tab.next"), move("tabs", "h", "tab.prev"),
  move("tabs", "right", "tab.next"), move("tabs", "left", "tab.prev"),
  move("agents", "j", "agent.next"), move("agents", "k", "agent.prev"),
  stays("spaces", "h"), stays("spaces", "l"), stays("tabs", "j"), stays("tabs", "k"), stays("agents", "h"),
  stays("spaces", "enter"), stays("tabs", "enter"),
  toTerminal("enter"), toTerminal("l"),
  {
    name: "The bar names the stock field selected",
    world: IN_STOCK,
    model: on("agents"),
    steps: [{ tick: 120, bar: { badge: "WHISTLE", label: "Agents" } },
      { key: "ctrl-k", model: { field: "spaces" }, bar: { label: "Spaces" } },
      { key: "ctrl-l", model: { field: "main" } },
      { key: "ctrl-k", model: { field: "tabs" }, bar: { label: "Tabs" } }],
  },
  {
    name: "Ctrl+H/J/K/L move between stock fields and the terminal by the layout",
    world: IN_STOCK,
    model: on("main"),
    steps: [{ key: "ctrl-k", model: { field: "tabs" } }, { key: "ctrl-j", model: { field: "main" } },
      { key: "ctrl-h", model: { field: "spaces" } }, { key: "ctrl-j", model: { field: "agents" } },
      { key: "ctrl-l", model: { field: "main" } }, { key: "ctrl-h", model: { field: "agents" } }],
  },
  {
    name: "The files block is not a field: Ctrl+L from the terminal stays put",
    world: IN_STOCK,
    model: on("main"),
    steps: [{ key: "ctrl-l", handled: true, effects: [], model: { field: "main" } }],
  },
  {
    name: "Entering WHISTLE goes to the terminal, not a stock field",
    world: IN_STOCK,
    steps: [{ command: "switch-mode", model: { mode: "whistle", field: "main" } }],
  },
  {
    name: "A mapping on a stock field runs as usual, with no pane focused first",
    world: { ...IN_STOCK, configFiles: { defaults: JSON.stringify({ keys: { type: ["i"] }, map: { x: ["Close pane", "pane.close"] } }), user: null } },
    model: on("spaces"),
    steps: [{ key: "x", effects: ran("pane.close"), model: { field: "spaces" } }],
  },
];

export default suite("stock fields", (t) => {
  for (const sc of SCENARIOS) t.scenario(sc, core);
});
