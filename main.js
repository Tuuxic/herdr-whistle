// Whistle: keyboard modes for Herdr (an idea borrowed from vim), and the status bar that
// shows them.
//
// TYPE: the keyboard is in a terminal (or anywhere else); this mod stays out of the way.
// WHISTLE: this mod holds the keyboard. ctrl-h/j/k/l pick the field in that direction; h/j/k/l,
// arrows and enter act inside it; i types in the selected pane. ctrl-space switches between
// the two, ctrl-[ in a terminal enters WHISTLE (keys.json). Clicking elsewhere ends WHISTLE.
//
// Fields (the keynav protocol, keynav.js): the terminal is built in (h/j/k/l move between split
// panes). Any other block is a field once its mod announces itself in shared("keynav.fields");
// whistle names the active one in shared("keynav") and sends that mod "keynav-<move>"
// commands, and the mod keeps its own cursor. No mod is known by name. The field in a
// direction comes from the layout's rows and columns, entering a group at the field used last
// (else its terminal, else its first). This block's "nav" prop overrides that:
// { "<block id>": { "l": "<block id>" } }.
//
// Mappings (config.js: defaults < the layout's "mappings" prop < ~/.config/herdr-app/whistle.json):
// in WHISTLE a key from the map runs a command or starts a group whose keys follow (w v);
// groups nest, and the leader is just the group on space. Mapped keys win over the built-in
// ones above. The pending keys and their choices go to shared("whistle.leader"), listed by
// this mod's "hints" copy (hints.js, a window above the bar) unless "hints" is false.
// "enabled": false (whistle.json, else the whistle block's props) turns WHISTLE off: ctrl-space and ctrl-[ then go to the terminal (through
// hc) and the status bar shows no mode. Settings: this mod's "settings" copy (settings.js).

import { View, div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { panes, focused, run, theme, shared, setShared, nextCommand, layout, props, readTextFile, commands, exec, openOverlay, closeOverlay } from "herdr";
import { fieldKey } from "./keynav.js";
import { load, setUser, USER_FILE, isGroup } from "./config.js";
import { renderHints, hintsSize } from "./hints.js";
import { renderSettings } from "./settings.js";

const KEY = "keynav";
const SELF = "whistle.";
const TERMINAL = "terminal";

function find(node, id) {
  if (node?.id === id) return node;
  for (const child of node?.children ?? []) {
    const found = find(child, id);
    if (found) return found;
  }
  return null;
}

// One look at the layout: each node by id and each node's parent.
function index() {
  const nodes = new Map(), parent = new Map();
  const walk = (n, p) => {
    if (!n) return;
    if (n.id) nodes.set(n.id, n);
    parent.set(n, p);
    for (const c of n.children ?? []) walk(c, n);
  };
  walk(layout(), null);
  return { nodes, parent };
}
const stackActive = (s) => s.active ?? s.children?.[0]?.id;
// The children that show: not hidden, and only the selected one of a stack.
const kids = (n) => (n.children ?? []).filter((c) => !c.hidden && (n.type !== "stack" || c.id === stackActive(n)));
function shows(idx, id) {
  for (let n = idx.nodes.get(id); n; n = idx.parent.get(n)) {
    const p = idx.parent.get(n);
    if (n.hidden || (p?.type === "stack" && stackActive(p) !== n.id)) return false;
  }
  return Boolean(idx.nodes.get(id));
}
function inside(idx, node, id) {
  for (let n = idx.nodes.get(id); n; n = idx.parent.get(n)) if (n === node) return true;
  return false;
}
// What layout.hide should hide to take a block away: climb while the parent shows nothing else.
function hideTarget(idx, id) {
  let n = idx.nodes.get(id);
  for (let p = idx.parent.get(n); p && idx.parent.get(p) && (p.type === "stack" || kids(p).length <= 1); p = idx.parent.get(n)) n = p;
  return n?.id;
}

// A key's name as mappings.json spells it: the character it types ("?", "+"), else its name.
// With ctrl/alt/super held it's the key's name with those in front, as keys.json spells them
// ("ctrl-n"); shift only shows on named keys ("shift-tab"), a character already carries it.
const keyName = (e) => {
  const m = e.modifiers ?? {}, c = e.key_char;
  const held = [m.control && "ctrl", m.alt && "alt", m.platform && "super"].filter(Boolean);
  if (!held.length && (c === " " || e.key === "space")) return "space";
  if (!held.length && c && c.length === 1 && c.trim()) return c;
  return [...held, ...(m.shift && e.key.length > 1 ? ["shift"] : []), e.key].join("-");
};
const show = (k) => (k === "space" ? "SPC" : k);
// The choices at one level, commands before groups, each sorted by key.
const choices = (map) => Object.entries(map ?? {})
  .map(([key, v]) => ({ key, label: isGroup(v) ? v.name ?? key : Array.isArray(v) ? v[0] : "?", group: Boolean(isGroup(v)) }))
  .sort((a, b) => a.group - b.group || a.key.localeCompare(b.key));
// A field's keys, sent on as keynav moves.
const MOVES = { j: "down", down: "down", k: "up", up: "up", h: "left", left: "left", l: "right", right: "right", enter: "open" };

// The layout's whistle bars: its blocks of this mod (not the hints or settings copies), each
// named by its "bar" prop. A layout with more than one lets whistle's settings pick where the
// bar goes; the others stay hidden.
function bars(node = layout(), out = []) {
  const c = node?.content;
  if (node?.type === "block" && c?.mod === "whistle" && !c.props?.part)
    out.push({ id: node.id, hidden: Boolean(node.hidden), name: c.props?.bar ?? null, props: c.props ?? {} });
  for (const child of node?.children ?? []) bars(child, out);
  return out;
}

// Shows the bar named name and hides the others.
function switchBar(name) {
  const all = bars(), to = all.find((b) => b.name === name);
  if (!to) return;
  if (to.hidden) run("layout.show", { id: to.id });
  for (const b of all) if (b !== to && !b.hidden) run("layout.hide", { id: b.id });
}

export default class Whistle extends View {
  init(_props, cx) {
    // The key hints window: draws shared("whistle.leader") and nothing else.
    if (props()?.part === "hints") { this.hintsPart = true; return; }
    // The settings dialog.
    if (props()?.part === "settings") {
      this.settingsPart = true;
      const reload = () => load(props()?.mappings, props()).then((c) => { this.conf = c; cx.notify(); });
      this.set = (key, value) => {
        if (key === "bar") switchBar(value);
        return setUser(key, value).then(reload);
      };
      reload();
      return;
    }
    this.handle = cx.focus_handle();
    this.pending = null;
    setShared("whistle.leader", null);
    this.loadLeader().then(() => cx.notify());
    // whistle.json is outside this folder, so saving it doesn't reload the mod: look now and then.
    cx.timer.every(2000, (cx) => {
      if (!this.live()) return;
      readTextFile(USER_FILE()).then((text) => { if (text !== this.userText) this.loadLeader().then(() => cx.notify()); });
    });
    this.mode = "type";
    this.field = null; // the selected field's block id
    this.recent = []; // block ids, the field used last first
    this.sel = { pane: null }; // the terminal field's pane
    this.seenRequest = Date.now();
    this.publish();
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        // "on" / "off": switch whistle mode from outside (another mod's settings), into whistle.json.
        if (c === "on" || c === "off") {
          if (c === "off" && this.mode === "whistle") { this.endLeader(); this.type(); }
          await setUser("enabled", c === "on");
          await this.loadLeader();
          cx.notify();
          continue;
        }
        // Settings, on or off (off, that's where it's turned back on).
        if (c === "settings") { if (this.mode === "whistle") { this.endLeader(); this.type(); } this.openSettings(); continue; }
        if (!this.enabledOn()) {
          if (c === "enter") this.passThrough("esc");
          else if (c === "whistle") this.passThrough("ctrl+space");
          continue;
        }
        if (c === "whistle") this.mode === "whistle" ? (this.endLeader(), this.type()) : this.whistle();
        else if (c === "focus") this.whistle(this.field);
        // "enter" (ctrl-[ in a terminal): into WHISTLE, never out; in WHISTLE it only cancels a sequence.
        else if (c === "enter") this.mode === "whistle" ? this.endLeader() : this.whistle();
        else if (c === "type") this.type();
        else if (c in DIRS) this.move(DIRS[c]);
        // "key-j", "key-enter", ...: the same as pressing it in WHISTLE (scripts, tests).
        else if (c.startsWith("key-") && this.mode === "whistle") {
          // "key-ctrl-n": modifiers in front, as in keys.json.
          const parts = c.slice(4).split(/-(?=.)/), key = parts.pop();
          const modifiers = { control: parts.includes("ctrl"), alt: parts.includes("alt"), platform: parts.includes("super"), shift: parts.includes("shift") };
          this.key({ key, key_char: parts.length ? undefined : key, modifiers });
        }
        this.publish();
        cx.notify();
      }
    });
    // A click anywhere else takes the keyboard: that ends WHISTLE.
    cx.timer.every(120, (cx) => {
      // A layout's other bar is the one shown: this copy rests until it shows again.
      if (!this.live()) return;
      const on = this.handle.is_focused();
      this.requests();
      // A field shown just now: its mod announces itself once it has loaded.
      if (this.waitFor) {
        if (this.mode === "whistle" && this.enter(this.waitFor.block)) { this.waitFor = null; this.publish(); cx.notify(); }
        else if (Date.now() > this.waitFor.until) this.waitFor = null;
      }
      // After a "type" mapping: still holding the keyboard means its terminal hasn't taken it yet.
      if (on && this.mode === "type" && this.releaseUntil) {
        if (Date.now() < this.releaseUntil) return;
        this.releaseUntil = 0;
        const pane = focused()?.pane;
        if (pane) { run("pane.focus", { pane }); return; }
      }
      // Just after a command (hold): the pane or terminal it focused may take the keyboard late.
      if (!on && this.mode === "whistle" && Date.now() < (this.holdUntil ?? 0)) {
        if (this.active() === TERMINAL) this.sel.pane = focused()?.pane ?? this.sel.pane;
        this.handle.focus();
        this.publish();
        cx.notify();
        return;
      }
      if (on !== (this.mode === "whistle")) {
        this.mode = on ? "whistle" : "type";
        if (!on) this.endLeader();
        this.publish();
        cx.notify();
      }
    });
  }

  // What a field's mod asked for: { to: "terminal" } after it focused one, { hold: true } after
  // it moved the keyboard somewhere (another space) and WHISTLE should keep it.
  requests() {
    const r = shared("keynav.request");
    if (!r || !(r.at > this.seenRequest)) return;
    this.seenRequest = r.at;
    if (this.mode !== "whistle") return;
    if (r.to === TERMINAL) {
      this.sel.pane = focused()?.pane ?? this.sel.pane;
      this.enter(this.terminalBlock());
    }
    this.hold();
    this.publish();
  }

  // The selected field's keynav key (only while in WHISTLE), and the terminal field's pane.
  publish() {
    const v = { v: 1, active: this.mode === "whistle" ? this.active() : null, pane: this.sel.pane };
    const cur = shared(KEY);
    if (!cur || cur.active !== v.active || cur.pane !== v.pane) setShared(KEY, v);
  }

  // Every field that shows: { block, key, label, mod }, in layout order.
  fields(idx = index()) {
    const told = shared("keynav.fields") ?? {};
    const out = [];
    for (const [id, n] of idx.nodes) {
      const c = n.content;
      if (!c || !shows(idx, id)) continue;
      if (c.pane) out.push({ block: id, key: TERMINAL, label: "Terminal" });
      else if (c.mod) {
        const key = fieldKey(c.mod, c.props);
        if (told[key]?.v === 1) out.push({ block: id, key, label: told[key].label, mod: c.mod });
      }
    }
    return out;
  }
  current() { return this.field ? this.fields().find((f) => f.block === this.field) ?? null : null; }
  active() { return this.current()?.key ?? null; }
  terminalBlock() { return this.fields().find((f) => f.key === TERMINAL)?.block ?? null; }

  // Selects a field by its block id, or the field to enter in a group of blocks (a stack, a
  // column); false if none shows (or its mod hasn't announced yet).
  enter(block) {
    if (!block) return false;
    const idx = index();
    const all = this.fields(idx);
    const node = idx.nodes.get(block);
    const there = node ? all.filter((x) => inside(idx, node, x.block)) : [];
    const f = all.find((x) => x.block === block) ?? (there.length ? this.pick(there) : null);
    if (!f) return false;
    this.field = f.block;
    this.recent = [f.block, ...this.recent.filter((b) => b !== f.block)].slice(0, 20);
    if (f.key === TERMINAL) this.sel.pane = focused()?.pane ?? this.sel.pane;
    return true;
  }

  // The field in a direction (h/j/k/l): a "nav" prop, else the layout's rows and columns.
  neighbour(k) {
    const idx = index();
    const all = this.fields(idx);
    const over = props()?.nav?.[this.field]?.[k];
    if (over) return all.find((f) => f.block === over) ?? null;
    const axis = "hl".includes(k) ? "row" : "column", d = "lj".includes(k) ? 1 : -1;
    for (let n = idx.nodes.get(this.field); n; n = idx.parent.get(n)) {
      const p = idx.parent.get(n);
      if (p?.type !== axis) continue;
      const list = kids(p);
      for (let i = list.indexOf(n) + d; i >= 0 && i < list.length; i += d) {
        const there = all.filter((f) => inside(idx, list[i], f.block));
        if (there.length) return this.pick(there);
      }
    }
    return null;
  }
  pick(list) {
    for (const b of this.recent) { const f = list.find((x) => x.block === b); if (f) return f; }
    return list.find((f) => f.key === TERMINAL) ?? list[0];
  }

  // ctrl-space: WHISTLE on the given field, else the terminal pane the keyboard just left.
  whistle(block) {
    this.sel.pane = focused()?.pane ?? this.sel.pane;
    if (!this.enter(block)) this.enter(this.terminalBlock());
    this.mode = "whistle";
    this.handle.focus();
    this.publish();
  }

  type() {
    const pane = (this.active() === TERMINAL && this.sel.pane) || focused()?.pane;
    this.mode = "type";
    this.publish();
    if (pane) run("pane.focus", { pane });
  }

  // ctrl-h/j/k/l: the field in that direction.
  move(d) {
    const next = this.neighbour(d);
    if (next) this.enter(next.block);
    this.publish();
  }

  // Keeps the keyboard here after a command that moved it.
  // The keyboard can come back late from the pane or terminal the command focused: the focus
  // timer takes it back again for a moment (holdUntil).
  hold() {
    this.holdUntil = Date.now() + 600;
    this.handle.focus();
  }

  // h/j/k/l over split panes: let pane.go find the neighbour, then take the keyboard back.
  paneGo(direction) {
    const from = this.sel.pane ?? focused()?.pane;
    if (from) run("pane.focus", { pane: from });
    run("pane.go", { direction });
    this.sel.pane = focused()?.pane ?? from;
    this.hold();
  }

  // Shows a block: selects it in its stacks and unhides what hides it.
  showBlock(id) {
    const idx = index();
    for (let n = idx.nodes.get(id); n; n = idx.parent.get(n)) {
      const p = idx.parent.get(n);
      if (p?.type === "stack" && stackActive(p) !== n.id) run("layout.select", { stack: p.id, child: n.id });
      if (n.hidden) run("layout.show", { id: n.id });
    }
  }

  // This copy's props over those of the layout's first bar with mappings: a second bar
  // ({ bar: "Under the terminals" }) needn't repeat the mappings and settings.
  layoutProps() {
    const base = bars().find((b) => b.props.mappings)?.props ?? {};
    return { ...base, ...(props() ?? {}) };
  }

  // This copy's block among the layout's bars (none: a docked or opened copy).
  mine() {
    return bars().find((b) => b.name === (props()?.bar ?? null)) ?? null;
  }

  live() {
    return !this.mine()?.hidden;
  }

  async loadLeader() {
    const lp = this.layoutProps();
    const c = await load(lp.mappings, lp);
    this.leaderConf = c;
    this.leaderErr = c.error;
    this.userText = c.userText;
    // "bar" in whistle.json names another of the layout's bars: show that one instead.
    const me = this.mine();
    if (c.bar != null && me && !me.hidden && me.name !== c.bar && bars().some((b) => b.name === c.bar)) {
      if (this.mode === "whistle") { this.endLeader(); this.type(); }
      switchBar(c.bar);
    }
    // For other mods' settings: whether whistle mode is on (see the "on" / "off" commands).
    if (!props()?.part && shared("whistle.enabled") !== this.enabledOn()) setShared("whistle.enabled", this.enabledOn());
  }

  hintsOn() { return this.leaderConf?.hints !== false; }
  // "enabled": false (whistle's settings) turns WHISTLE off; its keys go to the terminal instead.
  enabledOn() { return this.leaderConf?.enabled !== false; }

  openSettings() {
    const lp = this.layoutProps();
    openOverlay({ mod: "whistle", kind: "dialog", width: 640, height: 0.8, props: { part: "settings", mappings: lp.mappings ?? null, enabled: lp.enabled ?? null, hints: lp.hints ?? null } });
  }

  // Off: the key that would have entered WHISTLE, typed into the focused terminal.
  passThrough(key) {
    const term = focused()?.terminal;
    if (term) exec("hc", ["keys", term, key]).catch(() => {});
  }

  // Publishes the pending sequence; the hints window shows while one is pending.
  showLeader() {
    const p = this.pending;
    const v = p ? { keys: p.path.map(show).join(" "), title: p.title, items: choices(p.node) } : null;
    setShared("whistle.leader", v);
    if (!v || !this.hintsOn()) {
      if (this.hintsId) closeOverlay(this.hintsId);
      this.hintsId = null;
      this.hintsAt = null;
      return;
    }
    // Bottom left, just above this bar; reopened only when its size or spot changes.
    const vp = globalThis.window?.viewport_size?.();
    const maxWidth = Math.max(300, (vp?.width ?? this.barW ?? 900) - 16);
    const { width, height } = hintsSize(v.items.length, maxWidth);
    // The bar reaches the window's right edge, so its left edge is the window's width less its own.
    const left = vp && this.barW ? Math.max(0, vp.width - this.barW) : 0;
    // "hintsLift" (px, default 6): the gap above the bar; more when a border or padding sits below it.
    const lift = Number(props()?.hintsLift ?? 6);
    const at = vp ? { x: left + 8, y: Math.max(8, vp.height - (this.barH ?? 22) - height - lift) } : undefined;
    const spot = JSON.stringify([width, height, at]);
    if (this.hintsId && this.hintsAt === spot) return;
    if (this.hintsId) closeOverlay(this.hintsId);
    this.hintsAt = spot;
    this.hintsId = openOverlay({ mod: "whistle", kind: "window", frame: "none", width, height, at, props: { part: "hints", maxWidth } });
  }

  // A first key from the map: run it, or wait for the rest of its group.
  startMapping(name, v) {
    this.flash = null;
    if (!isGroup(v)) return this.runEntry(v);
    this.pending = { path: [name], node: v.map, title: v.name ?? name };
    this.showLeader();
  }

  endLeader() {
    if (!this.pending && shared("whistle.leader") == null) return;
    this.pending = null;
    this.showLeader();
  }

  leaderKey(e, name) {
    const p = this.pending;
    if (name === "escape" || name === "ctrl-[") return this.endLeader();
    if (name === "backspace") {
      if (p.path.length <= 1) return this.endLeader();
      p.path.pop();
      let node = this.leaderConf.map, title = "";
      for (const k of p.path) { title = node[k].name ?? k; node = node[k].map; }
      p.node = node; p.title = title;
      return this.showLeader();
    }
    const v = p.node?.[name];
    if (isGroup(v)) { p.path.push(name); p.node = v.map; p.title = v.name ?? name; return this.showLeader(); }
    const keys = [...p.path, name].map(show).join(" ");
    this.endLeader();
    if (!Array.isArray(v)) { this.flash = `${keys} is not mapped`; return; }
    this.flash = null;
    this.runEntry(v);
  }

  // [label, "command" | "command:value", args?, "type"?]
  runEntry([, cmd, args, then]) {
    if (typeof cmd !== "string") return;
    if (cmd.startsWith(SELF)) return this.internal(cmd.slice(SELF.length));
    let name = cmd, a = args ?? {};
    const colon = cmd.indexOf(":");
    if (colon > 0 && !args) {
      name = cmd.slice(0, colon);
      const first = commands().find((c) => c.name === name)?.args?.[0]?.name;
      if (first) a = { [first]: cmd.slice(colon + 1) };
    }
    // Pane and terminal commands act on the pane WHISTLE has selected.
    if (/^(pane|terminal)\./.test(name) && this.sel.pane) run("pane.focus", { pane: this.sel.pane });
    run(name, a);
    // Dialogs and prompts take the keyboard; everything else comes back to WHISTLE.
    if (/^(mod\.open|app\.)/.test(name) || /rename/.test(name)) return;
    this.sel.pane = focused()?.pane ?? this.sel.pane;
    // A 4th item "type": end in TYPE and let the terminal the command opened take the keyboard
    // (the focus timer waits a moment for it, then hands it over itself).
    if (then === "type") {
      this.endLeader();
      this.mode = "type";
      this.releaseUntil = Date.now() + 1000;
      return this.publish();
    }
    this.hold();
  }

  // field:<block>: select that field. focus:<block>: show it and select it. toggle:<block>: show
  // it, or take it away if it shows (a field inside moves on to the terminal).
  internal(c) {
    const i = c.indexOf(":"), verb = i < 0 ? c : c.slice(0, i), block = i < 0 ? "" : c.slice(i + 1);
    const idx = index();
    if (verb === "settings") this.openSettings();
    else if (verb === "field") {
      if (this.enter(block)) this.hold();
      else this.flash = `${block} can't be selected now`;
    } else if (verb === "focus" || verb === "toggle") {
      if (!idx.nodes.get(block)) { this.flash = `No ${block} in this layout`; return; }
      const target = hideTarget(idx, block);
      const near = this.field && inside(idx, idx.nodes.get(target), this.field);
      if (verb === "toggle" && shows(idx, block)) {
        run("layout.hide", { id: target });
        if (near) this.enter(this.terminalBlock());
      } else {
        this.showBlock(block);
        // Selected when asked, or when the selection sat in what now shows another block.
        if (verb === "focus" || near) {
          if (!this.enter(block)) this.waitFor = { block, until: Date.now() + 1500 };
        }
      }
      this.hold();
    }
  }

  key(e) {
    const k = e.key, m = e.modifiers ?? {};
    const name = keyName(e);
    if (this.pending) return this.leaderKey(e, name), true;
    const mapped = this.leaderConf?.map?.[name];
    if (mapped) return this.startMapping(name, mapped), true;
    if (this.leaderErr && name === "space") return (this.flash = this.leaderErr), true;
    this.flash = null;
    if (m.control && !m.alt && "hjkl".includes(k) && k.length === 1) return this.move(k), true;
    if (m.control || m.alt || m.platform) return false;
    if (k === "i") return this.type(), true;
    let f = this.current();
    // The selected field went away (a panel closed by mouse): back to the terminal.
    if (!f) { this.enter(this.terminalBlock()); f = this.current(); }
    if (!f) return false;
    if (f.key === TERMINAL) {
      const dir = { h: "left", j: "down", k: "up", l: "right", left: "left", down: "down", up: "up", right: "right" }[k];
      if (dir) this.paneGo(dir);
      else if (k === "enter") this.type();
      else return false;
      return true;
    }
    const c = e.key_char;
    const mv = MOVES[k] ?? (c && c.length === 1 && c.trim() ? `key-${c}` : null);
    if (!mv) return false;
    run(`${f.mod}.keynav-${mv}`);
    return true;
  }

  label() {
    if (this.mode === "type") return focused()?.pane ? "Terminal" : "";
    const f = this.current();
    if (f?.key === TERMINAL) {
      const p = panes().find((x) => x.pane === this.sel.pane);
      return p ? `Terminal · ${(p.title || p.program?.name || "").slice(0, 40)}` : "Terminal";
    }
    return f?.label ?? "";
  }

  // The pending keys and their group (the popup, when on, lists the choices).
  leaderLine(t) {
    const v = shared("whistle.leader");
    return h_flex().flex_1().min_w(0).gap(12).items_center().overflow_hidden()
      .child(div().flex_none().font_bold().text_color(t.accent).child(v.keys))
      .child(div().flex_none().text_color(t.foreground).child(v.title));
  }

  render(cx) {
    if (this.hintsPart) return renderHints(props()?.maxWidth ?? 900);
    if (this.settingsPart) {
      const all = bars().filter((b) => b.name);
      const place = all.length > 1 ? {
        names: all.map((b) => b.name), current: all.find((b) => !b.hidden)?.name ?? null,
        open: Boolean(this.barOpen), setOpen: (v) => { this.barOpen = v; cx.notify(); },
      } : null;
      return renderSettings(this.conf, this.set, place);
    }
    const t = theme();
    const on = this.mode === "whistle";
    return h_flex()
      .id("whistle")
      .track_focus(this.handle)
      .size_full()
      .bg(t.chrome)
      .items_center()
      .gap(10)
      .text_size(11.5)
      .on_size_change((size) => { this.barW = size.width; this.barH = size.height; })
      .on_key_down((e, cx) => {
        if (this.mode !== "whistle") return;
        if (this.key(e)) { this.publish(); cx.stop_propagation(); cx.notify(); }
      })
      .when(!this.enabledOn(), (el) => el.pl(10))
      // The mode badge; a click opens whistle's settings.
      .when(this.enabledOn(), (el) => el.child(h_flex().id("whistle-mode").h_full().px(10).flex_none().items_center().font_bold().cursor_pointer()
        .bg(on ? t.accent : t.done).text_color(t.background).tooltip("Whistle settings")
        .on_click(() => this.openSettings())
        .child(on ? "WHISTLE" : "TYPE")))
      .child(shared("whistle.leader") ? this.leaderLine(t)
        : div().flex_1().min_w(0).truncate().text_color(this.flash ? t.blocked : t.muted).child(this.flash ?? this.label()));
  }
}

const DIRS = { left: "h", down: "j", up: "k", right: "l" };
