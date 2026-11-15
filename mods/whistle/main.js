// Whistle: a keyboard mode for Herdr, borrowed from vim, and the bar that shows it.
//
// This is the shell (ADR 0011). Whistle's behaviour lives in the pure core, step.js; the shell
// reads Herdr into `world`, calls step on each command, key press and tick, carries out the
// effects it returns and feeds write outcomes back. It decides nothing itself.
//
// Herdr's keys.json runs whistle's commands: "whistle" (ctrl-space: TYPE <-> WHISTLE) and
// "type" (back to TYPE). In WHISTLE the bar holds the keyboard and its key presses go to step.
// Keys whistle claims in keys.json's mod:whistle section come back as "key-<key>" commands.
// Its config comes from mappings.json (this folder) and whistle.json (Herdr's home), read on
// the same poll as keys.json; the core keeps each file's last good version.
//
// Two more copies of this mod, known by their "part" prop, draw the views and run no core: the
// hints window (part "hints") and the settings dialog (part "settings"). The bar's copy hands
// them their view models (views.js) in private shared keys (ADR 0010) and opens the hints window
// while there are hints. Settings change things by writing whistle.json through config.js; the
// bar picks the change up on its next read (ADR 0011).

import { View } from "gpui-kit";
import { layout, focused, panes, run, theme, shared, setShared, nextCommand, readTextFile, writeTextFile, appHome, openOverlay, closeOverlay, exec, props } from "herdr";
// Through the namespace, so a Herdr without them still loads whistle, which then stands aside.
import * as herdr from "herdr";
import { start, step, bar, hints, settings } from "./step.js";
import { keyName, hcKey } from "./keynames.js";
import { switchMod, keepMapping } from "./config.js";
import { renderBar } from "./bar.js";
import { renderHints, hintsSize } from "./hints.js";
import { renderSettings } from "./settings.js";
import { HOME } from "./version.js";
import { folderOf, COPIES } from "./inert.js";

const FOLDER = folderOf(HOME);
const call = (f) => { try { return f(); } catch { return null; } };

// How often the shell ticks (ms): it notices a click away and Herdr's late focus changes.
const TICK_MS = 120;
// How often the shell reads keys.json, keys.error, mappings.json and whistle.json (ms).
const KEYS_MS = 1000;

// A path the core names, relative to Herdr's home ("keys.json").
const home = (path) => `${appHome()}/${path}`;

// The private shared keys the views' models go in, and the bar's height (mod.json's size).
const HINTS = "whistle.hints", SETTINGS = "whistle.settings", BAR_H = 22;

export default class Whistle extends View {
  init(_props, cx) {
    this.part = call(() => props()?.part) ?? null;
    if (this.part) return this.initPart(cx);
    this.handle = cx.focus_handle();
    this.model = start();
    this.overlays = new Map(); // overlay name -> id
    this.keysFile = undefined; // { text, error, at }, once read
    this.configFiles = {}; // { defaults, user }: mappings.json and whistle.json, once read
    this.commands = call(() => herdr.commands()); // Herdr's commands, to check mappings against
    this.failed = []; // commands that failed when run, fed back after the effects
    cx.spawn(async (cx) => {
      for (;;) {
        await Promise.all([this.readKeys(), this.readConfig()]);
        await cx.sleep(KEYS_MS);
      }
    });
    cx.spawn(async (cx) => {
      for (;;) {
        const command = await nextCommand();
        this.feed({ command });
        cx.notify();
      }
    });
    cx.timer.every(TICK_MS, (cx) => {
      const before = this.model;
      this.feed({ tick: true });
      if (this.model !== before) cx.notify();
    });
  }

  // keys.json and keys.error as last read.
  async readKeys() {
    const [text, error] = await Promise.all([readTextFile(home("keys.json")), readTextFile(home("keys.error"))]);
    this.keysFile = { text, error, at: Date.now() };
  }

  // whistle's config files as last read (null: no file).
  async readConfig() {
    const [defaults, user] = await Promise.all([readTextFile(home(`${HOME}mappings.json`)), readTextFile(home("whistle.json"))]);
    this.configFiles = { defaults, user };
  }

  // Herdr as the core sees it.
  world() {
    return {
      now: Date.now(), layout: layout(), focused: focused(), panes: panes(), barFocused: this.handle.is_focused(),
      keys: call(() => herdr.keys()) ?? [], herdr: call(() => herdr.updates().app.version),
      folder: FOLDER, copies: shared(COPIES) ?? {},
      platform: call(() => herdr.window().platform), layoutName: shared("layout") ?? null, keysFile: this.keysFile,
      configFiles: this.configFiles, commands: this.commands, modMappings: shared("whistle.mappings") ?? {},
    };
  }

  // One input through the core: the new model, its effects carried out, the views' models
  // handed on.
  feed(input) {
    const out = step(this.model, input, this.world());
    this.model = out.model;
    for (const e of out.effects) this.carry(e);
    // A command Herdr refused goes back to the core, which flashes it.
    for (const f of this.failed.splice(0)) this.model = step(this.model, f, this.world()).model;
    this.views();
    return out;
  }

  // The hints' and settings' models, set in shared state when they change; the hints window open
  // while there are hints, docked on top of the bar and as wide as the window.
  views() {
    const world = this.world();
    const h = hints(this.model, world), s = settings(this.model, world);
    const hs = JSON.stringify(h), ss = JSON.stringify(s);
    if (ss !== this.settingsSent) { this.settingsSent = ss; setShared(SETTINGS, s); }
    if (hs === this.hintsSent) return;
    this.hintsSent = hs;
    setShared(HINTS, h);
    if (!h) {
      if (this.hintsId) closeOverlay(this.hintsId);
      this.hintsId = null;
      this.hintsAt = null;
      return;
    }
    const vp = call(() => globalThis.window?.viewport_size?.());
    const { width, height } = hintsSize(h.items, Math.round(vp?.width ?? 900));
    const at = vp ? { x: 0, y: Math.max(8, vp.height - BAR_H - height - 6) } : undefined;
    const spot = JSON.stringify([width, height, at]);
    if (this.hintsId && this.hintsAt === spot) return;
    if (this.hintsId) closeOverlay(this.hintsId);
    this.hintsAt = spot;
    this.hintsId = openOverlay({ mod: FOLDER, kind: "window", frame: "none", width, height, at, props: { part: "hints", width } });
  }

  // A view copy: draws the model the bar's copy shares, looking for a new one now and then.
  initPart(cx) {
    this.note = null; // settings: what went wrong with the last change
    this.seen = null;
    cx.timer.every(TICK_MS * 2, (cx) => {
      const now = JSON.stringify(shared(this.part === "hints" ? HINTS : SETTINGS) ?? null);
      if (now !== this.seen) { this.seen = now; cx.notify(); }
    });
    // Settings change whistle.json, through config.js, against the text just read.
    const change = (edit) => readTextFile(home("whistle.json")).then((text) => {
      const r = edit(text);
      if (r.problem) { this.note = r.problem; return; }
      this.note = null;
      return writeTextFile(home("whistle.json"), r.text, text);
    }).catch((err) => { this.note = `couldn't write whistle.json: ${String(err?.message ?? err)}`; })
      .then(() => cx.notify());
    this.act = {
      switchMod: (name, on) => change((text) => switchMod(text, name, on)),
      keep: (seq, value) => change((text) => keepMapping(text, seq, value)),
    };
  }

  // One effect (step.js lists the closed set).
  carry(e) {
    if ("run" in e) {
      try { run(e.run, e.args ?? {}); } catch (err) { this.failed.push({ ran: e.run, ok: false, error: String(err?.message ?? err) }); }
    }
    else if (e.focusBar) this.handle.focus();
    else if ("setShared" in e) setShared(e.setShared, e.value);
    else if ("write" in e) {
      // The outcome goes back with the file read again, so the core sees what it wrote.
      const after = (ok, error) => this.readKeys().catch(() => {}).then(() => this.feed({ wrote: e.write, ok, error }));
      writeTextFile(home(e.write), e.text, e.expected ?? null).then(
        () => after(true, null),
        (err) => after(false, String(err?.message ?? err)),
      );
    } else if ("openOverlay" in e) {
      const old = this.overlays.get(e.openOverlay);
      if (old) closeOverlay(old);
      this.overlays.set(e.openOverlay, openOverlay(e.spec));
    } else if ("closeOverlay" in e) {
      const id = this.overlays.get(e.closeOverlay);
      if (id) closeOverlay(id);
      this.overlays.delete(e.closeOverlay);
    } else if ("typeKey" in e) exec("hc", ["keys", e.terminal, hcKey(e.typeKey)]).catch(() => {});
  }

  render(cx) {
    if (this.part === "hints") return renderHints(shared(HINTS) ?? null, Number(props()?.width ?? 900), theme());
    if (this.part === "settings") return renderSettings(shared(SETTINGS) ?? null, theme(), this.act, this.note);
    return renderBar(bar(this.model, this.world()), theme(), this.handle, (e, cx) => {
      if (this.model.mode !== "whistle") return;
      const out = this.feed({ key: keyName(e) });
      if (out.handled) cx.stop_propagation();
      cx.notify();
    });
  }
}
