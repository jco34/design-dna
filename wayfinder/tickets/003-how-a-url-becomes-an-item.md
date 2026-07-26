---
id: 003
title: How a URL becomes a visual item
label: wayfinder:research
status: open
assignee: unassigned
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
