// Inert (ADR 0002): whistle loaded but standing aside, because it can't run safely. Pure: it
// reads only the world it is given.
//
//   - Herdr too old: world.herdr (updates().app.version) is older than MIN_HERDR, or unknown.
//   - Another copy runs: every copy announces its folder in shared("whistle.copies")
//     (world.copies, { "<folder>": version }); of the copies in the shown layout (and this one),
//     the one in mods/whistle/ runs, else the first folder by name. The others are inert.
//   - Twins: whistle blocks with the same props (block.js), so no copy can tell which runs.
//
// The shell passes world.folder, this copy's folder, from HOME in version.js: a path the
// renaming in Herdr's add procedure rewrites.

import { MIN_HERDR, FOLDER } from "./version.js";
import { eachNode } from "./fields.js";
import { twinsProblem } from "./block.js";

// The private shared key copies announce themselves under.
export const COPIES = "whistle.copies";

// "mods/whistle/" -> "whistle".
export const folderOf = (home) => String(home).replace(/\\/g, "/").replace(/\/+$/, "").split("/").pop();

const parts = (v) => /^(\d+)\.(\d+)\.(\d+)/.exec(String(v ?? ""))?.slice(1).map(Number) ?? null;

// Whether version a is older than b (x.y.z; anything after is ignored). An unreadable a is.
export function older(a, b) {
  const x = parts(a), y = parts(b);
  if (!x) return true;
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] < y[i];
  return false;
}

// The mods in the layout.
function modsIn(layout) {
  const out = new Set();
  eachNode(layout, (n) => { if (n.content?.mod) out.add(n.content.mod); });
  return out;
}

// The folder of the copy that runs: of this one and the announced copies in the layout,
// mods/whistle/, else the first by name.
export function runningCopy(world) {
  const shown = modsIn(world.layout);
  const live = Object.keys(world.copies ?? {}).filter((f) => shown.has(f));
  const all = [...new Set([world.folder, ...live])].sort();
  return all.includes(FOLDER) ? FOLDER : all[0];
}

// Why whistle is inert in this world: null, or { reason: "herdr" | "copy" | "twins", problem:
// text, fix: what the person can do about it }.
export function inert(world) {
  if (older(world.herdr, MIN_HERDR)) {
    const is = parts(world.herdr) ? ` (this is ${world.herdr})` : "";
    return { reason: "herdr", problem: `Whistle needs Herdr ≥ ${MIN_HERDR}${is}`, fix: "Update Herdr." };
  }
  const runs = runningCopy(world);
  if (runs !== world.folder) return { reason: "copy", problem: `Another whistle runs, from mods/${runs}/`, fix: "Delete the copies you don't want." };
  const twins = twinsProblem(world.layout, world.folder);
  return twins ? { reason: "twins", ...twins } : null;
}

// The announcement this copy makes, if the world doesn't hold it yet: the new shared value.
export function announce(world, version) {
  const copies = world.copies ?? {};
  return copies[world.folder] === version ? null : { ...copies, [world.folder]: version };
}
