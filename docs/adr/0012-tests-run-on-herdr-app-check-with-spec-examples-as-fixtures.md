# Tests run on herdr-app check, with spec examples as fixtures

Whistle's tests run only through `herdr-app check`, which loads them as a throwaway mod on
Herdr's own JS engine (QuickJS). `tests/run.sh` copies the core's modules, the spec `.md` files
and one test mod, which imports every suite, into a temp folder and checks it. Any failing case
throws, so the check fails and lists every failure. Most suites are step scenarios written as
data: a starting world and a list of steps, each with the effects or published state it should
produce. The public contracts are tested from their own specs: each spec's tagged example
blocks are read by the test mod and run through `step`, so the docs and the code can't drift
apart.

Rejected: Node's test runner, alone or alongside, even in CI only. It gives better reporting
and coverage, and Windows CI without a desktop. But it runs on V8, not QuickJS, so a green run
doesn't prove the code works in Herdr, and `herdr-app check` would still be needed for the real
mod and for the minimum Herdr version. Two harnesses would also force every suite to stay
runner-neutral. Also rejected: fixture files that the docs link to or copy, which drift, and
generating the docs from fixtures, which adds a build step.

## Consequences

- Contributors need only herdr-app. There is no per-case reporting and no coverage tool, so the
  coverage rule is that every rule the docs state has at least one named scenario.
- The core must not import `herdr`. Only the test mod reads files, using `readTextFile`, from
  its own folder, so the tests run the same on any machine or runner.
- CI depends on `check` running without a display. Linux and macOS jobs are required, falling
  back to `xvfb-run` on Linux. Windows is a non-blocking job until it's shown to work, and stays
  covered by the local gate and the hand pass.
- The keynav checker mod uses the same mechanism and also runs against whistle's own
  `keynav.js`.
