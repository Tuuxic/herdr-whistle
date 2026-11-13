// Whistle's own settings: a dialog (whistle.settings, or a click on the mode badge)
// with WHISTLE on/off, the key hints on/off and every mapping in effect. The toggles write
// ~/.config/herdr-app/whistle.json; the main copy notices within a few seconds.

import { div } from "gpui-kit";
import { h_flex, v_flex, Popup } from "gpui-base";
import { theme } from "herdr";
import { flatten } from "./config.js";

const row = (t, title, about, control) => h_flex().w_full().gap(16).py(10).items_center().border_b(1).border_color(t.border)
  .child(v_flex().flex_1().min_w(0).gap(3)
    .child(div().text_size(13.5).text_color(t.foreground).child(title))
    .child(div().text_size(12).line_height("17px").text_color(t.dim).child(about)))
  .child(div().flex_none().child(control));

const toggle = (t, id, on, onClick) => div().id(id).w(36).h(20).p(2).cursor_pointer().bg(on ? t.accent : t.hover).flex()
  .when(on, (el) => el.justify_end()).on_click(onClick)
  .child(div().w(16).h(16).bg(on ? t.accent_foreground : t.muted));

const chip = (t, k) => div().px(5).h(18).flex().items_center().border_1().border_color(t.border).bg(t.background)
  .text_size(11.5).text_color(t.foreground).child(k === "space" ? "SPC" : k);

// A dropdown: the current choice with a ▾; a click lists them all under it.
// open: whether the list shows; setOpen(bool); pick(name).
function dropdown(t, id, names, current, open, setOpen, pick) {
  const trigger = h_flex().id(`${id}-trigger`).w(190).h(26).px(10).gap(8).items_center().cursor_pointer()
    .border_1().border_color(open ? t.accent : t.border).bg(t.background).hover((s) => s.border_color(t.accent))
    .on_click(() => setOpen(!open))
    .child(div().flex_1().min_w(0).truncate().text_size(12.5).text_color(t.foreground).child(current ?? "—"))
    .child(div().text_size(10).text_color(t.dim).child("▾"));
  const list = v_flex().id(`${id}-list`).w(190).py(4).border_1().border_color(t.accent).bg(t.chrome)
    .on_mouse_down_out(() => setOpen(false))
    .children(names.map((name, i) => h_flex().id(`${id}-${i}`).h(26).px(10).gap(8).items_center().cursor_pointer()
      .text_size(12.5).text_color(name === current ? t.accent : t.muted).hover((s) => s.bg(t.hover).text_color(t.foreground))
      .on_click(() => { setOpen(false); if (name !== current) pick(name); })
      .child(div().w(10).child(name === current ? "✓" : ""))
      .child(div().flex_1().min_w(0).truncate().child(name))));
  return Popup.new(`${id}-popup`, trigger).anchor("top_right").when(open, (el) => el.content(list));
}

// conf: what load() returned; set(key, value): writes it; place: the layout's bars when it has
// more than one ({ names, current, open, setOpen }), else null.
export function renderSettings(conf, set, place) {
  const t = theme();
  const rows = flatten(conf?.map);
  return v_flex().id("whistle-settings").size_full().min_h(0).p(18).gap(6).bg(t.chrome).text_color(t.foreground)
    .child(h_flex().gap(10).items_center().pb(6)
      .child(div().text_size(15).font_semibold().child("Whistle"))
      .child(div().flex_1())
      .child(div().text_size(11).text_color(t.dim).child("Esc closes")))
    .when(Boolean(conf?.error), (el) => el.child(div().py(6).text_size(12.5).text_color(t.blocked).child(conf.error)))
    .child(row(t, "Whistle mode", "Ctrl+Space (or Ctrl+[ in a terminal) leaves the terminal to move around and run mappings with single keys. Off: those keys go to the terminal and the status bar shows no mode.",
      toggle(t, "wh-enabled", conf?.enabled !== false, () => set("enabled", conf?.enabled === false))))
    .when(conf?.enabled !== false, (el) => el.child(row(t, "Show key hints", "After a group key like w or Space, a box above the status bar lists the keys that can follow. Off: only the status bar shows what you typed.",
      toggle(t, "wh-hints", conf?.hints !== false, () => set("hints", conf?.hints === false)))))
    .when(Boolean(place), (el) => el.child(row(t, "Bar position", "Where the status bar with the mode goes. This layout has a spot for each.",
      dropdown(t, "wh-bar", place.names, place.current, place.open, place.setOpen, (name) => set("bar", name)))))
    .child(div().pt(12).pb(4).text_size(11).font_semibold().text_color(t.dim).child(`MAPPINGS · ${rows.length}`))
    .child(v_flex().id("wh-maps").flex_1().min_h(0).overflow_y_scrollbar()
      .children(rows.map((m, i) => h_flex().id(`wh-m-${i}`).h(26).flex_none().px(6).gap(12).items_center().hover((s) => s.bg(t.hover))
        .child(h_flex().w(150).flex_none().gap(3).items_center().children(m.seq.flatMap((p, j) => [
          ...(j ? [div().text_size(11).text_color(t.dim).child("›")] : []), chip(t, p)])))
        .child(div().flex_1().min_w(0).truncate().text_size(12.5).text_color(t.muted).child(m.action))
        .when(Boolean(m.group), (e) => e.child(div().flex_none().text_size(11).text_color(t.dim).child(m.group))))))
    .child(div().pt(8).text_size(11.5).line_height("17px").text_color(t.dim)
      .child("Your own mappings go in ~/.config/herdr-app/whistle.json: { \"map\": { \"x\": [\"Label\", \"command\"] } }, over the defaults and this layout's. A key set to null removes it."));
}
