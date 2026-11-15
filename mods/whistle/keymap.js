// What a key pressed in WHISTLE means, decided without doing it. Pure.
//
// resolve(config, sequence, name, declared) -> { sequence, act }
//   config:   config.js compose() result ({ map, own })
//   sequence: the key sequence so far (["w"]) | null
//   name:     the key (keynames.js)
//   declared: the selected keynav field's declared keys ({ <key>: <as the field wrote it> },
//             own keys already left out: fields.js declaredKeys) | null
// act: { run: mapping } | { own: action } | { declared: the key as written } | { show: true }
//      (the sequence changed) | { flash: "w x is not mapped" } | null (not whistle's: the key
//      goes on)
//
// Outside a sequence a declared key goes over a mapping, which goes over an own key; inside
// one, the own keys cancel and back end or shorten it, and any other key is the group's or
// isn't mapped.

import { isGroup, groupAt } from "./config.js";
import { keyLabel } from "./keynames.js";

export function resolve(config, sequence, name, declared = null) {
  const own = config.own[name] ?? null;
  if (sequence) {
    if (own === "cancel") return { sequence: null, act: { show: true } };
    if (own === "back") return { sequence: sequence.length > 1 ? sequence.slice(0, -1) : null, act: { show: true } };
  }
  if (!sequence && declared?.[name] !== undefined) return { sequence: null, act: { declared: declared[name] } };
  const v = (groupAt(config.map, sequence)?.map ?? {})[name];
  if (isGroup(v)) return { sequence: [...(sequence ?? []), name], act: { show: true } };
  if (v) return { sequence: null, act: { run: v } };
  if (sequence) return { sequence: null, act: { flash: `${[...sequence, name].map(keyLabel).join(" ")} is not mapped` } };
  return { sequence: null, act: own ? { own } : null };
}
