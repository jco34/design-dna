# Seed content

Five demo Items so the app is not empty on first run.

## These are original designs, not screenshots of real sites

Every page in `philosophies/` was designed and written for this repo. None of
them is a real company, product or website, and no capture here is a screenshot
of anyone else's work. That is deliberate: a library whose shipped examples are
other people's design work is a library that stores other people's design work.
The names, copy, numbers and imagery are invented.

Each page is a single self-contained `.html` file with all CSS in a `<style>`
block and **no external requests of any kind** - no CDN, no webfonts, no remote
images. Typography comes from system font stacks; imagery is CSS gradients and
inline SVG. This is what makes the capture reproducible offline, so treat it as
a constraint rather than a style choice.

## The five philosophies

| File | Direction |
| --- | --- |
| `01-swiss-modernist.html` | Strict 12-column grid, neutral palette, one saturated red, flat, sharp, dense grotesque |
| `02-warm-editorial.html` | Serif display, cream and ink, generous leading, hairline rules, photography-led |
| `03-neo-brutalist.html` | Heavy black borders, hard offset shadows, saturated primaries, chunky uniform weights |
| `04-aurora-glass.html` | Dark gradient mesh, translucent layered surfaces, pills, pronounced elevation |
| `05-technical-terminal.html` | Near-black, monospace throughout, phosphor green, hairline borders, very dense |

They exist to exercise the trait vocabulary in
`wayfinder/assets/004-extraction-schema.ts` across its full range, so an empty
library still shows what the app is for. Each is composed for the first
viewport only, because that is the only thing a Capture ever sees.

## Re-running the capture

```sh
cd seed
npm install
npx playwright install chromium
node capture.mjs                 # writes into seed/captures/
node capture.mjs ../some/where   # or into a directory you name
```

`capture.mjs` implements ticket 003's recipe exactly, so these Captures are
indistinguishable from anything the producer CLI would later write:

- viewport `1440x900`, `deviceScaleFactor: 2`, `scale: 'device'`, never
  `fullPage`, so every PNG is exactly **2880x1800** and 1.6:1
- context-level `reducedMotion: 'reduce'` and `animations: 'disabled'`
- the bounded wait recipe, in order: `goto` at `load`, `document.fonts.ready`,
  a scroll-to-bottom-and-return pass in 0.85-viewport steps, a bounded wait on
  above-fold images being `complete`, then `scrollHeight` stable across two rAF

No `networkidle` and no `waitForTimeout` appear anywhere: Playwright's own docs
mark both DISCOURAGED and 003 quotes them. Every wait is bounded by a deadline
and resolves early on its own condition, so a page that never settles costs the
ceiling rather than the run.

Per 003 decision 3, the scroll pass is kept but not trusted, so the script also
reports first-viewport elements still at `opacity < 0.05` after it. These pages
are static and animation-free, so that count is currently zero for all five.

## Editing a page

Change the HTML, re-run `node capture.mjs`, and look at the PNG. The pages are
designed against a 900px-tall viewport with `overflow: hidden`, so anything you
add pushes something else out of frame rather than creating a scrollbar. If a
page grows past the fold, the capture will silently crop it.
