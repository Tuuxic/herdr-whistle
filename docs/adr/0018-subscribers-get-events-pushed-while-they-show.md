# Subscribers get events pushed while they show

Amends [ADR 0006](0006-whistle-publishes-facts-clients-show-them.md), under which whistle never
names a client and clients learn everything from the public keys. That left a client unable to
learn that something *happened*, such as a mode switch, except by comparing `shared("whistle")`
between renders, and renders merge: measured in the sandbox, about one render per frame (15 to
20 ms), so changes 12 ms apart lost 5 of 20. Shared state is not an event queue. And the feed
held only failures.

We decided that whistle's events announce anything that happened, each in one or more **event
groups** (`problem` holds everything that went wrong), and that a client may name itself to
whistle by **subscribing**: `whistle.subscribe:{"mod","groups","kinds"}` sets that mod's filter,
and for each event the filter passes whistle runs `<mod>.whistle-event:<event>`, **only while
the mod has a block that shows** (`modBlocks` of the shown layout). The feed stays: it keeps the
last 32 events, and its readers take the same filter and say how many events were `missed`.

Subscriptions are per mod, because Herdr delivers `<mod>.<cmd>` to every shown copy, in order,
with nothing lost. Whistle keeps them in a private shared key, `whistle.subscribers`, which only
whistle writes, so a new copy of whistle reads them back after a layout change.

## Considered options

- **Push to every subscriber blindly**: a command to a mod that doesn't show, or to a hidden
  copy, returns `null` and shows an error toast, which `run` can't silence. Every event would
  toast, and clients would have to track their own hiding.
- **Callbacks on `globalThis`**: all mods share one `globalThis`, but it is undocumented in
  Herdr, the callback gets no `cx`, and callbacks from closed copies (old builds' functions
  after a save) stay callable.
- **Files and `watchFolder`**: a disk write per event, 30 to 100 ms late, and a watch slot per
  client.
- **Push only, no feed**: a hidden client would have no catch-up, and without the private key
  the subscriber list would be lost on each layout change.
- **A `level` field to pick what to flash**: the `problem` group does it.
- **Naming the ID field `type`**: it clashes with the TYPE mode; the field is `kind`.

## Consequences

- Whistle names clients now, but only the ones that named themselves, and only by the mod name
  they gave. It still draws nothing and decides no looks.
- A mod that doesn't show (hidden, on another layout, shown only as an overlay, a pane mod) gets
  no push and never an "unknown command" toast from whistle; it reads the feed when it shows
  again.
- Herdr doesn't call `close()` on hide, which is why whistle skips subscribers that don't show
  rather than relying on them to unsubscribe. A mod that unsubscribes in `close()` unsubscribes
  every copy of it.
- Push filters take `groups` and `kinds` only: a predicate can't be sent in a command.
- Whistle writes the feed once per step, so a client reading it at render misses nothing that
  stays in the window, however renders merge.
- A copy standing aside with no copy running writes the feed (`whistle-inert`) but pushes
  nothing; a copy standing aside for another copy writes nothing.
