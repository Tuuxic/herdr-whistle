// whistle-ui's core (mods/whistle-ui/ui.js), fed published values and a world, never whistle's
// core: the bar it draws, the events it flashes, the hints box it opens, docks and closes, and
// the commands its settings run. The contract examples tie the two mods together.

import { suite } from "./harness.js";
import { ui, command, mappingsCommand, keepCommand, FLASH_MS } from "./ui/ui.js";
import * as read from "./ui/read.js";
import texts from "./texts.js";
import { VERSION } from "./version.js";

const term = (id) => ({ id, type: "block", content: { tab: "active", pane: {} } });
const uiBlock = (id, props, hidden) => ({ id, type: "block", ...(hidden ? { hidden: true } : {}), content: { mod: "whistle-ui", ...(props ? { props } : {}) } });
const ANCHOR = { id: "whistle-anchor", type: "block", content: { mod: "whistle" } };
const CORNER = { corner: true };
// The usual layout: a terminal, whistle's anchor, a whistle-ui bar and its 0 px corner block.
const layout = ({ bar = {}, barHidden = false, extra = [] } = {}) => ({ id: "root", type: "column", children: [
  term("main"), ANCHOR, uiBlock("whistle-bar", bar, barHidden), ...extra, uiBlock("whistle-corner", CORNER)] });

const STATE = { v: 1, mode: "type", enabled: true, sequence: null, pane: null, onTerminal: false, field: null, inert: null };
const CONFIG = { v: 1, problems: [], mods: [], conflicts: [], overrides: [] };
const EVENTS = (...events) => ({ v: 1, events });
const ev = (seq, text, kind = "unmapped") => ({ seq, kind, text });
const pub = (over = {}) => ({ whistle: STATE, hints: null, events: EVENTS(), config: CONFIG, ...over });
const whistling = (over = {}) => ({ ...STATE, mode: "whistle", ...over });

// A 1000 x 600 window, the bar along its bottom, 1000 x 22; seen from the bar's copy.
const world = (over = {}) => ({
  folder: "whistle-ui", props: {}, size: { width: 1000, height: 22 }, viewport: { width: 1000, height: 600 },
  layout: layout(), focused: { pane: "p1", terminal: "t1" }, panes: [{ pane: "p1", title: "zsh" }], shared: {},
  now: 10000, last: 0, flash: null, box: null, ...over,
});
const barOf = (p, w) => ui(p, world(w)).model.bar;

const HINTS = { v: 1, keys: "w", title: "Panes", items: [{ key: "v", label: "Split right", group: false }, { key: "m", label: "Move", group: true }], exit: "Esc cancels" };
// The hints box as whistle-ui opens it: a window overlay of its own "hints" part.
const BOX = (width, height, at) => ({ openOverlay: "hints", spec: { mod: "whistle-ui", kind: "window", frame: "none", width, height,
  ...(at ? { at } : {}), props: { part: "hints", width } } });
// Two items fit on one row: 22 (title) + 18 (row) + 10.
const ONE_ROW = 50;

export default suite("whistle-ui", (t) => {
  // The bar.
  t.check("TYPE with a terminal focused: the badge and Terminal", barOf(pub(), {}), { badge: "TYPE", label: "Terminal", marker: null });
  t.check("TYPE with nothing focused: the badge alone", barOf(pub(), { focused: null }), { badge: "TYPE", label: "", marker: null });
  t.check("WHISTLE on the terminal: its pane's title",
    barOf(pub({ whistle: whistling({ pane: "p1", onTerminal: true }) }), {}), { badge: "WHISTLE", label: "Terminal · zsh", marker: null });
  t.check("WHISTLE on the terminal, a pane with no title: its program",
    barOf(pub({ whistle: whistling({ pane: "p2", onTerminal: true }) }), { panes: [{ pane: "p2", title: "", program: { name: "claude" } }] }).label, "Terminal · claude");
  t.check("WHISTLE on a keynav field: its label",
    barOf(pub({ whistle: whistling() }), { shared: { keynav: { v: 3, active: "files {}" }, "keynav.field:files {}": { v: 3, label: "Files", keys: {} } } }).label, "Files");
  t.check("WHISTLE on a keynav field with no label: its mod",
    barOf(pub({ whistle: whistling() }), { shared: { keynav: { v: 3, active: "files {}" } } }).label, "files");
  t.check("WHISTLE on a stock field: its name, from the whistle state's field and its block's mod",
    barOf(pub({ whistle: whistling({ field: "agents" }) }), { layout: layout({ extra: [{ id: "agents", type: "block", content: { mod: "agents" } }] }) }).label, "Agents");
  t.check("config problems: the marker counts them",
    barOf(pub({ config: { ...CONFIG, problems: [{ source: "layout", detail: "a" }, { source: "keys.json", detail: "b" }] } }), {}).marker, "⚠ 2");
  t.check("switched off: no badge, Whistle off",
    barOf(pub({ whistle: { ...STATE, enabled: false }, config: { ...CONFIG, problems: [{ source: "layout", detail: "a" }] } }), {}),
    { badge: null, label: "Whistle off", marker: "⚠ 1" });
  t.check("inert: why, and nothing else",
    barOf(pub({ whistle: { ...STATE, inert: { problem: "Whistle needs Herdr 0.1.15", fix: "Update Herdr" } } }), {}),
    { badge: null, label: "", marker: null, problem: "Whistle needs Herdr 0.1.15" });
  t.check("no whistle state: whistle isn't running", barOf(pub({ whistle: null, config: null, events: null }), {}),
    { badge: null, label: "Whistle isn't running", marker: null });
  t.check("a whistle state of another version: whistle isn't running", barOf(pub({ whistle: { ...STATE, v: 2 } }), {}).label, "Whistle isn't running");
  t.check("the corner block draws no bar", barOf(pub(), { props: CORNER }), null);

  // Flashes: each event once, for FLASH_MS or until the key sequence changes.
  const one = EVENTS(ev(1, "`x` is not mapped"));
  t.check("a new copy flashes none of the events already there, and handles them",
    (({ bar, last }) => ({ label: bar.label, last }))(ui(pub({ events: EVENTS(ev(3, "old"), ev(4, "older")) }), world({ last: null })).model),
    { label: "Terminal", last: 4 });
  const flashed = ui(pub({ events: one }), world()).model;
  t.check("a new event flashes its text", flashed.bar.label, "`x` is not mapped");
  t.check("the flash lasts FLASH_MS", flashed.flash.until, 10000 + FLASH_MS);
  t.check("FLASH_MS is 2 s", FLASH_MS, 2000);
  const again = ui(pub({ events: one }), world({ last: flashed.last, flash: flashed.flash, now: 11000 })).model;
  t.check("the flash stays while it lasts, the event not raised again", [again.bar.label, again.flash.until], ["`x` is not mapped", 10000 + FLASH_MS]);
  t.check("the flash goes when it ends",
    ui(pub({ events: one }), world({ last: flashed.last, flash: flashed.flash, now: 10000 + FLASH_MS })).model.bar.label, "Terminal");
  t.check("the flash goes when the key sequence changes",
    ui(pub({ events: one, whistle: whistling({ sequence: { keys: ["w"], group: "Panes" } }) }), world({ last: flashed.last, flash: flashed.flash, now: 10500 })).model.bar.label, "");
  const several = ui(pub({ events: EVENTS(ev(1, "a"), ev(2, "b"), ev(3, "c")) }), world({ last: 1 })).model;
  t.check("several events in one step flash together, each once", [several.bar.label, several.last], ["b · c", 3]);
  t.check("handled events don't flash again",
    ui(pub({ events: EVENTS(ev(1, "a"), ev(2, "b"), ev(3, "c")) }), world({ last: 3, now: 20000 })).model.bar.label, "Terminal");
  t.check("seqs gone back (whistle started again): every event in the feed is new",
    ui(pub({ events: EVENTS(ev(1, "again")) }), world({ last: 7 })).model.bar.label, "again");
  t.check("switched off, the flash shows instead of Whistle off",
    ui(pub({ whistle: { ...STATE, enabled: false }, events: one }), world()).model.bar.label, "`x` is not mapped");

  // The hints box: the first shown bar docks it on itself, the corner block takes it with no bar shown.
  const inSeq = (over = {}) => pub({ whistle: whistling({ sequence: { keys: ["w"], group: "Panes" } }), hints: HINTS, ...over });
  const opened = ui(inSeq(), world());
  t.check("a shown bar opens the hints docked on top of itself, as wide as it",
    opened.effects, [BOX(1000, ONE_ROW, { x: 0, y: 600 - 22 - ONE_ROW - 6 })]);
  t.check("the same hints again: nothing to do", ui(inSeq(), world({ box: opened.model.box })).effects, []);
  t.check("the bar's place props dock the box",
    ui(inSeq(), world({ props: { hintsAlignRight: 100, hintsAlignBorder: 1, hintsGap: 2 }, size: { width: 800, height: 22 },
      layout: layout({ bar: { hintsAlignRight: 100, hintsAlignBorder: 1, hintsGap: 2 } }) })).effects,
    [BOX(802, ONE_ROW, { x: 1000 - 100 - 802, y: 600 - 24 - ONE_ROW - 2 })]);
  t.check("the bar resized: the box moves", ui(inSeq(), world({ box: opened.model.box, size: { width: 600, height: 22 } })).effects,
    [BOX(600, ONE_ROW, { x: 400, y: 600 - 22 - ONE_ROW - 6 })]);
  t.check("hints gone (null): the box closes", ui(pub({ whistle: whistling() }), world({ box: opened.model.box })).effects, [{ closeOverlay: "hints" }]);
  t.check("a new copy with no hints closes a box an earlier copy may have left", ui(pub(), world({ box: undefined })).effects, [{ closeOverlay: "hints" }]);
  t.check("no box and no hints: nothing to do", ui(pub(), world()).effects, []);
  t.check("hints in TYPE (left from before): no box", ui(pub({ hints: HINTS }), world()).effects, []);
  t.check("inert: no box", ui(inSeq({ whistle: { ...whistling(), inert: { problem: "p", fix: "f" } } }), world()).effects, []);
  t.check("a second shown bar opens nothing",
    ui(inSeq(), world({ props: { hintsGap: 3 }, layout: layout({ extra: [uiBlock("bar-2", { hintsGap: 3 })] }) })).effects, []);
  t.check("the corner block opens nothing while a bar shows", ui(inSeq(), world({ props: CORNER })).effects, []);
  const corner = (over) => world({ props: CORNER, size: { width: 1000, height: 0 }, layout: layout({ barHidden: true }), ...over });
  t.check("no bar shown: the corner block opens the box at the window's bottom right, 480 px wide, 6 px in",
    ui(inSeq(), corner()).effects, [BOX(480, ONE_ROW, { x: 1000 - 6 - 480, y: 600 - 6 - ONE_ROW })]);
  t.check("no bar shown, a narrow window: the window's width less 12 px",
    ui(inSeq(), corner({ viewport: { width: 300, height: 600 } })).effects, [BOX(288, ONE_ROW, { x: 6, y: 600 - 6 - ONE_ROW })]);
  t.check("hints: false on the bar: no box", ui(inSeq(), world({ props: { hints: false }, layout: layout({ bar: { hints: false } }) })).effects, []);
  t.check("hints: false, a box left open closes",
    ui(inSeq(), world({ props: { hints: false }, layout: layout({ bar: { hints: false } }), box: opened.model.box })).effects, [{ closeOverlay: "hints" }]);
  t.check("hints: false on the corner block: no box with no bar shown",
    ui(inSeq(), corner({ props: { corner: true, hints: false }, layout: { id: "root", type: "column", children: [term("main"), ANCHOR,
      uiBlock("whistle-bar", {}, true), uiBlock("whistle-corner", { corner: true, hints: false })] } })).effects, []);

  // The settings: whistle-ui.settings, and the commands the dialog runs.
  const SETTINGS = { openOverlay: "settings", spec: { mod: "whistle-ui", kind: "dialog", width: 640, height: 0.8, props: { part: "settings" } } };
  t.check("settings: back to TYPE, then the dialog", command("settings", pub({ whistle: whistling() }), world()),
    [{ run: "whistle.mode:type" }, SETTINGS]);
  t.check("settings with whistle not running: the dialog alone", command("settings", pub({ whistle: null }), world()), [SETTINGS]);
  t.check("settings: only the copy that shows the hints opens it", command("settings", pub(), world({ props: CORNER })), []);
  t.check("settings with no bar shown: the corner block opens it", command("settings", pub(), world({ props: CORNER, layout: layout({ barHidden: true }) })),
    [{ run: "whistle.mode:type" }, SETTINGS]);
  t.check("a command whistle-ui doesn't know: nothing", command("nope", pub(), world()), []);
  t.check("switching a mod off", mappingsCommand("claude-hints", false), "whistle.mappings-off:claude-hints");
  t.check("switching a mod on", mappingsCommand("claude-hints", true), "whistle.mappings-on:claude-hints");
  t.check("keeping a mod's mapping: one JSON argument", keepCommand("claude-hints", ["g", "q"]), 'whistle.keep-mapping:{"mod":"claude-hints","keys":["g","q"]}');

  // The contract page's examples (`json ui-example <name>`) run through whistle-ui's core.
  const page = "docs/contracts/whistle-ui.md";
  const found = [...String(texts[page] ?? "").replace(/\r\n/g, "\n").matchAll(/^```[ \t]*json[ \t]+ui-example[ \t]+([^\n`]*?)[ \t]*\n([\s\S]*?)^```[ \t]*$/gm)];
  t.check(`${page} has examples`, found.length > 0, true);
  const DEFAULTS = { folder: "whistle-ui", props: {}, size: null, viewport: null, focused: null, panes: [], shared: {}, now: 0, last: 0, flash: null, box: null,
    layout: { id: "root", type: "column", children: [uiBlock("whistle-bar", {}), uiBlock("whistle-corner", CORNER)] } };
  for (const [, name, body] of found) {
    let x;
    try { x = JSON.parse(body); } catch (e) { t.fail(`${page}: ${name}`, `doesn't parse: ${e?.message ?? e}`); continue; }
    const w = { ...DEFAULTS, ...(x.world ?? {}) };
    if (x.command !== undefined) { t.check(`${page}: ${name}`, command(x.command, x.published ?? {}, w), x.effects); continue; }
    const out = ui(x.published ?? {}, w);
    if ("bar" in x) t.check(`${page}: ${name} (bar)`, out.model.bar, x.bar);
    if ("effects" in x) t.check(`${page}: ${name} (effects)`, out.effects, x.effects);
  }

  // whistle-ui is a client: a pure core reading whistle's wire formats as whistle.js does.
  const whistleJs = texts["mods/whistle/whistle.js"] ?? "";
  const readSource = texts["mods/whistle-ui/read.js"] ?? "";
  const copied = [...readSource.matchAll(/^export (?:function|const) (\w+)[\s\S]*?^}$/gm)];
  t.check("read.js copies whistle.js's readers", copied.map((m) => m[1]), ["readState", "hintsOf", "eventsSince", "configOf"]);
  for (const m of copied) t.check(`read.js's ${m[1]} is whistle.js's, word for word`, whistleJs.replace(/\r\n/g, "\n").includes(m[0].replace(/\r\n/g, "\n")), true);
  t.check("the readers are there", typeof read.eventsSince, "function");
  for (const [path, text] of Object.entries(texts).filter(([p]) => p.startsWith("mods/whistle-ui/") && p.endsWith(".js"))) {
    const from = [...text.matchAll(/\bimport\b[^;]*?["']([^"']+)["']/g)].map((m) => m[1]);
    t.check(`${path} imports only whistle-ui's core`, from.filter((m) => !m.startsWith("./")), []);
  }
  let mod = null, keys = null;
  try { mod = JSON.parse(texts["mods/whistle-ui/mod.json"]); keys = JSON.parse(texts["mods/whistle-ui/keys.json"]); } catch (e) { t.fail("whistle-ui's mod.json and keys.json parse", String(e?.message ?? e)); }
  t.check("whistle-ui ships with whistle's version", mod?.version, VERSION);
  t.check("whistle-ui's keys.json binds alt-, to its settings", keys?.global?.["alt-,"], "whistle-ui.settings");
});
