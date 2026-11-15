// Key names: every spelling Herdr's keys.json accepts comes down to one canonical name, the one
// keyName gives a key press (ctrl, alt, super, shift, then the key). Issue #4.

import { suite } from "./harness.js";
import { canonicalKey, keyName } from "./keynames.js";

// [family, written, platform, canonical]; null: not a key whistle can name.
const TABLE = [
  ["already canonical", "ctrl-h", "linux", "ctrl-h"],
  ["already canonical", "ctrl-alt-super-shift-x", "linux", "ctrl-alt-super-shift-x"],
  ["already canonical", "j", "linux", "j"],
  ["already canonical", "?", "linux", "?"],
  ["already canonical", "ctrl--", "linux", "ctrl--"],
  ["already canonical", "shift-tab", "linux", "shift-tab"],

  ["platform modifier: cmd is super", "cmd-k", "macos", "super-k"],
  ["platform modifier: cmd is super", "cmd-k", "windows", "super-k"],
  ["platform modifier: win is super", "win-k", "windows", "super-k"],
  ["platform modifier: win is super", "win-k", "macos", "super-k"],
  ["platform modifier: super", "super-k", "linux", "super-k"],
  ["secondary is cmd on macOS", "secondary-k", "macos", "super-k"],
  ["secondary is ctrl elsewhere", "secondary-k", "linux", "ctrl-k"],
  ["secondary is ctrl elsewhere", "secondary-k", "windows", "ctrl-k"],
  ["secondary with ctrl held too", "ctrl-secondary-k", "linux", "ctrl-k"],

  ["modifier order", "shift-ctrl-x", "linux", "ctrl-shift-x"],
  ["modifier order", "alt-ctrl-h", "linux", "ctrl-alt-h"],
  ["modifier order", "shift-cmd-alt-p", "macos", "alt-super-shift-p"],
  ["modifier order", "super-ctrl-space", "linux", "ctrl-super-space"],

  ["case: modifiers", "Ctrl-x", "linux", "ctrl-x"],
  ["case: modifiers", "CTRL-ALT-x", "linux", "ctrl-alt-x"],
  ["case: modifiers", "Cmd-k", "macos", "super-k"],
  ["case: named keys", "Enter", "linux", "enter"],
  ["case: named keys", "ctrl-Space", "linux", "ctrl-space"],
  ["case: named keys", "F2", "linux", "f2"],
  ["case: named keys", "Shift-Tab", "linux", "shift-tab"],
  ["case: an uppercase letter in a chord is shift", "ctrl-X", "linux", "ctrl-shift-x"],
  ["case: an uppercase letter in a chord is shift", "ctrl-shift-X", "linux", "ctrl-shift-x"],
  ["case: a lone character is what it types", "X", "linux", "X"],
  ["case: shift and a letter types the capital", "shift-x", "linux", "X"],
  ["case: shift and a letter types the capital", "Shift-X", "linux", "X"],

  ["not a key whistle can name", "", "linux", null],
  ["not a key whistle can name", "option-x", "macos", null],
  ["not a key whistle can name", "fn-f1", "linux", null],
  ["not a key whistle can name", "ctrl-a b", "linux", null],
  ["not a key whistle can name", "ctrl-", "linux", null],
];

export default suite("keynames", (t) => {
  for (const [family, written, platform, want] of TABLE)
    t.check(`${family}: ${written} on ${platform}`, canonicalKey(written, platform), want);

  // A key press's name is already canonical.
  const presses = [
    { key: "h", modifiers: { control: true } },
    { key: "x", key_char: "X", modifiers: { control: true, shift: true } },
    { key: "k", modifiers: { platform: true, alt: true } },
    { key: "tab", modifiers: { shift: true } },
    { key: "x", key_char: "X", modifiers: { shift: true } },
    { key: "space", key_char: " ", modifiers: {} },
  ];
  for (const e of presses) {
    const name = keyName(e);
    t.check(`a press's name is canonical: ${name}`, canonicalKey(name, "linux"), name);
  }
});
