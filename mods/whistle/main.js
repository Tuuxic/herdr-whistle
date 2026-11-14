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

import { View } from "gpui-kit";
import { layout, focused, panes, run, theme, shared, setShared, nextCommand, readTextFile, writeTextFile, appHome, openOverlay, closeOverlay, exec } from "herdr";
// Through the namespace, so a Herdr without them still loads whistle, which then stands aside.
import * as herdr from "herdr";
import { start, step, bar } from "./step.js";
import { keyName, hcKey } from "./keynames.js";
import { renderBar } from "./bar.js";
import { HOME } from "./version.js";
import { folderOf, COPIES } from "./inert.js";
import { modBlocks, entryKey, requestKey } from "./fields.js";

const FOLDER = folderOf(HOME);
const call = (f) => { try { return f(); } catch { return null; } };

// How often the shell ticks (ms): it notices a click away and Herdr's late focus changes.
const TICK_MS = 120;
// How often the shell reads keys.json, keys.error, mappings.json and whistle.json (ms).
const KEYS_MS = 1000;

// A path the core names, relative to Herdr's home ("keys.json").
const home = (path) => `${appHome()}/${path}`;

export default class Whistle extends View {
  init(_props, cx) {
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
      configFiles: this.configFiles, commands: this.commands,
    };
  }

  // One input through the core: the new model, its effects carried out.
  feed(input) {
    const out = step(this.model, input, this.world());
    this.model = out.model;
    for (const e of out.effects) this.carry(e);
    // A command Herdr refused goes back to the core, which flashes it.
    for (const f of this.failed.splice(0)) this.model = step(this.model, f, this.world()).model;
    return out;
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
    return renderBar(bar(this.model, this.world()), theme(), this.handle, (e, cx) => {
      if (this.model.mode !== "whistle") return;
      const out = this.feed({ key: keyName(e) });
      if (out.handled) cx.stop_propagation();
      cx.notify();
    });
  }
}
