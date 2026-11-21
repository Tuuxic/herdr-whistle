# Contributing

How whistle is built, tested and released. Words: [GLOSSARY.md](GLOSSARY.md). Decisions and
why: [docs/adr/](docs/adr). Specs and tickets are GitHub issues.

## The repo

The repo is laid out like a Herdr home ([ADR 0005](docs/adr/0005-repo-laid-out-like-a-herdr-home.md)):
`mods/whistle/` is the mod as it ships and `keys.json` holds the lines it adds. The rest stays
outside the mod: the docs (`README.md`, [docs/guide.md](docs/guide.md),
[docs/authors.md](docs/authors.md), the contracts in [docs/contracts/](docs/contracts),
[RECIPE.md](RECIPE.md) for installing agents), the keynav checker in
[kit/keynav-checker/](kit/keynav-checker), the tests in `tests/` and the scripts in `scripts/`.

In `mods/whistle/` ([ADR 0011](docs/adr/0011-pure-step-core-behind-one-effects-shell.md)):

- **The core**, pure and synchronous, imports nothing from Herdr: `step.js` (`step(model,
  input, world) -> { model, effects, handled }`), with `fields.js` (fields from the layout:
  the terminal, stock fields, keynav fields), `config.js` (the config layers, own keys apart
  from mappings), `keymap.js` (what a key does), `claims.js` (claimed keys in keys.json),
  `block.js` (the layout's whistle blocks, each the anchor), `inert.js`, `keynames.js`,
  `facts.js` (the hint items and config whistle publishes) and `version.js`. Whistle decides no
  looks ([ADR 0020](docs/adr/0020-whistle-publishes-facts-clients-show-them.md)).
- **The shell**, `main.js`: reads Herdr into `world`, feeds `step` its inputs (commands, keys,
  ticks, write results) and carries out the effects. `anchor.js` is the anchor's block, which
  draws nothing and holds the keyboard.
- **The helpers other mods copy**, `keynav.js` and `whistle.js`: whistle itself imports
  neither.
- `mappings.json`: the default map.

`mods/whistle-ui/` is whistle-ui, a client of whistle's public keys and commands
([docs/contracts/whistle-ui.md](docs/contracts/whistle-ui.md)), built the same way: `ui.js` is
its pure core (`ui(published, world) -> { model, effects }`), with `read.js` (whistle.js's
readers, copied word for word) and `box.js` (the hints box's measures); `main.js` is its shell;
`bar.js`, `hints.js` and `settings.js` draw; `keys.json` holds the line it adds. It imports
nothing from `mods/whistle/`, and its tests (`tests/ui.test.js`) never run whistle's core.

## Tests

```sh
bash tests/run.sh
```

It needs only `herdr-app` on the PATH (`HERDR_APP` picks another). Tests run on Herdr's own
engine through `herdr-app check` ([ADR 0013](docs/adr/0013-tests-run-on-herdr-app-check-with-spec-examples-as-fixtures.md)):
`run.sh` builds a throwaway test mod per suite (`tests/*.test.js`) and checks each; a failing
case fails the check and lists every failure. `check` stops a mod whose loading runs longer
than about half a second, so `run.sh` prints each suite's time; split a suite that nears it.
Then it runs the keynav checker and `scripts/release.sh` end to end.

- **Step scenarios as data**: a scenario is a world, a starting model and steps (a command, a
  key, a tick or a write result), each with what it expects (effects, model fields, the bar,
  the hints, settings). `tests/harness.js` runs them through `step`; `tests/worlds.js` has
  shared layouts.
- **Spec examples are fixtures**: every fenced block tagged `json example <name>` in
  `docs/contracts/*.md`, `docs/guide.md` and `tests/fixtures/*.md` runs as a scenario
  (`tests/examples.test.js`), so the docs say exactly what whistle does.
- **Tagged tables**: the guide's default map and own keys, under `<!-- table map -->` and
  `<!-- table keys -->`, are checked both ways against `mappings.json`
  (`tests/guide.test.js`); RECIPE's Integrate keys against Herdr's commands.
- **The docs**: every doc exists and its links resolve, to a file and to a heading
  (`tests/docs.test.js`).
- **The rule**: every rule the docs state has at least one named scenario or example. A
  change to behaviour changes the scenario, the docs and their example together.
- `suite`s read files from `texts.js`, which `run.sh` writes (repo path → text): add a file
  there when a suite needs it. `check` never sees an async failure, so suites can't await.

CI ([.github/workflows/test.yml](.github/workflows/test.yml)) runs `run.sh`,
`herdr-app check mods/whistle` and `herdr-app check mods/whistle-ui` on Linux and macOS (blocking) and Windows (not blocking), each
on the latest Herdr and on the minimum whistle declares (`MIN_HERDR` in
`mods/whistle/version.js`, installed by `tests/install-herdr.sh`).

## The sandbox

`scripts/sandbox.sh` runs a second Herdr window with a home of its own, so you can try whistle
without touching yours (`~/.config/herdr-app`). The window shows the same spaces and terminals
as yours, so test in a space of its own.

| Command | Does |
|---|---|
| `scripts/sandbox.sh reset` | delete the sandbox, make a fresh home and open its window |
| `scripts/sandbox.sh reset --whistle` | the same, with this checkout's whistle and whistle-ui copied in, their keys.json merged and a layout `whistle-sandbox` showing whistle's anchor and whistle-ui's bar and corner block |
| `scripts/sandbox.sh sync` | copy this checkout's `mods/whistle/` and `mods/whistle-ui/` into the sandbox again |
| `scripts/sandbox.sh agent [task]` | start Claude with the sandbox as Herdr's home; with no task it installs whistle by RECIPE.md, as a person's agent would |
| `scripts/sandbox.sh open`, `close`, `status`, `path` | open or close its window, its `herdr-app status`, its folder |

`WHISTLE_SANDBOX` picks the folder (default `~/herdr-whistle-sandbox`; keep its path short on
Windows).

## How work lands

`main` is the release ([ADR 0012](docs/adr/0012-main-is-the-release-whistle-carries-its-own-version.md)):
what people install from herdr.dev. Work lands on the long-lived `next` branch, one slice at a
time: a slice is vertical (core, shell, scenarios and its docs together) and branches from
`next`, and merges back once `run.sh` passes. A slice that changes a public
contract changes its `docs/contracts/*.md` and adds a CHANGELOG entry under the audience it
affects. `next` reaches `main` only by a release.

## Release checklist

1. **Version**: `VERSION` in `mods/whistle/version.js` and `"version"` in
   `mods/whistle/mod.json` agree (a test checks), semver over every public surface: a break in
   a contract, a helper, keys.json's lines or whistle.json is a major version. A whistle.json
   key that stops having an effect, while it still parses and is listed as a config problem,
   is minor (as `back` in 1.1.0 and `bar` in 1.3.0), marked **Changed** or **Removed**. Raise
   `MIN_HERDR` and `"herdr"` together if whistle now needs a newer Herdr.
2. **CHANGELOG.md** has the version's entry, `## v<version> (<date>)` with the date of the
   release, grouped by audience: **Upgrading** (the installing agent's steps, if any), **You**,
   **Layout authors**, **Mod authors**, **Keynav authors**, breaking entries marked
   **Breaking** (a test checks the shape).
3. **CI green on `next`**.
4. **The Windows hand checks**, in the sandbox (`scripts/sandbox.sh reset --whistle`, then
   `scripts/sandbox.sh reset` and `scripts/sandbox.sh agent` for a fresh install): every item
   in RECIPE's [Done when](RECIPE.md#done-when), on Windows, which CI doesn't block on.
5. **A pull request `next` → `main`**. Merging it is the release:
   [.github/workflows/release.yml](.github/workflows/release.yml) reads `VERSION` from
   `mods/whistle/version.js` and, if the tag `v<VERSION>` doesn't exist yet, tags the merge
   commit, pushes the tag and makes a GitHub release named after it, whose notes are that
   version's CHANGELOG entry (`scripts/release.sh` reads both). When the tag already exists it
   does nothing, so a later push to `main` without a new version releases nothing.
