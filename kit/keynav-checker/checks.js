// The keynav checker's rules (docs/contracts/keynav.md): it plays the driver against a mod's
// copy of keynav.js and names every rule of keynav v2 the copy breaks. The expected values are
// the contract's, written out here, never computed with the helper under check.
//
// checkKeynav(helper, store) -> [{ rule, why }], empty when the copy passes.
//   helper: the keynav.js module (its exports).
//   store:  { shared, setShared }, Herdr's shared state (the checker mod passes herdr's own).
//
// The rules play on field keys of a mod named "keynav-check", so they don't touch real fields.

const MOD = "keynav-check";
const json = (v) => JSON.stringify(v);

// A field nobody else uses: fresh props on every call, so no run sees an entry an earlier one left.
let runs = 0;
const fresh = () => ({ check: ++runs });
const fieldOf = (props) => `${MOD} {"check":${props.check}}`;
// JSON with object keys sorted: two values are the same whatever order their fields were written in.
const sorted = (v) => JSON.stringify(v, (_k, x) => (x && typeof x === "object" && !Array.isArray(x)
  ? Object.fromEntries(Object.keys(x).sort().map((k) => [k, x[k]])) : x));
const same = (a, b) => sorted(a) === sorted(b);

// The functions the rules call. A copy missing one fails "functions" alone: the rules that call
// it are skipped.
const FUNCTIONS = ["fieldKey", "announce", "isActive", "move", "declared", "entered", "toTerminal", "keepKeys"];
const MISSING = Symbol("missing");

// Each rule: [name, run(helper, store, fail)]. A rule that throws fails with the error.
const RULES = [
  ["functions", (h, _s, fail) => {
    const missing = FUNCTIONS.filter((name) => typeof h[name] !== "function").sort();
    if (missing.length) fail(`keynav.js has no ${missing.join(", ")}; copy whistle's current keynav.js`);
  }],
  ["field key", (h, _s, fail) => {
    const cases = [
      [MOD, {}, `${MOD} {}`],
      [MOD, undefined, `${MOD} {}`],
      [MOD, { root: "~" }, `${MOD} {"root":"~"}`],
      [MOD, { b: { y: 1, x: [1, "z"] }, a: "s p" }, `${MOD} {"a":"s p","b":{"x":[1,"z"],"y":1}}`],
    ];
    for (const [mod, props, want] of cases) {
      const got = h.fieldKey(mod, props);
      if (got !== want) fail(`fieldKey(${json(mod)}, ${json(props)}) gave ${json(got)}, want ${json(want)}`);
    }
  }],
  ["entry", (h, s, fail) => {
    const props = fresh();
    const want = fieldOf(props);
    const got = h.announce(MOD, props, "Check", { d: "Delete" });
    if (got !== want) fail(`announce returned ${json(got)}, want the field key ${json(want)}`);
    const entry = s.shared(`keynav.field:${want}`);
    const wanted = { v: 2, label: "Check", keys: { d: "Delete" } };
    if (!same(entry, wanted)) fail(`announce wrote ${json(entry)} to "keynav.field:${want}", want ${json(wanted)}`);
  }],
  ["announce again", (h, s, fail) => {
    const props = fresh();
    const key = fieldOf(props);
    h.announce(MOD, props, "Check", { d: "Delete" });
    for (const [label, keys, wanted] of [["Check", { r: "Rename" }, { r: "Rename" }], ["Checked", undefined, {}]]) {
      h.announce(MOD, props, label, keys);
      const entry = s.shared(`keynav.field:${key}`);
      // Only what changed: the entry itself is the "entry" rule's.
      const got = { label: entry?.label, keys: entry?.keys };
      const want = { label, keys: wanted };
      if (!same(got, want)) fail(`announcing again with ${json(label)}, ${json(keys)} left ${json(entry)}, want label ${json(label)} and keys ${json(wanted)}`);
    }
  }],
  ["no v1", (h, s, fail) => {
    // v1's shared keys: one object of every field, one request slot for all.
    const before = [s.shared("keynav.fields"), s.shared("keynav.request")];
    const props = fresh();
    const key = h.announce(MOD, props, "Check", {});
    h.toTerminal(key);
    h.keepKeys(key);
    const after = [s.shared("keynav.fields"), s.shared("keynav.request")];
    if (!same(before[0], after[0])) fail("announce wrote v1's \"keynav.fields\"; v2 writes only the field's own entry");
    if (!same(before[1], after[1])) fail("a request went to v1's \"keynav.request\"; v2 writes the field's own slot");
  }],
  ["active", (h, s, fail) => {
    const key = fieldOf(fresh());
    const other = fieldOf(fresh());
    const was = s.shared("keynav");
    try {
      for (const [driver, field, want] of [
        [{ v: 2, active: key }, key, true],
        [{ v: 2, active: key }, other, false],
        [{ v: 2, active: null }, key, false],
      ]) {
        s.setShared("keynav", driver);
        const got = h.isActive(field);
        if (!!got !== want) fail(`isActive(${json(field)}) gave ${json(got)} while shared("keynav") is ${json(driver)}, want ${want}`);
      }
    } finally { s.setShared("keynav", was ?? null); }
  }],
  // The driver runs <mod>.keynav-<move>; the mod gets the command without its name.
  ["moves", (h, _s, fail) => {
    const cases = [
      ["keynav-up", "up"], ["keynav-down", "down"], ["keynav-left", "left"], ["keynav-right", "right"], ["keynav-open", "open"],
      ["keynav-key-d", null], ["keynav-key-j", null], ["keynav-", null], ["keynav-close", null], ["settings", null], [null, null],
    ];
    for (const [command, want] of cases) {
      const got = h.move(command);
      if (got !== want) fail(`move(${json(command)}) gave ${json(got)}, want ${json(want)}`);
    }
  }],
  ["declared keys", (h, _s, fail) => {
    const cases = [
      ["keynav-key-d", "d"], ["keynav-key-D", "D"], ["keynav-key-/", "/"], ["keynav-key-space", "space"],
      ["keynav-key-", null], ["keynav-down", null], ["key-d", null], ["settings", null], [null, null],
    ];
    for (const [command, want] of cases) {
      const got = h.declared(command);
      if (got !== want) fail(`declared(${json(command)}) gave ${json(got)}, want ${json(want)}`);
    }
  }],
  ["terminal request", (h, s, fail) => request(h.toTerminal, "toTerminal", s, fail, (r) => r?.to === "terminal" && !("hold" in r),
    '{ to: "terminal", at }')],
  ["hold request", (h, s, fail) => request(h.keepKeys, "keepKeys", s, fail, (r) => r?.hold === true && !("to" in r),
    "{ hold: true, at }")],
  // entered(self, key) is true once each time the driver selects the field, on the next render.
  ["entered", (h, s, fail) => {
    const key = fieldOf(fresh());
    const self = {};
    const was = s.shared("keynav");
    const renders = [[null, false], [key, true], [key, false], [null, false], [key, true]];
    try {
      const got = renders.map(([active]) => { s.setShared("keynav", { v: 2, active }); return !!h.entered(self, key); });
      const want = renders.map(([, w]) => w);
      if (!same(got, want)) {
        fail(`entered(self, key) over renders with active ${renders.map(([a]) => (a ? "key" : "null")).join(", ")} gave ${json(got)}, want ${json(want)}`);
      }
    } finally { s.setShared("keynav", was ?? null); }
  }],
];

// How far a request's `at` may be from now (ms): it's Date.now() when the field asked.
const AT_SLACK = 60000;

// A request goes in the field's own slot with `at` the time it was made, in ms.
function request(send, name, s, fail, shaped, shape) {
  const key = fieldOf(fresh());
  const slot = `keynav.request:${key}`;
  const from = Date.now();
  send(key);
  const r = s.shared(slot);
  if (!r || !shaped(r)) { fail(`${name}(key) wrote ${json(r)} to "${slot}", want ${shape}`); return; }
  if (typeof r.at !== "number" || r.at < from - AT_SLACK || r.at > Date.now() + AT_SLACK) {
    fail(`${name}(key) wrote at ${json(r.at)}, want the time in ms (Date.now(), about ${from})`);
  }
}

// The rules' names, in the order they run (keynav.md's table lists them; a test checks).
export const RULE_NAMES = RULES.map(([name]) => name);

export function checkKeynav(helper, store) {
  // The copy as the rules see it: a missing function throws MISSING, which skips the rule.
  const h = { ...helper };
  for (const name of FUNCTIONS) if (typeof h[name] !== "function") h[name] = () => { throw MISSING; };
  const fails = [];
  for (const [rule, run] of RULES) {
    const whys = [];
    try { run(rule === "functions" ? helper : h, store, (why) => whys.push(why)); }
    catch (err) { if (err !== MISSING) whys.push(`threw: ${err?.message ?? err}`); else whys.length = 0; }
    if (whys.length) fails.push({ rule, why: whys.join("; ") });
  }
  return fails;
}
