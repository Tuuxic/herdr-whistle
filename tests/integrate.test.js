// RECIPE's Integrate section (Integration, issue #32, ADR 0015): instructions for the installing
// agent, so these checks are on the text, against Herdr itself.
//
//   - The declared keys RECIPE gives for Herdr's blocks are the ticket's list, written out here
//     (not read from the RECIPE): spaces and tabs n/r/x, Show on Space for spaces and agents
//     (issue #43), files/changes none. Show's label is the glossary's name.
//   - Pick into TYPE (issue #43, ADR 0017): on spaces and agents, pick runs the block's Herdr
//     command, then whistle.type only when whistle is there (shared("whistle")); Show holds,
//     never goes to the terminal. Aside is gone (#38).
//   - Every Herdr command RECIPE names, in that table or as `herdr-app do <command>`, is one of
//     Herdr's `commands()` (live, from the Herdr running the check).
//
// The table is tagged `<!-- table integrate-keys -->`:
//   | Block | Key | Label | Herdr command |   one row per key; a block with no declared keys has
//   one row with "none" in Key and empty Label and command.
// Pick's table is tagged `<!-- table integrate-pick -->`:
//   | Block | Herdr command | Then |   Then: `whistle.type` when whistle is there.
//
// The anchor (issue #52, ADR 0018): the blocks Install adds are one fenced block tagged
// ```json whistle-blocks``` (a JSON array). Put in a layout, block.js (the layout-block contract)
// must read them as an anchor (anchor: true, 0 px) that drives and a bar that only draws, with no
// config problem, and the hints box docking at the bar's spot while it is hidden. Integrate adds
// the same anchor to a layout that has whistle's bar but no anchor, and Uninstall removes it.

import { suite } from "./harness.js";
import { taggedRows } from "./guide.test.js";
import texts from "./texts.js";
import * as herdr from "herdr";
import { bars, blockProps, viewing, dock, isAnchor } from "./block.js";

const code = (cell) => [...cell.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
const recipe = texts["RECIPE.md"];

const WANT = [
  "spaces · n · space.new",
  "spaces · r · space.rename",
  "spaces · x · space.close",
  "spaces · space · space.select",
  "agents · space · agent.focus",
  "tabs · n · tab.new",
  "tabs · r · tab.rename",
  "tabs · x · tab.close",
  "files · none",
  "changes · none",
];

const PICK = [
  "spaces · space.select · whistle.type",
  "agents · agent.focus · whistle.type",
];

const rows = () => taggedRows(recipe, "integrate-keys");
const picks = () => taggedRows(recipe, "integrate-pick").map(([block, command, then]) =>
  [code(block)[0], code(command)[0], code(then ?? "")[0]].join(" · "));
const lines = () => rows().map(([block, key, _label, command]) => {
  const [b] = code(block), [k] = code(key), [c] = code(command ?? "");
  return k ? `${b} · ${k} · ${c}` : `${b} · ${key}`;
});

// The JSON arrays in fenced blocks tagged `json whistle-blocks`, concatenated.
const whistleBlocks = (text) => [...String(text).replace(/\r\n/g, "\n").matchAll(/^ *```json whistle-blocks\n([\s\S]*?)^ *```$/gm)]
  .flatMap((m) => JSON.parse(m[1]));
// A RECIPE section's text: from its `## ` heading to the next.
const recipeSection = (name) => (recipe ?? "").split(new RegExp(`^## ${name}$`, "m"))[1]?.split(/^## /m)[0] ?? "";

// `herdr-app do <command>` anywhere in the text.
const doCommands = (text) => [...String(text).matchAll(/herdr-app do ([a-z_]+\.[a-z_]+)/g)].map((m) => m[1]);

export default suite("integrate", (t) => {
  t.check("RECIPE has an Integrate section", /^## Integrate$/m.test(recipe ?? ""), true);
  t.check("declared keys for Herdr's blocks", lines(), WANT);
  t.check("every row has a label", rows().filter(([, key, label]) => code(key).length && !label).length, 0);
  t.check("Space is labelled Show, the glossary's name",
    rows().filter(([, key]) => code(key)[0] === "space").map(([, , label]) => label), ["Show", "Show"]);

  // Pick and Show (issue #43).
  t.check("RECIPE has a Pick and Show section", /^### Pick and Show$/m.test(recipe ?? ""), true);
  t.check("what pick runs on spaces and agents", picks(), PICK);
  const section = (recipe ?? "").split(/^### Pick and Show$/m)[1]?.split(/^### /m)[0] ?? "";
  t.check("pick checks that whistle is there", section.includes('shared("whistle")'), true);
  t.check("Show holds", section.includes('after: "hold"') && section.includes("keepKeys"), true);
  t.check("Show never goes to the terminal", /\bnever[^.]*`\{ after: "terminal" \}`/.test(section), true);
  t.check("RECIPE offers no Aside", /\bAside\b|shift-space|Shift\+Space/.test(recipe ?? ""), false);

  // The anchor (issue #52).
  const added = whistleBlocks(recipeSection("Install"));
  const layout = { id: "work", type: "column", children: [{ id: "main", type: "block", content: { tab: {} } }, ...added] };
  const anchor = added.find((b) => isAnchor(b.content?.props));
  const bar = added.find((b) => b.content?.mod === "whistle" && b !== anchor);
  t.check("Install adds an anchor and a bar", [Boolean(anchor), Boolean(bar)], [true, true]);
  t.check("the anchor is sized 0 px", anchor?.size, { px: 0 });
  t.check("the blocks are whistle's", bars(layout, "whistle").map((b) => b.id), added.map((b) => b.id));
  t.check("the blocks have no config problem", blockProps(layout, "whistle").problems, []);
  t.check("the anchor drives, the bar only draws",
    [viewing(layout, "whistle", anchor?.content.props), viewing(layout, "whistle", bar?.content.props ?? {})], [false, true]);
  const hidden = { ...layout, children: layout.children.map((b) => (b === bar ? { ...b, hidden: true } : b)) };
  t.check("with the bar hidden, the hints box docks at its spot", dock(hidden, "whistle", null), { place: {} });
  t.check("Integrate adds the anchor", /```json whistle-blocks|"anchor": true|`anchor: true`/.test(recipeSection("Integrate")), true);
  t.check("Uninstall removes the anchor", /`anchor: true`/.test(recipeSection("Uninstall")), true);
  t.check("Done when: the hand check with the bar hidden",
    /bar hidden[\s\S]{0,80}?`ctrl-space` enters WHISTLE, `p` opens the palette, Ctrl\+H selects\s+a field, and `i` goes back to TYPE/.test(recipeSection("Done when")), true);

  const known = new Set((herdr.commands?.() ?? []).map((c) => c.name));
  t.check("Herdr lists its commands under check", known.size > 0, true);
  const named = [...rows().flatMap(([, , , c]) => code(c ?? "")), ...taggedRows(recipe, "integrate-pick").flatMap(([, c]) => code(c ?? "")), ...doCommands(recipe)];
  t.check("RECIPE names Herdr commands", named.length > 0 && doCommands(recipe).length > 0, true);
  t.check("every Herdr command RECIPE names exists", named.filter((c) => !known.has(c)), []);
});
