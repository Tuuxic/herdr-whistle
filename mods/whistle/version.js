// Whistle's version and the oldest Herdr it runs on (ADR 0012). mod.json repeats both for
// people and agents (a mod can't import JSON); a test fails if they drift apart. Bump them
// together with CHANGELOG.md at a release.

export const VERSION = "1.0.0-dev";
export const MIN_HERDR = "0.1.15";
