/**
 * Turning a URL into a Capture, plus the exploration pass that feeds `motion`.
 *
 * Ticket 003 owns the capture recipe and `docs/EXTRACTION.md` section A owns the
 * procedure. The one thing worth stating here, because it looks like a
 * contradiction until you see the mechanism:
 *
 *   The Capture is taken with animations disabled. The exploration pass runs with
 *   animations enabled. They are two different page loads in two different
 *   browser contexts.
 *
 * 003 fixed `reducedMotion: 'reduce'` and `animations: 'disabled'` at the context
 * and screenshot level so a Capture is byte-reproducible. Observing motion under
 * those settings would report that nothing moves on every site that respects the
 * preference, which is precisely backwards. So the capture context is reduced and
 * the exploration context is not.
 *
 * That split pays for itself twice: it also makes "does this site honour
 * prefers-reduced-motion" observable for free, by comparing what the two contexts
 * report. That is a real signal about how much craft went into a design, and no
 * single-context arrangement can see it.
 */
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

/* ------------------------------------------------------------------ */
/* Constants that 003 fixed and this module may not vary               */
/* ------------------------------------------------------------------ */

/** Not configurable. Every Capture is 2880x1800 and therefore 1.6:1. */
export const VIEWPORT = { width: 1440, height: 900 } as const;
export const DEVICE_SCALE_FACTOR = 2;

const FONTS_READY_MS = 5_000;
const IMAGES_COMPLETE_MS = 5_000;
const HEIGHT_STABLE_MS = 3_000;
const NAVIGATION_MS = 45_000;

/**
 * How long to let one CSS transition play before sampling the end state.
 *
 * 003 rules out `waitForTimeout` for *settling detection*, and it is right to:
 * "wait 2s and hope the page is built" is a guess dressed as a wait, which is why
 * every step of the wait recipe polls a condition instead. This is a different
 * job. There is no condition to poll here - the question is "what does hover look
 * like once it has finished happening", and the answer needs a duration longer
 * than a typical transition. A fixed delay is the correct tool for that, and
 * refusing to use one here would be cargo-culting the rule rather than applying
 * it. 400ms covers the overwhelming majority of UI transitions.
 */
const TRANSITION_SETTLE_MS = 400;

/** Ceiling on decoding a supplied image during re-encoding. */
const DECODE_MS = 15_000;

/** For the data URL a re-encode inlines the source bytes into. */
const MIME_BY_EXTENSION: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

/* ------------------------------------------------------------------ */
/* Results                                                             */
/* ------------------------------------------------------------------ */

export interface CaptureResult {
  readonly file: string;
  readonly takenAt: string;
  readonly pixelWidth: number;
  readonly pixelHeight: number;
  readonly mode: 'viewport' | 'selector' | 'clip';
  readonly warnings: readonly string[];
  readonly cleanup: () => Promise<void>;
}

/** Why an Item was refused. 003 decision 5: nothing is written. */
export class CaptureRefused extends Error {}

export interface HoverChange {
  readonly label: string;
  readonly properties: readonly string[];
}

/**
 * What actually moved as the page scrolled, measured rather than read off CSS.
 *
 * This exists because the CSS-declaration approach it replaces was blind to the
 * most common way scroll animation is built. Measured against a GSAP +
 * ScrollTrigger site: declared CSS transitions stayed at 11 and keyframe
 * animations at 2 from the top of the page to the bottom, while 272 elements
 * carried inline transforms that the library was rewriting per frame. Reading
 * `transition-duration` and `animation-name` therefore reported almost nothing on
 * a page that is animated end to end.
 *
 * Asking "what changed position, opacity or scale between these two scroll
 * offsets, beyond what the scroll itself accounts for" is framework-agnostic. It
 * catches GSAP, Framer Motion, Lenis, the Web Animations API, a hand-rolled rAF
 * loop and plain CSS identically, because it observes the effect instead of the
 * declaration.
 */
export interface ScrollChoreography {
  readonly sampled: number;
  /** Went from effectively invisible to visible. */
  readonly revealed: number;
  /** Moved by more or less than the scroll delta: parallax or pinning. */
  readonly parallax: number;
  /** Changed scale. */
  readonly scaled: number;
  /** Reveals landed at more than one scroll depth rather than all at once. */
  readonly staggered: boolean;
  /** How many viewports tall the page is. */
  readonly depthViewports: number;
  readonly steps: number;
}

/** Evidence that motion is script-driven rather than declared in CSS. */
export interface ScriptedMotion {
  readonly libraries: readonly string[];
  readonly inlineAnimatedElements: number;
  readonly webAnimations: number;
}

export interface MotionObservations {
  readonly transitions: readonly string[];
  readonly keyframeAnimations: readonly string[];
  readonly hover: readonly HoverChange[];
  readonly hoverInertCount: number;
  readonly focusRingVisible: boolean;
  readonly scroll: ScrollChoreography;
  readonly scripted: ScriptedMotion;
  readonly stickyHeader: boolean;
  readonly ambientAnimationCount: number;
  readonly disclosuresOpened: readonly string[];
  readonly honoursReducedMotion: boolean | null;
  readonly notes: readonly string[];
}

/* ------------------------------------------------------------------ */
/* The bounded wait recipe (003 decision 2)                            */
/* ------------------------------------------------------------------ */

/*
 * A constraint that applies to every `page.evaluate` callback in this file:
 *
 *   No named inner functions. Not `const frame = () => ...`, not a nested
 *   `function` declaration.
 *
 * esbuild compiles this TypeScript with `keepNames` on, which rewrites a named
 * function expression as `__name(fn, "fn")` so stack traces stay readable. That
 * helper is defined in the *module* scope. An evaluate callback is serialised to a
 * string and re-parsed inside the browser, where `__name` does not exist, so the
 * call fails at runtime with `ReferenceError: __name is not defined` - and only at
 * runtime, since it typechecks perfectly.
 *
 * The seed script in `seed/capture.mjs` uses these same helpers safely because it
 * is plain `.mjs` and never passes through esbuild. This file does, so every
 * repeated expression below is inlined rather than named.
 */

async function waitForFonts(page: Page): Promise<void> {
  await page.evaluate(async (ms) => {
    await Promise.race([
      document.fonts.ready,
      new Promise((resolve) => setTimeout(resolve, ms)),
    ]);
  }, FONTS_READY_MS);
}

/**
 * 003 decision 3: this pass earns its place and is not trusted. It gives lazy
 * content a chance to start; it never proves the page is built. The warning
 * emitted after the Capture is what says so out loud.
 */
async function scrollPass(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const step = Math.round(window.innerHeight * 0.85);
    let y = 0;
    for (let i = 0; i < 200; i += 1) {
      const limit = document.documentElement.scrollHeight - window.innerHeight;
      if (y >= limit) break;
      y = Math.min(y + step, limit);
      window.scrollTo(0, y);
      await new Promise((r) => requestAnimationFrame(() => r(undefined)));
      await new Promise((r) => requestAnimationFrame(() => r(undefined)));
    }
    window.scrollTo(0, 0);
    await new Promise((r) => requestAnimationFrame(() => r(undefined)));
    await new Promise((r) => requestAnimationFrame(() => r(undefined)));
  });
}

async function waitForAboveFoldImages(page: Page): Promise<{ pending: number; timedOut: boolean }> {
  return page.evaluate(async (ms) => {
    const deadline = Date.now() + ms;
    let pending = 0;
    while (Date.now() < deadline) {
      pending = Array.from(document.images).filter((img) => {
        const r = img.getBoundingClientRect();
        const visible = r.top < window.innerHeight && r.bottom > 0 && r.width > 0 && r.height > 0;
        return visible && !img.complete;
      }).length;
      if (pending === 0) return { pending: 0, timedOut: false };
      await new Promise((r) => requestAnimationFrame(() => r(undefined)));
    }
    return { pending, timedOut: true };
  }, IMAGES_COMPLETE_MS);
}

async function waitForStableHeight(page: Page): Promise<{ timedOut: boolean }> {
  return page.evaluate(async (ms) => {
    const deadline = Date.now() + ms;
    let previous = -1;
    while (Date.now() < deadline) {
      const a = document.documentElement.scrollHeight;
      await new Promise((r) => requestAnimationFrame(() => r(undefined)));
      const b = document.documentElement.scrollHeight;
      await new Promise((r) => requestAnimationFrame(() => r(undefined)));
      if (a === b && a === previous) return { timedOut: false };
      previous = b;
    }
    return { timedOut: true };
  }, HEIGHT_STABLE_MS);
}

async function settle(page: Page): Promise<string[]> {
  const warnings: string[] = [];
  await waitForFonts(page);
  await scrollPass(page);
  const images = await waitForAboveFoldImages(page);
  const height = await waitForStableHeight(page);
  if (images.timedOut) {
    warnings.push(`${images.pending} above-fold image(s) never completed`);
  }
  if (height.timedOut) warnings.push('scrollHeight never settled across two frames');

  const hidden = await page.evaluate(() => {
    let n = 0;
    for (const el of document.body.querySelectorAll('*')) {
      const r = el.getBoundingClientRect();
      if (r.top >= window.innerHeight || r.bottom <= 0 || r.width === 0 || r.height === 0) continue;
      if (parseFloat(getComputedStyle(el).opacity) < 0.05) n += 1;
    }
    return n;
  });
  if (hidden > 0) {
    warnings.push(`${hidden} first-viewport element(s) at opacity < 0.05 after the scroll pass`);
  }
  return warnings;
}

/* ------------------------------------------------------------------ */
/* Refusal (003 decision 5 and 6)                                      */
/* ------------------------------------------------------------------ */

const NOT_AT_URL_PATTERNS: ReadonlyArray<{ host: RegExp; path?: RegExp; why: string }> = [
  { host: /(^|\.)figma\.com$/, path: /^\/(file|design|proto|board)\//, why: 'a Figma document' },
  { host: /(^|\.)dribbble\.com$/, path: /^\/shots\//, why: 'a Dribbble shot page' },
  { host: /(^|\.)behance\.net$/, path: /^\/gallery\//, why: 'a Behance gallery' },
  { host: /(^|\.)pinterest\.[a-z.]+$/, path: /^\/pin\//, why: 'a Pinterest pin' },
  { host: /^docs\.google\.com$/, why: 'a Google Docs document' },
  { host: /^drive\.google\.com$/, why: 'Google Drive' },
  { host: /(^|\.)notion\.so$/, why: 'a Notion workspace page' },
  { host: /(^|\.)atlassian\.net$/, why: 'an Atlassian instance' },
];

/**
 * Refused before navigating at all. The design at these addresses is inside an
 * application that requires an account, so what a headless browser photographs is
 * a login screen, and 001's one-capture-per-Item rule means that login screen
 * would *become* the Item.
 */
export function refuseBeforeNavigation(target: string): string | null {
  let url: URL;
  try {
    url = new URL(target);
  } catch {
    return `not a valid URL`;
  }
  for (const rule of NOT_AT_URL_PATTERNS) {
    if (!rule.host.test(url.hostname)) continue;
    if (rule.path !== undefined && !rule.path.test(url.pathname)) continue;
    return (
      `the design is not at this URL - it is ${rule.why}, which renders as a login or an ` +
      `app shell to a headless browser. Screenshot it yourself and pass the image instead.`
    );
  }
  return null;
}

/**
 * 003 found `linear.app/no-such-page-xyz` returning HTTP 200 with a login screen
 * and dribbble returning 202, so a status check alone creates Items whose Capture
 * is a sign-in form. These three heuristics are what it takes.
 */
async function refuseAfterNavigation(page: Page, status: number): Promise<string | null> {
  if (status >= 400) return `HTTP ${status}`;

  const passwordVisible = await page
    .locator('input[type="password"]:visible')
    .count()
    .catch(() => 0);
  if (passwordVisible > 0) return 'a visible password field: this is a login screen';

  const thin = await page.evaluate(() => ({
    text: (document.body.innerText ?? '').trim().length,
    oneViewport: document.documentElement.scrollHeight <= window.innerHeight + 40,
  }));
  if (thin.text < 300 && thin.oneViewport) {
    return `only ${thin.text} characters of text in a single viewport: nothing was rendered`;
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* The exploration pass (docs/EXTRACTION.md A.3)                       */
/* ------------------------------------------------------------------ */

/** Properties whose change on hover is worth recording, in CSS names. */
const WATCHED = [
  'background-color',
  'color',
  'border-color',
  'box-shadow',
  'transform',
  'opacity',
  'text-decoration-line',
  'border-radius',
  'filter',
  'letter-spacing',
] as const;

/**
 * What gets hovered: one representative of each interactive kind, not every
 * element. Hovering 400 links reports the same finding 400 times and costs a
 * minute doing it.
 */
const HOVER_TARGETS: ReadonlyArray<{ label: string; selector: string }> = [
  { label: 'primary button', selector: 'button, [role="button"], a[class*="button"], a[class*="btn"]' },
  { label: 'nav link', selector: 'nav a, header a' },
  { label: 'card', selector: 'article, [class*="card"]' },
  { label: 'body link', selector: 'main a, p a' },
  { label: 'input', selector: 'input:not([type="hidden"]), textarea' },
  { label: 'table row', selector: 'tbody tr, [role="row"]' },
  { label: 'footer link', selector: 'footer a' },
];

/**
 * Only disclosure controls, and only ones that cannot navigate or submit.
 *
 * The exploration pass is read-only and that is a hard rule, not a preference:
 * this runs unattended against a stranger's site. Anything that could submit a
 * form, authenticate, purchase, post, or leave the origin is out of scope, which
 * is why this list is an allowlist of things whose entire purpose is to toggle
 * local visibility rather than a denylist of things that look dangerous.
 */
const DISCLOSURE_SELECTORS = [
  'summary',
  'button[aria-expanded]',
  '[role="tab"]',
  'button[aria-haspopup="true"]',
] as const;

async function snapshotStyles(page: Page, selector: string, index: number) {
  return page.evaluate(
    ({ selector, index, watched }) => {
      const el = document.querySelectorAll(selector)[index];
      if (el === undefined) return null;
      const style = getComputedStyle(el);
      const out: Record<string, string> = {};
      for (const prop of watched) out[prop] = style.getPropertyValue(prop);
      return out;
    },
    { selector, index, watched: [...WATCHED] },
  );
}

async function observeHover(page: Page): Promise<{ changes: HoverChange[]; inert: number }> {
  const changes: HoverChange[] = [];
  let inert = 0;

  for (const target of HOVER_TARGETS) {
    const locator = page.locator(target.selector);
    const count = await locator.count().catch(() => 0);
    if (count === 0) continue;

    // First visible one, capped: a locator can match hundreds and only the first
    // few are plausibly above the fold and representative.
    let index = -1;
    for (let i = 0; i < Math.min(count, 8); i += 1) {
      if (await locator.nth(i).isVisible().catch(() => false)) {
        index = i;
        break;
      }
    }
    if (index === -1) continue;

    const before = await snapshotStyles(page, target.selector, index);
    if (before === null) continue;

    try {
      await locator.nth(index).hover({ timeout: 2_000, trial: false });
    } catch {
      continue;
    }
    await page.waitForTimeout(TRANSITION_SETTLE_MS);
    const after = await snapshotStyles(page, target.selector, index);
    if (after === null) continue;

    const moved = WATCHED.filter((prop) => before[prop] !== after[prop]);
    if (moved.length === 0) inert += 1;
    else changes.push({ label: target.label, properties: moved });

    // Park the pointer somewhere inert so the next measurement is not taken
    // while the previous element is still hovered.
    await page.mouse.move(2, 2).catch(() => {});
    await page.waitForTimeout(120);
  }

  return { changes, inert };
}

async function observeFocusRing(page: Page): Promise<boolean> {
  try {
    await page.keyboard.press('Tab');
    await page.waitForTimeout(150);
    return await page.evaluate(() => {
      const el = document.activeElement;
      if (el === null || el === document.body) return false;
      const style = getComputedStyle(el);
      const outline =
        style.outlineStyle !== 'none' && parseFloat(style.outlineWidth || '0') > 0;
      const ring = style.boxShadow !== 'none' && style.boxShadow !== '';
      return outline || ring;
    });
  } catch {
    return false;
  }
}

async function observeStyleRules(page: Page) {
  return page.evaluate(() => {
    const transitions = new Set<string>();
    const animations = new Set<string>();
    let ambient = 0;

    for (const el of Array.from(document.querySelectorAll('*')).slice(0, 4000)) {
      const style = getComputedStyle(el);
      const dur = style.transitionDuration;
      if (dur !== '' && dur !== '0s' && !dur.startsWith('0s,')) {
        transitions.add(
          `${style.transitionProperty} ${dur} ${style.transitionTimingFunction}`.trim(),
        );
      }
      const name = style.animationName;
      if (name !== '' && name !== 'none') {
        animations.add(`${name} ${style.animationDuration} ${style.animationTimingFunction}`.trim());
        if (style.animationIterationCount === 'infinite') ambient += 1;
      }
    }
    // Most-used first: a transition declared on one element is noise next to one
    // declared on two hundred.
    return {
      transitions: [...transitions].slice(0, 8),
      animations: [...animations].slice(0, 8),
      ambient,
    };
  });
}

/** Named libraries are a cheap, strong signal, and worth reporting by name. */
async function detectScriptedMotion(page: Page): Promise<ScriptedMotion> {
  return page.evaluate(() => {
    const w = window as unknown as Record<string, unknown>;
    const libraries: string[] = [];

    if (w.gsap !== undefined) libraries.push('GSAP');
    if (w.ScrollTrigger !== undefined) libraries.push('GSAP ScrollTrigger');
    if (w.Lenis !== undefined || document.documentElement.classList.contains('lenis')) {
      libraries.push('Lenis smooth scroll');
    }
    if (document.querySelector('[data-framer-name], [data-projection-id]') !== null) {
      libraries.push('Framer Motion');
    }
    if (document.querySelector('[data-aos]') !== null) libraries.push('AOS');
    if (w.Swiper !== undefined) libraries.push('Swiper');
    if (document.querySelector('#smooth-wrapper, [data-scroll-container]') !== null) {
      libraries.push('a smooth-scroll container');
    }

    // Script filenames catch a library that does not expose a global.
    for (const script of Array.from(document.scripts)) {
      const name = (script.src.split('/').pop() ?? '').toLowerCase();
      if (name.includes('gsap') && !libraries.includes('GSAP')) libraries.push('GSAP');
      if (name.includes('scrolltrigger') && !libraries.includes('GSAP ScrollTrigger')) {
        libraries.push('GSAP ScrollTrigger');
      }
      if (name.includes('locomotive')) libraries.push('Locomotive Scroll');
      if (name.includes('scrollmagic')) libraries.push('ScrollMagic');
    }

    const inlineAnimated = Array.from(document.querySelectorAll('[style]')).filter((el) => {
      const style = (el as HTMLElement).style;
      return style.transform !== '' || style.opacity !== '' || style.translate !== '';
    }).length;

    return {
      libraries: [...new Set(libraries)],
      inlineAnimatedElements: inlineAnimated,
      webAnimations: document.getAnimations === undefined ? 0 : document.getAnimations().length,
    };
  });
}

/**
 * Walk the whole page and measure what moves, rather than sampling 1.5 viewports
 * and counting hidden elements.
 *
 * Probes are held on `window` between evaluate calls so the same elements are
 * compared at every depth. Identity by DOM reference rather than by index, because
 * a scroll-triggered reveal can insert or reorder nodes and an index-based match
 * would then be comparing two different elements.
 */
async function observeScrollChoreography(page: Page): Promise<{
  choreography: ScrollChoreography;
  sticky: boolean;
}> {
  const geometry = await page.evaluate(() => {
    const w = window as unknown as { __dnaProbes?: Element[] };
    w.__dnaProbes = Array.from(document.querySelectorAll('body *'))
      .filter((el) => {
        const r = el.getBoundingClientRect();
        return r.width * r.height > 400 && r.width < window.innerWidth * 2;
      })
      .slice(0, 400);
    return {
      probes: w.__dnaProbes.length,
      height: document.documentElement.scrollHeight,
      viewport: window.innerHeight,
    };
  });

  const header = await page.evaluate(() => {
    const el = document.querySelector('header, [role="banner"], nav');
    if (el === null) return null;
    return {
      position: getComputedStyle(el).position,
      height: el.getBoundingClientRect().height,
    };
  });

  const depthViewports = geometry.height / Math.max(1, geometry.viewport);
  // Enough steps to cross every reveal threshold on a long page, capped so a
  // 40-viewport page does not turn one Item into a five-minute run.
  const steps = Math.min(10, Math.max(4, Math.round(depthViewports)));
  const limit = Math.max(0, geometry.height - geometry.viewport);

  interface Sample {
    readonly y: number;
    readonly frames: ReadonlyArray<{
      documentTop: number;
      opacity: number;
      scale: number;
    } | null>;
  }

  const samples: Sample[] = [];

  for (let step = 0; step <= steps; step += 1) {
    const y = Math.round((limit * step) / steps);
    await page.evaluate((to) => window.scrollTo(0, to), y);
    // Long enough for a scroll-triggered transition to run to completion, since
    // catching one mid-flight would read as movement that is not really there.
    await page.waitForTimeout(850);

    const frames = await page.evaluate(() => {
      const w = window as unknown as { __dnaProbes?: Element[] };
      const probes = w.__dnaProbes ?? [];
      return probes.map((el) => {
        if (!el.isConnected) return null;
        const r = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        const matrix = new DOMMatrixReadOnly(style.transform === 'none' ? '' : style.transform);
        return {
          // Document-space, so ordinary scrolling cancels out and only genuine
          // movement survives.
          documentTop: r.top + window.scrollY,
          opacity: parseFloat(style.opacity),
          scale: Math.abs(matrix.a),
        };
      });
    });

    samples.push({ y, frames });
  }

  await page.evaluate(() => {
    const w = window as unknown as { __dnaProbes?: Element[] };
    delete w.__dnaProbes;
    window.scrollTo(0, 0);
  });
  await page.waitForTimeout(400);

  const headerAfter = await page.evaluate(() => {
    const el = document.querySelector('header, [role="banner"], nav');
    if (el === null) return null;
    return {
      position: getComputedStyle(el).position,
      height: el.getBoundingClientRect().height,
    };
  });

  let revealed = 0;
  let parallax = 0;
  let scaled = 0;
  const revealSteps = new Set<number>();

  for (let probe = 0; probe < geometry.probes; probe += 1) {
    let minOpacity = Number.POSITIVE_INFINITY;
    let maxOpacity = Number.NEGATIVE_INFINITY;
    let minTop = Number.POSITIVE_INFINITY;
    let maxTop = Number.NEGATIVE_INFINITY;
    let minScale = Number.POSITIVE_INFINITY;
    let maxScale = Number.NEGATIVE_INFINITY;
    let firstVisibleAt: number | null = null;

    for (let step = 0; step < samples.length; step += 1) {
      const frame = samples[step]!.frames[probe];
      if (frame === null || frame === undefined) continue;
      minOpacity = Math.min(minOpacity, frame.opacity);
      maxOpacity = Math.max(maxOpacity, frame.opacity);
      minTop = Math.min(minTop, frame.documentTop);
      maxTop = Math.max(maxTop, frame.documentTop);
      minScale = Math.min(minScale, frame.scale);
      maxScale = Math.max(maxScale, frame.scale);
      if (firstVisibleAt === null && frame.opacity > 0.5) firstVisibleAt = step;
    }

    if (minOpacity < 0.05 && maxOpacity > 0.5) {
      revealed += 1;
      if (firstVisibleAt !== null) revealSteps.add(firstVisibleAt);
    }
    // 8px of document-space drift is past layout jitter and reflow noise.
    if (maxTop - minTop > 8) parallax += 1;
    if (maxScale - minScale > 0.02) scaled += 1;
  }

  const sticky =
    header !== null &&
    headerAfter !== null &&
    (headerAfter.position === 'fixed' ||
      headerAfter.position === 'sticky' ||
      Math.abs(headerAfter.height - header.height) > 4);

  return {
    choreography: {
      sampled: geometry.probes,
      revealed,
      parallax,
      scaled,
      // Reveals landing at several depths is sequencing; all at one depth is a
      // single group arriving together.
      staggered: revealSteps.size > 1,
      depthViewports: Math.round(depthViewports * 10) / 10,
      steps: samples.length,
    },
    sticky,
  };
}

async function observeDisclosures(page: Page): Promise<string[]> {
  const opened: string[] = [];
  for (const selector of DISCLOSURE_SELECTORS) {
    const locator = page.locator(selector);
    const count = await locator.count().catch(() => 0);
    if (count === 0) continue;

    const first = locator.first();
    if (!(await first.isVisible().catch(() => false))) continue;

    // Never inside a form, and never something that submits. A disclosure control
    // that happens to sit in a form is not worth the risk of finding out.
    const risky = await first
      .evaluate((el) => {
        const inForm = el.closest('form') !== null;
        const type = (el as HTMLButtonElement).type;
        return inForm || type === 'submit';
      })
      .catch(() => true);
    if (risky) continue;

    const heightBefore = await page.evaluate(() => document.documentElement.scrollHeight);
    try {
      await first.click({ timeout: 2_000, noWaitAfter: true });
    } catch {
      continue;
    }
    await page.waitForTimeout(TRANSITION_SETTLE_MS);
    const heightAfter = await page.evaluate(() => document.documentElement.scrollHeight);
    if (heightAfter !== heightBefore) opened.push(`${selector} (page height changed)`);
    else opened.push(selector);

    // Put it back. The exploration pass must leave the page as it found it.
    await first.click({ timeout: 2_000, noWaitAfter: true }).catch(() => {});
    await page.waitForTimeout(200);
  }
  return opened;
}

async function explore(context: BrowserContext, url: string): Promise<MotionObservations> {
  const page = await context.newPage();
  const notes: string[] = [];
  try {
    await page.goto(url, { waitUntil: 'load', timeout: NAVIGATION_MS });
    await waitForFonts(page);
    await waitForStableHeight(page);

    const rules = await observeStyleRules(page);
    const scripted = await detectScriptedMotion(page);
    const hover = await observeHover(page);
    const focusRingVisible = await observeFocusRing(page);
    const scroll = await observeScrollChoreography(page);
    const disclosuresOpened = await observeDisclosures(page);

    if (hover.changes.length === 0 && hover.inert > 0) {
      notes.push(
        `${hover.inert} interactive kind(s) showed no hover change at all, which may be a ` +
          `deliberate restraint rather than an absence of craft`,
      );
    }

    // The disagreement itself is the finding, and it is worth stating explicitly
    // rather than leaving the agent to infer it from two numbers. A page with
    // almost no declared CSS motion but hundreds of inline transforms is animated
    // in JavaScript, and the CSS figures below understate it enormously.
    if (
      rules.transitions.length + rules.animations.length < 15 &&
      scripted.inlineAnimatedElements > 50
    ) {
      notes.push(
        `declared CSS motion is sparse (${rules.transitions.length} transitions, ` +
          `${rules.animations.length} keyframe animations) but ${scripted.inlineAnimatedElements} ` +
          `elements carry inline transform or opacity, so the motion is driven by script ` +
          `rather than declared in CSS. Trust the measured scroll figures over the CSS list`,
      );
    }

    return {
      transitions: rules.transitions,
      keyframeAnimations: rules.animations,
      hover: hover.changes,
      hoverInertCount: hover.inert,
      focusRingVisible,
      scroll: scroll.choreography,
      scripted,
      stickyHeader: scroll.sticky,
      ambientAnimationCount: rules.ambient,
      disclosuresOpened,
      honoursReducedMotion: null,
      notes,
    };
  } finally {
    await page.close().catch(() => {});
  }
}

/**
 * The same style sweep under `prefers-reduced-motion: reduce`. If a site declares
 * transitions with motion allowed and materially fewer with it reduced, it is
 * honouring the preference, and that is a craft signal worth recording.
 */
async function countTransitionsReduced(browser: Browser, url: string): Promise<number | null> {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: DEVICE_SCALE_FACTOR,
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  try {
    await page.goto(url, { waitUntil: 'load', timeout: NAVIGATION_MS });
    await waitForFonts(page);
    const rules = await observeStyleRules(page);
    return rules.transitions.length + rules.animations.length;
  } catch {
    return null;
  } finally {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
  }
}

/* ------------------------------------------------------------------ */
/* The public entry point                                              */
/* ------------------------------------------------------------------ */

export interface CaptureUrlOptions {
  readonly selector?: string;
  readonly clip?: { x: number; y: number; width: number; height: number };
  readonly headed?: boolean;
  readonly waitBeforeCapture?: number;
  /** Off for `--no-explore`, which skips the second and third page loads. */
  readonly explore?: boolean;
}

export interface CaptureUrlResult extends CaptureResult {
  readonly observations: MotionObservations | null;
}

export async function captureUrl(
  url: string,
  options: CaptureUrlOptions = {},
): Promise<CaptureUrlResult> {
  const preflight = refuseBeforeNavigation(url);
  if (preflight !== null) throw new CaptureRefused(preflight);

  const dir = await mkdtemp(path.join(tmpdir(), 'dna-capture-'));
  const file = path.join(dir, 'capture.png');
  const cleanup = async () => {
    await rm(dir, { recursive: true, force: true });
  };

  const browser = await chromium.launch({ headless: options.headed !== true });
  try {
    /* --- The Capture: reduced motion, animations disabled ----------- */
    const shotContext = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: DEVICE_SCALE_FACTOR,
      reducedMotion: 'reduce',
    });
    const page = await shotContext.newPage();

    let warnings: string[];
    let takenAt: string;
    let mode: 'viewport' | 'selector' | 'clip' = 'viewport';

    try {
      const response = await page.goto(url, { waitUntil: 'load', timeout: NAVIGATION_MS });
      const status = response?.status() ?? 0;

      const refusal = await refuseAfterNavigation(page, status);
      if (refusal !== null) throw new CaptureRefused(refusal);

      warnings = await settle(page);

      if (options.waitBeforeCapture !== undefined && options.waitBeforeCapture > 0) {
        await page.waitForTimeout(options.waitBeforeCapture);
      }

      takenAt = new Date().toISOString();

      if (options.selector !== undefined) {
        mode = 'selector';
        // `locator.screenshot` waits for actionability, scrolls the element into
        // view and clips to it. This is why 003 revised 001's no-crop rule: it
        // adds nothing to the common path and needs no UI at all.
        await page.locator(options.selector).first().screenshot({
          path: file,
          scale: 'device',
          animations: 'disabled',
          caret: 'hide',
          timeout: 15_000,
        });
      } else if (options.clip !== undefined) {
        mode = 'clip';
        await page.screenshot({
          path: file,
          fullPage: false,
          clip: options.clip,
          scale: 'device',
          animations: 'disabled',
          caret: 'hide',
        });
      } else {
        await page.screenshot({
          path: file,
          fullPage: false,
          scale: 'device',
          animations: 'disabled',
          caret: 'hide',
        });
      }
    } catch (error) {
      await page.close().catch(() => {});
      await shotContext.close().catch(() => {});
      await cleanup();
      if (error instanceof CaptureRefused) throw error;
      throw new CaptureRefused((error as Error).message);
    }

    await page.close().catch(() => {});
    await shotContext.close().catch(() => {});

    /* --- The exploration pass: motion enabled ----------------------- */
    let observations: MotionObservations | null = null;
    if (options.explore !== false) {
      const exploreContext = await browser.newContext({
        viewport: VIEWPORT,
        deviceScaleFactor: DEVICE_SCALE_FACTOR,
        reducedMotion: 'no-preference',
      });
      try {
        observations = await explore(exploreContext, url);
        const reducedCount = await countTransitionsReduced(browser, url);
        if (reducedCount !== null) {
          const fullCount =
            observations.transitions.length + observations.keyframeAnimations.length;
          observations = {
            ...observations,
            honoursReducedMotion: fullCount > 0 ? reducedCount < fullCount : null,
          };
        }
      } catch (error) {
        // A failed exploration must never lose a good Capture. Motion simply
        // stays Undetermined, which is the honest outcome of not having observed
        // it, and the warning says why.
        warnings = [
          ...warnings,
          `exploration pass failed (${(error as Error).message}); motion stays undetermined`,
        ];
      } finally {
        await exploreContext.close().catch(() => {});
      }
    }

    const { readPngSize } = await import('./png.js');
    const size = await readPngSize(file);

    return {
      file,
      takenAt,
      pixelWidth: size.width,
      pixelHeight: size.height,
      mode,
      warnings,
      observations,
      cleanup,
    };
  } finally {
    await browser.close().catch(() => {});
  }
}

/**
 * Explore a live URL and take no Capture at all. This is `dna re-explore`.
 *
 * The Capture invariant is the reason this is a separate function rather than a
 * flag on `captureUrl`. 001 fixes the Capture at the moment of saving and never
 * refreshes it, and 003 confirms nothing re-fetches. Both stand: this opens no
 * screenshot path, writes no PNG, and cannot touch the stored one. What it
 * revisits is the *page*, because motion's evidence was never the Capture.
 *
 * The refusal checks still run. A URL that now serves a login screen or a dead
 * page must not be allowed to overwrite good motion data with observations of a
 * sign-in form.
 */
export async function exploreUrl(url: string): Promise<MotionObservations> {
  const preflight = refuseBeforeNavigation(url);
  if (preflight !== null) throw new CaptureRefused(preflight);

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: DEVICE_SCALE_FACTOR,
      reducedMotion: 'no-preference',
    });

    // Refusal is judged on its own page, before the exploration commits to a page
    // it may have to throw away.
    const probe = await context.newPage();
    try {
      const response = await probe.goto(url, { waitUntil: 'load', timeout: NAVIGATION_MS });
      const refusal = await refuseAfterNavigation(probe, response?.status() ?? 0);
      if (refusal !== null) throw new CaptureRefused(refusal);
    } finally {
      await probe.close().catch(() => {});
    }

    try {
      const observations = await explore(context, url);
      const reducedCount = await countTransitionsReduced(browser, url);
      if (reducedCount === null) return observations;
      const fullCount = observations.transitions.length + observations.keyframeAnimations.length;
      return {
        ...observations,
        honoursReducedMotion: fullCount > 0 ? reducedCount < fullCount : null,
      };
    } finally {
      await context.close().catch(() => {});
    }
  } finally {
    await browser.close().catch(() => {});
  }
}

/**
 * Re-encode a supplied `.jpg`/`.jpeg`/`.webp` to PNG.
 *
 * 006's invariant is that every stored Capture is a PNG, which keeps the png-only
 * orphan scan in `check-library.ts` true for every Item however it was made.
 * Playwright does the conversion because it is already a dependency and can
 * decode every format a browser can; adding `sharp` for this would mean a native
 * build step to do what the browser already does.
 */
export async function reencodeToPng(source: string): Promise<{ file: string; cleanup: () => Promise<void> }> {
  const dir = await mkdtemp(path.join(tmpdir(), 'dna-encode-'));
  const file = path.join(dir, 'capture.png');
  const cleanup = async () => {
    await rm(dir, { recursive: true, force: true });
  };

  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();

    // A base64 data URL rather than a `file://` src, and this is not a style
    // preference. `setContent` gives the page an `about:blank` origin, from which
    // Chromium blocks `file://` subresource loads outright - the image never
    // loads and never errors, so an `onload`/`onerror` promise waits forever.
    // Inlining the bytes sidesteps the origin question entirely.
    const bytes = await readFile(source);
    const mime = MIME_BY_EXTENSION[path.extname(source).toLowerCase()] ?? 'image/png';
    const dataUrl = `data:${mime};base64,${bytes.toString('base64')}`;

    await page.setContent(
      `<style>html,body{margin:0;padding:0;line-height:0}</style><img id="i" src="${dataUrl}">`,
    );
    const img = page.locator('#i');
    await img.waitFor({ state: 'attached', timeout: 15_000 });

    // Bounded. The previous version had no ceiling here, so an image the browser
    // could neither decode nor reject hung the whole run.
    const natural = await img.evaluate(
      (el, ms) =>
        new Promise<{ w: number; h: number }>((resolve) => {
          const image = el as HTMLImageElement;
          if (image.complete) {
            resolve({ w: image.naturalWidth, h: image.naturalHeight });
            return;
          }
          image.onload = () => resolve({ w: image.naturalWidth, h: image.naturalHeight });
          image.onerror = () => resolve({ w: 0, h: 0 });
          setTimeout(() => resolve({ w: image.naturalWidth, h: image.naturalHeight }), ms);
        }),
      DECODE_MS,
    );
    if (natural.w === 0 || natural.h === 0) {
      throw new Error('the browser could not decode this image');
    }

    // Match the viewport to the image so `scale: 'device'` at DPR 1 yields the
    // original pixel dimensions rather than a resampled version.
    await page.setViewportSize({ width: natural.w, height: natural.h });
    await img.screenshot({ path: file, scale: 'device', animations: 'disabled' });
    return { file, cleanup };
  } catch (error) {
    await cleanup();
    throw error;
  } finally {
    await browser.close().catch(() => {});
  }
}
