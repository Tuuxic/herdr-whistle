// Key names, spelled as mappings.json and keys.json spell them, and shown to people.

// A pressed key's name: the character it types ("?", "+"), else its name ("enter", "f2"). With
// ctrl/alt/super held it's the key with those in front, as keys.json spells chords
// ("ctrl-n", "ctrl-shift-x"); without them shift only shows on named keys ("shift-tab",
// "shift-space"), since a typed character already carries it ("X").
export function keyName(e) {
  const m = e.modifiers ?? {}, c = e.key_char;
  const held = [m.control && "ctrl", m.alt && "alt", m.platform && "super"].filter(Boolean);
  if (!held.length && (c === " " || e.key === "space")) return m.shift ? "shift-space" : "space";
  if (!held.length && c && c.length === 1 && c.trim()) return c;
  const key = held.length && e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const shift = m.shift && (held.length || key.length > 1);
  return [...held, ...(shift ? ["shift"] : []), key].join("-");
}

// Modifiers as keys.json may spell them (any case), each as keyName writes it. cmd, super and
// win are the platform modifier on every OS; secondary is cmd on macOS and ctrl elsewhere.
const MODS = { ctrl: "ctrl", alt: "alt", shift: "shift", cmd: "super", super: "super", win: "super" };
const ORDER = ["ctrl", "alt", "super", "shift"];

// Any spelling Herdr's keys.json accepts for one key ("Cmd-K", "shift-ctrl-x", "ctrl-X",
// "secondary-k") as keyName writes the press (`super-k`, `ctrl-shift-x`, `ctrl-shift-x`, and
// `super-k` on macOS, `ctrl-k` elsewhere). platform: "macos" | "linux" | "windows". Null for
// what isn't one key whistle can name: a key sequence, an unknown modifier (option, fn).
// Shifted punctuation can't be worked out without the keyboard layout: write the character
// ("ctrl-?", not "ctrl-shift-/").
export function canonicalKey(written, platform) {
  if (typeof written !== "string" || !written || /\s/.test(written)) return null;
  const parts = keyParts(written);
  let key = parts.pop();
  const held = new Set();
  for (const p of parts) {
    const m = p.toLowerCase() === "secondary" ? (platform === "macos" ? "super" : "ctrl") : MODS[p.toLowerCase()];
    if (!m) return null;
    held.add(m);
  }
  if (key.length > 1 && key.includes("-")) return null; // "ctrl-": a modifier with no key
  if (key.length > 1) key = key.toLowerCase();
  else if (/[A-Z]/.test(key)) { held.add("shift"); key = key.toLowerCase(); }
  const chord = held.has("ctrl") || held.has("alt") || held.has("super");
  // Without ctrl/alt/super, shift and a letter is the capital it types.
  if (!chord && held.has("shift") && /^[a-z]$/.test(key)) return key.toUpperCase();
  return [...ORDER.filter((m) => held.has(m)), key].join("-");
}

// A key with ctrl/alt/super held: keys.json's sections are likely to bind it.
export const isChord = (k) => /^(ctrl|alt|super)-./.test(k);

// The parts of a key's name: "ctrl-shift-x" -> ["ctrl", "shift", "x"], "ctrl--" -> ["ctrl", "-"].
export const keyParts = (k) => k.split(/-(?=.)/);

// A key as `hc keys` spells it: "ctrl-space" -> "ctrl+space"; ctrl-[ is Esc to a terminal.
export const hcKey = (k) => (k === "ctrl-[" ? "esc" : keyParts(k).join("+"));

const NAMES = { space: "SPC", escape: "Esc", backspace: "⌫", enter: "Enter", tab: "Tab", left: "←", right: "→", up: "↑", down: "↓" };
const cap = (s) => s[0].toUpperCase() + s.slice(1);

// A key as people read it: "ctrl-h" -> "Ctrl+H", "escape" -> "Esc", "p" -> "p"; space is "SPC"
// on its own (in a key sequence) and "Space" in a chord.
export function keyLabel(k) {
  const parts = keyParts(k), last = parts.pop();
  const named = last === "space" && parts.length ? "Space" : NAMES[last];
  const key = named ?? (last.length === 1 ? (parts.length ? last.toUpperCase() : last) : cap(last));
  return [...parts.map(cap), key].join("+");
}
