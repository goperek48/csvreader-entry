import { readFileSync } from 'node:fs';
import { run } from './solve.js';
import { readCsv } from '/home/hatch/workspace/makefun/work/csv-reader-speed-01-run-20261121-kit/program/generator/vendor/csv-reader/index.js';
const KIT = '/home/hatch/workspace/makefun/work/csv-reader-speed-01-run-20261121-kit';
const cases = JSON.parse(readFileSync(`${KIT}/practice/input/cases.json`, 'utf8'));
for (const c of cases) { run(c.input); readCsv(c.input); }
const N = 6;
const ref = [], mine = [];
for (let r = 0; r < N; r++) {
  let t0 = process.hrtime.bigint();
  for (const c of cases) readCsv(c.input);
  ref.push(Number(process.hrtime.bigint() - t0) / 1e6);
  t0 = process.hrtime.bigint();
  for (const c of cases) run(c.input);
  mine.push(Number(process.hrtime.bigint() - t0) / 1e6);
}
const med = (a) => [...a].sort((x, y) => x - y)[Math.floor(a.length / 2)];
console.log('ref :', ref.map((t) => t.toFixed(0)).join(', '), 'median', med(ref).toFixed(0));
console.log('mine:', mine.map((t) => t.toFixed(0)).join(', '), 'median', med(mine).toFixed(0));
console.log('speedup:', (med(ref) / med(mine)).toFixed(2) + 'x');
