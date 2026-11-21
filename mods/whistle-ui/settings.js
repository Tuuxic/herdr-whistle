// The settings dialog: draws whistle's config (shared("whistle.config"),
// docs/contracts/config.md) and nothing else: the config problems, the mapping conflicts (each
// with "Keep <mod>'s"), the keys mapped over mods', and the layout's mods that offer mappings,
// each with an on/off switch. The buttons run whistle's settings commands (ui.js builds them);
// whistle writes whistle.json and publishes the config again, which this redraws.

import { div } from "gpui-kit";
import { h_flex, v_flex } from "gpui-base";
import { mappingsCommand, keepCommand } from "./ui.js";

const toggle = (t, id, on, onClick) => div().id(id).w(36).h(20).p(2).cursor_pointer().bg(on ? t.accent : t.hover).flex()
  .when(on, (el) => el.justify_end()).on_click(onClick)
  .child(div().w(16).h(16).bg(on ? t.accent_foreground : t.muted));

const button = (t, id, text, onClick) => div().id(id).px(8).h(22).flex().items_center().cursor_pointer()
  .border_1().border_color(t.border).bg(t.background).hover((s) => s.border_color(t.accent))
  .text_size(11.5).text_color(t.foreground).on_click(onClick).child(text);

const heading = (t, s) => div().pt(12).pb(4).flex_none().text_size(11).font_semibold().text_color(t.dim).child(s);
const line = (t, id, text, color) => h_flex().id(id).min_h(26).flex_none().px(6).gap(10).items_center().hover((s) => s.bg(t.hover))
  .child(div().flex_1().min_w(0).text_size(12.5).line_height("17px").text_color(color ?? t.muted).child(text));

// vm: whistle's config (read.js configOf), or null (whistle hasn't published it); t: theme();
// run(command): runs a whistle command.
export function renderSettings(vm, t, run) {
  const top = h_flex().gap(10).items_center().pb(6)
    .child(div().text_size(15).font_semibold().child("Whistle"))
    .child(div().flex_1())
    .child(div().text_size(11).text_color(t.dim).child("Esc closes"));
  const root = v_flex().id("whistle-ui-settings").size_full().min_h(0).p(18).gap(6).bg(t.chrome).text_color(t.foreground).child(top);
  if (!vm) return root.child(div().text_size(12.5).text_color(t.dim).child("Whistle isn't running, so there is nothing to show."));
  const { problems = [], conflicts = [], overrides = [], mods = [] } = vm;
  const rows = [heading(t, `PROBLEMS · ${problems.length}`)];
  if (!problems.length) rows.push(line(t, "wu-p-none", "None: whistle runs on all of its config."));
  problems.forEach((p, i) => rows.push(line(t, `wu-p-${i}`, `${p.source}: ${p.detail}`, t.blocked)));
  if (conflicts.length) {
    rows.push(heading(t, `MAPPING CONFLICTS · ${conflicts.length}`));
    conflicts.forEach((c, i) => rows.push(line(t, `wu-c-${i}`, `${c.text}: neither counts until you settle it`, t.blocked)
      .children((c.keep ?? []).map((k, j) => button(t, `wu-c-${i}-${j}`, `Keep ${k.mod}'s`, () => run(keepCommand(k.mod, c.seq)))))));
  }
  if (overrides.length) {
    rows.push(heading(t, `OVER MODS' KEYS · ${overrides.length}`));
    overrides.forEach((o, i) => rows.push(line(t, `wu-o-${i}`, o.text)));
  }
  rows.push(heading(t, `MODS' MAPPINGS · ${mods.length}`));
  if (!mods.length) rows.push(line(t, "wu-m-none", "No mod in this layout offers mappings."));
  mods.forEach((m, i) => {
    rows.push(line(t, `wu-m-${i}`, m.name, t.foreground).child(toggle(t, `wu-m-${i}-on`, m.on, () => run(mappingsCommand(m.name, !m.on)))));
    (m.problems ?? []).forEach((p, j) => rows.push(line(t, `wu-m-${i}-p-${j}`, p, t.blocked).pl(24)));
  });
  return root
    .child(v_flex().id("wu-body").flex_1().min_h(0).overflow_y_scrollbar().children(rows))
    .child(div().pt(8).text_size(11.5).line_height("17px").text_color(t.dim)
      .child("Whistle writes changes to whistle.json in Herdr's home; a change that fails flashes on the bar."));
}
