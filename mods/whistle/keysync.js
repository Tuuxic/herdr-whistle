// keys.json, as whistle uses it. Herdr runs keys.json's sections before whistle sees a key, so
// a key some section binds never reaches it, however whistle's config maps it. Whistle claims
// those keys in the "mod:whistle" section, which wins while whistle has the keyboard: each as
// "<key>": "whistle.key-<key>", sent back to whistle as if pressed. It claims every chord
// (ctrl/alt/super) in its config, and any other key of its config that a global or layout
// section binds. Whistle owns only entries of that exact form; your own entries in the
// section (ctrl-space -> whistle.type) stay as you wrote them and win.
//
// Writing keys.json makes it yours for Herdr: an untouched file no longer gets new default
// shortcuts on upgrade. Whistle writes only when its entries change, leaves the file alone
// while keys.error reports a problem, and puts the old text back if Herdr rejects the new one.
//
// It also answers which key runs a command from a terminal (entryKey), so callers needn't know
// keys.json's section precedence.

import { readTextFile, writeTextFile, appHome, shared } from "herdr";
import { isGroup } from "./config.js";
import { isChord } from "./keynames.js";

const KEYS_FILE = () => `${appHome()}/keys.json`;
const ERROR_FILE = () => `${appHome()}/keys.error`;
const SECTION = "mod:whistle";

// keys.json as written and parsed: { raw, all }. No file: raw null and all {}. Doesn't parse:
// all null.
async function readKeys() {
  const raw = await readTextFile(KEYS_FILE());
  if (raw == null) return { raw, all: {} };
  try { return { raw, all: JSON.parse(raw) }; } catch { return { raw, all: null }; }
}

// The sections that apply in a place, most specific first: the given ones, then the shown
// layout's, then global.
const sectionsFor = (...first) => [...first, `layout:${shared("layout")}`, "global"];

// The entry whistle itself writes for a key.
const isOwnEntry = (key, value) => value === `whistle.key-${key}`;

// Every key of whistle's config: its own keys and the mappings', groups included.
function configKeys(conf) {
  const out = new Set(conf?.own?.keys() ?? []);
  const walk = (map) => { for (const [k, v] of Object.entries(map ?? {})) { out.add(k); if (isGroup(v)) walk(v.map); } };
  walk(conf?.map);
  return out;
}

// The keys whistle needs to claim: its chords, and its other keys a global or layout section binds.
function claimsOf(conf, all) {
  const bound = new Set(Object.entries(all)
    .filter(([section]) => section === "global" || section.startsWith("layout:"))
    .flatMap(([, keys]) => Object.keys(keys ?? {})));
  return [...configKeys(conf)].filter((k) => isChord(k) || bound.has(k));
}

// Brings mod:whistle in line with conf. Resolves to null, or what went wrong (for the bar).
// sleep(ms): the caller's cx.sleep, to give Herdr a moment to load the new file.
export async function syncKeys(conf, sleep) {
  // A config that didn't load would drop every claim: leave keys.json until it loads again.
  if (conf?.error) return null;
  for (let attempt = 0; attempt < 3; attempt++) {
    const { raw, all } = await readKeys();
    if (raw == null) return null; // no keys.json: Herdr's defaults; writing one would replace them
    if (!all) return "keys.json doesn't parse; whistle's keys may not reach it";
    if ((await readTextFile(ERROR_FILE())) != null) return "keys.json has an error (keys.error); whistle left it alone";
    const current = all[SECTION] ?? {}, claims = claimsOf(conf, all), updated = {};
    for (const [k, v] of Object.entries(current)) if (!isOwnEntry(k, v) || claims.includes(k)) updated[k] = v;
    for (const k of claims) if (!(k in updated)) updated[k] = `whistle.key-${k}`;
    if (JSON.stringify(updated) === JSON.stringify(current)) return null;
    const text = `${JSON.stringify({ ...all, [SECTION]: updated }, null, 2)}\n`;
    try { await writeTextFile(KEYS_FILE(), text, raw); } catch { continue; }
    await sleep(600);
    const error = await readTextFile(ERROR_FILE());
    if (error == null) return null;
    try { await writeTextFile(KEYS_FILE(), raw, text); } catch {}
    return `keys.json rejected whistle's keys: ${error.trim().slice(0, 80)}`;
  }
  return null;
}

// The key that runs command in the given sections (most specific first): one bound to it
// that no more specific section binds to something else. Null if there's none.
async function boundKey(command, sections) {
  const { all } = await readKeys();
  if (!all) return null;
  const runs = (key) => sections.map((s) => all[s]?.[key]).find((v) => v !== undefined);
  for (const s of sections) for (const [k, v] of Object.entries(all[s] ?? {})) if (v === command && runs(k) === command) return k;
  return null;
}

// The key that runs command from a terminal, as keys.json binds it there. Null if there's none.
export const entryKey = (command) => boundKey(command, sectionsFor("terminal"));
