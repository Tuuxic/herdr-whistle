// A mod that only loads keymap.test.js: `herdr-app check` fails with the test's error when a
// case fails. tests/run.sh copies it next to the mod's files it tests (a mod can't import
// from outside its own folder).

import { View, div } from "gpui-kit";
import "./keymap.test.js";

export default class T extends View {
  // Nothing to show: the tests ran on import.
  render() { return div(); }
}
