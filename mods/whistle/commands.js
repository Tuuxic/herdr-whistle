// Whistle's command grammar (docs/contracts/commands.md): "whistle.<command>" or
// "whistle.<command>:<argument>", the argument everything after the first colon. Herdr hands a
// mod's command over as one string and never its args (#58), so each command takes at most one
// argument and declares its kind: none, plain (the string as it is: a block, a mod), one of a few
// words, or JSON (where a command needs several values). A plain argument is never parsed as
// JSON. The names and their arguments live here only. Pure, like the rest of the core.

const isObject = (v) => Boolean(v) && typeof v === "object" && !Array.isArray(v);
const NONE = { arg: "none" }, PLAIN = { arg: "plain" };
const nonEmpty = (s) => typeof s === "string" && s !== "";
const COMMANDS = {
  "switch-mode": NONE, mode: { arg: ["type", "whistle"] }, on: NONE, off: NONE,
  field: PLAIN, focus: PLAIN, toggle: PLAIN, "toggle-keep-mode": PLAIN,
  "mappings-on": PLAIN, "mappings-off": PLAIN,
  // { "mod": "claude-hints", "keys": ["g", "q"] }: the keys in Herdr's key names.
  "keep-mapping": { arg: "json", valid: (v) => isObject(v) && nonEmpty(v.mod) && Array.isArray(v.keys) && v.keys.length > 0 && v.keys.every(nonEmpty) },
};

// A command as Herdr hands it over (no "whistle." before it): { name, arg: undefined (none) |
// the plain string | the JSON value } | null: no whistle command (an unknown name, or an
// argument that isn't the kind the command takes: missing, extra, a word it doesn't know, JSON
// that doesn't parse or lacks a field).
export function parseCommand(c) {
  if (typeof c !== "string") return null;
  const colon = c.indexOf(":");
  const name = colon < 0 ? c : c.slice(0, colon), raw = colon < 0 ? null : c.slice(colon + 1);
  const spec = Object.prototype.hasOwnProperty.call(COMMANDS, name) ? COMMANDS[name] : null;
  if (!spec) return null;
  if (spec.arg === "none") return raw === null ? { name } : null;
  if (!raw) return null;
  if (Array.isArray(spec.arg)) return spec.arg.includes(raw) ? { name, arg: raw } : null;
  if (spec.arg === "plain") return { name, arg: raw };
  let v;
  try { v = JSON.parse(raw); } catch { return null; }
  return spec.valid(v) ? { name, arg: v } : null;
}
