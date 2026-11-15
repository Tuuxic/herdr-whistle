// The guide's tagged tables (Docs for each audience, issue #16): the default map and the
// default own keys in docs/guide.md are checked against the shipped mappings.json, both ways,
// so the docs and the defaults can't drift apart.
//
// A tagged table is a Markdown table right under a line `<!-- table map -->` or
// `<!-- table keys -->`.
//   map:  | Keys | Does | Command |   keys `w` `v` (the whole sequence), what it does (the
//         mapping's label, then "→ TYPE" if it ends in TYPE; a group's name), the command and
//         its args as code (`pane.split` `{"direction": "right"}`), or "group".
//   keys: | Action | Keys | Does |   the action as code, its keys as code (`h` `left`).

import { suite } from "./harness.js";
import texts from "./texts.js";

const code = (cell) => [...cell.matchAll(/`([^`]+)`/g)].map((m) => m[1]);

// The rows of each table tagged `tag` in a Markdown text, as arrays of cells.
export function taggedRows(text, tag) {
  const lines = String(text).replace(/\r\n/g, "\n").split("\n");
  const rows = [];
  lines.forEach((line, i) => {
    if (line.trim() !== `<!-- table ${tag} -->`) return;
    let j = i + 1;
    while (j < lines.length && lines[j].trim() === "") j++;
    for (let k = j + 2; k < lines.length && lines[k].trim().startsWith("|"); k++)
      rows.push(lines[k].trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
  });
  return rows;
}

// A map table's rows as lines: "w v · Split right → TYPE · pane.split {"direction":"right"}".
function tableMap(text) {
  return taggedRows(text, "map").map(([keys, does, command]) => {
    const [name, args] = code(command);
    const run = name ? [name, ...(args ? [JSON.stringify(JSON.parse(args))] : [])].join(" ") : command;
    return `${code(keys).join(" ")} · ${does} · ${run}`;
  });
}

// mappings.json's map as the same lines.
function shippedMap(map, path = []) {
  return Object.entries(map ?? {}).flatMap(([k, v]) => {
    const keys = [...path, k];
    if (!Array.isArray(v)) return [`${keys.join(" ")} · ${v.name} · group`, ...shippedMap(v.map, keys)];
    const [label, run, args, then] = v;
    const does = then === "type" ? `${label} → TYPE` : label;
    return [`${keys.join(" ")} · ${does} · ${[run, ...(args ? [JSON.stringify(args)] : [])].join(" ")}`];
  });
}

const tableKeys = (text) => taggedRows(text, "keys").map(([action, keys]) => `${code(action)[0]} · ${code(keys).join(" ")}`);
const shippedKeys = (keys) => Object.entries(keys ?? {}).map(([a, ks]) => `${a} · ${ks.join(" ")}`);

// What differs between the guide's lines and the shipped ones, as messages.
export function differ(guide, shipped, what) {
  const g = new Set(guide), s = new Set(shipped);
  return [
    ...shipped.filter((x) => !g.has(x)).map((x) => `${what}: the guide is missing ${x}`),
    ...guide.filter((x) => !s.has(x)).map((x) => `${what}: the guide has ${x}, which isn't shipped`),
    ...guide.filter((x, i) => guide.indexOf(x) !== i).map((x) => `${what}: the guide has ${x} twice`),
  ];
}

const check = (text, json) => [
  ...differ(tableMap(text), shippedMap(json.map), "default map"),
  ...differ(tableKeys(text), shippedKeys(json.keys), "own keys"),
];

const SAMPLE = [
  "<!-- table map -->",
  "| Keys | Does | Command |",
  "|---|---|---|",
  "| `n` | Next tab | `tab.next` |",
  "| `w` | Panes | group |",
  '| `w` `v` | Split right → TYPE | `pane.split` `{"direction": "right"}` |',
  "",
  "<!-- table keys -->",
  "| Action | Keys | Does |",
  "|---|---|---|",
  "| `left` | `h` `left` | Move left |",
].join("\r\n");
const SAMPLE_JSON = {
  keys: { left: ["h", "left"] },
  map: { n: ["Next tab", "tab.next"], w: { name: "Panes", map: { v: ["Split right", "pane.split", { direction: "right" }, "type"] } } },
};

export default suite("guide tables", (t) => {
  t.check("matching tables and map: no differences", check(SAMPLE, SAMPLE_JSON), []);
  t.check("a mapping missing from the tables is a difference",
    check(SAMPLE, { ...SAMPLE_JSON, map: { ...SAMPLE_JSON.map, p: ["Palette", "app.palette"] } }),
    ["default map: the guide is missing p · Palette · app.palette"]);
  t.check("a table row the map doesn't have is a difference",
    check(SAMPLE, { ...SAMPLE_JSON, map: { w: SAMPLE_JSON.map.w } }),
    ["default map: the guide has n · Next tab · tab.next, which isn't shipped"]);
  t.check("a mapping that no longer ends in TYPE is a difference",
    check(SAMPLE, { ...SAMPLE_JSON, map: { ...SAMPLE_JSON.map, w: { name: "Panes", map: { v: ["Split right", "pane.split", { direction: "right" }] } } } }).length, 2);
  t.check("an own key that differs is a difference",
    check(SAMPLE, { ...SAMPLE_JSON, keys: { left: ["h"] } }).length, 2);

  let shipped = null;
  try { shipped = JSON.parse(texts["mods/whistle/mappings.json"]); } catch (e) { t.fail("mappings.json parses", String(e?.message ?? e)); }
  const guide = texts["docs/guide.md"] ?? "";
  t.check("the guide has a tagged default map table", taggedRows(guide, "map").length > 0, true);
  t.check("the guide has a tagged own keys table", taggedRows(guide, "keys").length > 0, true);
  if (shipped) t.check("docs/guide.md's tables are the shipped mappings.json", check(guide, shipped), []);
});
