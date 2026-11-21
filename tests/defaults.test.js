// The shipped defaults (Defaults for stock Herdr, issue #11): mappings.json in the 1.0 form,
// every entry good, every action keyed; the default map grouped by noun, with terminal scroll
// and find keys, and every mapping that makes a terminal ending in TYPE; ctrl-space the only
// switch key in the shipped keys.json, beside two jump keys.

import { suite } from "./harness.js";
import * as core from "./step.js";
import { compose, flatten, ACTIONS, keysProblems } from "./config.js";
import { IN_TERMINAL } from "./worlds.js";
import texts from "./texts.js";

const SHIPPED = texts["mods/whistle/mappings.json"];
const world = { ...IN_TERMINAL, configFiles: { defaults: SHIPPED, user: null } };
const IN = [{ command: "switch-mode" }, { world: { anchorFocused: true }, tick: 120 }];
const FOCUS = { run: "pane.focus", args: { pane: "p1" } };
const HOLD = { focusAnchor: true };

// Keys pressed in WHISTLE on the shipped map; the last one's effects and mode.
const press = (name, keys, effects, mode = "whistle") => ({
  name, world,
  steps: [...IN, ...keys.slice(0, -1).map((key) => ({ key })),
    { key: keys.at(-1), handled: true, effects, model: { mode, sequence: null } }],
});
const toType = (name, keys, effects) => press(name, keys, effects, "type");

const SCENARIOS = [
  toType("Ctrl+N makes a tab and goes to TYPE", ["ctrl-n"], [{ run: "tab.new", args: {} }]),
  toType("t n makes a tab and goes to TYPE", ["t", "n"], [{ run: "tab.new", args: {} }]),
  toType("s n makes a space and goes to TYPE", ["s", "n"], [{ run: "space.new", args: {} }]),
  toType("w v splits the selected pane right and goes to TYPE", ["w", "v"],
    [FOCUS, { run: "pane.split", args: { direction: "right" } }]),
  toType("w s splits the selected pane down and goes to TYPE", ["w", "s"],
    [FOCUS, { run: "pane.split", args: { direction: "down" } }]),
  toType("f finds in the selected terminal and goes to TYPE", ["f"], [FOCUS, { run: "terminal.search", args: {} }]),
  press("Ctrl+U scrolls the selected terminal half a page up", ["ctrl-u"], [FOCUS, { run: "terminal.scroll", args: { pages: -0.5 } }, HOLD]),
  press("Ctrl+D scrolls the selected terminal half a page down", ["ctrl-d"], [FOCUS, { run: "terminal.scroll", args: { pages: 0.5 } }, HOLD]),
  press("g scrolls the selected terminal to the top", ["g"], [FOCUS, { run: "terminal.scroll", args: { to: "top" } }, HOLD]),
  press("G scrolls the selected terminal to the bottom", ["G"], [FOCUS, { run: "terminal.scroll", args: { to: "bottom" } }, HOLD]),
  press("w H swaps the selected pane left", ["w", "H"], [FOCUS, { run: "pane.swap", args: { direction: "left" } }, HOLD]),
  press("a n shows the next agent", ["a", "n"], [{ run: "agent.next", args: {} }, HOLD]),
  press("] shows the next agent", ["]"], [{ run: "agent.next", args: {} }, HOLD]),
  press("tab shows the next tab", ["tab"], [{ run: "tab.next", args: {} }, HOLD]),
  press("s x closes the space", ["s", "x"], [{ run: "space.close", args: {} }, HOLD]),
  press("/ opens the picker, which takes the keyboard", ["/"], [{ run: "mod.open:picker", args: {} }]),
  {
    name: "A key sequence has no step back: Backspace in one isn't mapped, and Escape still ends one",
    world,
    steps: [...IN,
      { key: "w", model: { sequence: ["w"] }, hints: { keys: "w", exit: "Esc cancels" } },
      { key: "backspace", handled: true, effects: [], model: { sequence: null }, raised: [{ kind: "key-unmapped", text: "w ⌫ is not mapped" }, { kind: "sequence-ended", by: "unmapped" }] },
      { key: "w" }, { key: "escape", handled: true, effects: [], model: { sequence: null }, hints: null }],
  },
];

// Commands that make a terminal: a mapping running one ends in TYPE.
const MAKES_TERMINAL = ["tab.new", "space.new", "pane.split"];

export default suite("shipped defaults", (t) => {
  let defaults = null;
  try { defaults = JSON.parse(SHIPPED); } catch (e) { t.fail("mappings.json parses", String(e?.message ?? e)); }
  const c = compose([{ source: "mappings.json", ...defaults }], { platform: "linux" });
  t.check("mappings.json has no config problems", c.problems, []);
  t.check("mappings.json gives every own-key action a key", Object.keys(ACTIONS).filter((a) => !c.keys[a]?.length), []);
  t.check("the default map's groups are by noun: s t w a",
    Object.entries(c.map).filter(([, v]) => v.map).map(([k, v]) => `${k} ${v.name}`).sort(), ["a Agents", "s Spaces", "t Tabs", "w Panes"]);
  const flat = (map, path = []) => Object.entries(map).flatMap(([k, v]) => (v.map ? flat(v.map, [...path, k]) : [{ seq: [...path, k], ...v }]));
  t.check("every default mapping that makes a terminal ends in TYPE",
    flat(c.map).filter((m) => MAKES_TERMINAL.includes(m.run) && m.then !== "type").map((m) => m.seq.join(" ")), []);
  t.check("flatten lists the default map", flatten(c.map).length, flat(c.map).length);

  let keys = null;
  try { keys = JSON.parse(texts["keys.json"]); } catch (e) { t.fail("keys.json parses", String(e?.message ?? e)); }
  t.check("the shipped keys.json binds ctrl-space, the switch key, the jump keys alt-a and alt-s (ids from Herdr's main layout),",
    keys && { global: keys.global, terminal: keys.terminal ?? null },
    { global: { "ctrl-space": "whistle.switch-mode", "alt-a": "whistle.focus:agents", "alt-s": "whistle.focus:spaces" }, terminal: null });
  t.check("the shipped keys.json has no config problem", keysProblems(texts["keys.json"], "whistle"), []);

  for (const sc of SCENARIOS) t.scenario(sc, core);
});
