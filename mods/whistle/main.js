// Whistle: a keyboard mode for Herdr, borrowed from vim.
//
// This is the shell (ADR 0011). Whistle's behaviour lives in the pure core, step.js; the shell
// reads Herdr into `world`, calls step on each command, key press and tick, carries out the
// effects it returns and feeds write outcomes back. It decides nothing itself.
//
// Herdr's keys.json runs whistle's commands: "switch-mode" (ctrl-space: TYPE <-> WHISTLE) and
// "mode:type" (back to TYPE). In WHISTLE the anchor holds the keyboard and its key presses go to
// step. Keys whistle claims in keys.json's mod:whistle section come back as "key-<key>"
// commands, and jump keys as "<verb>:<block>" (alt-a: "focus:agents").
// Its config comes from mappings.json (this folder) and whistle.json (Herdr's home), read on
// the same poll as keys.json; the core keeps each file's last good version.
//
// Every whistle block is the anchor (ADR 0018, ADR 0020), sized 0 px: it draws nothing and holds
// the keyboard in WHISTLE. Whistle draws no bar, hints or settings: it publishes facts in public
// shared keys (docs/contracts/) and clients such as whistle-ui show them.

import { View } from "gpui-kit";
import { layout, focused, panes, run, shared, setShared, nextCommand, readTextFile, writeTextFile, appHome, exec, props } from "herdr";
// Through the namespace, so a Herdr without them still loads whistle, which then stands aside.
import * as herdr from "herdr";
import { start, step, STATE } from "./step.js";
import { keyName, hcKey } from "./keynames.js";
import { renderAnchor } from "./anchor.js";
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

  // The shared state keynav needs (docs/contracts/keynav.md): the driver entry and
  // each shown mod block's entry and request slot.
  keynavShared(tree) {
    const out = { keynav: shared("keynav") ?? null };
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
      now: Date.now(), layout: tree, focused: focused(), panes: panes(), anchorFocused: this.handle.is_focused(),
      keys: call(() => herdr.keys()) ?? [], herdr: call(() => herdr.updates().app.version),
      folder: FOLDER, copies: shared(COPIES) ?? {},
      platform: call(() => herdr.window().platform), layoutName: shared("layout") ?? null, keysFile: this.keysFile,
      configFiles: this.configFiles, commands: this.commands, modMappings: shared("whistle.mappings") ?? {},
      props: call(() => props() ?? {}) ?? undefined, state: shared(STATE) ?? null,
    };
  }

  // One input through the core: the new model and its effects carried out. A command Herdr
  // refused goes back to the core, which raises an event for it.
  feed(input) {
    const out = step(this.model, input, this.world());
    this.model = out.model;
    for (const e of out.effects) this.carry(e);
    for (const f of this.failed.splice(0)) this.feed(f);
    return out;
  }

  // One effect (step.js lists the closed set).
  carry(e) {
    if ("run" in e) {
      // Herdr's run() returns null on a command it refuses and shows its own error toast (issue
      // #35); it doesn't throw. The catch only guards a later Herdr that throws: then the core
      // raises command-failed for { ran, ok: false }.
      try { run(e.run, e.args ?? {}); } catch (err) { this.failed.push({ ran: e.run, ok: false, error: String(err?.message ?? err) }); }
    }
    else if (e.focusAnchor) this.handle.focus();
    else if ("setShared" in e) setShared(e.setShared, e.value);
    else if ("write" in e) {
      // The outcome goes back with the file read again, so the core sees what it wrote.
      const after = (ok, error) => Promise.all([this.readKeys(), this.readConfig()]).catch(() => {}).then(() => this.feed({ wrote: e.write, ok, error }));
      writeTextFile(home(e.write), e.text, e.expected ?? null).then(
        () => after(true, null),
        (err) => after(false, String(err?.message ?? err)),
      );
    }
    else if ("typeKey" in e) exec("hc", ["keys", e.terminal, hcKey(e.typeKey)]).catch(() => {});
    // Through the namespace and guarded: notify() is in every Herdr from 0.1.10 to 0.1.16 (checked), but
    // a Herdr without it, or one that throws, must leave an inert whistle quiet, not broken.
    else if ("notify" in e) call(() => herdr.notify?.(e.notify));
  }

  render(_cx) {
    const onKey = (e, cx) => {
      if (this.model.mode !== "whistle") return;
      const out = this.feed({ key: keyName(e) });
      if (out.handled) cx.stop_propagation();
      cx.notify();
    };
    return renderAnchor(this.handle, onKey);
  }
}
