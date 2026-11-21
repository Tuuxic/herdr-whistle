# Main is the release; whistle carries its own version and update steps

Herdr has no versioning, install or update path for third-party mods: herdr.dev links a repo's
default branch and ignores tags and releases, `mod.json` has no version field, and the add
procedure in Herdr's AGENTS.md says never to overwrite, so re-adding whistle makes a renamed
second copy. We decided that whistle supplies all of it itself:

- `main` moves only at a release, since it is what herdr.dev installs; work happens on
  branches. Each release is a `vX.Y.Z` tag and a GitHub Release, kept for history only.
- `mods/whistle/version.js` exports whistle's version and the minimum Herdr it needs (a mod
  can't import JSON); `mod.json` repeats both for people and agents, and a test fails if they
  drift apart.
- Semver over every public surface: the whistle.json shape, the layout whistle block's props,
  `whistle.*` command names, the public shared keys, the keynav wire format, the helpers other
  mods copy and the claimed-key form. Raising the minimum Herdr is a minor bump.
- On a Herdr older than the minimum, whistle is inert: it stands aside, and its state says why.
- Updating is an agent following RECIPE.md: replace the mods' folders in place, never touch
  whistle.json, leave keys.json to whistle's key sync
  ([ADR 0009](0009-whistle-claims-keys-in-keys-json.md)), and relay the breaking entries of
  `CHANGELOG.md` since the old version.

## Considered options

- Committing to `main` and tagging releases: herdr.dev would serve half-done work.
- A `release` default branch: the repo's face on GitHub would lag behind.
- The version only in `mod.json`, read at runtime: its path breaks in a renamed copy.
- Whistle checking GitHub for updates: whistle uses no network.

## Consequences

- A second copy is still possible when an agent follows AGENTS.md instead of RECIPE.md. Each
  copy knows its folder from a path constant the rename rewrites; the copy in `mods/whistle/`
  runs, else the first folder by name, and the others are inert and name the copy that runs.
- Whistle never rewrites a person's whistle.json entries to migrate them. A key it doesn't know
  is listed as a config problem.
- A release is a hand checklist in CONTRIBUTING: tests, `herdr-app check`, a Windows hand
  check, version.js, mod.json and CHANGELOG bumped together; merging to `main` tags and
  releases.
