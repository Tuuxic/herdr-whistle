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
A regular Herdr key that enters or leaves WHISTLE (Ctrl+Space, both ways);
not an own key, since TYPE never hands whistle the keyboard.
_Avoid_: entry key, toggle, hotkey

**Inert**:
Whistle loaded but standing aside because it can't run safely, such as on a Herdr older than it
needs, when another copy of whistle already runs, or when its blocks can't be told apart: it
claims no keys, the switch keys type through, one Herdr notification says why, and clients may
show it. Unlike switching whistle off, it isn't the person's choice.
_Avoid_: disabled, dormant, off

## Keys

**Mapping**:
A key bound to a command, or to a group, in whistle's config.
_Avoid_: binding, shortcut, leader key

**Group**:
A named set of mappings reached through one key, whose keys follow it (w then v).
_Avoid_: menu, leader group, submap

**Key sequence**:
The keys typed so far inside groups, before a command runs or the sequence is cancelled.
_Avoid_: leader, pending keys

**Chord**:
A key pressed with Ctrl, Alt or Super held, such as Ctrl+H; one key, not a key sequence.
_Avoid_: combo, modifier key, hotkey

**Verb**:
One of whistle's actions on a layout block, named with the block's id after a colon: select
the block's field, focus the block (show it, then select its field), or toggle it (hide or show
it). A mapping or a jump key can run one.
_Avoid_: in-map verb, block command, action

**Pick**:
Acting on the item under a field's cursor; what that does is the field's to decide, such as
going to a space, going to an agent and typing there, or flipping a setting. Enter by default.
_Avoid_: open, select, activate, confirm

**Show**:
Bringing up the item under a field's cursor while staying in WHISTLE with that field selected,
whistle keeping the keyboard (or taking it back from the item's terminal): you look at it
without working in it. A
field that offers it does so on Space; Pick is the one that goes in.
_Avoid_: preview, peek

**Jump key**:
A regular Herdr key that runs a verb from either mode and goes to WHISTLE, unless its verb says
to keep the mode; not a switch key, since it never leaves WHISTLE, and not an own key.
_Avoid_: shortcut, hotkey, quick key

**Own key**:
A key for one of whistle's own actions in WHISTLE, such as selecting a field or going back to
TYPE; configurable like mappings, but not a mapping.
_Avoid_: built-in key, mode key, action key

**Claimed key**:
A key whistle takes over in Herdr's keys.json so that it reaches whistle instead of a binding
elsewhere; entries a person writes there themselves are not claims.
_Avoid_: synced key, reserved key

**Config layer**:
One of the four places whistle's config comes from, each over the one before: the defaults,
mod mappings, the layout's anchor, and the person's own whistle.json.
_Avoid_: mapping layer, override

**Mod mappings**:
Mappings and groups a mod offers whistle under its own name, which only add keys and count
only while that mod is in the shown layout.
_Avoid_: plugin keys, registered keys, extensions

**Mapping conflict**:
A key that two mods both offer, or that a mod offers over one of whistle's own keys; neither
mod's mapping counts until a later layer maps the key or a mod is switched off. A later layer
mapping over a mod's key is not a conflict.
_Avoid_: collision, clash, shadowing

## Fields

**Field**:
A part of the window whistle can select in WHISTLE: the terminal, a copy of a keynav mod, or a
stock field. The terminal and stock fields are whistle's own, driven with Herdr's commands; the
terminal is never a keynav field, since it is no mod.
_Avoid_: panel, block, pane

**Stock field**:
A block of one of Herdr's own spaces, tabs or agents mods, which take no part in keynav, that
whistle drives with Herdr's commands; it has no cursor, so moving to an item opens it.
_Avoid_: fallback field, built-in field

**Keynav**:
The agreement through which a mod becomes a field: it announces itself and the keys it
declares, draws its own cursor while selected, and takes moves and declared keys from whoever
drives it.
_Avoid_: field protocol, navigation API

**Declared key**:
A key a keynav field says it handles while selected, with a label for the hints; it wins over
mappings but never over own keys, and keys it doesn't declare never reach it.
_Avoid_: field key, field mapping, key-char

**Keynav mod**:
A mod that takes part in keynav; each of its copies in a layout is a field.
_Avoid_: taking-part mod, participant

**Integration**:
An agent's optional pass, after whistle is installed or when asked, that makes the blocks of a
person's layout into keynav fields with a look for the selected one; it leaves Herdr's own mods
and layouts as they are and works on clones of them.
_Avoid_: setup, adaptation, onboarding

**Driver**:
A mod that moves the keyboard between fields through keynav; whistle is one.
_Avoid_: controller, host, navigator

## Display

**Anchor**:
Whistle's block in the layout, which whistle runs in and holds the keyboard through; it draws
nothing. Every whistle block is one: the first runs, an extra one is left out and listed as a
config problem.
_Avoid_: core, engine, host, driver block

**Client**:
A mod that shows what whistle publishes and may run whistle's commands, such as whistle-ui; it
never changes how whistle works.
_Avoid_: view, UI, frontend

**Event**:
Something that just happened in whistle, such as a key that isn't mapped or a command that
failed, published with a stable kind and a default text that clients may show.
_Avoid_: flash, message, notification

**Bar**:
A client's strip in the window showing the mode badge and where the keyboard is; only an aid,
so hiding it changes what you see, never what whistle does.
_Avoid_: status bar, statusline

**Mode badge**:
The TYPE or WHISTLE label at the start of the bar.
_Avoid_: mode indicator, pill

**Hints**:
The keys that can follow the current key sequence, which a client shows in a box above the bar,
or at the window's bottom right with no bar shown.
_Avoid_: which-key, popup, help

**Flash**:
A client's short display of an event, such as on the bar in place of its label.
_Avoid_: toast, notification, error

**Config problem**:
Something wrong in whistle's config or in keys.json that whistle works around and publishes in
its config until it is fixed, such as a file that doesn't parse or a mapping to an unknown command.
_Avoid_: error, warning, issue

**Whistle state**:
What whistle tells other mods about itself: the mode, whether WHISTLE is switched on, the key
sequence so far, the terminal pane it has selected, the selected field and whether it is the
terminal, and why whistle is inert if it is.
_Avoid_: status, whistle API, public state
