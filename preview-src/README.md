# preview.png and promo video source

## preview.png

`index.html` is the poster herdr.dev shows for this mod (1600×1000), in the promo video's look;
`poster.css` holds its shared styles. The right side draws a Herdr window in WHISTLE mode (the bar
lit, the `w` hints open with `v` picked, `w` `v` landing on the pane they split) above Ctrl+Space
with keycaps warping out of it, all in HTML. Edit them, then run `./render.sh` to rewrite
`../preview.png`.

## Promo video

`video.html` is the promo video (1920×1080, 34 s plus 1.2 s on the end card), drawn in HTML: Ctrl+Space
warps a dull TYPE screen into a keycap orbit around Herdr, seven commands fly their keys out of the orbit to
where they act, the combo counter rolls to ∞, and a second Ctrl+Space lands on the title card. Open it in a
browser to play it (click for sound; Space pauses, R restarts, the scrubber seeks, `?t=7` starts paused at
7 s). The sound is [8bit-sfx](https://github.com/cportka/8bit-sfx) (MIT): the clicks, and the Orbit theme
sequenced from its one-shots, whose clock follows the video so every key press is a beat and every command
a bar.

- `video-sfx.js` holds the effects the page plays, baked by `node video-sfx-bake.mjs <8bit-sfx checkout>`;
  rerun it after naming a new effect in `video.html`.
- `node video-render.mjs <deps dir> <out.mp4> [fps]` renders the MP4 frame by frame in headless Chromium,
  with the soundtrack mixed offline by the page itself, so picture and sound line up exactly. `<deps dir>` is
  a folder outside the repo with `playwright` and `ffmpeg-static` installed; the script's header says how.
  The MP4 isn't checked in.
