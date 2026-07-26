# 003 findings - what a good capture is, and what happens when there is not one

Ticket: [`../tickets/003-how-a-url-becomes-an-item.md`](../tickets/003-how-a-url-becomes-an-item.md).

**Status: settled, and the ticket's core empirical claim is confirmed harder than
it was stated.** Marketing pages at a 1440-wide viewport are not tall in the
sense of two or three screens. The measured median across nine pages is
**10,898px, roughly twelve viewports, an aspect ratio of 7.6:1**, with a worst
case of 14,758px at 10.3:1. A full-page image of any of them is unusable as a
grid card and is a worse input to extraction than the hero alone. So:

- **Viewport `1440x900`, `deviceScaleFactor: 2`, never `fullPage`.** One
  Capture, 1.6:1, the same aspect ratio for every Item.
- **Wait recipe:** `goto` on `load`, scroll to the bottom in viewport-sized
  steps, return to the top, await fonts and above-the-fold image decode, then
  `screenshot({ animations: 'disabled', caret: 'hide', scale: 'device' })`.
- **No banner dismissal.** Capture the noise and re-take by hand on the rare
  page it ruins.
- **Cropping is a `--selector` flag on the producer CLI**, backed by
  `locator.screenshot()`, which the Playwright docs confirm is a first-class API
  that scrolls the element into view and clips to it. This is a better answer to
  "I wanted just the nav bar" than any cropping UI would have been.
- **A failed capture refuses the Item.** Nothing is written, exit code is
  non-zero. 001's one-capture-per-item invariant survives untouched.
- **Playwright, not Puppeteer.**

Sections 2 and 7 are the ones with teeth. Section 2 is the measurement table
that settles the viewport. Section 7 argues that consent-banner dismissal is a
trap for a single-user CLI, against the temptation to reach for a filter list.

Environment: Windows 11, Chromium driven through the Playwright MCP server,
viewport set to `1440x900`, `devicePixelRatio` **1** in the measuring browser,
US-routed network egress. Measured 2026-07-26.

> The sample is ten pages measured once each, plus five deliberate failure
> probes. That settles the viewport question, which only needs an order of
> magnitude, and does **not** establish a success rate for the wait recipe.
> Nothing downstream blocks on a success rate, so it is left as measured. The
> US egress is a real limitation and is called out where it bites (section 7).

## 1. What I actually ran

Every number in section 2 comes from one script evaluated in the page after
`page.goto(url, { waitUntil: 'load' })` plus a 1.2-1.5s settle, at
`page.setViewportSize({ width: 1440, height: 900 })`. It reads:

- `document.documentElement.scrollHeight`, the ticket's core claim.
- Every `position: fixed` or `position: sticky` element wider than a quarter of
  the viewport and taller than 40px, with the fraction of the viewport it
  covers, then filtered on consent wording. This is the banner measurement.
- A regex sweep of every `script[src]`, `iframe[src]`, `link[href]` and the
  first 400KB of `outerHTML` against host and class-name signatures for thirteen
  consent platforms (OneTrust/Optanon/CookieLaw, Cookiebot, Quantcast, Didomi,
  Usercentrics, TrustArc, Osano, Iubenda, Termly, CookieYes,
  Sourcepoint/consensu, Klaro, Axeptio).
- `document.images` intersecting the first viewport, counting `loading="lazy"`
  and `!img.complete`. This is the lazy-loading measurement.
- Every element intersecting the first viewport with computed `opacity < 0.05`
  (a scroll-reveal that has not fired) or a live `animation-name` or a
  transitioned `transform`.

Then the same script again after a scroll pass (0.85-viewport steps to the
bottom, 90ms apart, then back to top), which is how the before/after columns are
produced.

Byte sizes in section 3 are real `page.screenshot()` buffers measured with
`buffer.length`.

I did not accept a consent dialog, log in, or submit a form anywhere. Pages that
showed a banner were recorded and left alone.

## 2. The measurements. Full-page is dead on arrival.

All at viewport `1440x900`. "Ratio" is document height divided by 1440, so it is
the aspect ratio a full-page Capture would have. "Screens" is document height
divided by 900.

| Site | `scrollHeight` | Ratio (h:w) | Screens | Consent overlay | Lazy imgs above fold | Hidden (`opacity<0.05`) above fold |
| --- | ---: | ---: | ---: | --- | ---: | ---: |
| stripe.com | **14,758** | 10.25 : 1 | 16.4 | none seen (US egress) | 0 / 1 | 4 |
| nytimes.com | 14,322 | 9.95 : 1 | 15.9 | none seen (US egress) | 0 / 1 | 0 |
| monzo.com | 14,177 | 9.85 : 1 | 15.8 | **first-party, 215px, 15.9% of viewport** | 4 / 8 | 1 |
| tailwindcss.com | 11,656 | 8.09 : 1 | 13.0 | none | 0 / 1 | 0 |
| linear.app | **10,898** (median) | 7.57 : 1 | 12.1 | none | **6 / 8** | 2 |
| figma.com | 8,892 | 6.17 : 1 | 9.9 | **first-party, 324px, 10.5% of viewport** | 0 / 1 | 3 |
| vercel.com | 5,323 | 3.70 : 1 | 5.9 | none | 0 / 0 | 8 |
| klarna.com | 4,654 | 3.23 : 1 | 5.2 | **OneTrust, 194px, 11.3% of viewport** | 0 / 0 | 1 |
| anthropic.com | 3,211 | 2.23 : 1 | 3.6 | none | 0 / 0 | **42** |
| spotify.com | 900 | 0.63 : 1 | 1.0 | **OneTrust, 93px, 10.3% of viewport** | **40 / 40, 13 undecoded** | **53** |

Median `scrollHeight` 10,898px. Median ratio **7.57 : 1**. Seven of ten pages are
over 3:1; five are over 7:1.

Two of these rows are not what they look like:

- **spotify.com is not a marketing page.** `https://www.spotify.com` redirected
  to `https://open.spotify.com/`, the web player. `scrollHeight` 900 because it
  is an app shell that does not scroll the document, with 40 lazy images above
  the fold of which 13 had not decoded, and 53 elements at `opacity < 0.05`.
  That is the single most hostile page in the set and it is hostile because the
  URL did not point at the design. See section 10.
- **anthropic.com has 42 elements at `opacity < 0.05` in the first viewport,
  both before and after the scroll pass.** Something on that page stays hidden
  that a scroll pass does not reveal. It is the counter-example to the scroll
  pass being sufficient, and the reason section 5 recommends a post-capture
  sanity check rather than blind trust.

### What the scroll pass actually changed

| Site | `scrollHeight` before -> after | Elements in `<body>` before -> after |
| --- | --- | --- |
| vercel.com | 5,323 -> **5,941** (+618px) | 965 -> 965 |
| stripe.com | 14,758 -> 14,828 (+70px) | **2,272 -> 3,492** (+1,220) |
| nytimes.com | 14,322 -> 14,424 (+102px) | 6,307 -> 6,349 |
| monzo.com | 14,177 -> 14,208 (+31px) | 1,397 -> 1,409 |
| klarna.com | 4,654 -> 4,630 (-24px) | 1,218 -> 1,218 |
| linear.app, figma.com, tailwindcss.com | unchanged | unchanged |

Stripe grows the DOM by **1,220 elements** during a scroll to the bottom.
Vercel's document grows 12% taller. Neither is visible in a viewport-only
capture of the hero, which is an argument that the scroll pass is cheap
insurance rather than load-bearing: **it costs about a second and it is the only
thing that fires an `IntersectionObserver`.** Keep it, do not depend on it.

### Does the site look materially different narrow vs wide?

Measured at 1280 / 1440 / 1920, same page load, resized in place.

| Site | h1 font-size 1280 / 1440 / 1920 | h1 wrapped lines | Horizontal scroll | Content block width |
| --- | --- | --- | --- | --- |
| linear.app | 64 / 64 / 64px | 2 / 2 / 2 | no | fills viewport |
| stripe.com | 48 / 48 / 48px | 4 / 4 / 4 | no | 1265 / 1425 / 1905 |
| tailwindcss.com | 96 / 96 / 96px | **3 / 2 / 2** | no | 1265 / 1425 / 1905 |
| anthropic.com | **57.7 / 60.9 / 64px** (fluid) | 3 / 3 / 3 | no | 1265 / 1425 / 1905 |

**Nothing breaks anywhere in 1280-1920, and no site switched to a mobile
layout.** The only change worth anything is Tailwind's headline, which wraps to
three lines at 1280 and settles at two from 1440 up. That is the whole argument
for 1440 over 1280: it is the narrowest width in the desktop band at which
headline typography is doing what the designer drew, and typography is a Trait.

**A second viewport is not warranted.** Nothing in the sample looks materially
different across the desktop band, so a second desktop width buys a near-identical
image. A mobile width would produce a genuinely different design, but it is a
*different design*, which under 001 means a different Item with a different
Capture, not a second image on one Item. Section 3 says how to get one if you
want it.

## 3. Viewport: `1440x900`, `deviceScaleFactor: 2`, `scale: 'device'`, never `fullPage`

```ts
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
  reducedMotion: 'reduce',
  colorScheme: 'light',
  locale: 'en-GB',
  timezoneId: 'Europe/London',
});
```

The context options are all documented Playwright context params: `viewport`
"Emulates consistent viewport for each page. Defaults to an 1280x720 viewport";
`deviceScaleFactor` "Specify device scale factor (can be thought of as dpr).
Defaults to 1"; `reducedMotion` "Emulates 'prefers-reduced-motion' media
feature, supported values are 'reduce', 'no-preference' ... Defaults to
'no-preference'"; `colorScheme` "Emulates prefers-colors-scheme media feature
... Defaults to 'light'"
([params.md](https://github.com/microsoft/playwright/blob/main/docs/src/api/params.md)).

**Why 1440x900 and not full-page.** Three reasons, in order of force.

1. **Aspect ratio, which is 011's problem.** A fixed viewport gives every Item
   the same **1.6:1** Capture. The alternative gives 011 a grid where cards range
   from 0.63:1 to 10.25:1. A 10.25:1 Capture rendered into a 320px card is 3,280px
   tall; rendered into a card of sane height it is a 30px-wide sliver. There is
   no card design that survives that range. The ticket already suspected this;
   the table proves it.
2. **The designed thing is above the fold.** A page at 16 screens is twelve
   scroll sections of feature grids, logo walls and a footer. Extraction reading
   a 14,758px image is reading mostly repetition. The hero is where the palette,
   the type system and the design philosophy live, and it is the part that was
   art-directed rather than assembled.
3. **Bytes and time.** Measured, at `deviceScaleFactor: 1`:

| | linear.app | stripe.com |
| --- | ---: | ---: |
| viewport PNG | **138 KB** | **657 KB** |
| viewport JPEG q90 | 103 KB | 171 KB |
| full-page PNG | 1,303 KB | 2,113 KB |
| full-page multiplier | **9.4x** | 3.2x |
| full-page capture time | 1,098 ms | 1,241 ms |

At the locked scale of low hundreds of Items, full-page PNGs are a few hundred
megabytes of Captures against roughly 30-60MB for viewport captures. Not fatal,
but it buys nothing.

**On `deviceScaleFactor: 2`.** This is the crispness lever, and it is separate
from the screenshot's `scale` option. `scale: 'device'` "will produce a single
pixel per each device pixel, so screenshots of high-dpi devices will be twice as
large or even larger", where `scale: 'css'` "will have a single pixel per each
css pixel on the page. For high-dpi devices, this will keep screenshots small"
([params.md](https://github.com/microsoft/playwright/blob/main/docs/src/api/params.md)).
So the pair to use is `deviceScaleFactor: 2` plus an explicit `scale: 'device'`,
yielding a 2880x1800 image of a 1440x900 layout. Pass `scale` explicitly rather
than relying on the default.

**Honest limitation:** the MCP-driven browser I measured in ran at
`devicePixelRatio: 1`, and `deviceScaleFactor` is a context option the MCP
server does not expose, so `scale: 'css'` and `scale: 'device'` returned
byte-identical buffers (138 KB and 138 KB, 657 KB and 657 KB) - a correct result
at DPR 1 and a useless one for sizing DPR 2. **I did not measure the file-size
cost of `deviceScaleFactor: 2`.** It is 4x the pixels; PNG will land somewhere
under 4x the bytes because the extra pixels are highly predictable, but that is
reasoning, not measurement. Budget for roughly 0.5-2MB per Capture and check it
against the first real batch.

**If you ever want the whole page or a mobile view**, both are new Items with
their own Captures, not a second image on one Item. A `--full-page` escape hatch
and a `--viewport WxH` flag are cheap to add and should exist, but neither is
the default and neither changes the storage contract.

## 4. Playwright over Puppeteer

Both drive Chromium over CDP on Windows and both would work. Playwright wins on
one axis that matters for this specific job: **its screenshot API has the
determinism controls and Puppeteer's does not.**

| | Playwright `page.screenshot()` | Puppeteer `ScreenshotOptions` |
| --- | --- | --- |
| `fullPage`, `clip`, `omitBackground`, `quality`, `type`, `path` | yes | yes |
| `animations: 'disabled'` | **yes** | no |
| `caret: 'hide'` | **yes** | no |
| `mask` / `maskColor` | **yes** | no |
| `style` (inject CSS for the capture only) | **yes** | no |
| `scale: 'css' \| 'device'` | **yes** | no (`captureBeyondViewport`, `fromSurface`, `optimizeForSpeed`, `encoding` instead) |
| element screenshot with actionability wait | **`locator.screenshot()`** | `elementHandle.screenshot()` |

Sources:
[Playwright params.md](https://github.com/microsoft/playwright/blob/main/docs/src/api/params.md),
[Puppeteer ScreenshotOptions](https://pptr.dev/api/puppeteer.screenshotoptions).

`animations`, `caret` and `style` are exactly the three knobs that make a
Capture reproducible, and section 5 uses all three. That is the whole argument.

Supporting, weaker points:

- **Install weight is a wash.** Playwright: "These browsers will take a few
  hundred megabytes of disk space when installed", and you can install only what
  you need with `npx playwright install chromium`
  ([Browsers](https://playwright.dev/docs/browsers)). Puppeteer "automatically
  downloads a recent version of Chrome for Testing (~170MB macOS, ~282MB Linux,
  ~280MB Windows)"
  ([Installation](https://pptr.dev/guides/installation)). Comparable. Playwright
  is marginally better here only because installing a single browser is a
  documented first-class command.
- **Windows is documented rather than incidental** in Playwright: the browser
  cache path `%USERPROFILE%\AppData\Local\ms-playwright` is in the docs, and
  Playwright tracks and garbage-collects unused browser versions
  ([Browsers](https://playwright.dev/docs/browsers)). Puppeteer's install docs
  name `$HOME/.cache/puppeteer` and mention no Windows-specific behaviour.
- **Puppeteer's install script is fragile under modern package managers** by its
  own docs: "Many modern package managers ... block dependency install scripts
  by default", requiring a manual `puppeteer browsers install`
  ([Installation](https://pptr.dev/guides/installation)). A small papercut, but
  a real one for a CLI someone reinstalls occasionally.
- **I ran this entire research pass through Playwright on this machine**, so the
  recipe in section 5 is exercised rather than proposed.

The one thing Puppeteer has that Playwright's screenshot options do not name is
`captureBeyondViewport`, "Capture the screenshot beyond the viewport. Defaults
to false if no clip, true otherwise". Since the recommendation is never to
capture beyond the viewport, that is not a loss.

## 5. The wait recipe

Ordered, with the actual calls. Every step is bounded and every step after
`goto` is allowed to fail without failing the capture.

```ts
// 1. Navigate. 'load' means "the load event fired" - documented, cheap, and
//    the strongest thing you can wait for that is not discouraged.
await page.goto(url, { waitUntil: 'load', timeout: 30_000 });

// 2. Fonts. A capture taken before webfonts swap in records the fallback
//    stack, which corrupts the typography Trait specifically.
await page.evaluate(() => document.fonts.ready).catch(() => {});

// 3. Scroll pass: trigger lazy images and IntersectionObserver reveals,
//    then return to the top.
await page.evaluate(async () => {
  const step = Math.round(window.innerHeight * 0.85);
  for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
    window.scrollTo(0, y);
    await new Promise(r => setTimeout(r, 90));
  }
  window.scrollTo(0, 0);
});

// 4. Above-the-fold images decoded. Scoped to the first viewport, bounded,
//    non-fatal. This is the check that spotify.com would have failed (13 of
//    40 above-fold images undecoded).
await page.waitForFunction(() => [...document.images]
  .filter(i => { const r = i.getBoundingClientRect();
                 return r.top < window.innerHeight && r.bottom > 0; })
  .every(i => i.complete && i.naturalWidth > 0),
  null, { timeout: 8_000 }).catch(() => {});

// 5. Layout has stopped moving: same scrollHeight across two animation frames.
await page.waitForFunction(() => new Promise(res => {
  const a = document.documentElement.scrollHeight;
  requestAnimationFrame(() => requestAnimationFrame(() =>
    res(document.documentElement.scrollHeight === a)));
}), null, { timeout: 5_000 }).catch(() => {});

// 6. Capture.
const buf = await page.screenshot({
  animations: 'disabled',
  caret: 'hide',
  scale: 'device',
  type: 'png',
});
```

**Why `load` and not `networkidle`.** The Playwright docs mark `networkidle`
**DISCOURAGED**: "consider operation to be finished when there are no network
connections for at least 500 ms. Don't use this method for testing, rely on web
assertions to assess readiness instead"
([class-page](https://playwright.dev/docs/api/class-page)). `load` is
"consider operation to be finished when the `load` event is fired" and
`domcontentloaded` is "consider operation to be finished when the
`DOMContentLoaded` event is fired" (same page). Analytics beacons and
long-poll sockets mean `networkidle` on a marketing site is a coin flip between
firing instantly and hanging for the full timeout. Steps 2-5 are the readiness
assertions the docs are pointing at.

**Why no `page.waitForTimeout`.** Also marked **DISCOURAGED**: "Wait for the
given timeout in milliseconds. Note that this method should only be used for
testing, the application under test should not have hard-coded timeouts"
([class-page](https://playwright.dev/docs/api/class-page)). Every wait above is
a `waitForFunction` on an observable condition. The one hard sleep in the recipe
is the 90ms inside the scroll loop, which is not a readiness wait but a scroll
*rate*, throttling so `IntersectionObserver` callbacks get a frame to run. I used
`waitForTimeout` freely in the measurement harness and it does not belong in the
CLI.

### Mid-animation state, and why `animations: 'disabled'` is the right lever

The exact documented behaviour, and it is better than "turn animations off":

> "stops CSS animations, CSS transitions and Web Animations. Animations get
> different treatment depending on their duration: finite animations are
> fast-forwarded to completion, so they'll fire `transitionend` event. infinite
> animations are canceled to initial state, and then played over after the
> screenshot."
> ([params.md](https://github.com/microsoft/playwright/blob/main/docs/src/api/params.md))

**Finite animations are fast-forwarded to completion.** That is precisely the
scroll-reveal case the ticket worries about: a fade-and-rise that the scroll pass
triggered and that is 40% through when the shutter opens gets snapped to its end
state rather than frozen mid-flight. And infinite animations, the looping
gradient meshes and marquees, are reset to their initial state, which is at least
deterministic run to run.

**`reducedMotion: 'reduce'` is the second lever and belongs at context level, not
as a substitute.** It emulates `prefers-reduced-motion`
([params.md](https://github.com/microsoft/playwright/blob/main/docs/src/api/params.md)),
which MDN defines as the media feature "used to detect if a user has enabled a
setting on their device to minimize the amount of non-essential motion", where
`reduce` "Indicates that a user has enabled the setting on their device for
reduced motion"
([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)).
The two do different jobs and both are worth having:

- `reducedMotion: 'reduce'` asks well-built sites to **not start** the animation.
  It is a request the page may ignore, and the common careless implementation
  (`@media (prefers-reduced-motion: reduce) { * { animation: none } }` applied
  over a reveal whose visible state is set by an animation's end keyframe) leaves
  content **stuck invisible**. This is the failure mode to watch for.
- `animations: 'disabled'` is enforced by the driver at capture time and cannot
  be ignored by the page.

Neither helps the case the measurements actually turned up: **an element at
`opacity: 0` whose `IntersectionObserver` never fired has no running animation to
fast-forward.** That is what the scroll pass is for, and anthropic.com shows the
scroll pass does not always win (42 hidden elements before and after). So:

**Recommend a cheap post-capture sanity check.** After step 5, count elements in
the first viewport at `opacity < 0.05` covering more than ~15% of the viewport
area. If the count is non-trivial, print a warning naming the URL and suggesting
`--no-reduced-motion` as a retry. Do not fail the capture on it. This is a
warning, not a gate, because the CLI cannot tell "a reveal that never fired"
from "a deliberately hidden modal".

## 6. The screenshot API, and what the docs do not say

Verbatim from
[params.md](https://github.com/microsoft/playwright/blob/main/docs/src/api/params.md)
unless noted.

| Option | Documented meaning | Use here |
| --- | --- | --- |
| `fullPage` | "When true, takes a screenshot of the full scrollable page, instead of the currently visible viewport. Defaults to `false`." | **leave false** |
| `clip` | "An object which specifies clipping of the resulting image" (x, y, width, height) | the `--clip` escape hatch, section 8 |
| `animations` | "stops CSS animations, CSS transitions and Web Animations ... finite animations are fast-forwarded to completion ... infinite animations are canceled to initial state" | **`'disabled'`, always** |
| `caret` | "When set to `\"hide\"`, screenshot will hide text caret. When set to `\"initial\"`, text caret behavior will not be changed. Defaults to `\"hide\"`." | `'hide'` explicitly; it is already the default but say it |
| `mask` | "Specify locators that should be masked when the screenshot is taken. Masked elements will be overlaid with a pink box `#FF00FF`." | **not used**, see section 7 |
| `maskColor` | "Specify the color of the overlay box for masked elements, in CSS color format. Default color is pink `#FF00FF`." | n/a |
| `scale` | `'css'`: "a single pixel per each css pixel on the page. For high-dpi devices, this will keep screenshots small". `'device'`: "a single pixel per each device pixel, so screenshots of high-dpi devices will be twice as large or even larger" | **`'device'`**, paired with `deviceScaleFactor: 2` |
| `omitBackground` | "Hides default white background and allows capturing screenshots with transparency. Not applicable to `jpeg` images. Defaults to `false`." | **false.** A Capture with a transparent background would poison palette extraction |
| `type` | "Specify screenshot type, defaults to `png`." | **`png`** |
| `quality` | "The quality of the image, between 0-100. Not applicable to `png` images." | n/a |
| `style` | "Text of the stylesheet to apply while making the screenshot. This stylesheet pierces the Shadow DOM and applies to the inner frames." | held in reserve, see section 7 |

**On maximum capture height: the documentation is silent, and that is itself an
argument.** I looked in three places and found no stated limit. Playwright's
`params.md` gives no bound on `fullPage` or `clip`. Chromium's own CDP reference
for `Page.captureScreenshot` documents `format`, `quality`, `clip`, `fromSurface`,
`captureBeyondViewport` and `optimizeForSpeed` with no dimension constraint, and
types the clip as device-independent pixels
([CDP Page domain](https://chromedevtools.github.io/devtools-protocol/tot/Page/)).
Playwright's Chromium screenshotter builds the clip from the document rect and
passes it through without clamping
([crPage.ts](https://github.com/microsoft/playwright/blob/main/packages/playwright-core/src/server/chromium/crPage.ts)).
So whatever happens on a 40,000px page is emergent Chromium compositor behaviour
that nobody has promised. Empirically full-page captures at 10,898px and
14,758px succeeded in about 1.1-1.2s each, so the limit is well beyond anything
in the sample. But **relying on undocumented behaviour for the default path is a
bad trade when the default path should be a fixed viewport anyway.** If the
`--full-page` escape hatch is used on a genuinely enormous page, expect
undefined behaviour and say so in the flag's help text.

## 7. Banners: do not attempt dismissal

**Recommendation: no banner dismissal, no filter lists, no CMP-specific
selectors. Capture the noise. Re-take by hand on the rare page it ruins.**

The measured facts first.

**Three of ten pages showed a consent overlay, and each covered 10-16% of the
viewport.** None covered the hero. All three were bottom-anchored or
lower-centred: figma.com at `top: 552` (324px, 10.5%), monzo.com at `top: 653`
(215px, 15.9%), klarna.com at `top: 676` (194px, 11.3%), spotify.com at
`top: 808` (93px, 10.3%). Not one was a full-screen interstitial cookie wall.
The ticket's worry that banners "sit on top of exactly the hero you want" is not
what the sample shows: they sit on the bottom eighth of it.

**Vendor-signature detection catches half of them at best.** My thirteen-vendor
regex caught OneTrust on klarna.com and spotify.com. It missed both figma.com
(class `fig-1smnc27`) and monzo.com (class `Dialog_Dialog__tJ9Sz`), because both
are **first-party implementations with build-hashed class names**. Those class
names change on every deploy. A design-conscious company is exactly the kind of
company that builds its own consent dialog rather than shipping OneTrust's, which
means the sites in this library are systematically the ones a vendor-selector
approach fails on.

Now the principled options I was asked to assess, each rejected for its own
reason.

- **Global Privacy Control / the `Sec-GPC` header.** The spec defines
  `Sec-GPC-field-value = "1"` and `navigator.globalPrivacyControl`, and says a
  server "MUST ignore it and process the request as if that header had not been
  specified unless the field value is exactly the character `1`". The signal it
  carries is that a user requests "their data not be sold to or shared with any
  party other than the one the person intends to interact with, or to have their
  data used for cross-context ad targeting"
  ([W3C GPC](https://w3c.github.io/gpc/)). **This is the wrong tool.** GPC is a
  do-not-sell/share signal about data processing, not a hide-your-banner signal,
  and nothing in the spec obliges a site to suppress its UI. Sending it via
  `extraHTTPHeaders: { 'Sec-GPC': '1' }` costs nothing and is arguably the polite
  thing for a bot to do, so **send it as a courtesy, but do not expect it to
  change a single pixel.**
- **The `mask` screenshot option.** It works and it is the wrong shape: masked
  elements are "overlaid with a pink box `#FF00FF`"
  ([params.md](https://github.com/microsoft/playwright/blob/main/docs/src/api/params.md)).
  Replacing a banner with a magenta rectangle in a design library is strictly
  worse than the banner. The palette Trait would read the magenta.
- **`style` injection**, a targeted
  `screenshot({ style: '[id*=onetrust], [class*=cookie-banner] { display: none }' })`,
  is the least-bad mechanical option and still fails on figma and monzo for the
  same build-hash reason. It also risks hiding legitimate design.
- **Community filter lists.** EasyList does ship an **EasyList Cookie List**
  under `/easylist_cookie/` (`easylist-cookie.template`,
  `easylist-cookie-uBO.template`)
  ([easylist/easylist](https://github.com/easylist/easylist)). But uBlock
  Origin's own asset repo explicitly declines this category: "uAssets will not
  address the following: Paywalls, Porn Farms, Annoyances (widgets, social media
  buttons, newsletter subscriptions, donation requests, etc)"
  ([uBlockOrigin/uAssets](https://github.com/uBlockOrigin/uAssets)). Adopting
  EasyList Cookie means shipping an Adblock-Plus-syntax parser, a cosmetic-filter
  engine, and a list that needs updating forever, to solve a problem that
  occurred three times in ten pages and never over the hero. **The complexity is
  wildly out of proportion**, and the map's standing preference for simplicity
  and long-term maintainability points the same way.
- **Clicking "Accept".** Rejected on principle as well as on engineering. It
  fabricates a consent decision the user never made, and it is the one action
  most likely to trigger a page reload, an animation, or a layout shift right
  before the shutter.

**The decisive argument is the one the ticket half-makes itself: the CLI is not
running unattended.** 002 measured extraction at 18-48s per Item, so this is a
tool you run and look at the result of. A single-user library gains nothing from
a 70%-reliable banner dismissal that fails silently on the sites you care most
about. What it gains a lot from is **`--wait-before-capture <ms>`**: a flag that
pauses so you can dismiss the banner yourself in a headed browser, then captures.
That is a dozen lines, always works, and never lies about what it did.

So: default to headless, capture the banner, and provide two escapes.

```
--headed --wait-before-capture 15000   # dismiss it yourself, then capture
--selector "main > section:first-child" # or just crop above it (section 8)
```

The second escape is usually enough, because every banner in the sample was
below the top 60% of the viewport.

**Limitation to record: my egress was US-routed.** The three consent overlays I
found appeared anyway, but a EU-routed run would very likely find more, and
possibly find a full-screen wall on a publisher site. That would not change the
recommendation, because a full-screen wall is a capture *failure* (section 9),
not a cropping problem.

## 8. Cropping: a `--selector` flag, backed by `locator.screenshot()`

**Recommendation: the CLI crops, via a selector, at capture time. There is no
cropping UI and there should not be one.**

001 locked that Scope is chosen by cropping, and the ticket is right that this is
where the read-only app strains. It strains less than expected, because
Playwright already has the primitive.

> "Take a screenshot of the element matching the locator ... waits for the
> actionability checks, then scrolls element into view before taking a
> screenshot. If the element is detached from DOM, the method throws an error."
>
> "This method captures a screenshot of the page, clipped to the size and
> position of a particular element matching the locator. If the element is
> covered by other elements, it will not be actually visible on the screenshot.
> If the element is a scrollable container, only the currently scrolled content
> will be visible on the screenshot."
>
> ([class-locator.md](https://github.com/microsoft/playwright/blob/main/docs/src/api/class-locator.md);
> the guide's sample is `await page.locator('.header').screenshot({ path: 'screenshot.png' })`,
> [Screenshots](https://playwright.dev/docs/screenshots))

**Verified: yes, Playwright screenshots a locator rather than the page, and it is
the cleanest answer to "I wanted just the nav bar."** `--selector "header"`
produces a Capture that is exactly the nav bar, correctly scoped, with no crop
step and no image editor. Under 001 that is a narrowly scoped Item, which the
ADR calls "the best mix ingredient, because it carries no competing traits". The
mechanism 001 imagined as a manual act turns out to be a CLI flag.

The two documented caveats matter and belong in the flag's help text: an element
covered by an overlay is captured *with* the overlay over it, and a scrollable
container yields only its currently scrolled content.

The realistic options, and why the others lose:

| Option | Verdict |
| --- | --- |
| **`--selector <css>` via `locator.screenshot()`** | **Chosen.** No UI, no image editor, precise, and it makes Scope explicit at save time rather than inferred later. |
| `--clip x,y,w,h` via `page.screenshot({ clip })` | **Keep as secondary.** Necessary when no single element bounds what you want. Requires knowing pixel coordinates, so it is the flag you reach for after looking at a first capture. |
| Crop in an OS tool, then hand the file to the CLI | **Already supported and should stay supported.** The map already has a hand-over-a-file path. This is the answer for anything a selector cannot express. It is the manual fallback, not the primary route. |
| A cropping UI in the app | **Rejected.** Directly contradicts the locked read-only app. |
| Defer cropping to a later version | **Rejected.** `--selector` is roughly one call and one flag. Deferring it would leave Scope, which 001 made load-bearing, unreachable in v1. |

Note what this does **not** do: it does not crop an existing Capture. Re-cropping
a stored Capture into a new Item remains 001's "deliberate v1 omission". The
selector runs against the live page at capture time, which means it is subject to
the same drift as everything else, and it does not reopen the invariant.

**One consequence for 004 and 006:** the CLI knows whether a Capture was
whole-viewport, selector-scoped or clip-scoped. That is Scope information
obtained for free and more reliably than the agent could infer it from pixels.
Both tickets should decide whether to record it. My recommendation is yes, as a
CLI-supplied field the agent does not write.

## 9. Capture failure: refuse the Item

**Recommendation: refuse. Write nothing, exit non-zero, print what failed and
what to do about it. 001's one-capture-per-item invariant stays intact.**

The alternative, writing an Item with CSS-derived DNA and no Capture, is more
tempting than it looks because 002 proved it works: URL analysis without a
rendered image returned Linear's actual brand purple `#5e6ad2` out of the
stylesheet. So the CLI genuinely *could* produce a decent partial DNA from a page
it cannot photograph.

Refuse anyway, for three reasons:

1. **The invariant is worth more than the Item.** "One source, one capture, one
   DNA" is the sentence the whole model rests on. Allowing a Capture-less Item
   makes `capture` nullable everywhere: 006 stores an optional, 011 renders a
   card with no image (and a grid of design work whose cards have no picture is
   not a design library), 004's schema needs a "no capture" mode, and every
   Trait needs a second reason to be **Not applicable**. That is four tickets
   paying rent for a case that is rare and has a good manual workaround.
2. **The DNA would be systematically lopsided in a way nothing records.** 002
   already found this: URL-only analysis is "strong on the token-level traits and
   weak on the layout-level ones". A Capture-less Item is a quietly second-class
   Item that looks first-class in search results and in a Mix.
3. **The workaround is good.** Screenshot the page yourself and hand the file
   over. That path already exists, gives a better result, and takes ten seconds.

**Consequence if you went the other way**, stated plainly since the ticket asks:
`capture` becomes optional in the schema; **Not applicable** and **Undetermined**
have to cover a third case, "no capture existed to read from"; and 011 needs a
card design for an imageless Item. The invariant does not survive it.

### Detecting failure is harder than it sounds

The probes, all at 1440x900:

| Probe | HTTP | Final URL | What actually rendered |
| --- | --- | --- | --- |
| `linear.app/no-such-page-xyz-404` | **200** | unchanged | `<h1>Log in to Linear</h1>`, 146 chars of text, `scrollHeight` 900 |
| `wsj.com` | 200 | unchanged | full page, paywall wording present |
| `dribbble.com/shots/popular` | **202** | unchanged | rendered, login wording present |
| `figma.com/community` | 200 | unchanged | rendered fine |
| `no-such-host-zzq12345.example` | n/a | n/a | throws `net::ERR_NAME_NOT_RESOLVED` |

**The headline finding: a dead link returned HTTP 200 and served a login screen.**
`linear.app/no-such-page-xyz-404` is exactly the ticket's dead-link case, and
status-code checking would have sailed straight past it and produced an Item
whose Capture is a login form. Dribbble returned **202**, which is not an error
either. So:

**Signals worth checking, in order of reliability:**

1. `page.goto()` **throws** (DNS, TLS, connection refused, timeout). Unambiguous.
2. HTTP status `>= 400` from the response object. Reliable when present, absent
   when it matters most.
3. **A visible `input[type="password"]` in the first viewport.** The single best
   heuristic for "this is a login screen".
4. **Very little text.** The dead Linear page had 146 characters of body text
   against 3,000+ on every real page in the sample. A threshold around 200-300
   characters plus a `scrollHeight` at or under one viewport is a strong "this is
   not a designed page" signal.
5. Body text matching bot-wall wording: `/verify you are human|checking your
   browser|enable javascript and cookies|unusual traffic|access denied/i`. **Zero
   hits in my sample**, so this one is unexercised and should be a warning, not a
   hard refusal.
6. Paywall wording. **Do not refuse on this.** WSJ rendered a real, fully
   designed page that happens to mention subscriptions; refusing it would be
   wrong. Only a paywall that *replaces* the page is a failure, and that shows up
   as (3) or (4).

Use 1 and 2 as hard refusals, 3 and 4 as hard refusals, 5 and 6 as warnings.

### What a useful error message says

Bad: `Error: capture failed`.

Good, in the CLI's own voice:

```
Refused: https://linear.app/no-such-page-xyz-404
  The page loaded (HTTP 200) but rendered a login screen: an <h1> reading
  "Log in to Linear" and 146 characters of body text. Nothing was written.

  If the design you want is behind that login, screenshot it yourself and
  pass the file instead:
      design-dna add ./nav-bar.png --source https://linear.app/...

  If you think this is wrong, re-run with --headed to watch the page load,
  or --wait-before-capture 15000 to intervene before the capture.
```

Three things make it useful: it names **which** signal fired and quotes the
evidence, it states plainly that **nothing was written**, and it gives the exact
next command. No Item is created, no Capture file is left behind, no partial row
in the store.

## 10. URLs where the design is not at the URL

**Recommendation: reject explicitly, before opening a browser, with a message
that names the file-handover path.**

The ticket's guess is right, and section 2 supplied an unplanned proof:
`https://www.spotify.com` redirected to `https://open.spotify.com/`, a web-player
app shell with 40 lazy images above the fold of which 13 had not decoded and 53
elements at `opacity < 0.05`. Whatever a Capture of that is, it is not the design
you meant to save.

What the CLI can concretely detect, in three tiers.

**Tier 1: host plus path patterns, checked before navigating.** Cheap, precise,
implementable today.

| Pattern | Why |
| --- | --- |
| `figma.com/(file\|design\|proto\|board)/` | the design is inside a canvas app, not in the DOM |
| `figma.com/community/file/` | public, but still renders as a canvas app |
| `dribbble.com/shots/` | the design *is* an uploaded image; the page is chrome around it |
| `behance.net/gallery/` | same |
| `pinterest.\w+/pin/` | same |
| `docs.google.com`, `drive.google.com`, `figjam.com` | document viewers |
| `*.notion.so` (not `*.notion.site`) | private workspace; `notion.site` is a published page and is fine |
| `mail.google.com`, `*.atlassian.net`, `*.slack.com`, `app.*` | applications behind auth |
| `open.spotify.com`, and any `open.*` / `app.*` host reached **by redirect** from a marketing host | measured; this is the spotify case |
| non-HTML `content-type` (`image/*`, `application/pdf`) | not a page at all |

The last two rows are the ones worth building carefully. **A redirect that
changes the host is a strong signal that the URL you pasted is not the page you
get**, and the CLI already has `response.url()` versus the requested URL for
free.

`image/*` deserves a nicer outcome than rejection: if the URL is an image, the
right move is to download it and treat it as a directly supplied file. That is
the existing hand-over-a-file path with the fetch done for you, and it turns the
common "I found a Dribbble shot's image URL" case into a working Item.

**Tier 2: post-navigation, from section 9.** A visible password field, or a body
text length under ~300 characters. These catch the login-walled page that no
pattern list anticipates.

**Tier 3: a `<canvas>` that dominates the viewport.** If a single `<canvas>`
covers more than ~60% of the first viewport, the page is an application drawing
itself and CSS-derived signals will be near-empty. Warn rather than refuse:
WebGL hero sections are a legitimate design choice and would false-positive here.

The message should teach rather than scold:

```
Refused: https://www.figma.com/design/abc123/Marketing-Site
  Figma renders its designs on a canvas, so a capture of this URL would be
  the Figma editor, not your design. Export a frame as PNG and pass the file:
      design-dna add ./frame.png --source https://www.figma.com/design/abc123/...

  --source keeps the link as provenance on the Item.
```

That last line matters: **rejecting the URL as a capture target does not mean
losing it.** It survives as the Item's Source, which is what a Source is for.

## 11. Provenance: confirmed, nothing re-fetches

Short, because it is a confirmation.

- **The Capture is fixed at save time.** `CONTEXT.md` defines Capture as "The
  single image an item holds, fixed at the moment of saving and never changed
  afterwards."
- **The Source is provenance, not a place the app goes.** `CONTEXT.md`: "Where an
  item came from: a web address or an uploaded file. **Provenance, not a place
  you can browse to.**"
- **Nothing in the app could re-fetch even if it wanted to.** The map's locked
  decision is that the app "makes no model calls, spawns no subprocess, and has
  no asynchronous ingest, no job queue, and no waiting state", and that it is "a
  pure reader of a library that was written out-of-band". A re-fetch is a write.
- **The producer CLI is the only thing that ever visits a URL, and it visits it
  once**, during the run that creates the Item.

So the divergence the ticket describes is real, one-directional, and correct: as
sites redesign, the Capture becomes the record of a design that no longer exists
anywhere, and the Source becomes a link that no longer shows what the Item is
about. **The Capture is the artefact; the Source is a footnote.**

Two consequences worth writing down rather than rediscovering:

- 011 should not render the Source as a primary affordance that implies "click
  to see this design". It is a citation.
- The Capture files are the irreplaceable part of the library. The DNA can be
  regenerated from a Capture for about $0.05-0.13 (002); a Capture whose site has
  been redesigned cannot be regenerated at all. Whatever 006 decides about
  storage, that asymmetry should shape it.

## Open items this hands off

- **`deviceScaleFactor: 2` file size is unmeasured.** The measuring browser ran
  at DPR 1, so `scale: 'css'` and `scale: 'device'` were byte-identical and the
  4x-pixels claim is reasoning, not measurement. Check it against the first real
  batch. Bears on **006**, which sizes the store.
- **Scope is knowable at capture time and nothing has decided to record it.**
  The CLI knows whether a Capture was whole-viewport, `--selector`-scoped or
  `--clip`-scoped. That is more reliable than inferring Scope from pixels.
  **004** should decide whether it is a schema field; if it is, it is
  CLI-supplied and the agent must not write it.
- **The bot-wall heuristic is unexercised.** Zero sites in the sample served one,
  so the wording regex in section 9 is written from expectation rather than from
  a captured example. Ship it as a warning, promote it to a refusal only once a
  real one has been seen. **008**.
- **Consent measurement was US-routed.** A EU-routed run would likely find more
  banners and possibly a full-screen wall. It would not change the "do not
  attempt dismissal" call, but it would change how often
  `--wait-before-capture` gets used. Worth a second pass if the library skews
  European.
- **The scroll pass has a known counter-example.** anthropic.com kept 42
  first-viewport elements at `opacity < 0.05` before *and* after scrolling. The
  section 5 warning covers it, but nobody has looked at an actual Capture of
  that page to see whether it matters visually. **008**, first real run.
- **Aspect ratio is now a fixed input to 011**, not a variable. Every Capture is
  1.6:1. The grid can assume it, and should be told it may.
- **The `image/*` URL case is a small unspecified feature.** Section 10 proposes
  that an image URL is downloaded and treated as a directly supplied file rather
  than refused. That is a real behaviour nobody has ticketed. **008**.
