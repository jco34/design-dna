---
id: 003
title: How a URL becomes a visual item
label: wayfinder:research
status: closed
assignee: jeb
blocked-by: none
parent: map
---

> **Narrowed 2026-07-26.** The strategy comparison this ticket opened with is
> settled by decision rather than research: the **producer CLI screenshots URLs
> with a headless browser**, and you hand it files directly for anything else.
> The app captures nothing, so cookie walls and lazy loading are now a CLI
> reliability problem rather than a user-facing one. The OG-image and
> agent-fetch-only options are rejected: 002 confirmed a URL can be analysed
> from fetched CSS alone, but that yields no image, and 001 locked one capture
> per item. What survives is everything below.

## Question

Given that a headless browser produces the capture, what does a good capture
actually look like, and what happens when the browser cannot get one?

Settle the capture itself:

- **Viewport and what gets captured.** Full-page, or a fixed viewport? Full-page
  screenshots of modern marketing sites are enormously tall, which wrecks the
  grid's aspect ratios (011) and buries the design under twelve scroll sections.
  A fixed viewport captures the part that was actually designed. What viewport -
  and does it differ for a site that only looks right wide?
- **Getting the page into a photographable state.** Cookie and consent banners
  sit on top of exactly the hero you want. Lazy-loaded imagery and
  scroll-triggered animation mean a naive screenshot catches a half-built page.
  Settle: a wait strategy, a scroll-then-return pass, and whether banner
  dismissal is attempted at all or just accepted as noise you crop out later.
- **Where cropping happens.** 001 locked that **scope is chosen by cropping**.
  If the CLI captures a full hero and you wanted the nav bar, who crops, and
  with what? This is the one place the read-only app assumption strains: cropping
  is an inherently visual, interactive act, and there is no UI for it.

Settle failure:

- **What happens when capture fails** - dead link, hard paywall, bot wall. Does
  the CLI refuse the item entirely, or write it with the DNA it could get from
  CSS and no capture? Refusing keeps 001's one-capture-per-item invariant intact;
  the alternative reopens it.
- **URLs where the design is not at the URL.** A Figma file, a Dribbble shot, a
  page behind a login. Probably: these are the case for handing over a file
  yourself rather than pasting a link, but say so explicitly so the CLI can
  reject them with a useful message instead of capturing a login screen.

Settle provenance:

- **The capture is fixed at save time and never refreshed** (001). So when a site
  redesigns, the capture and the live site diverge, and the capture is the more
  valuable of the two. Confirm nothing re-fetches, and that the stored source URL
  is provenance rather than something the app ever follows.

Deliverable: a research note under `wayfinder/assets/003-*` covering the viewport
and wait strategy with evidence from real sites, plus the failure and cropping
decisions, linked from the resolution.

## Resolution

**A Capture is a fixed 1440x900 viewport shot at `deviceScaleFactor: 2`, taken
after a bounded wait recipe, and the CLI refuses an Item it cannot photograph.**
Full-page is rejected on measured evidence rather than taste. Findings:
[`../assets/003-capture-findings.md`](../assets/003-capture-findings.md).

### What was decided

1. **Viewport `1440x900`, `deviceScaleFactor: 2`, `scale: 'device'`, never
   `fullPage`.** Measured across ten real sites: a full-page Capture would range
   from 0.63:1 to 10.25:1 with a median of **7.57:1** (median `scrollHeight`
   10,898px; stripe.com worst at 14,758px, 16.4 screens). No card grid survives
   that spread. 1440 is the narrowest width where hero headlines stop wrapping
   awkwardly, and 1280/1440/1920 sweeps triggered no mobile layout, so there is
   no second viewport. Every Capture is therefore **1.6:1**, which 011 may treat
   as a fixed input rather than a variable.

2. **A bounded wait recipe, with no arbitrary sleeps.** `goto` at `load`, then
   `document.fonts.ready`, then a scroll-to-bottom-and-return pass in
   0.85-viewport steps, then a bounded wait on above-fold images being
   `complete`, then a wait for `scrollHeight` stable across two rAF, then capture
   with `animations: 'disabled'` and context-level `reducedMotion: 'reduce'`.
   Playwright's own docs mark both `networkidle` and `waitForTimeout`
   **DISCOURAGED**; the note quotes them.

3. **The scroll pass is kept but is not trusted.** It earns its place
   (+1,220 DOM elements on stripe.com, +618px on vercel.com) but is provably
   insufficient: anthropic.com held 42 first-viewport elements at `opacity < 0.05`
   both before *and* after scrolling. The CLI emits a post-capture warning rather
   than assuming the page is fully built.

4. **Consent banners are captured as noise, not dismissed.** Only 3 of 10 pages
   showed one, each occupying 10-16% of the viewport and sitting in the bottom
   eighth rather than over the hero, so the premise that banners "sit on top of
   exactly the hero you want" did not survive measurement. Automation was
   rejected on evidence: a 13-vendor signature sweep caught OneTrust on klarna
   and spotify but **missed figma.com and monzo.com entirely**, because both ship
   first-party dialogs with build-hashed class names, which is precisely what
   design-conscious companies do. `mask` would paint a magenta box that poisons
   palette extraction, and GPC is a data-sale signal rather than a UI one. The
   escape hatch is `--headed --wait-before-capture <ms>`, not a rule engine.

5. **Capture failure refuses the Item.** Nothing is written, the exit is
   non-zero, and 001's one-capture-per-item invariant stays intact. Status codes
   alone are insufficient: `linear.app/no-such-page-xyz-404` returned **HTTP 200**
   serving a login screen and dribbble returned **202**, so a naive check would
   have created Items whose Capture is a login form. Refusal triggers on
   goto-throw, status >= 400, a visible `input[type=password]`, or body text under
   ~300 chars paired with a one-viewport `scrollHeight`. Paywall *wording* is
   explicitly not a refusal trigger, since WSJ rendered a genuinely designed page.

6. **Design-not-at-the-URL is rejected before navigation** on host and path
   patterns (figma `/file|/design|/proto|/board`, dribbble `/shots/`, behance
   `/gallery/`, pinterest `/pin/`, google docs and drive, `*.notion.so` but not
   `*.notion.site`, `*.atlassian.net`), with a message naming the file-handover
   path instead. Unplanned finding: **cross-host redirect is itself a signal** -
   `www.spotify.com` redirected to `open.spotify.com` and yielded an app shell
   with 13 undecoded above-fold images and 53 hidden elements.

7. **Provenance confirmed.** Nothing re-fetches. The Source is provenance and the
   app never follows it. This restates 001 rather than adding to it.

### Two collisions with 001, deliberately surfaced

- **Decision 9 is revised, not merely extended.** 001 ruled that "v1 has no crop
  affordance: to keep a section on its own, screenshot it yourself and upload it",
  on the reasoning that a crop step taxes every URL ingest to serve a minority
  case. That reasoning was aimed at *in-app* cropping. `locator.screenshot()`
  changes the cost: it waits for actionability, scrolls the element into view and
  clips to it, so a `--selector` flag adds nothing to the common path and needs no
  UI at all. **Scope becomes human-chosen for URL items too, which removes the
  first asymmetry 001 accepted knowingly.**
- **Decision 5 is challenged.** 001 ruled Scope "agent-inferred, not entered by
  hand". But the CLI *knows* whether a Capture was whole-viewport,
  `--selector`-scoped or `--clip`-scoped, and that is strictly more reliable than
  inferring it from pixels. If 004 makes Scope a schema field, it should be
  CLI-supplied and the agent must not write it.

### Decision 2 is not reopened

001 required this be addressed explicitly rather than assumed: a viewport shot is
**not** a rendition of a full-page shot, because no full-page shot is ever taken.
The Capture is the primary artifact, not a crop of some larger one, so "a
rendition of a capture is not a domain concept" stands unchanged.

### What was not verified

- **`deviceScaleFactor: 2` file size is reasoning, not measurement.** The
  measuring browser ran at DPR 1, so both `scale` modes returned byte-identical
  buffers. Bears on 006.
- **Maximum capture height is genuinely undocumented** across Playwright's
  params, Chromium's CDP reference and `crPage.ts`. 14,758px worked empirically.
  Treated as a further argument against `fullPage`.
- **The bot-wall heuristic is unexercised** - zero sites served one, so the regex
  is written from expectation. Ship as a warning, promote to refusal only once a
  real one is seen.
- **Consent measurement was US-routed.** A EU run would likely find more banners.
  It would not change the "do not dismiss" call, only how often
  `--wait-before-capture` is needed.
