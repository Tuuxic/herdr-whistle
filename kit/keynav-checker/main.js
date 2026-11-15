// The keynav checker: a throwaway mod that plays the keyboard driver against a field mod's copy
// of keynav.js, through Herdr's own shared state, and fails `herdr-app check` naming every rule
// of keynav v2 (docs/contracts/keynav.md) the copy breaks. check.sh puts the copy next to this
// file; by hand, copy this folder and drop your keynav.js in it, then `herdr-app check` it.

import { View, div } from "gpui-kit";
import { shared, setShared } from "herdr";
import * as helper from "./keynav.js";
import { checkKeynav } from "./checks.js";

const fails = checkKeynav(helper, { shared, setShared });
if (fails.length) {
  const lines = fails.map((f) => `  ${f.rule}: ${f.why}`);
  throw new Error(`keynav.js breaks ${fails.length} rule${fails.length === 1 ? "" : "s"} of keynav v2:\n${lines.join("\n")}`);
}

export default class KeynavChecker extends View {
  // Nothing to show: the rules ran on import.
  render() { return div(); }
}
