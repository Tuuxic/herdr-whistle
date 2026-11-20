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

import { suite } from "./harness.js";
import { taggedRows } from "./guide.test.js";
import texts from "./texts.js";
import * as herdr from "herdr";

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

  const known = new Set((herdr.commands?.() ?? []).map((c) => c.name));
  t.check("Herdr lists its commands under check", known.size > 0, true);
  const named = [...rows().flatMap(([, , , c]) => code(c ?? "")), ...taggedRows(recipe, "integrate-pick").flatMap(([, c]) => code(c ?? "")), ...doCommands(recipe)];
  t.check("RECIPE names Herdr commands", named.length > 0 && doCommands(recipe).length > 0, true);
  t.check("every Herdr command RECIPE names exists", named.filter((c) => !known.has(c)), []);
});
