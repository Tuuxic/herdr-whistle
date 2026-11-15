# Keynav checker

Checks a field mod's copy of `keynav.js` against keynav v2 ([the contract](../../docs/contracts/keynav.md)).
It needs only `herdr-app` and bash:

```sh
bash kit/keynav-checker/check.sh path/to/your-mod
```

`check.sh` builds a throwaway mod in a temp folder from this kit (`main.js`, `checks.js`,
`mod.json`) and your mod's `keynav.js`, and loads it with `herdr-app check`. The kit plays the
driver through Herdr's shared state. It exits 0 and prints `PASS` when your copy speaks keynav
v2; otherwise the check fails and lists each rule your copy breaks
([Checking your field](../../docs/contracts/keynav.md#checking-your-field) has the rules).
`HERDR_APP` picks the `herdr-app` to run.

To run it from your own tests, copy this folder into your repo (or check out whistle next to
it) and call `check.sh` with your mod's folder. It checks the helper only, not your view.
