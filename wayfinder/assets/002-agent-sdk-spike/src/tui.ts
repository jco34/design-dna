/**
 * PROTOTYPE - throwaway. Ticket 002. This shell is NOT for production.
 *
 * QUESTION THIS ANSWERS
 * Can the Claude Agent SDK, spawned as a local subprocess from a Node process
 * on Windows, reliably return schema-valid design analysis - headlessly, using
 * existing Claude Code auth rather than an API key? And is the analysis any
 * good, or generic filler?
 *
 * You drive it. The interesting moments are "wait, that hex is wrong" and
 * "that philosophy paragraph could describe anything".
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runExtraction, tally, type Attempt, type ExtractionInput, type Mode } from './extract.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const INPUTS_DIR = path.resolve(HERE, '..', 'inputs');
const LOG_PATH = path.resolve(HERE, '..', 'findings.json');

const B = (s: string) => `\x1b[1m${s}\x1b[0m`;
const D = (s: string) => `\x1b[2m${s}\x1b[0m`;
const G = (s: string) => `\x1b[32m${s}\x1b[0m`;
const R = (s: string) => `\x1b[31m${s}\x1b[0m`;
const Y = (s: string) => `\x1b[33m${s}\x1b[0m`;

/** Truecolor swatch, so a plausible-but-wrong hex is visible to the eye. */
function swatch(hex: string): string {
  const m = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!m) return '??';
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16));
  return `\x1b[48;2;${r};${g};${b}m    \x1b[0m`;
}

const SEEDED_URLS: ExtractionInput[] = [
  { kind: 'url', url: 'https://linear.app', label: 'url: linear.app' },
  { kind: 'url', url: 'https://stripe.com', label: 'url: stripe.com' },
];

function discoverInputs(): ExtractionInput[] {
  const images: ExtractionInput[] = [];
  if (fs.existsSync(INPUTS_DIR)) {
    for (const f of fs.readdirSync(INPUTS_DIR).sort()) {
      if (/\.(png|jpe?g|webp|gif)$/i.test(f)) {
        images.push({ kind: 'image', path: path.join(INPUTS_DIR, f), label: `img: ${f}` });
      }
    }
  }
  return [...images, ...SEEDED_URLS];
}

/* ------------------------------- state ------------------------------- */

type State = {
  inputs: ExtractionInput[];
  selected: number;
  mode: Mode;
  attempts: Attempt[];
  busy: string | null;
  showRaw: boolean;
  notice: string | null;
};

const state: State = {
  inputs: discoverInputs(),
  selected: 0,
  mode: 'schema',
  attempts: [],
  busy: null,
  showRaw: false,
  notice: null,
};

/* ------------------------------- render ------------------------------ */

function render(): void {
  console.clear();
  const t = tally(state.attempts);
  const cur = state.inputs[state.selected];

  console.log(B('  002 spike - Agent SDK design extraction') + D('   (throwaway)'));
  console.log(D('  ' + '-'.repeat(72)));

  console.log(
    `  ${B('input')}  ${cur ? cur.label : R('none - drop images in inputs/')}` +
      D(`   [${state.selected + 1}/${state.inputs.length}]`)
  );
  console.log(
    `  ${B('mode')}   ${state.mode === 'schema' ? G('schema') + D(' (SDK outputFormat, self-retries)') : Y('freeform') + D(' (prompt-only, scraped)')}`
  );
  console.log('');

  if (t.runs === 0) {
    console.log(D('  no runs yet'));
  } else {
    const pct = (t.validityRate * 100).toFixed(0);
    const rateColor = t.validityRate === 1 ? G : t.validityRate >= 0.8 ? Y : R;
    console.log(
      `  ${B('first-try valid')}  ${rateColor(`${t.firstTryValid}/${t.runs}`)} ${D(`(${pct}%)`)}`
    );
    console.log(
      `  ${B('latency ms')}       min ${t.latency.min}  p50 ${B(String(t.latency.p50))}  max ${t.latency.max}`
    );
    console.log(
      `  ${B('cost')}            $${t.totalCostUsd.toFixed(4)} total` +
        D(`  ($${(t.totalCostUsd / t.runs).toFixed(4)}/run)`)
    );
    if (t.transportErrors > 0) {
      console.log(`  ${B('transport errs')}  ${R(String(t.transportErrors))}`);
    }
    if (t.proseWrapped > 0) {
      console.log(
        `  ${B('prose-wrapped')}   ${Y(`${t.proseWrapped}/${t.runs}`)}` +
          D('  (recoverable, but needs a tolerant parser)')
      );
    }
    const fails = Object.entries(t.failureCounts);
    if (fails.length > 0) {
      console.log(
        `  ${B('failure kinds')}   ` + fails.map(([k, n]) => `${R(k)} x${n}`).join('  ')
      );
    }
  }

  const last = state.attempts.at(-1);
  if (last) {
    console.log('');
    console.log(D('  ' + '-'.repeat(72)));
    console.log(
      `  ${B('last')} ${last.input.label} ${D(last.mode)} ${D(`${last.durationMs}ms`)} ` +
        D(`${last.turns ?? '?'} turns  via ${last.payloadSource}`)
    );

    if (last.transportError) {
      console.log(`  ${R('TRANSPORT: ' + last.transportError)}`);
      if (last.stderr.trim()) {
        console.log(D('  stderr: ' + last.stderr.trim().split('\n').slice(0, 4).join('\n          ')));
      }
    }

    if (last.outcome.ok) {
      const v = last.outcome.value;
      console.log(
        `  ${G('SCHEMA-VALID')}` +
          (last.outcome.wasProseWrapped ? `  ${Y('(was prose/fence wrapped)')}` : '')
      );
      console.log(
        `  ${B('palette')}  ` +
          Object.entries(v.palette)
            .map(([role, hex]) => `${swatch(hex)} ${D(role)} ${hex}`)
            .join('  ')
      );
      console.log(
        D('            compare these swatches against the design - the model')
      );
      console.log(D('            eyeballs colour, it does not sample pixels'));
      console.log(
        `  ${B('type')}     ${v.typography.headingFamily} / ${v.typography.bodyFamily} ${D(v.typography.scale)}`
      );
      console.log(`  ${B('tags')}     ${v.tags.join(', ')}`);
      console.log(`  ${B('philosophy')}`);
      for (const line of wrap(v.philosophy, 68)) console.log('    ' + line);
    } else {
      console.log(`  ${R('INVALID')}  ${last.outcome.failures.join(', ')}`);
      for (const d of last.outcome.detail.slice(0, 6)) console.log(D('    ' + d));
    }

    if (state.showRaw) {
      console.log('');
      console.log(B('  raw payload'));
      console.log(D(last.rawText.slice(0, 2000) || '(empty)'));
    }
  }

  console.log('');
  if (state.busy) console.log(`  ${Y('... ' + state.busy)}`);
  if (state.notice) console.log(`  ${G(state.notice)}`);

  console.log(D('  ' + '-'.repeat(72)));
  console.log(
    D('  ') +
      `${B('[1]')}${D(' run once  ')}${B('[5]')}${D(' run x5  ')}${B('[3]')}${D(' 3 concurrent  ')}` +
      `${B('[m]')}${D(' mode  ')}${B('[i]')}${D(' next input')}`
  );
  console.log(
    D('  ') +
      `${B('[r]')}${D(' raw payload  ')}${B('[w]')}${D(' write findings.json  ')}` +
      `${B('[x]')}${D(' reset tally  ')}${B('[q]')}${D(' quit')}`
  );
}

function wrap(s: string, width: number): string[] {
  const words = s.split(/\s+/);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > width) {
      lines.push(line.trim());
      line = w;
    } else line += ' ' + w;
  }
  if (line.trim()) lines.push(line.trim());
  return lines;
}

/* ------------------------------ actions ----------------------------- */

async function run(times: number, concurrent: boolean): Promise<void> {
  const input = state.inputs[state.selected];
  if (!input) {
    state.notice = 'no input selected';
    return render();
  }

  state.notice = null;
  state.busy = concurrent
    ? `${times} concurrent on ${input.label}`
    : `run 1/${times} on ${input.label}`;
  render();

  const opts = { mode: state.mode };

  if (concurrent) {
    const started = Date.now();
    const results = await Promise.all(
      Array.from({ length: times }, () => runExtraction(input, opts))
    );
    state.attempts.push(...results);
    const wall = Date.now() - started;
    const serial = results.reduce((s, r) => s + r.durationMs, 0);
    state.notice =
      `${times} concurrent: ${wall}ms wall vs ${serial}ms summed ` +
      `(${(serial / wall).toFixed(2)}x parallel speedup)`;
  } else {
    for (let i = 0; i < times; i++) {
      state.busy = `run ${i + 1}/${times} on ${input.label}`;
      render();
      state.attempts.push(await runExtraction(input, opts));
    }
  }

  state.busy = null;
  render();
}

function writeFindings(): void {
  const t = tally(state.attempts);
  fs.writeFileSync(
    LOG_PATH,
    JSON.stringify(
      {
        note: 'PROTOTYPE output - ticket 002. Regenerate, do not hand-edit.',
        capturedAt: new Date().toISOString(),
        platform: `${process.platform} node ${process.version}`,
        tally: t,
        attempts: state.attempts.map((a) => ({
          ...a,
          rawText: a.rawText.slice(0, 4000),
          stderr: a.stderr.slice(0, 2000),
        })),
      },
      null,
      2
    )
  );
  state.notice = `wrote ${path.relative(process.cwd(), LOG_PATH)} (${t.runs} attempts)`;
  render();
}

/* -------------------------------- loop ------------------------------ */

function main(): void {
  if (!process.stdin.isTTY) {
    console.error('This prototype needs a TTY. Run it directly in a terminal.');
    process.exit(1);
  }
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');

  let locked = false;
  process.stdin.on('data', async (key: string) => {
    if (key === 'q' || key === '') {
      console.clear();
      process.exit(0);
    }
    if (locked) return;

    switch (key) {
      case '1':
      case '5':
        locked = true;
        await run(key === '1' ? 1 : 5, false);
        locked = false;
        break;
      case '3':
        locked = true;
        await run(3, true);
        locked = false;
        break;
      case 'm':
        state.mode = state.mode === 'schema' ? 'freeform' : 'schema';
        state.notice = 'mode switched - tally now mixes modes, [x] to reset';
        render();
        break;
      case 'i':
        state.selected = (state.selected + 1) % Math.max(1, state.inputs.length);
        render();
        break;
      case 'r':
        state.showRaw = !state.showRaw;
        render();
        break;
      case 'w':
        writeFindings();
        break;
      case 'x':
        state.attempts = [];
        state.notice = 'tally reset';
        render();
        break;
    }
  });

  render();
}

main();
