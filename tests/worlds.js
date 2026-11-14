// Layouts and worlds the scenarios share.

export const term = (id) => ({ id, type: "block", content: { tab: "active", pane: {} } });
export const bar = { id: "bar", type: "block", content: { mod: "whistle" } };

// One terminal over the bar: the usual layout.
export const ONE = { id: "root", type: "column", children: [term("main"), bar] };

// Three terminal blocks: a and b side by side over c, then the bar.
//   +---+---+
//   | a | b |
//   +---+---+
//   |   c   |
//   +-------+
export const GRID = {
  id: "root", type: "column", children: [
    { id: "top", type: "row", children: [term("a"), term("b")] },
    term("c"),
    bar,
  ],
};

// A terminal with a pane focused, in the usual layout.
export const IN_TERMINAL = { layout: ONE, focused: { pane: "p1" }, panes: [{ pane: "p1", title: "zsh" }] };
