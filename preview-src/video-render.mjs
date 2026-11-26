// Renders video.html to an MP4 (1920×1080, H.264 + AAC), frame by frame, so the video never depends on screen
// recording. Each frame is drawn with window.renderAt(t) in headless Chromium; the soundtrack is mixed offline by the
// page's own window.renderSound(), so picture and sound line up exactly. The video runs to the end card plus the
// page's tail while the last chord rings out, as the player does. Also writes the soundtrack next to it as a .wav.
//
// usage: node video-render.mjs <deps dir> <out.mp4> [fps]
//   deps dir: a folder outside the repo with playwright and ffmpeg-static installed:
//     npm i --prefix <deps dir> playwright ffmpeg-static && (cd <deps dir> && npx playwright install chromium)
//     (if ffmpeg-static's binary is missing: node <deps dir>/node_modules/ffmpeg-static/install.js)
//     FFMPEG=/path/to/ffmpeg uses another ffmpeg instead.
//   fps: 60 by default
// Needs network once for JetBrains Mono, and a machine where Chromium can draw text: on a bare Linux server that
// means Chromium's shared libraries and a fontconfig setup (`npx playwright install --with-deps chromium` as root).
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, dirname, resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const [deps, out, fpsArg] = process.argv.slice(2);
if (!deps || !out) { console.error('usage: node video-render.mjs <deps dir> <out.mp4> [fps]'); process.exit(1); }
const need = createRequire(join(resolve(deps), 'node_modules', '.'));
const { chromium } = need('playwright'), ffmpeg = process.env.FFMPEG || need('ffmpeg-static');
const FPS = Number(fpsArg || 60);
const html = join(dirname(fileURLToPath(import.meta.url)), 'video.html');

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
await page.goto(`${pathToFileURL(html).href}?clean=1`, { waitUntil: 'networkidle' });
// load every subset up front, so glyphs like ∞ ← → are drawn on the frame they first appear
await page.evaluate(async () => { await document.fonts.ready; await Promise.allSettled([...document.fonts].map(f => f.load())) });
const bad = await page.evaluate(() => [...document.fonts].filter(f => f.status !== 'loaded').length);
if (bad) throw new Error(`${bad} font faces failed to load (no network, or Chromium has no fontconfig)`);
const { duration, tail } = await page.evaluate(() => window.VIDEO);
const total = duration + tail;

// ---- sound: 48 kHz stereo 16-bit WAV ----
const wavB64 = await page.evaluate(async () => {
  const r = await window.renderSound(48000), SR = r.sampleRate, L = r.getChannelData(0), R = r.getChannelData(1), n = r.length;
  const dv = new DataView(new ArrayBuffer(44 + n * 4)), w = (o, s) => [...s].forEach((c, i) => dv.setUint8(o + i, c.charCodeAt(0)));
  w(0, 'RIFF'); dv.setUint32(4, 36 + n * 4, true); w(8, 'WAVEfmt '); dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 2, true);
  dv.setUint32(24, SR, true); dv.setUint32(28, SR * 4, true); dv.setUint16(32, 4, true); dv.setUint16(34, 16, true); w(36, 'data'); dv.setUint32(40, n * 4, true);
  const q = x => Math.max(-1, Math.min(1, x)) * 32767;
  for (let i = 0; i < n; i++) { dv.setInt16(44 + i * 4, q(L[i]), true); dv.setInt16(46 + i * 4, q(R[i]), true) }
  const u8 = new Uint8Array(dv.buffer); let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode(...u8.subarray(i, i + 0x8000)); return btoa(s);
});
const wav = out.replace(/\.mp4$/, '') + '.wav';
writeFileSync(wav, Buffer.from(wavB64, 'base64'));

// ---- picture: PNG frames piped into ffmpeg ----
const ff = spawn(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-', '-i', wav,
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '256k', '-shortest', '-movflags', '+faststart', out],
  { stdio: ['pipe', 'inherit', 'inherit'] });
const done = new Promise((res, rej) => ff.on('close', c => c ? rej(new Error('ffmpeg exited ' + c)) : res()));
const frames = Math.round(total * FPS);
for (let f = 0; f < frames; f++) {
  await page.evaluate(t => window.renderAt(t), Math.min(f / FPS, duration));
  const png = await page.screenshot({ type: 'png' });
  if (!ff.stdin.write(png)) await new Promise(r => ff.stdin.once('drain', r));
  if (f % (FPS * 5) === 0) console.log(`frame ${f}/${frames}`);
}
ff.stdin.end();
await done;
await browser.close();
console.log(`wrote ${out} (${total.toFixed(1)} s, ${FPS} fps) and ${wav}`);
