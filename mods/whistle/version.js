// Whistle's version and the oldest Herdr it runs on (ADR 0002). mod.json repeats both for
// people and agents (a mod can't import JSON); a test fails if they drift apart. Bump them
// together with CHANGELOG.md at a release.

export const VERSION = "2.0.0";
export const MIN_HERDR = "0.1.15";

// This copy's own folder, spelled as Herdr's add procedure finds it: when a name is taken it
// renames the new copy and rewrites its mods/<name>/ paths, so a renamed copy knows its name
// (inert.js: only one copy runs).
export const HOME = "mods/whistle/";
// The folder whistle ships in: the copy that runs when there are several, and the folder a
// world that doesn't say (tests) stands for.
export const FOLDER = "whistle";
