// The shipped defaults: mappings.json in the 1.0 form, every entry good, every action keyed.

import { suite } from "./harness.js";
import { compose, ACTIONS } from "./config.js";
import texts from "./texts.js";

export default suite("shipped defaults", (t) => {
  let defaults = null;
  try { defaults = JSON.parse(texts["mods/whistle/mappings.json"]); } catch (e) { t.fail("mappings.json parses", String(e?.message ?? e)); }
  const c = compose([{ source: "mappings.json", ...defaults }], { platform: "linux" });
  t.check("mappings.json has no config problems", c.problems, []);
  t.check("mappings.json gives every own-key action a key", Object.keys(ACTIONS).filter((a) => !c.keys[a]?.length), []);
});
