# Key names and chords across macOS, Linux and Windows

Research for #4 (map #1, Whistle 1.0). Sources were read on 2026-11-13. Herdr sources are
pinned to herdr-app commit `be6cedef` (`H:` below is
`https://github.com/herdrdev/herdr-app/blob/be6cedef3bd655ff5a8eafc0d13458711b02d5c5/`).
Local files are under `~/.config/herdr-app/`.

## Answer

- keys.json is parsed by GPUI's `Keystroke::parse`. It treats `cmd`, `super` and `win` as
  the same platform modifier on every OS (Command on macOS, the Windows key elsewhere). It
  also accepts `secondary` (cmd on macOS, ctrl elsewhere). `option` is not a modifier name:
  on macOS Option is `alt`.
- Whistle's own key names (`keynames.js` `keyName`) always write the platform modifier as
  `super`. So `super-x` works in whistle.json on all three OSes. `cmd-x`, `win-x` and
  `secondary-x` never match in whistle, even though keys.json accepts them. A Mac user who
  copies Herdr's macOS spelling (`cmd-…`) gets a dead mapping.
- Every whistle default chord is `ctrl-…`, and Ctrl is Control on all three OSes. Herdr's
  macOS defaults use `cmd-…`, and its Windows/Linux defaults use `ctrl-shift-…` and `alt-…`.
  Neither binds any whistle default chord, so the defaults need no per-platform variant.
- Two defaults carry platform risk:
  - **`ctrl-space`**, the shipped switch key. macOS uses it by default to select the
    previous input source. Windows uses it to toggle the Chinese IME when that IME is
    installed. fcitx5 on Linux uses it as its default IME toggle. Where one of these
    applies, the OS or IME may take the key before Herdr sees it.
  - **`ctrl-[`** (cancel; in a terminal, enter WHISTLE). Herdr matches it by the key's
    unshifted character in the active layout. On layouts with no unshifted `[` key (German
    QWERTZ and most European layouts) it cannot be pressed on any OS. `escape` still works
    for cancel, but on those layouts nothing else enters WHISTLE from a terminal.
- For claims (ADR 0001): writing the claim with the same string whistle matches on
  (`super-…`, `ctrl-…`) is correct everywhere, because GPUI parses it the same way.
  Claiming `super-…` chords is useless on Windows and GNOME for many letters, because the
  OS shell takes Win/Super+letter first. That is likely but unverified; see "Not verified".

## How Herdr spells and matches a key

| Fact | Source |
|---|---|
| keys.json entries are built with `KeyBinding::load(keys, …, &gpui::DummyKeyboardMapper)`: GPUI parsing, no layout remapping | `H:src/keys.rs#L244` |
| `KeyBinding::load` splits on whitespace (a key sequence is allowed) and calls `Keystroke::parse` on each part | `H:vendor/gpui-pre/src/keymap/binding.rs#L48-L66` |
| Modifier names: `ctrl`, `alt`, `shift`, `fn`, `secondary` (cmd on macOS, ctrl elsewhere), and `cmd` / `super` / `win`, which all set `platform`. Matching ignores case. Anything else is the key, and a part that is not last is an error. | `H:vendor/gpui-pre/src/platform/keystroke.rs#L171-L233`, message at `#L114-L116` |
| A single uppercase letter means shift plus that letter (`ctrl-N` = `ctrl-shift-n`) | `…/keystroke.rs#L235-L238` |
| GPUI writes the platform modifier back as `cmd-` on macOS, `super-` on Linux and `win-` on Windows | `…/keystroke.rs#L816-L842` |
| Herdr's JS API says the same: `Modifiers.platform` is "Command on macOS, Windows key elsewhere", and the kit always writes `keystroke` with `cmd` | `gpui-kit.d.ts:416-424`, `gpui-kit.d.ts:446-457` |
| Herdr ships separate defaults: `defaults/keys.json` (ctrl+shift, alt) on Windows/Linux and `defaults/keys.macos.json` (cmd) on macOS | `H:src/keys.rs#L27-L33` |
| Sections become GPUI contexts. `mod:<name>` is matched as `mod == <name>`, so it is deeper than `global` (`Herdr`) and wins while the mod has focus | `H:src/keys.rs#L115-L130`; `AGENTS.md:502-504` |
| Reserved by Herdr: `ctrl-alt-shift-escape` (rejected in keys.json, always `app.reset`) and `escape` → `overlay.close` in the `Overlay` context | `H:src/keys.rs#L24-L25`, `#L217-L219`, `#L269-L272`; `AGENTS.md:59-60` |
| `option` is not accepted, so `"option-x"` in keys.json is a parse error. On macOS, whether Option acts as Alt is a setting (`option_as_alt`, default `auto`: Alt on US/ABC layouts, native text elsewhere) | `…/keystroke.rs#L171-L233`; `AGENTS.md:722-729` |

### What a key press looks like on each platform

| | macOS | Windows | Linux |
|---|---|---|---|
| `key` for a printable key | `charactersIgnoringModifiers` of the layout (`H:vendor/gpui-pre-macos/src/events.rs#L402-L405`, `#L494-L517`) | the layout's unshifted character for the VK (`MapVirtualKeyW`) (`H:vendor/gpui-pre-windows/src/keyboard.rs#L248-L272`) | xkb keysym (`H:vendor/gpui-pre-linux/src/linux/platform.rs`) |
| Shifted punctuation (`ctrl-shift-/`) | arrives as `ctrl-?` with `unshifted_key` `/`. Herdr also matches `ctrl-shift-/` bindings (`events.rs#L536-L546`; `keystroke.rs#L157-L166`; `AGENTS.md:526-528`) | shift is dropped for OEM and digit keys, so it arrives as `ctrl-?` (`keyboard.rs#L253-L256`, `#L275-L300`) | arrives as `ctrl-?` without shift (`H:src/keys.rs#L345-L357`) |
| Shift+Tab | `tab` + shift (`events.rs#L435`) | `tab` + shift (`H:vendor/gpui-pre-windows/src/events.rs#L1550-L1597`) | `ISO_Left_Tab` → `tab` + shift (`platform.rs#L1411`) |
| Option / AltGr typing a character | Option keeps `alt` set and puts the typed character in `key_char`, unless Option-as-Alt (`events.rs#L519-L533`) | AltGr comes in as ctrl+alt with the character in `key_char` (`events.rs#L1623-L1700`; `AGENTS.md:519`, `:523`) | not checked |
| Ctrl+`[` | `key` `[` + ctrl on layouts with an unshifted `[` (inferred from `events.rs#L494-L517`) | `key` `[` + ctrl. `ToUnicode` gives ESC, which is filtered out as a control char (`events.rs#L1647-L1650`) | `[` + ctrl (inferred; not read) |

## What whistle does with that

- `keyName` (`mods/whistle/keynames.js:7-15`) builds names from `modifiers`, not from
  `event.keystroke`. The order is ctrl, alt, super, then shift. The platform modifier is
  always `super` (`:9`), so `keyName` output is the same on all three OSes. That is good.
  The catch is that whistle accepts only one spelling, while keys.json accepts several:

  | Written in whistle.json | Matches in whistle? |
  |---|---|
  | `super-k` | yes, on all three OSes (Cmd+K on macOS, Win+K elsewhere) |
  | `cmd-k`, `win-k`, `secondary-k` | never |
  | `shift-ctrl-x`, `ctrl-X`, `Ctrl-x` | never (keys.json accepts all three) |
  | `ctrl-shift-/` | never: every OS reports `ctrl-?` (table above) |
  | `alt-x` on a Mac non-US layout or with Windows AltGr | the press can arrive as a chord when a character was meant (`@` is `alt-l` on Mac German); plain-character mappings that need Option/AltGr (`[`, `@`, `{`) don't match |

- `whistle.key-<name>` turns the name back into modifiers and only recognises `super`
  (`mods/whistle/main.js:166-170`). Claims (`keysync.js:48-52`, `:65-66`) write the same
  string. GPUI parses `super-…` as the platform modifier everywhere, so claims round-trip on
  all three OSes.
- `keysync.js` decides whether a non-chord key is bound in a global or layout section by
  comparing strings (`claimsOf`, `:48-52`). That misses a binding spelled differently
  (`Tab` vs `tab`). It only matters for non-chord keys (inferred, low risk).

## Keys the OS takes

| OS | Relevant defaults | Source |
|---|---|---|
| macOS | Cmd-Space Spotlight. **Ctrl-Space / Ctrl-Option-Space select the previous/next input source.** Ctrl-Cmd-Space Character Viewer. Cmd-Tab, Cmd-`, Cmd-H, Cmd-M, Cmd-Q are app/system keys. Ctrl-Up / Ctrl-Down are Mission Control / app windows. Ctrl-H/K/L/N are text-editing keys inside native text fields only | https://support.apple.com/en-us/102650 |
| Windows | **Ctrl+Space: "Enable or disable the Chinese input method editor (IME)"**. Ctrl+Shift switches the keyboard layout when there are several. Ctrl+Esc opens Start. Alt+Space opens the window menu. Win+Space and Win+Ctrl+Space switch input. Win+A–Z are almost all taken (C Copilot, K Cast, L lock, V clipboard history, W Widgets, …) | https://support.microsoft.com/en-us/windows/keyboard-shortcuts-in-windows-dcc61a57-8ff0-cffe-9796-cb9706c75eec |
| Linux (GNOME) | Super+Space / Shift+Super+Space switch input source. Super, Super+Tab, Super+`, Super+A, Super+L, Super+V, Super+PageUp/Down are shell keys | https://help.gnome.org/users/gnome-help/stable/keyboard-layouts.html.en, https://help.gnome.org/users/gnome-help/stable/shell-keyboard-shortcuts.html.en |
| Linux (fcitx5) | **Default "Toggle Input Method" is `Control+space`** (on non-Apple systems), plus Zenkaku_Hankaku and Hangul | https://github.com/fcitx/fcitx5/blob/master/src/lib/fcitx/globalconfig.cpp#L41-L48 |
| Terminals (all OSes) | Ctrl+[ is Escape. Programs rely on ctrl+c/d/l/r/w/a/e/u/k/z and ctrl+[. Ctrl+Space sends NUL (Emacs set-mark, some shells' completion) | `AGENTS.md:517-522` |

## Whistle's default keys, per platform

TYPE keys come from the repo's `keys.json` (merged by hand). WHISTLE keys come from
`mods/whistle/mappings.json:16-28` (own keys) and `:29-67` (map). "Claimed" means whistle
writes it to `mod:whistle` (chords, or keys a global/layout section binds).

| Key | Role | Claimed | macOS | Windows | Linux |
|---|---|---|---|---|---|
| `ctrl-space` | switch: global → `whistle.whistle`, `mod:whistle` → `whistle.type` (`keys.json:3`, `:9`) | user-written | **Risk.** The OS default is "select previous input source". It is likely taken before Herdr when that shortcut is on (it is on by default) and there is more than one input source (unverified). Ctrl-Option-Space is also taken. | **Risk** only with the Chinese IME active: the IME toggles. Otherwise fine. | **Risk** with fcitx5 (default trigger). IBus/GNOME use Super+Space, so plain GNOME is fine. |
| `ctrl-[` | `terminal` → `whistle.enter` (`keys.json:6`); own key `cancel` | yes (cancel) | Works on US/ABC. **Not pressable** on layouts without an unshifted `[` (German: `[` is Option-5). Takes Esc-via-Ctrl+[ from terminal programs (vim). | Same: works on US/UK. Not pressable on German/French etc. (`[` is AltGr). Same terminal cost. | Same, inferred. |
| `escape` | own key `cancel` | no (not a chord, unbound in global/layout) | fine; Herdr's `escape` → `overlay.close` applies only in an overlay | fine | fine |
| `ctrl-h` `ctrl-j` `ctrl-k` `ctrl-l` | own keys `field-*` | yes | Fine: no OS or Herdr-macOS binding; Cocoa's Ctrl-H/K/L only act in native text fields. The person's layout may bind them (this machine binds ctrl-h/l) and `mod:whistle` wins while whistle has focus. | Fine: Herdr's Windows defaults use `alt-h/j/k/l`, not ctrl. | Fine (same defaults as Windows). |
| `ctrl-n` | map: New tab | yes | fine (no default binding; Cmd-N is Herdr's new space) | fine | fine |
| `tab`, `shift-tab` | map: next/prev tab | only if a global/layout section binds them (none of Herdr's defaults do) | fine. Shift-Tab comes in as `tab` + shift → `shift-tab` | fine (verified on Windows by use) | fine: `ISO_Left_Tab` → `tab` + shift |
| `h j k l`, arrows, `enter`, `i`, `backspace` | own keys | no | fine | fine | fine |
| `/ ? + - , 0 p t w S` | map | no | fine on US. On non-US layouts each is matched by the character typed, which is right for keys that need no Option (`?` is Shift-ß on German). | fine (same; AltGr characters would not match) | fine |

## What this means for whistle

1. **Keep the defaults' `ctrl-…` spelling.** It means Control on all three OSes, and none of
   Herdr's per-platform defaults collide with it. No per-OS default map is needed for 1.0.
2. **Normalise key names on load (config.js).** Accept `cmd` / `win` / `secondary`
   (secondary = super on macOS, ctrl elsewhere), any modifier order and any case, then
   rewrite them to `keyName`'s form (`ctrl-alt-super-shift-key`). Herdr's macOS defaults
   and AGENTS.md teach `cmd-…`. Without this, a Mac user's `cmd-k` mapping silently does
   nothing. Also document that shifted punctuation is written as the character (`ctrl-?`,
   not `ctrl-shift-/`).
3. **`ctrl-space` as the shipped switch key** costs Mac users with two input sources, CJK
   Windows users and fcitx5 users. The README should say so and name a fallback. No single
   chord is free on all three; a candidate is an `alt-…` or `ctrl-shift-…` key not in Herdr's
   defaults (needs checking in the person's keys.json).
4. **`ctrl-[` can't be pressed on many non-US layouts.** Escape still cancels, but the
   terminal-side `whistle.enter` then has no key. The docs should point to `ctrl-space` (or
   the person's own key) as the way in, and say that binding `ctrl-[` in `terminal` takes
   Esc-by-Ctrl+[ from vim.
5. **Claimed `super-…` chords** written by keysync work on all three OSes as far as Herdr
   is concerned. On Windows and GNOME, though, most Win/Super+letter keys belong to the
   shell, so whistle should not suggest them as defaults.

## Not verified

- Nothing here was run on macOS or Linux. The platform behaviour above comes from reading
  Herdr's vendored GPUI sources, not from pressing keys.
- Whether macOS takes Ctrl-Space before the app when there is only one input source, and
  whether Herdr ever sees Win+letter keys on Windows, is inferred from the OS docs.
- Linux xkb handling of Ctrl+`[` was not read (inferred to match the other OSes).
- Whether the UI kit's own key bindings (`H:src/keys.rs#L254-L268`) bind `tab` in contexts
  whistle's bar sits in was not checked. `tab` works on Windows in practice.
