// Key names, spelled as mappings.json and keys.json spell them, and shown to people.

// A pressed key's name: the character it types ("?", "+"), else its name ("enter", "f2"). With
// ctrl/alt/super held it's the key with those in front, as keys.json spells chords
// ("ctrl-n", "ctrl-shift-x"); without them shift only shows on named keys ("shift-tab"),
// since a typed character already carries it ("X").
export function keyName(e) {
  const m = e.modifiers ?? {}, c = e.key_char;
  const held = [m.control && "ctrl", m.alt && "alt", m.platform && "super"].filter(Boolean);
  if (!held.length && (c === " " || e.key === "space")) return "space";
  if (!held.length && c && c.length === 1 && c.trim()) return c;
  const key = held.length && e.key.length === 1 ? e.key.toLowerCase() : e.key;
  const shift = m.shift && (held.length || key.length > 1);
  return [...held, ...(shift ? ["shift"] : []), key].join("-");
}

// A key with ctrl/alt/super held: keys.json's sections are likely to bind it.
export const isChord = (k) => /^(ctrl|alt|super)-./.test(k);

// The parts of a key's name: "ctrl-shift-x" -> ["ctrl", "shift", "x"], "ctrl--" -> ["ctrl", "-"].
export const keyParts = (k) => k.split(/-(?=.)/);

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
