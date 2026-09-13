#!/usr/bin/env node
/**
 * Runs ESLint and fails if the problem count has grown since the recorded baseline.
 *
 * Why a ratchet and not a plain `eslint .`: the codebase carries a real backlog of lint
 * problems (mostly react-hooks/set-state-in-effect, which fires on the ordinary "fetch in an
 * effect, then setState" pattern used by nearly every page). Gating on zero would mean CI is
 * red from the day it is switched on, so nobody would switch it on — which is exactly how it
 * stayed unenforced. Gating on "no worse than the baseline" is enforceable today: existing
 * debt is tolerated, new debt is not, and every fix ratchets the number down.
 *
 * Working the count down is the separate, ongoing job; when it reaches zero, replace this
 * with `eslint . --max-warnings 0` and delete the baseline.
 *
 *   npm run lint:ci             check against the baseline
 *   npm run lint:ci -- --update rewrite the baseline (after fixing problems, never to hide them)
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const baselineFile = join(here, '..', '.eslint-baseline.json');
const update = process.argv.includes('--update');

// Invoked through node against ESLint's own entry point rather than through `npx`, so the
// call needs no shell and behaves the same on Windows and on the CI runner.
const eslintBin = join(here, '..', 'node_modules', 'eslint', 'bin', 'eslint.js');

let report;
try {
  // ESLint exits non-zero when it finds problems; that is the normal path here, so the
  // output is read from the error rather than treated as a failure.
  report = execFileSync(process.execPath, [eslintBin, '.', '-f', 'json'], {
    cwd: join(here, '..'),
    encoding: 'utf8',
  });
} catch (err) {
  if (!err.stdout) {
    console.error('ESLint could not run:\n', err.stderr || err.message);
    process.exit(2);
  }
  report = err.stdout;
}

const files = JSON.parse(report);
const counts = files.reduce(
  (acc, f) => ({
    errors: acc.errors + f.errorCount,
    warnings: acc.warnings + f.warningCount,
  }),
  { errors: 0, warnings: 0 },
);

if (update) {
  writeFileSync(baselineFile, `${JSON.stringify(counts, null, 2)}\n`);
  console.log(`Baseline updated: ${counts.errors} errors, ${counts.warnings} warnings.`);
  process.exit(0);
}

const baseline = JSON.parse(readFileSync(baselineFile, 'utf8'));
const grew = counts.errors > baseline.errors || counts.warnings > baseline.warnings;

console.log(
  `ESLint: ${counts.errors} errors, ${counts.warnings} warnings ` +
  `(baseline ${baseline.errors} / ${baseline.warnings}).`,
);

if (grew) {
  console.error(
    '\nThis change adds new lint problems. Fix them, or — if a rule is genuinely wrong ' +
    'here — silence that one line with an eslint-disable comment explaining why.',
  );
  process.exit(1);
}

if (counts.errors < baseline.errors || counts.warnings < baseline.warnings) {
  console.log(
    'The count went down. Run `npm run lint:ci -- --update` and commit the new baseline ' +
    'so it cannot creep back up.',
  );
}
