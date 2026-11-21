// Spec examples as fixtures (ADR 0003): every tagged example block in the spec .md files
// (texts.js, written by tests/run.sh) runs through step as a scenario. Also the reader itself.

import { suite, examples } from "./harness.js";
import * as core from "./step.js";
import texts from "./texts.js";

const FENCE = "```";
const SAMPLE = [
  "# A spec",
  "",
  `${FENCE}json example Ctrl+Space enters WHISTLE`,
  '{ "steps": [{ "command": "switch-mode" }] }',
  FENCE,
  "",
  `${FENCE}json`,
  '{ "not": "an example" }',
  FENCE,
  "",
  `${FENCE}js example not JSON, so not an example`,
  FENCE,
  "",
  `${FENCE}json example Broken`,
  "{ nope",
  FENCE,
  "",
].join("\r\n");

export default suite("spec examples", (t) => {
  const found = examples(SAMPLE);
  t.check("the reader finds only `json example` blocks", found.map((x) => x.name), ["Ctrl+Space enters WHISTLE", "Broken"]);
  t.check("the reader names the scenario by its tag", found[0].scenario,
    { name: "Ctrl+Space enters WHISTLE", steps: [{ command: "switch-mode" }] });
  t.check("a block that doesn't parse comes back with an error", typeof found[1].error, "string");

  t.check("the fixture file has an example", examples(texts["tests/fixtures/example.md"] ?? "").length > 0, true);

  for (const [path, text] of Object.entries(texts)) {
    if (!path.endsWith(".md")) continue;
    for (const x of examples(text)) {
      if (x.error) t.fail(`${path}: ${x.name}`, `doesn't parse: ${x.error}`);
      else t.scenario({ ...x.scenario, name: `${path}: ${x.name}` }, core);
    }
  }
});
