// Whistle's settings: draws the settings' view model (views.js settings()) and nothing else: the
// config problems, the mapping conflicts (each with "keep <mod>'s"), the keys mapped over mods'
// and the layout's mods that offer mappings, each with an on/off switch. The actions write
// whistle.json (main.js, through config.js); the bar picks the change up on its next read.

import { div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";

const toggle = (t, id, on, onClick) => div().id(id).w(36).h(20).p(2).cursor_pointer().bg(on ? t.accent : t.hover).flex()
  .when(on, (el) => el.justify_end()).on_click(onClick)
  .child(div().w(16).h(16).bg(on ? t.accent_foreground : t.muted));

const button = (t, id, text, onClick) => div().id(id).px(8).h(22).flex().items_center().cursor_pointer()
  .border_1().border_color(t.border).bg(t.background).hover((s) => s.border_color(t.accent))
  .text_size(11.5).text_color(t.foreground).on_click(onClick).child(text);

const heading = (t, s) => div().pt(12).pb(4).flex_none().text_size(11).font_semibold().text_color(t.dim).child(s);
const line = (t, id, text, color) => h_flex().id(id).min_h(26).flex_none().px(6).gap(10).items_center().hover((s) => s.bg(t.hover))
  .child(div().flex_1().min_w(0).text_size(12.5).line_height("17px").text_color(color ?? t.muted).child(text));

// vm: the settings' model, or null (the bar hasn't said yet); t: theme(); act: { switchMod(name,
// on, cx), keep(seq, value, cx) }, each given the click's cx; note: what went wrong with the last
// change | null.
export function renderSettings(vm, t, act, note) {
  const top = h_flex().gap(10).items_center().pb(6)
    .child(div().text_size(15).font_semibold().child("Whistle"))
    .child(div().flex_1())
    .child(div().text_size(11).text_color(t.dim).child("Esc closes"));
  const root = v_flex().id("whistle-settings").size_full().min_h(0).p(18).gap(6).bg(t.chrome).text_color(t.foreground).child(top);
  if (!vm) return root.child(div().text_size(12.5).text_color(t.dim).child("Waiting for whistle's bar…"));
  const rows = [heading(t, `PROBLEMS · ${vm.problems.length}`)];
  if (!vm.problems.length) rows.push(line(t, "wh-p-none", "None: whistle runs on all of its config."));
  vm.problems.forEach((p, i) => rows.push(line(t, `wh-p-${i}`, `${p.source}: ${p.detail}`, t.blocked)));
  if (vm.conflicts.length) {
    rows.push(heading(t, `MAPPING CONFLICTS · ${vm.conflicts.length}`));
    vm.conflicts.forEach((c, i) => rows.push(line(t, `wh-c-${i}`, `${c.text}: neither counts until you settle it`, t.blocked)
      .children(c.keep.map((k, j) => button(t, `wh-c-${i}-${j}`, `Keep ${k.mod}'s`, (_e, cx) => act.keep(c.seq, k.value, cx))))));
  }
  if (vm.overrides.length) {
    rows.push(heading(t, `OVER MODS' KEYS · ${vm.overrides.length}`));
    vm.overrides.forEach((o, i) => rows.push(line(t, `wh-o-${i}`, o.text)));
  }
  rows.push(heading(t, `MODS' MAPPINGS · ${vm.mods.length}`));
  if (!vm.mods.length) rows.push(line(t, "wh-m-none", "No mod in this layout offers mappings."));
  vm.mods.forEach((m, i) => {
    rows.push(line(t, `wh-m-${i}`, m.name, t.foreground).child(toggle(t, `wh-m-${i}-on`, m.on, (_e, cx) => act.switchMod(m.name, !m.on, cx))));
    m.problems.forEach((p, j) => rows.push(line(t, `wh-m-${i}-p-${j}`, p, t.blocked).pl(24)));
  });
  return root
    .when(Boolean(note), (el) => el.child(div().py(6).text_size(12.5).text_color(t.blocked).child(note ?? "")))
    .child(v_flex().id("wh-body").flex_1().min_h(0).overflow_y_scrollbar().children(rows))
    .child(div().pt(8).text_size(11.5).line_height("17px").text_color(t.dim)
      .child("Changes go in ~/.config/herdr-app/whistle.json; the bar picks them up within a second."));
}
