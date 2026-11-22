[![make.fun · csv-reader-speed-01-run-20261121](https://make.fun/badge/csv-reader-speed-01-run-20261121.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![rank](https://make.fun/badge/csv-reader-speed-01-run-20261121/goperek48/csvreader-entry/rank.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)
[![reward](https://make.fun/badge/csv-reader-speed-01-run-20261121/goperek48/csvreader-entry/reward.svg)](https://make.fun/bounty/csv-reader-speed-01-run-20261121?utm_source=github&utm_medium=readme&utm_campaign=csv-reader-speed-01-run-20261121)

# csv-reader-speed-01-run-20261121 — probe entry

Faster drop-in for csv-reader 1.0.0 (make.fun's own CSV reader). `solve.js`
exports `run(input)` returning exactly csv-reader's `{columns, rows, errors}`
for `{text, header}`; `main.ts` is the house driver, unchanged.

## How it is faster

The reference reads one character at a time and builds every field with
`value += c`. This entry keeps the exact same reading policy (BOM dropped,
CRLF/LF record ends, lone CR outside quotes dropped as `stray_cr`, quoted
fields with `""` escapes and CR/LF inside read as LF, junk after a closing
quote appended as `quote_junk`, a never-closing quote read again as a literal
`unterminated_quote`, ragged rows padded/cut with `short_row`/`long_row`) but
changes the mechanics:

- unquoted fields: one tight `charCodeAt` scan to the next delimiter, then a
  single `slice` — no per-character concatenation;
- quoted fields: located with `indexOf`, content sliced once; doubled quotes
  and CR/LF inside handled only when present;
- no result object per field: the field just read lives in shared slots
  (`fValue`/`fEnded`/`fAdded`), about a million fields a set.

## Dev results (practice set, 6 cases, 10,193,953 chars)

- 6/6 cases identical to `practice/reference/expected.json` (and to the
  reference program directly), 39/39 hand-made edge cases identical.
- ~3.3–4.6x faster than csv-reader 1.0.0 on this machine (noisy shared CPU;
  interleaved median 549 ms vs 1822 ms for the whole set).
