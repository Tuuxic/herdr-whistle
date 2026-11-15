// RECIPE's Integrate section (Integration, issue #32, ADR 0015): instructions for the installing
// agent, so these checks are on the text, against Herdr itself.
//
//   - The declared keys RECIPE gives for Herdr's blocks are the ticket's list, written out here
//     (not read from the RECIPE): spaces and tabs n/r/x, agents/files/changes none.
//   - Every Herdr command RECIPE names, in that table or as `herdr-app do <command>`, is one of
//     Herdr's `commands()` (live, from the Herdr running the check).
//
// The table is tagged `<!-- table integrate-keys -->`:
//   | Block | Key | Label | Herdr command |   one row per key; a block with no declared keys has
//   one row with "none" in Key and empty Label and command.

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
  "agents · none",
  "tabs · n · tab.new",
  "tabs · r · tab.rename",
  "tabs · x · tab.close",
  "files · none",
  "changes · none",
];

const rows = () => taggedRows(recipe, "integrate-keys");
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

  const known = new Set((herdr.commands?.() ?? []).map((c) => c.name));
  t.check("Herdr lists its commands under check", known.size > 0, true);
  const named = [...rows().flatMap(([, , , c]) => code(c ?? "")), ...doCommands(recipe)];
  t.check("RECIPE names Herdr commands", named.length > 0 && doCommands(recipe).length > 0, true);
  t.check("every Herdr command RECIPE names exists", named.filter((c) => !known.has(c)), []);
});
