/**
 * PROTOTYPE - throwaway. Ticket 002.
 *
 * The ticket asks whether extraction runs "from a Next.js route handler or a
 * worker". The TUI covers the worker. This covers the request-handler shape -
 * the SDK subprocess spawned from inside an HTTP request, which is what a Next
 * route handler is - without installing Next into a throwaway spike.
 *
 *   GET /extract?url=https://linear.app
 *   GET /extract?path=inputs/whatever.png
 *   GET /extract?url=...&mode=freeform
 */
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runExtraction, type ExtractionInput, type Mode } from './extract.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const PORT = Number(process.env.PORT ?? 4002);

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://localhost:${PORT}`);

  if (url.pathname !== '/extract') {
    res.writeHead(404, { 'content-type': 'text/plain' });
    res.end('GET /extract?url=... or /extract?path=...\n');
    return;
  }

  const target = url.searchParams.get('url');
  const filePath = url.searchParams.get('path');
  const mode = (url.searchParams.get('mode') ?? 'schema') as Mode;

  let input: ExtractionInput;
  if (target) {
    input = { kind: 'url', url: target, label: `url: ${target}` };
  } else if (filePath) {
    const abs = path.resolve(ROOT, filePath);
    input = { kind: 'image', path: abs, label: `img: ${path.basename(abs)}` };
  } else {
    res.writeHead(400, { 'content-type': 'text/plain' });
    res.end('need ?url= or ?path=\n');
    return;
  }

  console.log(`[${new Date().toISOString()}] extracting ${input.label} (${mode})`);
  const attempt = await runExtraction(input, { mode });

  res.writeHead(attempt.outcome.ok ? 200 : 422, { 'content-type': 'application/json' });
  res.end(
    JSON.stringify(
      {
        valid: attempt.outcome.ok,
        durationMs: attempt.durationMs,
        payloadSource: attempt.payloadSource,
        turns: attempt.turns,
        costUsd: attempt.costUsd,
        transportError: attempt.transportError,
        dna: attempt.outcome.ok ? attempt.outcome.value : null,
        failures: attempt.outcome.ok ? null : attempt.outcome.failures,
        detail: attempt.outcome.ok ? null : attempt.outcome.detail,
        rawText: attempt.rawText.slice(0, 2000),
        stderr: attempt.stderr.slice(0, 1000),
      },
      null,
      2
    )
  );
});

server.listen(PORT, () => {
  console.log(`002 spike server on http://localhost:${PORT}`);
  console.log(`  http://localhost:${PORT}/extract?url=https://linear.app`);
  console.log(`  http://localhost:${PORT}/extract?path=inputs/your-shot.png`);
  console.log('Fire three at once to test concurrency from a request handler.');
});
