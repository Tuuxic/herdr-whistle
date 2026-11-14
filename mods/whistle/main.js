// Whistle: a keyboard mode for Herdr, borrowed from vim, and the bar that shows it.
//
// This is the shell (ADR 0011). Whistle's behaviour lives in the pure core, step.js; the shell
// reads Herdr into `world`, calls step on each command, key press and tick, carries out the
// effects it returns and feeds write outcomes back. It decides nothing itself.
//
// Herdr's keys.json runs whistle's commands: "whistle" (ctrl-space: TYPE <-> WHISTLE) and
// "type" (back to TYPE). In WHISTLE the bar holds the keyboard and its key presses go to step.
// Keys whistle claims in keys.json's mod:whistle section come back as "key-<key>" commands.

import { View } from "gpui-kit";
import { layout, focused, panes, run, theme, shared, setShared, nextCommand, readTextFile, writeTextFile, appHome, openOverlay, closeOverlay, exec } from "herdr";
// Through the namespace, so a Herdr without them still loads whistle, which then stands aside.
import * as herdr from "herdr";
import { start, step, bar } from "./step.js";
import { keyName, hcKey } from "./keynames.js";
import { renderBar } from "./bar.js";
import { HOME } from "./version.js";
import { folderOf, COPIES } from "./inert.js";

const FOLDER = folderOf(HOME);
const call = (f) => { try { return f(); } catch { return null; } };

// How often the shell ticks (ms): it notices a click away and Herdr's late focus changes.
const TICK_MS = 120;
// How often the shell reads keys.json and keys.error (ms).
const KEYS_MS = 1000;

// A path the core names, relative to Herdr's home ("keys.json").
const home = (path) => `${appHome()}/${path}`;

export default class Whistle extends View {
  init(_props, cx) {
    this.handle = cx.focus_handle();
    this.model = start();
    this.overlays = new Map(); // overlay name -> id
    this.keysFile = undefined; // { text, error, at }, once read
    cx.spawn(async (cx) => {
      for (;;) {
        await this.readKeys();
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

  // Herdr as the core sees it.
  world() {
    return {
      now: Date.now(), layout: layout(), focused: focused(), panes: panes(), barFocused: this.handle.is_focused(),
      keys: call(() => herdr.keys()) ?? [], herdr: call(() => herdr.updates().app.version),
      folder: FOLDER, copies: shared(COPIES) ?? {},
      platform: call(() => herdr.window().platform), layoutName: shared("layout") ?? null, keysFile: this.keysFile,
    };
  }

  // One input through the core: the new model, its effects carried out.
  feed(input) {
    const out = step(this.model, input, this.world());
    this.model = out.model;
    for (const e of out.effects) this.carry(e);
    return out;
  }

  // One effect (step.js lists the closed set).
  carry(e) {
    if ("run" in e) run(e.run, e.args ?? {});
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
