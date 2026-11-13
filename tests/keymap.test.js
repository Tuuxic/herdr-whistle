// Table-driven tests for keymap.js (resolve, describe) and keynames.js (keyName, keyLabel).
// Runs on import: every failing case is collected, then one Error lists them all, which
// `herdr-app check` reports as the load error. tests/run.sh puts this next to the mod's files.

import { compose } from "./config.js";
import { keyName, keyLabel } from "./keynames.js";
import { resolve, describe } from "./keymap.js";

// The default own keys (as mappings.json has them) and a small map: commands, a nested group,
// and a mapped key ("x") that is also an own key, to show the map wins.
const KEYS = {
  "field-left": ["ctrl-h"], "field-down": ["ctrl-j"], "field-up": ["ctrl-k"], "field-right": ["ctrl-l"],
  left: ["h", "left"], down: ["j", "down"], up: ["k", "up"], right: ["l", "right"],
  open: ["enter"], type: ["i"], cancel: ["escape", "ctrl-["], back: ["backspace"],
};
const SPLIT = ["Split right", "pane.split", { direction: "right" }];
const MAP = {
  p: ["Command palette", "app.palette"],
  "ctrl-n": ["New tab", "tab.new", null, "type"],
  j: ["Mapped j", "test.j"],
  w: {
    name: "Panes",
    map: {
      v: SPLIT,
      q: ["Close pane", "pane.close"],
      m: { name: "More", map: { z: ["Zoom pane", "pane.zoom"] } },
    },
  },
  t: { map: { n: ["New tab", "tab.new"] } },
};
const conf = compose({ keys: KEYS, map: MAP }, null, null, null);
// The same keys, but "j" isn't mapped: the own key shows through.
const plain = compose({ keys: KEYS, map: { p: MAP.p, w: MAP.w } }, null, null, null);

const W = { path: ["w"], node: MAP.w.map, title: "Panes" };
const WM = { path: ["w", "m"], node: MAP.w.map.m.map, title: "More" };

// [name, conf, pending, field, key, expected { pending, act }]
const RESOLVE = [
  ["mapped key beats own key", conf, null, "keynav", "j", { pending: null, act: { run: MAP.j } }],
  ["own key when not mapped", plain, null, "keynav", "j", { pending: null, act: { keynav: "down" } }],
  ["mapped entry runs", conf, null, "terminal", "p", { pending: null, act: { run: MAP.p } }],
  ["mapped chord runs", conf, null, "terminal", "ctrl-n", { pending: null, act: { run: MAP["ctrl-n"] } }],
  ["group starts a sequence", conf, null, "terminal", "w", { pending: W, act: { show: true } }],
  ["group without name: key is title", conf, null, null, "t",
    { pending: { path: ["t"], node: MAP.t.map, title: "t" }, act: { show: true } }],
  ["entry in sequence runs", conf, W, null, "v", { pending: null, act: { run: SPLIT } }],
  ["nested group", conf, W, null, "m", { pending: WM, act: { show: true } }],
  ["entry two levels down", conf, WM, null, "z", { pending: null, act: { run: MAP.w.map.m.map.z } }],
  ["cancel ends sequence", conf, WM, null, "escape", { pending: null, act: { show: true } }],
  ["ctrl-[ cancels too", conf, W, null, "ctrl-[", { pending: null, act: { show: true } }],
  ["back goes up a level", conf, WM, null, "backspace", { pending: W, act: { show: true } }],
  ["back at first level ends", conf, W, null, "backspace", { pending: null, act: { show: true } }],
  ["not mapped flash", conf, W, null, "x", { pending: null, act: { flash: "w x is not mapped" } }],
  ["not mapped flash, labels", conf, WM, null, "ctrl-h",
    { pending: null, act: { flash: "w m Ctrl+H is not mapped" } }],
  ["own move key in sequence is not mapped", conf, W, "terminal", "h",
    { pending: null, act: { flash: "w h is not mapped" } }],
  ["field own key", conf, null, "terminal", "ctrl-l", { pending: null, act: { field: "right" } }],
  ["field own key, no field", conf, null, null, "ctrl-h", { pending: null, act: { field: "left" } }],
  ["type own key", conf, null, "keynav", "i", { pending: null, act: { type: true } }],
  ["unmapped chord not handled", conf, null, "keynav", "ctrl-x", { pending: null, act: null }],
  ["unmapped chord on terminal", conf, null, "terminal", "alt-q", { pending: null, act: null }],
  ["terminal: move between panes", conf, null, "terminal", "h", { pending: null, act: { pane: "left" } }],
  ["terminal: arrow moves", conf, null, "terminal", "down", { pending: null, act: { pane: "down" } }],
  ["terminal: open types", conf, null, "terminal", "enter", { pending: null, act: { type: true } }],
  ["terminal: other char not handled", conf, null, "terminal", "x", { pending: null, act: null }],
  ["terminal: cancel outside sequence", conf, null, "terminal", "escape", { pending: null, act: null }],
  ["keynav: move", conf, null, "keynav", "k", { pending: null, act: { keynav: "up" } }],
  ["keynav: arrow", conf, null, "keynav", "left", { pending: null, act: { keynav: "left" } }],
  ["keynav: open", conf, null, "keynav", "enter", { pending: null, act: { keynav: "open" } }],
  ["keynav: char", conf, null, "keynav", "x", { pending: null, act: { keynav: "key-x" } }],
  ["keynav: shifted char", conf, null, "keynav", "X", { pending: null, act: { keynav: "key-X" } }],
  ["keynav: punctuation", conf, null, "keynav", "?", { pending: null, act: { keynav: "key-?" } }],
  ["keynav: space not passed", conf, null, "keynav", "space", { pending: null, act: null }],
  ["keynav: named key not passed", conf, null, "keynav", "f2", { pending: null, act: null }],
  ["keynav: back key not passed", conf, null, "keynav", "backspace", { pending: null, act: null }],
  ["null field: move not handled", conf, null, null, "h", { pending: null, act: null }],
  ["null field: char not handled", conf, null, null, "x", { pending: null, act: null }],
  ["null field: mapped still runs", conf, null, null, "p", { pending: null, act: { run: MAP.p } }],
];

// A key event as Herdr sends it: key, key_char, modifiers.
const ev = (key, key_char, mods = {}) => ({ key, key_char, modifiers: mods });

// [event, expected keyName]
const NAMES = [
  [ev("a", "a"), "a"],
  [ev("x", "X", { shift: true }), "X"],
  [ev("/", "?", { shift: true }), "?"],
  [ev("space", " "), "space"],
  [ev("enter", undefined), "enter"],
  [ev("tab", undefined, { shift: true }), "shift-tab"],
  [ev("n", undefined, { control: true }), "ctrl-n"],
  [ev("X", undefined, { control: true, shift: true }), "ctrl-shift-x"],
  [ev("x", "X", { control: true, shift: true }), "ctrl-shift-x"],
  [ev("space", " ", { control: true }), "ctrl-space"],
  [ev("h", undefined, { alt: true, platform: true }), "alt-super-h"],
  [ev("[", undefined, { control: true }), "ctrl-["],
];

// [key name, expected keyLabel]
const LABELS = [
  ["ctrl-h", "Ctrl+H"],
  ["space", "SPC"],
  ["ctrl-space", "Ctrl+Space"],
  ["escape", "Esc"],
  ["p", "p"],
  ["ctrl-shift-x", "Ctrl+Shift+X"],
  ["backspace", "⌫"],
  ["f2", "F2"],
  ["ctrl--", "Ctrl+-"],
];

// JSON with keys sorted, so two results compare equal whatever order their fields were made in.
const show = (v) => JSON.stringify(v, (_k, x) => (x && typeof x === "object" && !Array.isArray(x)
  ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, x[k]])) : x));

// Runs every table: the failures as lines, and how many cases ran.
function runAll() {
  const fails = [];
  let total = 0;
  const check = (name, got, want) => {
    total++;
    if (show(got) !== show(want)) fails.push(`${name}: got ${show(got)}, want ${show(want)}`);
  };
  for (const [name, c, pending, field, key, want] of RESOLVE) {
    const before = show(pending);
    check(`resolve: ${name}`, resolve(c, pending, field, key), want);
    if (show(pending) !== before) fails.push(`resolve: ${name}: mutated the pending sequence`);
  }
  check("describe: nothing pending", describe(conf, null), null);
  check("describe: Panes", describe(conf, W), {
    keys: "w", title: "Panes", exit: "Esc · ⌫",
    items: [
      { key: "q", label: "Close pane", group: false },
      { key: "v", label: "Split right", group: false },
      { key: "m", label: "More", group: true },
    ],
  });
  check("describe: labels and no back key", describe(compose({ keys: { cancel: ["ctrl-g"] } }), {
    path: ["space", "ctrl-a"], node: {}, title: "x",
  }), { keys: "SPC Ctrl+A", title: "x", items: [], exit: "Ctrl+G" });
  for (const [e, want] of NAMES) check(`keyName ${show(e)}`, keyName(e), want);
  for (const [k, want] of LABELS) check(`keyLabel ${k}`, keyLabel(k), want);
  return { fails, total };
}

const { fails, total } = runAll();
if (fails.length) throw new Error(`${fails.length} of ${total} keymap tests failed:\n${fails.join("\n")}`);
