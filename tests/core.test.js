// The core's own rules: it imports nothing from Herdr (ADR 0004, ADR 0003), and version.js
// agrees with mod.json (ADR 0002).

import { suite } from "./harness.js";
import { VERSION, MIN_HERDR, HOME } from "./version.js";
import { folderOf } from "./inert.js";
import texts from "./texts.js";

const HELPERS = ["mods/whistle/whistle.js", "mods/whistle/keynav.js"];
const SEMVER =/^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;

export default suite("core", (t) => {
  // The helpers other mods copy (whistle.js) call Herdr: they aren't core.
  const sources = Object.entries(texts).filter(([p]) => p.startsWith("mods/whistle/") && p.endsWith(".js") && !HELPERS.includes(p));
  t.check("the core's sources are there to check", sources.map(([p]) => p).includes("mods/whistle/step.js"), true);
  for (const [path, text] of sources) {
    const from = [...text.matchAll(/\bimport\b[^;]*?["']([^"']+)["']/g)].map((m) => m[1]);
    const outside = from.filter((m) => !m.startsWith("./"));
    t.check(`${path} imports only the core's own modules`, outside, []);
  }

  t.check("VERSION is semver", SEMVER.test(VERSION), true);
  t.check("MIN_HERDR is a version", SEMVER.test(MIN_HERDR), true);
  let mod = null;
  try { mod = JSON.parse(texts["mods/whistle/mod.json"]); } catch (e) { t.fail("mod.json parses", String(e?.message ?? e)); }
  t.check("mod.json repeats the version", mod?.version, VERSION);
  t.check("mod.json repeats the minimum Herdr", mod?.herdr, MIN_HERDR);

  // A renamed copy learns its folder from HOME: Herdr's add procedure rewrites the mod's own
  // mods/<name>/ paths when it renames, so HOME must be spelled that way.
  t.check("HOME is the mod's own mods/whistle/ path", HOME, "mods/whistle/");
  t.check("a copy's folder comes from HOME", folderOf(HOME), "whistle");
  t.check("a renamed HOME gives the renamed folder", folderOf("mods/whistle-2/"), "whistle-2");
});
