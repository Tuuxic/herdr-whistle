// The docs for each audience (Docs for each audience, issue #16; the release, issue #30):
//   - every doc exists, and every link in them resolves, to a file or folder in the repo and,
//     with a #fragment, to a heading in that file (GitHub's anchors). Links to other sites
//     aren't followed;
//   - docs/authors.md routes to the five contracts, the two helpers and the checker;
//   - README names the keys outside WHISTLE, links the other docs, and drops what 1.0 dropped;
//   - CHANGELOG's newest entry is VERSION's, dated, with its parts by audience;
//   - CONTRIBUTING has the tests, the sandbox and the release checklist;
//   - every workflow checks out with actions/checkout@v7 (Node 24).
// The release script (scripts/release.sh) is checked by tests/run.sh itself: it's bash.

import { suite } from "./harness.js";
import texts, { files } from "./texts.js";
import { VERSION } from "./version.js";

// The docs #16 settles, by audience. RECIPE.md is the installing agent's.
export const DOCS = [
  "README.md", "docs/guide.md", "docs/authors.md", "RECIPE.md", "CHANGELOG.md", "CONTRIBUTING.md",
  "kit/keynav-checker/README.md",
  "docs/contracts/keynav.md", "docs/contracts/mod-mappings.md", "docs/contracts/state.md",
  "docs/contracts/layout-block.md", "docs/contracts/commands.md",
];

const unfenced = (text) => String(text).replace(/\r\n/g, "\n").replace(/^(```|~~~)[^\n]*\n[\s\S]*?^\1[^\n]*$/gm, "");

// GitHub's heading anchors: lowercased, punctuation but `-` and `_` dropped, spaces to `-`, a
// repeated anchor numbered (-1, -2, ...).
export function anchors(text) {
  const seen = new Map();
  const out = new Set();
  for (const m of unfenced(text).matchAll(/^#{1,6}[ \t]+(.+?)[ \t#]*$/gm)) {
    const base = m[1].replace(/`/g, "").replace(/\[([^\]]*)\]\([^)]*\)/g, "$1").trim().toLowerCase()
      .replace(/[^\p{L}\p{N}\s_-]/gu, "").replace(/\s/g, "-");
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    out.add(n ? `${base}-${n}` : base);
  }
  return out;
}

// The links a Markdown text makes, `[text](target)` outside code, as targets.
export function links(text) {
  return [...unfenced(text).replace(/`[^`\n]*`/g, "").matchAll(/\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g)].map((m) => m[1]);
}

// Where a relative target written in the doc at `from` points, as a repo path ("" = the repo).
export function resolve(from, target) {
  const parts = from.split("/").slice(0, -1);
  for (const p of target.split("/")) {
    if (p === "" || p === ".") continue;
    if (p === "..") parts.pop();
    else parts.push(p);
  }
  return parts.join("/");
}

const isFile = (path) => files.includes(path);
const isFolder = (path) => path === "" || files.some((f) => f.startsWith(`${path}/`));

export default suite("docs", (t) => {
  t.check("the repo's files are listed", isFile("mods/whistle/step.js"), true);
  t.check("anchors follow GitHub's", [...anchors("# A copy in another folder\n## `whistle.json`: yours\n# A copy in another folder")],
    ["a-copy-in-another-folder", "whistlejson-yours", "a-copy-in-another-folder-1"]);
  t.check("links skip code", links("[a](x.md) `[b](y.md)`\n```\n[c](z.md)\n```\n[d](w.md#h \"t\")"), ["x.md", "w.md#h"]);

  for (const doc of DOCS) {
    const text = texts[doc];
    if (text === undefined) { t.fail(`${doc} exists`, "no such file (or tests/run.sh doesn't copy it)"); continue; }
    for (const link of links(text)) {
      if (/^[a-z][a-z0-9+.-]*:/i.test(link)) continue; // https:, mailto:
      const [target, fragment] = link.split("#");
      const path = target ? resolve(doc, target) : doc;
      if (!isFile(path) && !isFolder(path)) { t.fail(`${doc}: ${link}`, `${path} isn't in the repo`); continue; }
      if (fragment === undefined || !path.endsWith(".md")) continue;
      if (texts[path] === undefined) { t.fail(`${doc}: ${link}`, `${path} isn't copied by tests/run.sh, so its headings can't be checked`); continue; }
      if (!anchors(texts[path]).has(fragment)) t.fail(`${doc}: ${link}`, `${path} has no heading #${fragment}`);
    }
  }

  // docs/authors.md routes every author to the five contracts, the helpers they copy and the
  // keynav checker (issue #30, item 2).
  const routed = new Set(links(texts["docs/authors.md"] ?? "").map((l) => resolve("docs/authors.md", l.split("#")[0])));
  for (const to of [
    "docs/contracts/keynav.md", "docs/contracts/mod-mappings.md", "docs/contracts/state.md",
    "docs/contracts/layout-block.md", "docs/contracts/commands.md",
    "mods/whistle/keynav.js", "mods/whistle/whistle.js", "kit/keynav-checker",
  ]) t.check(`docs/authors.md links ${to}`, routed.has(to), true);

  // README.md, for people installing whistle (issue #30, item 1): the keys outside WHISTLE,
  // the docs it routes to, and nothing 1.0 dropped.
  const readme = texts["README.md"] ?? "";
  const readmeLinks = new Set(links(readme).map((l) => resolve("README.md", l.split("#")[0])));
  for (const to of ["RECIPE.md", "docs/guide.md", "docs/authors.md", "CHANGELOG.md", "CONTRIBUTING.md", "preview.png", "LICENSE"])
    t.check(`README links ${to}`, readmeLinks.has(to), true);
  for (const key of ["Ctrl+Space", "Alt+A", "Alt+S", "Alt+,", "Ctrl+Shift+A", "Ctrl+Shift+S", "Ctrl+Shift+,"])
    t.check(`README names ${key}`, readme.includes(key), true);
  for (const gone of ["Ctrl+[", "docks itself", "keynav.fields"])
    t.check(`README no longer says ${gone}`, readme.includes(gone), false);

  // CHANGELOG.md: the newest entry is this version's, dated, grouped by audience (#16) with
  // the installing agent's Upgrading note first.
  const changelog = unfenced(texts["CHANGELOG.md"] ?? "");
  const entries = [...changelog.matchAll(/^## (.*)$/gm)].map((m) => m[1]);
  t.check("CHANGELOG's newest entry is this version's, dated", /^v(\S+) \(\d{4}-\d{2}-\d{2}\)$/.exec(entries[0] ?? "")?.[1], VERSION);
  const newest = changelog.split(/^## /m)[1] ?? "";
  t.check("the newest entry's parts", [...newest.matchAll(/^### (.*)$/gm)].map((m) => m[1]),
    ["Upgrading", "You", "Layout authors", "Mod authors", "Keynav authors"]);

  // CONTRIBUTING.md has the release checklist (issue #30, item 3).
  const contributing = texts["CONTRIBUTING.md"] ?? "";
  t.check("CONTRIBUTING has a release checklist", anchors(contributing).has("release-checklist"), true);
  for (const said of ["bash tests/run.sh", "scripts/sandbox.sh reset", "--whistle", "scripts/sandbox.sh agent",
    "scripts/sandbox.sh sync", "mods/whistle/version.js", ".github/workflows/release.yml"])
    t.check(`CONTRIBUTING says ${said}`, contributing.includes(said), true);

  // Every workflow checks out with actions/checkout v7, which runs on Node 24 (issue #30, item 7).
  const workflows = Object.keys(texts).filter((p) => p.startsWith(".github/workflows/"));
  t.check("the workflows are there to check", workflows.includes(".github/workflows/test.yml"), true);
  for (const w of workflows)
    t.check(`${w} checks out with actions/checkout@v7`, [...texts[w].matchAll(/actions\/checkout@(\S+)/g)].map((m) => m[1]).filter((v) => v !== "v7"), []);
});
