// Whistle: a keyboard mode for Herdr, borrowed from vim, and the bar that shows it.
//
// This is the shell (ADR 0011). Whistle's behaviour lives in the pure core, step.js; the shell
// reads Herdr into `world`, calls step on each command, key press and tick, carries out the
// effects it returns and feeds write outcomes back. It decides nothing itself.
//
// Herdr's keys.json runs whistle's commands: "whistle" (ctrl-space: TYPE <-> WHISTLE) and
// "type" (back to TYPE). In WHISTLE the bar holds the keyboard and its key presses go to step.
// Keys whistle claims in keys.json's mod:whistle section come back as "key-<key>" commands,
// and jump keys as "<verb>:<block>" (alt-a: "focus:agents").
// Its config comes from mappings.json (this folder) and whistle.json (Herdr's home), read on
// the same poll as keys.json; the core keeps each file's last good version.
//
// Two more copies of this mod, known by their "part" prop, draw the views and run no core: the
// hints window (part "hints") and the settings dialog (part "settings"). The core hands them
// their view models (views.js) in private shared keys (ADR 0010) and opens and docks the hints
// window, all as effects; the shell measures the window and the bar for it. A part copy draws
// on each render, which Herdr reruns when shared state changes. Settings change things by
// writing whistle.json through config.js; the bar picks the change up on its next read
// (ADR 0011).

import { View } from "gpui-kit";
import { layout, focused, panes, run, theme, shared, setShared, nextCommand, readTextFile, writeTextFile, appHome, openOverlay, closeOverlay, exec, props } from "herdr";
// Through the namespace, so a Herdr without them still loads whistle, which then stands aside.
import * as herdr from "herdr";
import { start, step, bar, VIEWS } from "./step.js";
import { keyName, hcKey } from "./keynames.js";
import { switchMod, keepMapping } from "./config.js";
import { renderBar } from "./bar.js";
import { renderHints } from "./hints.js";
import { renderSettings } from "./settings.js";
import { HOME } from "./version.js";
import { folderOf, COPIES } from "./inert.js";
import { modBlocks, entryKey, requestKey } from "./fields.js";

const FOLDER = folderOf(HOME);
const call = (f) => { try { return f(); } catch { return null; } };

// How often the shell ticks (ms): it notices a click away and Herdr's late focus changes.
const TICK_MS = 120;
// How often the shell reads keys.json, keys.error, mappings.json and whistle.json (ms).
const KEYS_MS = 1000;

// The private shared key (ADR 0010) holding the id of the overlay this folder's copy opened
// under a name, so a later copy can close it.
const overlayKey = (name) => `whistle.overlay:${FOLDER}:${name}`;

// A path the core names, relative to Herdr's home ("keys.json").
const home = (path) => `${appHome()}/${path}`;


export default class Whistle extends View {
  init(_props, cx) {
    // One of whistle's own overlay copies (the "part" prop, private): no core of its own.
    this.part = call(() => props()?.part) ?? null;
    if (this.part) return this.initPart();
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

  // The shared state keynav needs (docs/contracts/keynav.md): the driver entry, old v1
  // announcements, and each shown mod block's entry and request slot.
  keynavShared(tree) {
    const out = { keynav: shared("keynav") ?? null, "keynav.fields": shared("keynav.fields") ?? null };
    for (const b of modBlocks(tree)) {
      for (const k of [entryKey(b.key), requestKey(b.key)]) if (!(k in out)) out[k] = shared(k) ?? null;
    }
    return out;
  }

  // Herdr as the core sees it.
  world() {
    const tree = layout();
    return {
      shared: this.keynavShared(tree),
      now: Date.now(), layout: tree, focused: focused(), panes: panes(), barFocused: this.handle.is_focused(),
      keys: call(() => herdr.keys()) ?? [], herdr: call(() => herdr.updates().app.version),
      folder: FOLDER, copies: shared(COPIES) ?? {},
      platform: call(() => herdr.window().platform), layoutName: shared("layout") ?? null, keysFile: this.keysFile,
      configFiles: this.configFiles, commands: this.commands, modMappings: shared("whistle.mappings") ?? {},
      viewport: call(() => globalThis.window?.viewport_size?.()) ?? this.viewport ?? null, barSize: this.barSize ?? null,
      props: call(() => props() ?? {}) ?? undefined, home: call(() => appHome()) ?? undefined,
    };
  }

  // One input through the core: the new model and its effects carried out. A command Herdr
  // refused goes back to the core, which flashes it.
  feed(input) {
    const out = step(this.model, input, this.world());
    this.model = out.model;
    for (const e of out.effects) this.carry(e);
    for (const f of this.failed.splice(0)) this.feed(f);
    return out;
  }

  // A view copy: draws the model the core shares (render). Settings change whistle.json,
  // through config.js, against the text just read; each change runs in a task of its own, from
  // the click that asked for it.
  initPart() {
    this.note = null; // settings: what went wrong with the last change
    const change = (edit, cx) => cx.spawn(async (cx) => {
      try {
        const text = await readTextFile(home("whistle.json"));
        const r = edit(text);
        this.note = r.problem ?? null;
        if (!r.problem) await writeTextFile(home("whistle.json"), r.text, text);
      } catch (err) { this.note = `couldn't write whistle.json: ${String(err?.message ?? err)}`; }
      cx.notify();
    });
    this.act = {
      switchMod: (name, on, cx) => change((text) => switchMod(text, name, on), cx),
      keep: (seq, value, cx) => change((text) => keepMapping(text, seq, value), cx),
    };
  }

  // Closes the overlay open under a name: this copy's, else the one an earlier copy of this
  // folder left open (Herdr makes a new copy when the layout changes; the id is in shared state).
  closeOverlay(name) {
    const id = this.overlays.get(name) ?? shared(overlayKey(name)) ?? null;
    if (id) call(() => closeOverlay(id));
    this.overlays.delete(name);
    if (id) setShared(overlayKey(name), null);
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
      const after = (ok, error) => Promise.all([this.readKeys(), this.readConfig()]).catch(() => {}).then(() => this.feed({ wrote: e.write, ok, error }));
      writeTextFile(home(e.write), e.text, e.expected ?? null).then(
        () => after(true, null),
        (err) => after(false, String(err?.message ?? err)),
      );
    } else if ("openOverlay" in e) {
      this.closeOverlay(e.openOverlay);
      const id = openOverlay(e.spec);
      this.overlays.set(e.openOverlay, id);
      setShared(overlayKey(e.openOverlay), id);
    } else if ("closeOverlay" in e) this.closeOverlay(e.closeOverlay); else if ("typeKey" in e) exec("hc", ["keys", e.terminal, hcKey(e.typeKey)]).catch(() => {});
  }

  render(_cx) {
    if (this.part === "hints") return renderHints(shared(VIEWS.hints) ?? null, Number(props()?.width ?? 900), theme());
    if (this.part === "settings") return renderSettings(shared(VIEWS.settings) ?? null, theme(), this.act, this.note);
    // Measured while drawing, where it is sure to be legal: the window's size, for the hints.
    this.viewport = call(() => globalThis.window?.viewport_size?.()) ?? this.viewport;
    return renderBar(bar(this.model, this.world()), theme(), this.handle, (e, cx) => {
      if (this.model.mode !== "whistle") return;
      const out = this.feed({ key: keyName(e) });
      if (out.handled) cx.stop_propagation();
      cx.notify();
    }, (size) => { this.barSize = { width: size.width, height: size.height }; });
  }
}
