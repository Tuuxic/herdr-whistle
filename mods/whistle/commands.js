// Whistle's command grammar (docs/contracts/commands.md): "whistle.<command>" or
// "whistle.<command>:<argument>", the argument everything after the first colon. Herdr hands a
// mod's command over as one string and never its args (#58), so each command takes at most one
// argument and declares its kind: none, plain (the string as it is: a block, a mod), one of a few
// words, or JSON (where a command needs several values). A plain argument is never parsed as
// JSON. The names and their arguments live here only. Pure, like the rest of the core.
//
// A command also says when it works (`when`): by default only while whistle runs and WHISTLE is
// switched on; ANY_TIME also while switched off (on, off, the settings commands); KEPT_INERT
// also while whistle is inert, by the copy that would run (the subscriptions, events.md rule 6).

export const ANY_TIME = "any-time", KEPT_INERT = "kept-inert";

const isObject = (v) => Boolean(v) && typeof v === "object" && !Array.isArray(v);
const NONE = { arg: "none" }, PLAIN = { arg: "plain" };
const nonEmpty = (s) => typeof s === "string" && s !== "";
const strings = (v) => Array.isArray(v) && v.every((x) => typeof x === "string");
const COMMANDS = {
  "switch-mode": NONE, mode: { arg: ["type", "whistle"] },
  on: { ...NONE, when: ANY_TIME }, off: { ...NONE, when: ANY_TIME },
  field: PLAIN, focus: PLAIN, toggle: PLAIN, "toggle-keep-mode": PLAIN,
  "mappings-on": { ...PLAIN, when: ANY_TIME }, "mappings-off": { ...PLAIN, when: ANY_TIME },
  // { "mod": "claude-hints", "keys": ["g", "q"] }: the keys in Herdr's key names.
  "keep-mapping": { arg: "json", when: ANY_TIME, valid: (v) => isObject(v) && nonEmpty(v.mod) && Array.isArray(v.keys) && v.keys.length > 0 && v.keys.every(nonEmpty) },
  // { "mod": "notes", "groups": ["mode"], "kinds": ["field-selected"] }: groups and kinds
  // optional, each a list of strings.
  subscribe: { arg: "json", when: KEPT_INERT, valid: (v) => isObject(v) && nonEmpty(v.mod)
    && (v.groups === undefined || strings(v.groups)) && (v.kinds === undefined || strings(v.kinds)) },
  unsubscribe: { ...PLAIN, when: KEPT_INERT },
};

// A command as Herdr hands it over (no "whistle." before it): { name, arg: undefined (none) |
// the plain string | the JSON value, when: undefined | ANY_TIME | KEPT_INERT } | null: no
// whistle command (an unknown name, or an argument that isn't the kind the command takes:
// missing, extra, a word it doesn't know, JSON that doesn't parse or lacks a field).
export function parseCommand(c) {
  if (typeof c !== "string") return null;
  const colon = c.indexOf(":");
  const name = colon < 0 ? c : c.slice(0, colon), raw = colon < 0 ? null : c.slice(colon + 1);
  const spec = Object.prototype.hasOwnProperty.call(COMMANDS, name) ? COMMANDS[name] : null;
  if (!spec) return null;
  const when = spec.when;
  if (spec.arg === "none") return raw === null ? { name, when } : null;
  if (!raw) return null;
  if (Array.isArray(spec.arg)) return spec.arg.includes(raw) ? { name, arg: raw, when } : null;
  if (spec.arg === "plain") return { name, arg: raw, when };
  let v;
  try { v = JSON.parse(raw); } catch { return null; }
  return spec.valid(v) ? { name, arg: v, when } : null;
}
