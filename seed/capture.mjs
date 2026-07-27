/**
 * Design DNA - seed capture.
 *
 * Captures each page in `seed/philosophies/` with ticket 003's exact recipe, so
 * the shipped demo Items are indistinguishable from anything the producer CLI
 * would later write:
 *
 *   viewport 1440x900, deviceScaleFactor 2, scale 'device', never fullPage,
 *   reducedMotion 'reduce', animations 'disabled'
 *
 * and 003 decision 2's bounded wait recipe, in order:
 *
 *   1. goto at 'load'
 *   2. document.fonts.ready
 *   3. scroll to bottom and back in 0.85-viewport steps
 *   4. bounded wait on above-fold images being complete
 *   5. wait for scrollHeight stable across two rAF
 *
 * Playwright's own docs mark `networkidle` and `waitForTimeout` DISCOURAGED and
 * 003 quotes them, so neither appears here. Every wait below is bounded by a
 * deadline and resolves early on its own condition.
 *
 * Usage:
 *   node capture.mjs [outputDir]      # default: ./captures
 */
import { chromium } from 'playwright';
import { mkdir, readdir, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PAGES_DIR = path.join(HERE, 'philosophies');

/** 003 decision 1. Not configurable: every Capture is 2880x1800 and 1.6:1. */
const VIEWPORT = { width: 1440, height: 900 };
const DEVICE_SCALE_FACTOR = 2;

/** Ceilings for the two open-ended waits. Neither is a sleep. */
const FONTS_READY_MS = 5_000;
const IMAGES_COMPLETE_MS = 5_000;
const HEIGHT_STABLE_MS = 3_000;

/**
 * Step 2. `document.fonts.ready` with a deadline, so a font that never resolves
 * costs the ceiling rather than the run.
 */
async function waitForFonts(page) {
  await page.evaluate(async (ms) => {
    await Promise.race([
      document.fonts.ready,
      new Promise((resolve) => setTimeout(resolve, ms)),
    ]);
  }, FONTS_READY_MS);
}

/**
 * Step 3. Scroll to the bottom in 0.85-viewport steps and return to the top.
 * 003 decision 3: this earns its place but is not trusted, so its only job is
 * to give lazy content a chance to start, never to prove the page is built.
 */
async function scrollPass(page) {
  await page.evaluate(async () => {
    const step = Math.round(window.innerHeight * 0.85);
    const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
    let y = 0;
    // Bounded by construction: the loop cannot run more times than the page is
    // tall in steps, and re-reads scrollHeight so a growing page still ends.
    for (let i = 0; i < 200; i += 1) {
      const limit = document.documentElement.scrollHeight - window.innerHeight;
      if (y >= limit) break;
      y = Math.min(y + step, limit);
      window.scrollTo(0, y);
      await frame();
      await frame();
    }
    window.scrollTo(0, 0);
    await frame();
    await frame();
  });
}

/**
 * Step 4. Above-fold images only. An image below the fold cannot appear in a
 * viewport Capture, so blocking on it would buy nothing and cost the ceiling.
 */
async function waitForAboveFoldImages(page) {
  return page.evaluate(async (ms) => {
    const aboveFold = () =>
      Array.from(document.images).filter((img) => {
        const r = img.getBoundingClientRect();
        return r.top < window.innerHeight && r.bottom > 0 && r.width > 0 && r.height > 0;
      });

    const deadline = Date.now() + ms;
    const frame = () => new Promise((r) => requestAnimationFrame(() => r()));

    while (Date.now() < deadline) {
      const pending = aboveFold().filter((img) => !img.complete);
      if (pending.length === 0) return { pending: 0, timedOut: false };
      await frame();
    }
    return { pending: aboveFold().filter((img) => !img.complete).length, timedOut: true };
  }, IMAGES_COMPLETE_MS);
}

/**
 * Step 5. `scrollHeight` unchanged across two consecutive animation frames.
 * The last thing that moves on a settling page is usually its height.
 */
async function waitForStableHeight(page) {
  return page.evaluate(async (ms) => {
    const frame = () => new Promise((r) => requestAnimationFrame(() => r()));
    const deadline = Date.now() + ms;
    let previous = -1;
    while (Date.now() < deadline) {
      const a = document.documentElement.scrollHeight;
      await frame();
      const b = document.documentElement.scrollHeight;
      await frame();
      if (a === b && a === previous) return { height: a, timedOut: false };
      previous = b;
    }
    return { height: document.documentElement.scrollHeight, timedOut: true };
  }, HEIGHT_STABLE_MS);
}

/**
 * 003 decision 3 again: the scroll pass is provably insufficient, so report
 * first-viewport elements still sitting at opacity < 0.05 rather than assuming
 * the page finished building itself.
 */
async function countInvisibleAboveFold(page) {
  return page.evaluate(() => {
    let n = 0;
    for (const el of document.body.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (r.top >= window.innerHeight || r.bottom <= 0 || r.width === 0 || r.height === 0) continue;
      if (parseFloat(getComputedStyle(el).opacity) < 0.05) n += 1;
    }
    return n;
  });
}

async function main() {
  const outDir = path.resolve(process.argv[2] ?? path.join(HERE, 'captures'));
  await mkdir(outDir, { recursive: true });

  const pages = (await readdir(PAGES_DIR)).filter((f) => f.endsWith('.html')).sort();
  if (pages.length === 0) {
    console.error(`No .html pages found in ${PAGES_DIR}`);
    process.exitCode = 1;
    return;
  }

  const browser = await chromium.launch();
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: DEVICE_SCALE_FACTOR,
    reducedMotion: 'reduce',
  });

  let failures = 0;

  try {
    for (const file of pages) {
      const name = path.basename(file, '.html');
      const target = path.join(outDir, `${name}.png`);
      const url = new URL(`file://${path.join(PAGES_DIR, file).split(path.sep).join('/')}`).href;

      const page = await context.newPage();
      try {
        const response = await page.goto(url, { waitUntil: 'load' });
        const status = response?.status() ?? 0;
        if (status >= 400) throw new Error(`status ${status}`);

        await waitForFonts(page);
        await scrollPass(page);
        const images = await waitForAboveFoldImages(page);
        const height = await waitForStableHeight(page);
        const hidden = await countInvisibleAboveFold(page);

        await page.screenshot({
          path: target,
          fullPage: false,
          scale: 'device',
          animations: 'disabled',
          caret: 'hide',
        });

        const { size } = await stat(target);
        console.log(
          `ok   ${name}.png  ${size.toLocaleString()} bytes  ` +
            `(scrollHeight ${height.height}px)`,
        );
        if (images.timedOut) {
          console.warn(`     warn: ${images.pending} above-fold image(s) never completed`);
        }
        if (height.timedOut) {
          console.warn('     warn: scrollHeight never settled across two frames');
        }
        if (hidden > 0) {
          console.warn(
            `     warn: ${hidden} first-viewport element(s) at opacity < 0.05 after the scroll pass`,
          );
        }
      } catch (error) {
        failures += 1;
        console.error(`fail ${name}: ${error.message}`);
      } finally {
        await page.close();
      }
    }
  } finally {
    await context.close();
    await browser.close();
  }

  console.log(`\n${pages.length - failures}/${pages.length} captured into ${outDir}`);
  if (failures > 0) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
