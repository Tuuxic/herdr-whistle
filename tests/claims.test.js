// Claimed keys (ADR 0001): whistle keeps its keys in keys.json's mod:whistle section, as
// "<key>": "whistle.key-<key>", by write effects; the write's outcome comes back as an input.

import { suite } from "./harness.js";
import * as core from "./step.js";
import { IN_TERMINAL } from "./worlds.js";

const text = (all) => `${JSON.stringify(all, null, 2)}\n`;
const keys = (all, extra = {}) => ({ keys: { text: text(all), error: null, at: 0, ...extra } });
const world = (all, extra) => ({ ...IN_TERMINAL, platform: "linux", layoutName: "main", ...keys(all, extra) });

// keys.json as shipped: the switch key only.
const SHIPPED = { global: { "ctrl-space": "whistle.whistle" }, "mod:whistle": { "ctrl-space": "whistle.type" } };
// What whistle makes of it: its chords (Ctrl+H/J/K/L) claimed after your entry.
const CLAIMED = {
  ...SHIPPED,
  "mod:whistle": {
    "ctrl-space": "whistle.type",
    "ctrl-h": "whistle.key-ctrl-h", "ctrl-j": "whistle.key-ctrl-j",
    "ctrl-k": "whistle.key-ctrl-k", "ctrl-l": "whistle.key-ctrl-l",
  },
};
const WRITE = { write: "keys.json", text: text(CLAIMED), expected: text(SHIPPED) };

const SCENARIOS = [
  {
    name: "Whistle claims its chords in mod:whistle, after your entries",
    world: world(SHIPPED),
    steps: [{ tick: 120, effects: [WRITE] }],
  },
  {
    name: "Claims already in keys.json write nothing",
    world: world(CLAIMED),
    steps: [{ tick: 120, effects: [] }, { tick: 120, effects: [] }],
  },
  {
    name: "No second write while one is on its way",
    world: world(SHIPPED),
    steps: [{ tick: 120, effects: [WRITE] }, { tick: 120, effects: [] }],
  },
  {
    name: "A written claim Herdr loads is kept",
    world: world(SHIPPED),
    steps: [
      { tick: 120, effects: [WRITE] },
      { world: keys(CLAIMED, { at: 120 }), wrote: "keys.json", effects: [] },
      { world: keys(CLAIMED, { at: 1000 }), tick: 1000, effects: [], model: { claimProblem: null } },
      { tick: 120, effects: [] },
    ],
  },
  {
    name: "A claim Herdr rejects (keys.error) is put back to the old text and not tried again",
    world: world(SHIPPED),
    steps: [
      { tick: 120, effects: [WRITE] },
      { world: keys(CLAIMED, { at: 120 }), wrote: "keys.json", effects: [] },
      { world: keys(CLAIMED, { at: 1000, error: "bad key" }), tick: 1000,
        effects: [{ write: "keys.json", text: text(SHIPPED), expected: text(CLAIMED) }],
        model: { claimProblem: "keys.json rejected whistle's keys: bad key" } },
      { world: keys(SHIPPED, { at: 1200 }), wrote: "keys.json", effects: [] },
      { tick: 120, effects: [] },
    ],
  },
  {
    name: "Herdr's verdict is waited for: a keys.json read before it doesn't count",
    world: world(SHIPPED),
    steps: [
      { tick: 120, effects: [WRITE] },
      { world: keys(CLAIMED, { at: 120 }), wrote: "keys.json", effects: [] },
      { tick: 1000, effects: [] },
      { world: keys(CLAIMED, { at: 1300, error: "bad key" }), tick: 120,
        effects: [{ write: "keys.json", text: text(SHIPPED), expected: text(CLAIMED) }] },
    ],
  },
  {
    name: "A failed write comes back as an input: a problem, and no retry of the same text",
    world: world(SHIPPED),
    steps: [
      { tick: 120, effects: [WRITE] },
      { wrote: "keys.json", ok: false, error: "disk full", effects: [],
        model: { claimProblem: "couldn't write keys.json: disk full" } },
      { tick: 120, effects: [] },
    ],
  },
  {
    name: "After a failed write, keys.json changing tries again",
    world: world(SHIPPED),
    steps: [
      { tick: 120, effects: [WRITE] },
      { wrote: "keys.json", ok: false, error: "changed on disk", effects: [] },
      { world: keys({ ...SHIPPED, global: { "ctrl-space": "whistle.whistle", "alt-1": "space.select:1" } }), tick: 120,
        effects: [{
          write: "keys.json",
          text: text({ ...CLAIMED, global: { "ctrl-space": "whistle.whistle", "alt-1": "space.select:1" } }),
          expected: text({ ...SHIPPED, global: { "ctrl-space": "whistle.whistle", "alt-1": "space.select:1" } }),
        }] },
    ],
  },
  {
    name: "keys.error: whistle leaves keys.json alone",
    world: world(SHIPPED, { error: "unknown command" }),
    steps: [{ tick: 120, effects: [], model: { claimProblem: "keys.json has an error (keys.error); whistle left it alone" } }],
  },
  {
    name: "No keys.json: whistle writes none (it would replace Herdr's defaults)",
    world: { ...IN_TERMINAL, platform: "linux", layoutName: "main", keys: { text: null, error: null, at: 0 } },
    steps: [{ tick: 120, effects: [] }],
  },
  {
    name: "keys.json not read yet: nothing written",
    world: { ...IN_TERMINAL, platform: "linux", layoutName: "main" },
    steps: [{ tick: 120, effects: [] }],
  },
  {
    name: "keys.json that doesn't parse: nothing written, a problem",
    world: { ...IN_TERMINAL, platform: "linux", layoutName: "main", keys: { text: "{ nope", error: null, at: 0 } },
    steps: [{ tick: 120, effects: [], model: { claimProblem: "keys.json doesn't parse; whistle's keys may not reach it" } }],
  },
  {
    name: "Your own entry for a key wins, in any spelling",
    world: world({ ...SHIPPED, "mod:whistle": {
      "ctrl-space": "whistle.type", "CTRL-h": "tab.prev",
      "ctrl-j": "whistle.key-ctrl-j", "ctrl-k": "whistle.key-ctrl-k", "ctrl-l": "whistle.key-ctrl-l",
    } }),
    steps: [{ tick: 120, effects: [] }],
  },
  {
    name: "A key a global section binds is claimed though it isn't a chord",
    world: world({ ...SHIPPED, global: { "ctrl-space": "whistle.whistle", j: "tab.next" } }),
    steps: [{ tick: 120, effects: [{
      write: "keys.json",
      text: text({ ...SHIPPED, global: { "ctrl-space": "whistle.whistle", j: "tab.next" }, "mod:whistle": { ...CLAIMED["mod:whistle"], j: "whistle.key-j" } }),
      expected: text({ ...SHIPPED, global: { "ctrl-space": "whistle.whistle", j: "tab.next" } }),
    }] }],
  },
  {
    name: "A key the shown layout's section binds is claimed, in any spelling",
    world: world({ ...SHIPPED, "layout:main": { Left: "tab.prev" } }),
    steps: [{ tick: 120, effects: [{
      write: "keys.json",
      text: text({ ...SHIPPED, "layout:main": { Left: "tab.prev" }, "mod:whistle": { ...CLAIMED["mod:whistle"], left: "whistle.key-left" } }),
      expected: text({ ...SHIPPED, "layout:main": { Left: "tab.prev" } }),
    }] }],
  },
  {
    name: "Another layout's or the terminal's binding claims nothing",
    world: world({ ...CLAIMED, "layout:other": { j: "tab.next" }, terminal: { k: "send:x" } }),
    steps: [{ tick: 120, effects: [] }],
  },
  {
    name: "Whistle's own entries it no longer needs go; anything else stays",
    world: world({ ...CLAIMED, "mod:whistle": { ...CLAIMED["mod:whistle"], "ctrl-x": "whistle.key-ctrl-x", "ctrl-y": "tab.new" } }),
    steps: [{ tick: 120, effects: [{
      write: "keys.json",
      text: text({ ...CLAIMED, "mod:whistle": { ...CLAIMED["mod:whistle"], "ctrl-y": "tab.new" } }),
      expected: text({ ...CLAIMED, "mod:whistle": { ...CLAIMED["mod:whistle"], "ctrl-x": "whistle.key-ctrl-x", "ctrl-y": "tab.new" } }),
    }] }],
  },
  {
    name: "Claims are made in TYPE as in WHISTLE",
    world: world(SHIPPED),
    steps: [{ command: "whistle" }, { world: { barFocused: true }, tick: 120, effects: [WRITE] }],
  },
  {
    name: "A claimed key's command in WHISTLE acts as the key",
    world: world(CLAIMED),
    steps: [
      { command: "whistle" },
      { world: { barFocused: true }, command: "key-i", effects: [{ run: "pane.focus", args: { pane: "p1" } }], model: { mode: "type" } },
    ],
  },
  {
    name: "A claimed key's command in another spelling acts as the key",
    world: world(CLAIMED),
    steps: [
      { command: "whistle" },
      { world: { barFocused: true }, command: "key-Enter", model: { mode: "type" } },
    ],
  },
  {
    name: "A claimed key's command in TYPE does nothing",
    world: world(CLAIMED),
    steps: [{ command: "key-i", effects: [], model: { mode: "type" } }],
  },
];

export default suite("claims", (t) => {
  for (const sc of SCENARIOS) t.scenario(sc, core);
});
