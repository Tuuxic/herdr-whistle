// The core's own rules: it imports nothing from Herdr (ADR 0011, ADR 0013), and version.js
// agrees with mod.json (ADR 0012).

import { suite } from "./harness.js";
import { VERSION, MIN_HERDR } from "./version.js";
import texts from "./texts.js";

const SEMVER = /^\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?$/;

export default suite("core", (t) => {
  const sources = Object.entries(texts).filter(([p]) => p.startsWith("mods/whistle/") && p.endsWith(".js"));
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
});
