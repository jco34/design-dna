/**
 * Print what the exploration pass observes for a URL, and nothing else.
 *
 *   npx tsx producer/tools/observe.mts https://example.com
 *
 * `captureUrl` takes the Capture and runs the exploration pass but never calls the
 * API, so this is free and repeatable. It is the tool for tuning motion detection
 * without paying for an extraction on every iteration, and it is how the
 * CSS-declaration blind spot documented in `capture.ts` was found: a GSAP site
 * reported 8 declared transitions and 273 inline-animated elements.
 */
import { captureUrl } from '../src/lib/capture.js';

const target = process.argv[2] ?? 'https://www.paulkalkbrenner.net/';
console.log(`exploring ${target}\n`);

const result = await captureUrl(target, { explore: true });

console.log(`capture: ${result.pixelWidth}x${result.pixelHeight} ${result.mode}`);
for (const warning of result.warnings) console.log(`warn: ${warning}`);

const o = result.observations;
if (o === null) {
  console.log('\nno observations (exploration was skipped or failed)');
} else {
  console.log('\n=== scripted motion ===');
  console.log(`libraries:              ${o.scripted.libraries.join(', ') || '(none detected)'}`);
  console.log(`inline transform/opacity: ${o.scripted.inlineAnimatedElements}`);
  console.log(`Web Animations running:   ${o.scripted.webAnimations}`);

  console.log('\n=== declared CSS motion (the old, blind measure) ===');
  console.log(`transitions: ${o.transitions.length}`);
  console.log(`keyframes:   ${o.keyframeAnimations.length}`);
  console.log(`ambient:     ${o.ambientAnimationCount}`);

  console.log('\n=== measured scroll choreography (the new measure) ===');
  console.log(`page depth:       ${o.scroll.depthViewports} viewports`);
  console.log(`probes tracked:   ${o.scroll.sampled} across ${o.scroll.steps} depths`);
  console.log(`revealed:         ${o.scroll.revealed}`);
  console.log(`parallax/pinned:  ${o.scroll.parallax}`);
  console.log(`scaled:           ${o.scroll.scaled}`);
  console.log(`staggered:        ${o.scroll.staggered}`);
  console.log(`sticky header:    ${o.stickyHeader}`);

  console.log('\n=== hover ===');
  for (const h of o.hover) console.log(`  ${h.label}: ${h.properties.join(', ')}`);
  console.log(`  inert kinds: ${o.hoverInertCount}`);
  console.log(`  focus ring:  ${o.focusRingVisible}`);

  if (o.notes.length > 0) {
    console.log('\n=== notes ===');
    for (const n of o.notes) console.log(`  ${n}`);
  }
}

await result.cleanup();
