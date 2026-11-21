// Layouts and worlds the scenarios share.

export const term = (id) => ({ id, type: "block", content: { tab: "active", pane: {} } });
// Whistle's block, the anchor (ADR 0005): every whistle block is one.
export const anchor = { id: "anchor", type: "block", content: { mod: "whistle" } };

// One terminal over the anchor: the usual layout.
export const ONE = { id: "root", type: "column", children: [term("main"), anchor] };

// Three terminal blocks: a and b side by side over c, then the anchor.
//   +---+---+
//   | a | b |
//   +---+---+
//   |   c   |
//   +-------+
export const GRID = {
  id: "root", type: "column", children: [
    { id: "top", type: "row", children: [term("a"), term("b")] },
    term("c"),
    anchor,
  ],
};

// A terminal with a pane focused, in the usual layout.
export const IN_TERMINAL = { layout: ONE, focused: { pane: "p1", terminal: "t1" }, panes: [{ pane: "p1", title: "zsh" }] };

// The usual layout with whistle's block carrying props (the layout's whistle block).
export const withProps = (props) => ({ id: "root", type: "column", children: [term("main"), { ...anchor, content: { mod: "whistle", props } }] });

// A stock block: one of Herdr's own spaces, tabs, agents or files mods.
export const stock = (id, mod = id) => ({ id, type: "block", content: { mod } });

// Herdr's stock main layout, cut down: spaces over agents in the sidebar, tabs over the
// terminal and the files panel, then the anchor.
//   +--------+------------+
//   | spaces | tabs       |
//   +--------+------+-----+
//   | agents | main | files
//   +--------+------+-----+
export const STOCK = {
  id: "root", type: "column", children: [
    { id: "body", type: "row", children: [
      { id: "sidebar", type: "column", children: [stock("spaces"), stock("agents")] },
      { id: "work", type: "column", children: [
        stock("tabs"),
        { id: "work-body", type: "row", children: [term("main"), stock("files")] },
      ] },
    ] },
    anchor,
  ],
};
