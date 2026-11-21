// whistle-ui: whistle's bar, hints box and settings dialog, as a client of whistle's public
// contract (docs/contracts/): it reads whistle's shared keys and runs whistle's commands, and
// never runs whistle's core, reads whistle's files or claims keys. Replace any part of it
// (docs/contracts/whistle-ui.md).
//
// This is the shell. What to draw and which overlays to open come from the pure core, ui.js:
// render reads Herdr into its arguments, which Herdr reruns whenever shared state, focus or
// terminals change (reading a key while drawing is the subscription), and carries out its
// effects once the drawing is done. A timer only redraws when a flash ends or the bar's size
// changed.
//
// Its blocks: bars (any props but `corner`), and the corner block (`corner: true`, 0 px), which
// draws nothing and shows the hints with no bar shown. Two more copies, known by their "part"
// prop, draw the overlays: the hints box (part "hints") and the settings dialog (part
// "settings"). Its one command, whistle-ui.settings, opens the dialog (keys.json: alt-,).

import { View, div } from "gpui-kit";
import { layout, focused, panes, run, theme, shared, setShared, nextCommand, openOverlay, closeOverlay, props } from "herdr";
import { ui, command, isCorner, SEEN } from "./ui.js";
import { hintsOf, configOf } from "./read.js";
import { renderBar } from "./bar.js";
import { renderHints } from "./hints.js";
import { renderSettings } from "./settings.js";

const FOLDER = "whistle-ui";
const call = (f) => { try { return f(); } catch { return null; } };
// How often the shell checks whether a flash has ended or the bar's size changed (ms).
const TICK_MS = 250;
// The private shared key holding the id of the overlay open under a name, so any copy can close
// or replace it (Herdr makes a new copy when the layout changes).
const overlayKey = (name) => `whistle-ui.overlay:${name}`;

export default class WhistleUi extends View {
  init(_props, cx) {
    this.part = call(() => props()?.part) ?? null;
    if (this.part) return;
    // What the core kept from its last call: handed back in the next world.
    this.kept = { last: null, flash: null, box: undefined };
    this.size = null; // the bar's drawn size, once measured
    this.drawnAt = null; // the size the last draw used, as JSON
    cx.spawn(async (cx) => {
      for (;;) {
        const c = await nextCommand();
        for (const e of command(c, this.published(), this.world())) this.carry(e);
        cx.notify();
      }
    });
    cx.timer.every(TICK_MS, (cx) => {
      const f = this.kept.flash;
      if ((f && Date.now() >= f.until) || JSON.stringify(this.size) !== this.drawnAt) cx.notify();
    });
  }

  // Whistle's public keys, as Herdr holds them.
  published() {
    return { whistle: shared("whistle"), hints: shared("whistle.hints"), events: shared("whistle.events"), config: shared("whistle.config") };
  }

  // Herdr as the core sees it.
  world() {
    const keynav = shared("keynav") ?? null;
    const entry = typeof keynav?.active === "string" ? `keynav.field:${keynav.active}` : null;
    return {
      folder: FOLDER, props: call(() => props() ?? {}) ?? {}, size: this.size, viewport: this.viewport ?? null,
      layout: layout(), focused: focused(), panes: panes(), now: Date.now(),
      shared: { keynav, ...(entry ? { [entry]: shared(entry) ?? null } : {}), [SEEN]: shared(SEEN) ?? null },
      ...this.kept,
    };
  }

  closeOverlay(name) {
    const id = shared(overlayKey(name)) ?? null;
    if (id) { call(() => closeOverlay(id)); setShared(overlayKey(name), null); }
  }

  // One effect (ui.js lists the set).
  carry(e) {
    if ("run" in e) call(() => run(e.run, {}));
    else if ("seen" in e) setShared(SEEN, e.seen);
    else if ("openOverlay" in e) {
      this.closeOverlay(e.openOverlay);
      const id = call(() => openOverlay(e.spec));
      if (id) setShared(overlayKey(e.openOverlay), id);
    } else if ("closeOverlay" in e) this.closeOverlay(e.closeOverlay);
  }

  render(_cx) {
    if (this.part === "hints") return renderHints(hintsOf(shared("whistle.hints")), Number(props()?.width ?? 480), theme());
    if (this.part === "settings") return renderSettings(configOf(shared("whistle.config")), theme(), (c) => this.carry({ run: c }));
    // Measured while drawing, where it is sure to be legal: the window's size, for the hints.
    this.viewport = call(() => globalThis.window?.viewport_size?.()) ?? this.viewport;
    const out = ui(this.published(), this.world());
    const { last, flash, box } = out.model;
    this.kept = { last, flash, box };
    this.drawnAt = JSON.stringify(this.size);
    // Overlays open and close after the drawing, not during it.
    if (out.effects.length) Promise.resolve().then(() => { for (const e of out.effects) this.carry(e); });
    if (isCorner(call(() => props()))) return div().id("whistle-ui-corner").size_full();
    return renderBar(out.model.bar, theme(), (size) => { this.size = { width: size.width, height: size.height }; });
  }
}
