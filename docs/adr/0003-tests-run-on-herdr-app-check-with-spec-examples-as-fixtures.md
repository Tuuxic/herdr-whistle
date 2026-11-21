# Tests run on herdr-app check, with spec examples as fixtures

Whistle's tests run only through `herdr-app check`, which loads them as a mod on Herdr's own JS
engine (QuickJS). `tests/run.sh` builds a throwaway test mod from the cores' modules, the
helpers mods copy and the test files, and runs one `check` per suite file, each on its own copy
of the mod that imports only that suite. Any failing case throws, so that check fails and lists
every failure in its suite. Most suites are step scenarios written as data: a starting world and
a list of steps, each with the effects or published values it should produce. The public
contracts are tested from their own specs: each spec's tagged example blocks run through the
core, so the docs and the code can't drift apart. `run.sh` bakes the text of every spec `.md`
(and the other files suites read) into a generated `texts.js` module, which suites import.

Why one check per suite, and texts baked in: `check` interrupts a mod whose loading runs longer
than about half a second, and the suites run while the test mod loads, so one mod importing
every suite outgrew it. And `check` never sees a failure in async code (a `readTextFile`
promise, a top-level `await`), so a test mod that read its fixtures at runtime would pass while
its cases never ran; a sync module can't go unseen.

## Considered options

- Node's test runner, alone or alongside, even in CI only. It gives better reporting and
  coverage, and Windows CI without a desktop. But it runs on V8, not QuickJS, so a green run
  doesn't prove the code works in Herdr, and `herdr-app check` would still be needed for the
  real mods and for the minimum Herdr version. Two harnesses would also force every suite to
  stay runner-neutral.
- Fixture files that the docs link to or copy: they drift.
- Generating the docs from fixtures: it adds a build step.

## Consequences

- Contributors need only herdr-app. There is no per-case reporting and no coverage tool, so the
  coverage rule is that every rule the docs state has at least one named scenario.
- The cores must not import `herdr`. The tests read no files at runtime: `run.sh` bakes what
  they need into `texts.js`, so they run the same on any machine or runner.
- Any one suite must load well under the limit; `run.sh` prints each suite's run time, slowest
  first, and a suite that nears it is split.
- CI depends on `check` running without a display. Linux and macOS jobs are required, falling
  back to `xvfb-run` on Linux. Windows is a non-blocking job until it's shown to work, and stays
  covered by the local gate and the hand pass.
- The keynav checker mod uses the same mechanism and also runs against whistle's own
  `keynav.js`.
