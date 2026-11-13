# Keynav: fields join by protocol, not by name

Whistle names no other mod, and no mod depends on whistle; a mod may offer extras when whistle
is installed (tuuxic's settings show whistle's switch only then). A mod becomes a field by
taking part in keynav: it announces itself in `shared("keynav.fields")` (`v: 1`), draws its own
cursor while selected, and handles `<mod>.keynav-<move>` commands. Each mod carries its own
copy of `keynav.js` instead of importing it from whistle, so every mod loads and works without
whistle installed, and whistle without any of them. The cost is copies that can drift; the
version field lets a driver tell them apart.
