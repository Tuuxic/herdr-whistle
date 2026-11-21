// The keynav checker (kit/keynav-checker/, docs/contracts/keynav.md "Checking your field"): it
// plays the driver against a mod's copy of keynav.js through Herdr's shared state and names
// every rule the copy breaks. Whistle's own keynav.js must pass; each rule has a broken copy
// that fails it, and only it.

import { shared, setShared } from "herdr";
import { suite } from "./harness.js";
import { checkKeynav, RULE_NAMES } from "./checks.js";
import texts from "./texts.js";
import * as helper from "./keynav.js";

const store = { shared, setShared };
// The rule names in keynav.md's "Checking your field" table, in order.
const documented = () => {
  const text = texts["docs/contracts/keynav.md"].split("\r").join("");
  const section = text.split("## Checking your field")[1]?.split("\n## ")[0] ?? "";
  return [...section.matchAll(/^\| `([^`]+)` \|/gm)].map((m) => m[1]);
};
const rules = (h) => checkKeynav(h, store).map((f) => f.rule);

export default suite("keynav checker", (t) => {
  t.check("keynav.md's checker table lists every rule the checker has, in order", documented(), RULE_NAMES);
  t.check("whistle's keynav.js passes the checker", checkKeynav(helper, store), []);
  t.check("a field key with a space after the comma breaks \"field key\"",
    rules({ ...helper, fieldKey: (mod, props) => `${mod} ${JSON.stringify(props ?? {}, null, 1)}` }), ["field key"]);
  // Objects inside arrays left as written: the contract sorts them too.
  const unsortedInArrays = (v) => (v && typeof v === "object" && !Array.isArray(v)
    ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${unsortedInArrays(v[k])}`).join(",")}}`
    : JSON.stringify(v ?? null));
  t.check("a field key that leaves objects inside arrays unsorted breaks \"field key\"",
    rules({ ...helper, fieldKey: (mod, props) => `${mod} ${unsortedInArrays(props ?? {})}` }), ["field key"]);
  t.check("an entry with another v breaks \"entry\"", rules({ ...helper, announce: (mod, props, label, keys = {}) => {
    const key = helper.fieldKey(mod, props);
    setShared(`keynav.field:${key}`, { v: 2, label, keys });
    return key;
  } }), ["entry"]);
  t.check("an announce that never rewrites its entry breaks \"announce again\"", rules({ ...helper, announce: (mod, props, label, keys = {}) => {
    const key = helper.fieldKey(mod, props);
    if (!shared(`keynav.field:${key}`)) setShared(`keynav.field:${key}`, { v: 3, label, keys });
    return key;
  } }), ["announce again"]);
  t.check("an entry with its fields in another order still passes", rules({ ...helper, announce: (mod, props, label, keys = {}) => {
    const key = helper.fieldKey(mod, props);
    setShared(`keynav.field:${key}`, { keys, label, v: 3 });
    return key;
  } }), []);
  t.check("a copy that reads field instead of active breaks \"active\"", rules({ ...helper, isActive: (key) => shared("keynav")?.field === key }), ["active"]);
  t.check("a copy active for any field breaks \"active\"", rules({ ...helper, isActive: (_key) => shared("keynav")?.active != null }), ["active"]);
  t.check("a copy without pick breaks \"moves\"", rules({ ...helper, move: (c) => (["up", "down", "left", "right"].includes(c?.slice(7)) ? c.slice(7) : null) }), ["moves"]);
  t.check("a copy that reads a move that isn't one breaks \"moves\"", rules({ ...helper, move: (c) => (["up", "down", "left", "right", "pick", "close"].includes(c?.slice(7)) ? c.slice(7) : null) }), ["moves"]);
  t.check("a copy that reads a declared key as a move breaks \"moves\"", rules({ ...helper, move: (c) => (typeof c === "string" && c.startsWith("keynav-") ? c.slice(7) : null) }), ["moves"]);
  t.check("a copy that lowercases declared keys breaks \"declared keys\"", rules({ ...helper, declared: (c) => helper.declared(c)?.toLowerCase() ?? null }), ["declared keys"]);
  t.check("a copy that reads key-<key> without keynav- breaks \"declared keys\"", rules({ ...helper, declared: (c) => (typeof c === "string" && c.startsWith("key-") ? c.slice(4) : null) }), ["declared keys"]);
  t.check("a terminal request in seconds breaks \"terminal request\"", rules({ ...helper, toTerminal: (key) => setShared(`keynav.request:${key}`, { after: "terminal", at: Math.floor(Date.now() / 1000) }) }), ["terminal request"]);
  t.check("a terminal request naming the pane breaks \"terminal request\"", rules({ ...helper, toTerminal: (key) => setShared(`keynav.request:${key}`, { after: "p1", at: Date.now() }) }), ["terminal request"]);
  t.check("a terminal request with to instead of after breaks \"terminal request\"", rules({ ...helper, toTerminal: (key) => setShared(`keynav.request:${key}`, { to: "terminal", at: Date.now() }) }), ["terminal request"]);
  t.check("a terminal request with an extra field breaks \"terminal request\"", rules({ ...helper, toTerminal: (key) => setShared(`keynav.request:${key}`, { after: "terminal", to: "terminal", at: Date.now() }) }), ["terminal request"]);
  t.check("a hold request with hold instead of after breaks \"hold request\"", rules({ ...helper, keepKeys: (key) => setShared(`keynav.request:${key}`, { hold: true, at: Date.now() }) }), ["hold request"]);
  t.check("a hold request in the terminal's shape breaks \"hold request\"", rules({ ...helper, keepKeys: (key) => setShared(`keynav.request:${key}`, { after: "terminal", at: Date.now() }) }), ["hold request"]);
  t.check("a hold request with no time breaks \"hold request\"", rules({ ...helper, keepKeys: (key) => setShared(`keynav.request:${key}`, { after: "hold" }) }), ["hold request"]);
  t.check("a copy entered on every render breaks \"entered\"", rules({ ...helper, entered: (_self, key) => helper.isActive(key) }), ["entered"]);
  t.check("a copy never entered breaks \"entered\"", rules({ ...helper, entered: () => false }), ["entered"]);
  t.check("a copy without keepKeys breaks \"functions\" alone", rules({ ...helper, keepKeys: undefined }), ["functions"]);
  t.check("\"functions\" names what's missing", checkKeynav({ ...helper, keepKeys: undefined, entered: undefined }, store).find((f) => f.rule === "functions")?.why,
    "keynav.js has no entered, keepKeys; copy whistle's current keynav.js");
  t.check("a copy whose move throws breaks \"moves\" with the error", checkKeynav({ ...helper, move: () => { throw new Error("boom"); } }, store),
    [{ rule: "moves", why: "threw: boom" }]);
});
