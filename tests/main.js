// The test mod: imports the suites of this check (suites.js, which tests/run.sh writes: one
// suite per check, ADR 0013) and throws one Error listing every failure, grouped by suite, so
// `herdr-app check` fails with all of them. tests/run.sh copies it next to the core's modules (a mod can't import from
// outside its own folder).

import { View, div } from "gpui-kit";
import suites from "./suites.js";

const total = suites.reduce((n, s) => n + s.total, 0);
const failed = suites.filter((s) => s.fails.length);
if (failed.length) {
  const count = failed.reduce((n, s) => n + s.fails.length, 0);
  const lines = failed.map((s) => `[${s.name}]\n  ${s.fails.join("\n  ")}`);
  throw new Error(`${count} failures in ${total} cases:\n${lines.join("\n")}`);
}

export default class T extends View {
  // Nothing to show: the tests ran on import.
  render() { return div(); }
}
