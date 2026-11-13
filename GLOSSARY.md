# Whistle

A keyboard mode for Herdr, borrowed from vim: switch out of typing to move around the window
and run commands with single keys and short key sequences.

## Modes

**TYPE**:
The mode where the keyboard belongs to the focused terminal or app, as usual.
_Avoid_: insert mode, normal mode

**WHISTLE**:
The mode where whistle holds the keyboard and keys move between fields or run mappings.
_Avoid_: command mode, vim mode, leader mode

**Switch key**:
A regular Herdr key that enters or leaves WHISTLE (Ctrl+Space both ways, Ctrl+[ only in);
not an own key, since TYPE never hands whistle the keyboard.
_Avoid_: entry key, toggle, hotkey

## Keys

**Mapping**:
A key bound to a command, or to a group, in whistle's config.
_Avoid_: binding, shortcut, leader key

**Group**:
A named set of mappings reached through one key, whose keys follow it (w then v).
_Avoid_: menu, leader group, submap

**Key sequence**:
The keys typed so far inside groups, before a command runs or the sequence is cancelled.
_Avoid_: leader, pending keys, chord

**Own key**:
A key for one of whistle's own actions in WHISTLE, such as selecting a field or going back to
TYPE; configurable like mappings, but not a mapping.
_Avoid_: built-in key, mode key, action key

**Claimed key**:
A key whistle takes over in Herdr's keys.json so that it reaches whistle instead of a binding
elsewhere; entries a person writes there themselves are not claims.
_Avoid_: synced key, reserved key

**Config layer**:
One of the three places whistle's config comes from, each over the one before: the defaults,
the layout's whistle block, and the person's own whistle.json.
_Avoid_: mapping layer, override

## Fields

**Field**:
A part of the window whistle can select in WHISTLE: the terminal, or a mod that takes part in
keynav.
_Avoid_: panel, block, pane

**Keynav**:
The agreement through which a mod becomes a field: it announces itself, draws its own cursor
while selected, and takes moves from whoever drives it.
_Avoid_: field protocol, navigation API

## Display

**Bar**:
Whistle's strip in the window showing the mode badge and where the keyboard is; a layout can
offer several spots for it.
_Avoid_: status bar, statusline

**Mode badge**:
The TYPE or WHISTLE label at the start of the bar.
_Avoid_: mode indicator, pill

**Hints**:
The box above the bar listing the keys that can follow the current key sequence.
_Avoid_: which-key, popup, help
