// What a key pressed in WHISTLE means, decided without doing it. Pure.
//
// resolve(config, sequence, name) -> { sequence, act }
//   config:   config.js compose() result ({ map, own })
//   sequence: the key sequence so far (["w"]) | null
//   name:     the key (keynames.js)
// act: { run: mapping } | { own: action } | { show: true } (the sequence changed)
//      | { flash: "w x is not mapped" } | null (not whistle's: the key goes on)
//
// Outside a sequence a mapping goes over an own key; inside one, the own keys cancel and back
// end or shorten it, and any other key is the group's or isn't mapped.

import { isGroup } from "./config.js";
import { keyLabel } from "./keynames.js";

// The group's map at a sequence.
function at(config, path) {
  let map = config.map;
  for (const k of path) map = isGroup(map?.[k]) ? map[k].map : {};
  return map;
}

export function resolve(config, sequence, name) {
  const own = config.own[name] ?? null;
  if (sequence) {
    if (own === "cancel") return { sequence: null, act: { show: true } };
    if (own === "back") return { sequence: sequence.length > 1 ? sequence.slice(0, -1) : null, act: { show: true } };
  }
  const v = at(config, sequence ?? [])[name];
  if (isGroup(v)) return { sequence: [...(sequence ?? []), name], act: { show: true } };
  if (v) return { sequence: null, act: { run: v } };
  if (sequence) return { sequence: null, act: { flash: `${[...sequence, name].map(keyLabel).join(" ")} is not mapped` } };
  return { sequence: null, act: own ? { own } : null };
}
