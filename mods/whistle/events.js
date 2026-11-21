// Whistle's events (docs/contracts/events.md): the catalog of kinds and their groups, the feed's
// window, the changes in the whistle state that are events, and the pushes to subscribers
// (ADR 0018). Pure, like the rest of the core.

import { modBlocks } from "./fields.js";
import { keyLabel } from "./keynames.js";

// How many events whistle.events keeps: the last ones.
export const EVENTS_KEPT = 32;

// Each kind's groups. A kind is unique across groups; an event may be in several.
export const GROUPS = {
  "mode-switched": ["mode"],
  "whistle-enabled": ["whistle"],
  "whistle-disabled": ["whistle"],
  "whistle-inert": ["whistle", "problem"],
  "whistle-active": ["whistle"],
  "sequence-started": ["sequence"],
  "sequence-ended": ["sequence"],
  "key-unmapped": ["sequence", "problem"],
  "field-selected": ["field"],
  "cant-select": ["field", "problem"],
  "command-ran": ["command"],
  "command-failed": ["command", "problem"],
  "verb-failed": ["command", "problem"],
  "conflict-new": ["config", "problem"],
  "mod-problem-new": ["config", "problem"],
  "settings-unread": ["settings", "problem"],
  "settings-broken": ["settings", "problem"],
  "settings-write-failed": ["settings", "problem"],
};

// The model with an event in its feed: { kind, text, ...data } numbered with the next seq, its
// groups added, the oldest dropped past EVENTS_KEPT.
export function raised(model, event) {
  const seq = (model.eventSeq ?? 0) + 1;
  const { kind, text, ...data } = event;
  const e = { seq, kind, groups: [...(GROUPS[kind] ?? [])], text, ...data };
  return { ...model, eventSeq: seq, events: [...(model.events ?? []), e].slice(-EVENTS_KEPT) };
}

const keysText = (keys) => keys.map(keyLabel).join(" ");

// A key sequence that started: keys so far, group the name of the group they reached.
export const sequenceStarted = (keys, group) => ({ kind: "sequence-started", keys: [...keys], group, text: `${keysText(keys)}: ${group ?? "group"}` });

// A key sequence that ended, by: "ran" (a mapping ran), "unmapped" (a key it doesn't map) or
// "left" (cancelled, or left another way).
export const sequenceEnded = (keys, by) => ({ kind: "sequence-ended", keys: [...keys], by, text: `${keysText(keys)}: ${by}` });

// The events a change of the whistle state is (state() in step.js; before: the state published
// before, null: none yet, so nothing changed): the mode switched, WHISTLE switched on or off,
// another field selected.
export function changes(before, after) {
  if (!before || typeof before !== "object") return [];
  const out = [];
  if (before.enabled !== after.enabled) out.push(after.enabled
    ? { kind: "whistle-enabled", text: "Whistle on" } : { kind: "whistle-disabled", text: "Whistle off" });
  if (before.mode !== after.mode) out.push({ kind: "mode-switched", from: before.mode, to: after.mode, text: after.mode.toUpperCase() });
  if (after.field && after.field !== before.field) out.push({ kind: "field-selected", block: after.field, text: `${after.field} selected` });
  return out;
}

// A subscribe argument ({ mod, groups?, kinds? }, as commands.js checks it) as the mod's filter.
export const filterOf = (v) => ({ ...(v.groups ? { groups: v.groups } : {}), ...(v.kinds ? { kinds: v.kinds } : {}) });

// Whether an event passes a subscriber's filter ({ groups, kinds }; neither: every event).
export function passes(filter, event) {
  const { groups, kinds } = filter ?? {};
  if (!groups && !kinds) return true;
  return Boolean(groups?.some((g) => event.groups.includes(g)) || kinds?.includes(event.kind));
}

// The run effects that push the events raised after seq `after` to each subscriber whose filter
// passes them, only if the mod has a block that shows: a command to a mod that doesn't show is
// dropped with an error toast.
export function pushes(model, after, subscribers, world) {
  const fresh = (model.events ?? []).filter((e) => e.seq > after);
  if (!fresh.length) return [];
  const shown = new Set(modBlocks(world.layout).map((b) => b.mod));
  return Object.entries(subscribers ?? {})
    .filter(([mod]) => shown.has(mod))
    .flatMap(([mod, filter]) => fresh.filter((e) => passes(filter, e))
      .map((e) => ({ run: `${mod}.whistle-event:${JSON.stringify(e)}` })));
}
