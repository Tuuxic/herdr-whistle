# Herdr support for mod versions, install and update

Research for issue #3 (child of map #1, "Whistle 1.0"). Checked on 2026-11-13 against Herdr 0.1.15.

## Answer

Herdr has no versioning, install or update mechanism for third-party mods. A mod can read Herdr's version at runtime. It can't read its own version except from a file it ships. `mod.json` has no version field, but unknown fields don't break it. `installed.json` covers only Herdr's shipped mods and layouts. herdr.dev tracks a repo's default branch and push time, not releases. Installing is done by an agent following AGENTS.md. Those steps say never to overwrite, so re-adding whistle produces a second, renamed copy instead of an update. Whistle has to supply its own versioning: semver in a file it ships, a runtime check of the minimum Herdr version, and an update procedure in RECIPE.md/README.

## Findings

### Reading versions

| What | How | Source |
|---|---|---|
| Herdr's version | `updates().app.version` (string), plus `core.version` for herdr-core. `app.updates` is false for a build from source. | `~/.config/herdr-app/herdr.d.ts:286-299` |
| Verified | A probe mod run through `herdr-app check` threw `updates().app` and got `{"version":"0.1.15","ready":null,"updates":true}`. `herdr-app --version` printed `herdr-app 0.1.15`. | run locally, see below |
| The mod's own version | No API. `import.meta` is `{}`, so it has no URL or version. `import x from "./mod.json"` fails ("expecting ';'"): JSON can't be imported. These options remain: export it from a JS module (`./version.js`), or call `readTextFile(\`${appHome()}/mods/<name>/mod.json\`)` and parse it. | probe, `herdr.d.ts:21-26` |

### What `mod.json` allows

- Documented fields: `place` (`right\|left\|top\|bottom\|none`), `size` (`AGENTS.md:803`), `focusable` (`AGENTS.md:807`, `herdr.d.ts:404`), and `overlay` width/height/kind/frame (`AGENTS.md:281-284`, `herdr.d.ts:239`). Shipped mods also use `title` (`~/.config/herdr-app/mods/*/mod.json`).
- None of these is a version, a minimum Herdr version, or a dependency.
- Herdr writes one extra field itself. Clones get `cloned_from: {name, version}`, where the version is Herdr's at clone time (e.g. `mods/tuuxic-agents/mod.json` holds `"version": "0.1.13"`). Clones "are yours and never updated" (`AGENTS.md:202-203`, `herdr.d.ts:74`).
- Extra fields are tolerated: a `mod.json` with `"version": "1.2.3", "herdr": ">=0.1.15", "whatever": {...}` passed `herdr-app check` (exit 0). Herdr doesn't enforce them. This is inferred to hold in the running app as well as in `check`; only `check` was run.

### What `installed.json` records

- It maps each **shipped** mod (and `layout:main|terminals|win98`) to a per-file hash, e.g. `"agents": {"main.js": "…", "mod.json": "…"}` (`~/.config/herdr-app/installed.json`). The 24 keys are all Herdr's own. Neither `whistle` nor any `tuuxic-*` mod is listed.
- It is "bookkeeping, written by Herdr" (`AGENTS.md:86`). Inferred: it is how Herdr spots an edited shipped file, moves it to `<name>-edited` and restores its own copy on the next start (`AGENTS.md:209-213`, `herdr.d.ts:75`). It has nothing to do with third-party mods.

### What herdr.dev records

- Listing: a public GitHub repo with the topic `herdr-mod`. Each mod is a folder containing `mods/<name>/`, `RECIPE.md`, `preview.png` and an optional `keys.json` snippet. It "shows up here within the hour" and is not reviewed by Herdr (https://herdr.dev/mods, "Share yours" section; `AGENTS.md:460-464`).
- Every card carries only these fields: `data-key` (`mods:<owner>/<repo>/<folder>`), `data-name`, `data-blurb`, `data-owner`, `data-stars`, `data-updated`, `data-pic`, `data-gh`, `data-page` and `data-line` (attribute census of https://herdr.dev/mods HTML). There is no version, release, tag, minimum Herdr version or install count.
- `data-gh` always points at a branch tree, never a tag: 858 × `tree/main`, 37 × `tree/master`, 1 other. `herdr-recap` has 30 GitHub releases and still links `tree/main/app`. So the gallery serves whatever is on the default branch.
- `data-updated` matched the repo's `pushed_at` exactly for `mrolafsson/herdr-recap` (2026-11-04T11:32:53Z). For `dougcunha/herdr-mods` it lagged behind `pushed_at` (11-09 vs 11-13). Inferred: it is `pushed_at` at the last crawl.
- The install line is the same for every mod, with no version pin: `Read ~/.config/herdr-app/AGENTS.md, then add this mod: herdr.dev/mods/<owner>/<name>` (https://herdr.dev/mods/herdrdev/tmux-prefix/). The mod page says: "The files next to it are one build of it. If they don't work on your Herdr, or you want it different, build it again from here."
- Not covered: whistle isn't listed yet. The repo has the `herdr-mod` topic, and its last push (2026-11-13T14:17Z) is under a day old. Not investigated further.

### What happens when an agent adds, re-adds or "updates" a mod

AGENTS.md "Layouts and mods other people made" (`AGENTS.md:432-458`) is the whole procedure. It has no update path.

1. **Folder.** The agent copies the mod folder to `mods/` and leaves out the recipe and preview. "Never overwrite: if a name is taken (yours or Herdr's), rename the new one: its file or folder, the `mod` names in the layout, and the mod's own `mods/<name>/` paths" (`AGENTS.md:446-449`). Re-adding whistle when `mods/whistle/` exists therefore creates `mods/whistle-2/` (or similar), with `mods/whistle/` paths rewritten. The old copy stays.
2. **Docking.** "The first time Herdr sees a folder, it docks one copy per `mod.json`" (`AGENTS.md:813-815`). Inferred: the renamed copy is a new folder with `"place": "bottom"`, so a second whistle bar appears. Both copies would also claim keys.
3. **keys.json merge.** The agent should "Add its sections and keys, and ask before replacing a key they already use" (`AGENTS.md:454-455`). The rename rule names paths and layout `mod` names, but not `keys.json` actions (`whistle.whistle`) or the `mod:whistle` section. Inferred: after a renaming re-add, the snippet's keys still point at the old copy, or clash with keys whistle already claimed. Separately, any edit to `keys.json` makes the whole file the person's, and Herdr stops refreshing its defaults (`AGENTS.md:489-491`). Whistle's own writes (ADR 0001) already have that effect.
4. **Person's files.** The procedure only writes `layouts/`, `mods/` and merges `keys.json`. It never touches `~/.config/herdr-app/whistle.json`, which lives outside `mods/whistle/` (`mods/whistle/config.js:14`). Files *inside* the mod folder (`mappings.json`) belong to the mod and get replaced on an update. That is how `config.js:2-6` already treats them.
5. **In-place overwrite (outside the documented procedure).** If an agent or script does replace `mods/whistle/` files, "Saving any file reloads every copy in place". A broken save keeps the old build running (`AGENTS.md:815-820`). A copy's `localStorage` and shared state survive, because they are per copy and in `shared.json`/`data/` (`AGENTS.md:86, 900`).
6. **Herdr's own updates** replace only shipped mods and layouts (`AGENTS.md:209-213`) and rewrite the `.d.ts` files (`AGENTS.md:47`). A third-party mod folder is left alone. Nothing stops an older mod from running on a newer Herdr.

## Consequences for whistle (inferred)

- Semver: keep it in a JS module the mod imports (`mods/whistle/version.js`). Optionally mirror it as a `"version"` field in `mod.json` for people and agents to read. Tag GitHub releases for history only, because herdr.dev ignores them.
- Minimum Herdr version: put it in the same module and compare it with `updates().app.version` in `init`. If Herdr is too old, show a message instead of claiming keys. Herdr won't enforce it.
- Updates: write the update steps into RECIPE.md/README, because AGENTS.md has none and its "never overwrite" rule produces a duplicate. The steps would be: replace the contents of `mods/whistle/`, never touch `whistle.json`, and let whistle's own key sync (ADR 0001) reconcile `keys.json` rather than re-merging the snippet. Treat `main` as the release channel, since the gallery installs from it.

## How this was checked

- Read `~/.config/herdr-app/AGENTS.md`, `herdr.d.ts`, `installed.json` and shipped `mods/*/mod.json` (read only).
- `herdr-app --version` printed `herdr-app 0.1.15`.
- Ran `herdr-app check` on a throwaway mod in a temp folder:
  - a `mod.json` with extra fields passed;
  - a probe that threw `updates().app` printed version 0.1.15;
  - `import.meta` came back `{}`;
  - `import "./mod.json"` failed to parse.
- Fetched https://herdr.dev/mods and https://herdr.dev/mods/herdrdev/tmux-prefix/, and counted the card attributes and `data-gh` refs in the HTML.
- Compared `data-updated` with `gh api repos/<owner>/<repo>` `pushed_at` for two mods.
