# Herdr commands and state for the stock sidebar blocks

Research for issue #2. Question: what does Herdr give a mod to move through and act on the stock
`spaces`, `agents`, `tabs` and `files` blocks (next/previous item, open it, which item is
selected), and which of them can a driver move through with Herdr commands alone?

Sources, all read on 2026-11-13 against herdr-app 0.1.15 (`herdr-app --version`):

- `~/.config/herdr-app/AGENTS.md` (Herdr's mod guide), cited as `AGENTS.md:<line>`
- `~/.config/herdr-app/herdr.d.ts` (the `herdr` module), cited as `herdr.d.ts:<line>`
- `herdr-app commands` (the live command list, with argument names and required flags)
- the stock mods' source, `~/.config/herdr-app/mods/{spaces,agents,tabs,files}/main.js`

## Answer

| Block | Next / previous item | Open item | Which item is selected | Commands alone? |
|---|---|---|---|---|
| spaces | `space.next`, `space.prev` | moving already opens it (the space is shown) | `spaces()[i].active` | Yes |
| tabs | `tab.next`, `tab.prev` | moving already opens it (the tab is shown) | `spaces().find(s => s.active).tabs[i].active` | Yes |
| agents | `agent.next`, `agent.prev` (in the agents block's order) | moving already opens it (the agent is shown) | `agents()[i].focused`, or `focused().agent` | Yes |
| files | none | none | none (private instance state) | No |

In all three that work, moving and opening are one step: the stock blocks have no cursor of
their own. Their highlight is Herdr's current space, tab or agent, so "select next" means "show
next". A driver gets no separate "hover a row, then open it".

## Per block

### spaces

- Move: `space.next {}`, `space.prev {}` ("Show the next space" / "previous");
  `space.select {index?, id?}` jumps by 1-based position or id (`herdr-app commands`;
  `AGENTS.md:555`; `herdr.d.ts:53`).
- Open: same commands. Selecting a space shows it.
- Selected: `SpaceInfo.active`, "The shown space" (`herdr.d.ts:127`). The stock block highlights
  exactly that: `.when(on, el => el.bg(t.selected))` with `on = w.active`
  (`mods/spaces/main.js:388,401`).
- Order: the block shows worktree spaces nested under their repo, and keeps the model order
  the same as what it shows by issuing `space.move` itself (`mods/spaces/main.js:277-293`).
  So `space.next` follows the visible order.
- Gaps (inferred from source, not tested):
  - The block can fold a machine's group (`this.folded`, kept in its own `localStorage`;
    `mods/spaces/main.js:317,325-326`). `space.next` follows `spaces()`, which knows nothing
    about folding, so it can show a space whose row is folded away.
  - Whether `space.next` wraps from last to first is not documented. Not tested, because that
    would change the live window.
  - The row actions (rename, close, colour) come from a right-click menu
    (`mods/spaces/main.js:432`). Commands cover rename and close (`space.rename`,
    `space.close`) but not colour: that lives in `shared("space.colors")`
    (`mods/spaces/main.js:390`), which a driver could write with `setShared`.

### tabs

- Move: `tab.next {}`, `tab.prev {}`, `tab.select {index?, id?}` (index is the position in the
  space) (`herdr-app commands`; `AGENTS.md:566`; `herdr.d.ts:56-57`). The block itself already
  maps the scroll wheel to `tab.prev` / `tab.next` (`mods/tabs/main.js:104`).
- Open: same commands.
- Selected: `TabInfo.active`, "The one its space shows" (`herdr.d.ts:96-97`). The block finds
  it the same way (`mods/tabs/main.js:51-54`) and draws it raised (`mods/tabs/main.js:69`).
- Gap: `tab.next` / `tab.prev` / `tab.select {index}` skip settled tabs (`AGENTS.md:567-568`),
  while the stock block draws every tab in `space.tabs`, settled or not (`mods/tabs/main.js:52,107`).
  The shipped layouts don't settle tabs (`AGENTS.md:124-126`), so in practice this doesn't
  happen unless a person settles one.
- The tabs block also holds the Files/Changes panel buttons. These are layout commands,
  not tab items: `layout.select {stack: "panel-body", child}` plus `layout.show` /
  `layout.hide {id: "panel"}` (`mods/tabs/main.js:97-99`).

### agents

- Move: `agent.next {}`, `agent.prev {}`: "Show the next agent, in the order the agents list
  shows them" (`herdr-app commands`; `AGENTS.md:617`; `herdr.d.ts:68`).
  `agent.focus {terminal}` jumps to one by address, sub-agents included.
- The order comes from whichever mod draws the list: it calls `setAgentOrder(addresses)` on
  render (`AGENTS.md:165-168`; `herdr.d.ts:211-214`). The stock block does this after sorting
  and pinning (`mods/agents/main.js:235-239`), so `agent.next` follows its rows top to bottom.
  If no mod sets an order, model order (space, tab, pane) is used.
- Open: same commands. A row click is `pane.focus {pane: a.pane}` (`mods/agents/main.js:351`),
  which is what `agent.next` lands on.
- Selected: `AgentInfo.focused` (`herdr.d.ts:179`); the block highlights rows with
  `.when(a.focused, el => el.bg(t.selected))` (`mods/agents/main.js:343`). `focused().agent`
  is "the agent an agent block shows" (`AGENTS.md:981`; `herdr.d.ts:232`).
- Gaps (inferred from source):
  - Sub-agents without a pane are drawn as tree rows under their parent
    (`mods/agents/main.js:166-175,241-246`) but are not in `agents()`, so not in the order.
    `agent.next` skips them. Their row click opens a peek: `terminal.peek {terminal}`
    (`mods/agents/main.js:161-162,194`). A driver can only reach them by reading `terminals()`
    (`parent`, `state === "live"`) and running `terminal.peek` / `agent.focus` itself.
  - Folded groups and folded sub-agent trees (`this.folded`, private to the block,
    `mods/agents/main.js:244,267,395`) don't change the order passed to `setAgentOrder`. So
    `agent.next` can land on an agent whose row is folded away.
  - Pin/unpin has a command: `terminal.pin {terminal, pinned}`.
  - The sort lives in `shared("agents.sort")` (`mods/agents/main.js:60,153`), so a driver can
    change it.

### files

- No commands. `herdr-app commands` has no file or tree command, and the files block calls no
  `run(...)` at all (its only `herdr` imports are data and I/O: `mods/files/main.js:4`).
- State is private: open folders (`this.folders`), the previewed file (`this.file`) and the
  rows live on the instance (`mods/files/main.js:43-44,130-131`). Nothing goes through
  `shared`, `props` or `localStorage`, so another mod can neither read nor set it.
- No keyboard entry: the block has no `focus_handle`, `on_key_down` or `nextCommand()` loop,
  and its `mod.json` is `{ "place": "none" }`, not `"focusable": true` (`mods/files/mod.json`).
  `"<mod>.<command>"` key actions go to that mod's `nextCommand()` (`AGENTS.md:507`;
  `herdr.d.ts:79,402-409`), and files never reads it, so commands sent that way do nothing
  (inferred: nothing reads the queue). `pane.go` reaches only mods that are focusable
  (`AGENTS.md:575-576`).
- Its row clicks are in-mod only: toggle a folder or preview a file
  (`mods/files/main.js:156`); back is `this.show(null)` (`mods/files/main.js:171`).
- Only the whole panel can be driven: show, hide or switch it with
  `layout.show|hide {id: "panel"}` and `layout.select {stack: "panel-body", child: "files"}`
  (node ids from `layouts/main.json:146-154`).
- Verdict: a driver cannot move through files with Herdr commands. It takes a mod that keeps
  its own cursor and takes moves, which is keynav. A fork with that loop already exists in
  this Herdr home (`mods/tuuxic-files/main.js:46`), as do forks of agents, spaces and changes
  (`mods/tuuxic-*/main.js`, each with a `nextCommand()` keynav loop).

## What this means for a driver

- Spaces, tabs and agents need no change to the stock mods. A driver can map h/j/k/l to
  `space.prev|next`, `tab.prev|next`, `agent.prev|next` and read `active` / `focused` to
  draw where it is. Every move changes what the window shows; there is no
  "look without opening".
- Files cannot be driven. It needs a keynav mod (a fork) in the layout in place of the stock
  `files` block.
- Things a command-only driver can't match in the stock blocks: folded rows (spaces' machine
  groups, agents' groups and trees), pane-less sub-agents, and settled tabs. In each case the
  command's order and the drawn rows differ.

## Not verified

- No command was run against the live window (it would change the person's screen). Wrapping
  at the ends of `space.next`, `tab.next` and `agent.next` is undocumented and untested.
- `herdr-app status` shows the read side live: it reports `space`, `tab`, `focused_pane` and
  `agent` (the shown agent), which match `focused()`.
