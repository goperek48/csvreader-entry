// Dev test: my solve.js vs csv-reader 1.0.0 (reference) and vs the practice
// expected.json, plus a hand-made edge-case suite. Usage: node test.mjs [rounds]
import { readFileSync } from 'node:fs';
import { run } from './solve.js';
import { readCsv } from '/home/hatch/workspace/makefun/work/csv-reader-speed-01-run-20261121-kit/program/generator/vendor/csv-reader/index.js';

const KIT = '/home/hatch/workspace/makefun/work/csv-reader-speed-01-run-20261121-kit';

function canonical(v) {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v !== null && typeof v === 'object') {
    const keys = Object.keys(v).sort();
    return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(',')}}`;
  }
  return JSON.stringify(v) ?? 'null';
}

// ---- practice set ----
const cases = JSON.parse(readFileSync(`${KIT}/practice/input/cases.json`, 'utf8'));
const expected = JSON.parse(readFileSync(`${KIT}/practice/reference/expected.json`, 'utf8'));
const byId = new Map(expected.cases.map((c) => [c.id, c.output]));

let pass = 0;
let fail = 0;
const failedIds = [];
for (const c of cases) {
  const mine = run(c.input);
  const want = byId.get(c.id);
  const ref = readCsv(c.input);
  const okExpected = canonical(mine) === canonical(want);
  const okRef = canonical(mine) === canonical(ref);
  if (okExpected && okRef) pass++;
  else {
    fail++;
    failedIds.push(`${c.id} (vsExpected=${okExpected} vsRef=${okRef})`);
  }
}
console.log(`practice: ${pass}/${cases.length} pass, ${fail} fail`);
if (failedIds.length) console.log('failed:', failedIds.join('; '));

// ---- hand-made edge cases (mine vs reference, must be identical) ----
const edges = [
  { text: '', header: true },
  { text: '', header: false },
  { text: '\uFEFFa,b\n1,2\n', header: true },
  { text: '\uFEFFa,b\r\n1,2\r\n', header: true },
  { text: 'a,b\r\n1,2', header: true },
  { text: 'a,b\n\n1,2\n\n\n3,4\n', header: true },
  { text: '\n\n', header: false },
  { text: 'a,b\r1,2\r3,4', header: true }, // lone CRs = stray_cr, dropped
  { text: 'a\rb,c\n1\r2,3\n', header: false },
  { text: '"a,b","c""d",e\n"x\ny","p\r\nq",z\n', header: true },
  { text: '"a\rb","c\rd"\n', header: false }, // lone CR inside quotes -> LF
  { text: '"a\r\rb"\n', header: false },
  { text: '"abc\n', header: false }, // unterminated quote
  { text: '"abc', header: false },
  { text: '"a"b,c\n', header: false }, // quote_junk
  { text: '"a"xy,"b"z\n', header: false },
  { text: '"a"\rx,b\n', header: false }, // stray CR inside junk
  { text: '"a" ,b\n', header: false }, // junk is a space
  { text: '""\n', header: false }, // empty quoted field = real record
  { text: '\r\n', header: false }, // only CRLF = no record
  { text: '\r', header: false }, // only a lone CR = stray_cr, no record
  { text: '\r\r\n', header: false },
  { text: 'a,b\n1\n2,3,4\n', header: true }, // short_row + long_row
  { text: 'a,b,c\n"x,y\n', header: true }, // unterminated across the whole tail
  { text: 'a,b\n"unterminated,more\nstill,going\n', header: true },
  { text: 'a"b,c"d\n', header: false }, // quotes inside unquoted = literal
  { text: '"a""b""c",d\n', header: false },
  { text: '"""",x\n', header: false }, // '""' doubled -> one quote, then closing
  { text: '"""\n', header: false }, // '""' doubled then EOF -> unterminated
  { text: 'a,b\n1,2', header: true }, // no trailing EOL
  { text: 'a,b\r', header: true }, // trailing lone CR after header
  { text: '\uFEFF', header: true }, // only BOM
  { text: '\uFEFF\n', header: true },
  { text: 'a,b\n"x\ny",2\n3,4\n', header: true }, // LF inside quotes counts lines
  { text: 'a,b\n1,2\n"x', header: true }, // unterminated in last record
  { text: '"q"junk"more",x\n', header: false }, // junk holding a quote char
  { text: 'a,b\n,\n', header: true }, // two empty fields
  { text: 'a\n,\n,,\n', header: false },
  { text: 'a,b\n"a",\n', header: true }, // short_row via trailing comma
];
let ePass = 0;
let eFail = 0;
const eFailed = [];
edges.forEach((input, i) => {
  const mine = run(input);
  const ref = readCsv(input);
  if (canonical(mine) === canonical(ref)) ePass++;
  else {
    eFail++;
    eFailed.push(i);
    console.log(`EDGE ${i} MISMATCH input=${JSON.stringify(input)}`);
    console.log('  mine:', JSON.stringify(mine));
    console.log('  ref :', JSON.stringify(ref));
  }
});
console.log(`edges: ${ePass}/${edges.length} pass, ${eFail} fail`);

// ---- timing: whole practice set, repeated rounds ----
const rounds = Number(process.argv[2] ?? 3);
function timeIt(fn, label) {
  // warm-up
  for (const c of cases) fn(c.input);
  const ts = [];
  for (let r = 0; r < rounds; r++) {
    const t0 = process.hrtime.bigint();
    for (const c of cases) fn(c.input);
    const t1 = process.hrtime.bigint();
    ts.push(Number(t1 - t0) / 1e6);
  }
  ts.sort((a, b) => a - b);
  const med = ts[Math.floor(ts.length / 2)];
  console.log(`${label}: ${ts.map((t) => t.toFixed(0)).join(', ')} ms (median ${med.toFixed(0)} ms)`);
  return med;
}
const tRef = timeIt(readCsv, 'reference csv-reader');
const tMine = timeIt(run, 'mine          ');
console.log(`speedup: ${(tRef / tMine).toFixed(2)}x faster than csv-reader`);
const totalChars = cases.reduce((s, c) => s + String(c.input.text).length, 0);
console.log(`practice set: ${cases.length} cases, ${totalChars} chars total`);
