// Claimed keys (ADR 0001): the mod:whistle section of keys.json whistle wants, and keeping it
// written (claimsTick, claimWrote: the core's model.claims and model.claimProblem). Pure: the
// writes are effects step.js hands on.
//
// Herdr runs keys.json's sections before whistle sees a key, so a key some section binds never
// reaches it. The mod:whistle section wins while whistle has the keyboard, so whistle claims
// there each key it needs as "<key>": "whistle.key-<key>", which Herdr sends back as the
// command key-<key>. It claims every chord (ctrl/alt/super) among its keys, and any other of
// its keys that the global section or the shown layout's section binds. Keys are compared by
// their canonical names (keynames.js), so "Ctrl-H" and "ctrl-h" are one key.
//
// Whistle owns only entries of exactly that form. Your own entries in the section stay as you
// wrote them and win: a key you bind there, in any spelling, isn't claimed.

import { canonicalKey, isChord } from "./keynames.js";
import { usedKeys, KEYS } from "./config.js";
import { FOLDER } from "./version.js";

// keys.json's text (null: no file), with the keys whistle needs (canonical names), the shown
// layout's name, the platform and whistle's folder (a renamed copy's section and commands are
// mod:<folder> and <folder>.key-<key>). Returns { text } to write, { same: true } when
// keys.json already says it, or { problem } when whistle can't or mustn't write.
export function claim(fileText, needed, layoutName, platform, mod = FOLDER) {
  const SECTION = `mod:${mod}`;
  const isOwnEntry = (key, value) => value === `${mod}.key-${key}`;
  if (fileText == null) return { same: true }; // no keys.json: Herdr's defaults; writing one would replace them
  let all;
  try { all = JSON.parse(fileText); } catch { all = null; }
  if (!all || typeof all !== "object" || Array.isArray(all)) return { problem: "keys.json doesn't parse; whistle's keys may not reach it" };

  const canon = (k) => canonicalKey(k, platform);
  const sectionKeys = (name) => Object.keys(all[name] ?? {}).map(canon).filter(Boolean);
  const bound = new Set([...sectionKeys("global"), ...(layoutName ? sectionKeys(`layout:${layoutName}`) : [])]);
  const claims = [...new Set(needed)].filter((k) => isChord(k) || bound.has(k));

  const current = all[SECTION] ?? {}, updated = {};
  for (const [k, v] of Object.entries(current)) if (!isOwnEntry(k, v) || claims.includes(k)) updated[k] = v;
  const taken = new Set(Object.keys(updated).map(canon));
  for (const k of claims) if (!taken.has(k)) updated[k] = `${mod}.key-${k}`;

  if (JSON.stringify(updated) === JSON.stringify(current)) return { same: true };
  return { text: `${JSON.stringify({ ...all, [SECTION]: updated }, null, 2)}\n` };
}

// claims: { pending: the write on its way { text, raw, revert } | null, check: a write waiting
// for Herdr's verdict { until, text, raw } | null, failed: a text that failed or Herdr rejected,
// not tried again | null }
export const CLAIMS = { pending: null, check: null, failed: null };

// How long Herdr gets to load a written keys.json before whistle looks for keys.error (ms).
export const CHECK_MS = 600;

// The shell's timer, for claims: keys.json brought in line with whistle's keys, one write at a
// time. A written text waits for Herdr's verdict (a keys.json read CHECK_MS after the write);
// if Herdr rejects it, the old text goes back. Nothing is written while keys.error exists.
export function claimsTick(model, world) {
  const claims = model.claims ?? CLAIMS, keys = world.keysFile, problem = model.claimProblem ?? null;
  const none = { model, effects: [] };
  const kept = (patch, p = problem, effects = []) => ({ model: { ...model, claims: { ...claims, ...patch }, claimProblem: p }, effects });
  if (!keys || claims.pending) return none;
  if (claims.check) {
    if (keys.at < claims.check.until) return none;
    if (keys.error == null) return kept({ check: null }, null);
    const why = `keys.json rejected whistle's keys: ${String(keys.error).trim().slice(0, 80)}`;
    return kept({ check: null, failed: claims.check.text, pending: { text: claims.check.raw, raw: claims.check.text, revert: true } }, why,
      [{ write: KEYS, text: claims.check.raw, expected: claims.check.text }]);
  }
  if (keys.error != null) {
    const why = "keys.json has an error (keys.error); whistle left it alone";
    return problem === why ? none : kept({}, why);
  }
  if (model.config?.broken) return none;
  const wanted = claim(keys.text, usedKeys(model.config), world.layoutName, world.platform, world.folder ?? FOLDER);
  if (wanted.problem) return problem === wanted.problem ? none : kept({}, wanted.problem);
  if (wanted.same) return problem == null && claims.failed == null ? none : kept({ failed: null }, null);
  if (wanted.text === claims.failed) return none;
  return kept({ pending: { text: wanted.text, raw: keys.text, revert: false } }, problem,
    [{ write: KEYS, text: wanted.text, expected: keys.text }]);
}

// A keys.json write's outcome: a claim waits for Herdr's verdict; a failure is a problem, and
// its text isn't tried again.
export function claimWrote(model, world, input) {
  const before = model.claims ?? CLAIMS, write = before.pending;
  if (input.wrote !== KEYS || !write) return { model, effects: [] };
  if (!input.ok) {
    const claims = { ...before, pending: null, failed: write.revert ? before.failed : write.text };
    return { model: { ...model, claims, claimProblem: `couldn't write keys.json: ${input.error ?? "unknown error"}` }, effects: [] };
  }
  const claims = write.revert ? { ...before, pending: null }
    : { ...before, pending: null, check: { until: world.now + CHECK_MS, text: write.text, raw: write.raw } };
  return { model: { ...model, claims }, effects: [] };
}
