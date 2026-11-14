// Claimed keys (ADR 0001): the mod:whistle section of keys.json whistle wants. Pure; step.js
// turns the answer into a write effect.
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

export const SECTION = "mod:whistle";

// The entry whistle writes for a key.
export const claimCommand = (key) => `whistle.key-${key}`;
const isOwnEntry = (key, value) => value === claimCommand(key);

// keys.json's text (null: no file), with the keys whistle needs (canonical names), the shown
// layout's name and the platform. Returns { text } to write, { same: true } when keys.json
// already says it, or { problem } when whistle can't or mustn't write.
export function claim(fileText, needed, layoutName, platform) {
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
  for (const k of claims) if (!taken.has(k)) updated[k] = claimCommand(k);

  if (JSON.stringify(updated) === JSON.stringify(current)) return { same: true };
  return { text: `${JSON.stringify({ ...all, [SECTION]: updated }, null, 2)}\n` };
}
