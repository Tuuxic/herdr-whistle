# A spec with an example

This file shows the form a spec's examples take, and keeps the fixture reader honest: the
`spec examples` suite needs at least one example here. Contract specs in `docs/contracts/`
use the same form.

A tagged example is a fenced block whose info string is `json example <name>`. It holds one
scenario as JSON (no `name`: the tag gives it), and runs through `step` like any other
scenario. Text around it, `${like this}` or a \backslash, is only prose.

```json example Ctrl+Space in a terminal enters WHISTLE, and Ctrl+Space again leaves it
{
  "world": {
    "layout": { "id": "root", "type": "column", "children": [
      { "id": "main", "type": "block", "content": { "pane": {} } },
      { "id": "bar", "type": "block", "content": { "mod": "whistle" } }
    ] },
    "focused": { "pane": "p1" },
    "panes": [{ "pane": "p1", "title": "C:\\work" }]
  },
  "steps": [
    { "command": "switch-mode", "effects": [{ "focusBar": true }],
      "state": { "mode": "whistle", "onTerminal": true } },
    { "world": { "barFocused": true }, "command": "switch-mode",
      "effects": [{ "run": "pane.focus", "args": { "pane": "p1" } }],
      "state": { "mode": "type" } }
  ]
}
```
