// Fast drop-in for csv-reader 1.0.0 (make.fun's own CSV reader): run(input) returns
// exactly csv-reader's answer {columns, rows, errors} for {text, header}.
//
// Same reading policy, faster mechanics: instead of one character at a time with
// string concatenation, unquoted fields are scanned with a tight charCodeAt loop
// and cut out with one slice, quoted fields are located with indexOf, and only
// the rare paths (stray CR, doubled quotes, line breaks inside quotes, junk
// after a closing quote, unterminated quote) pay for extra work.

const COMMA = 0;
const LINE_BREAK = 1;
const END = 2;

/** csv-reader 1.0.0's answer for one case's input. */
export function run(input) {
  const text = String(input.text);
  const header = input.header === true;
  const errors = [];
  const rows = [];
  let columns = null;
  let width = -1;

  const len = text.length;
  let pos = 0; // the next character to read
  let line = 1; // the line that character is on
  if (len > 0 && text.charCodeAt(0) === 0xfeff) pos = 1;

  // The record being read: the line it starts on and the index in rows it takes (null: the header).
  let recordLine = 1;
  let recordRow = null;

  // The field just read: its value, how it ended, and the characters the last
  // unquoted scan kept. Shared slots, not a fresh object per field: a set holds
  // about a million fields, and one object each is pure GC pressure.
  let fValue = '';
  let fEnded = END;
  let fAdded = 0;

  function error(code) {
    errors.push({ code, line: recordLine, row: recordRow });
  }

  // Reads unquoted characters onto `init` up to the next comma or line break: a CR
  // not followed by LF is dropped (stray_cr). Sets fValue, fEnded and fAdded
  // (the characters kept by this scan, not counting `init`).
  function readUnquoted(init) {
    let value = init;
    let added = 0;
    for (;;) {
      let i = pos;
      while (i < len) {
        const c = text.charCodeAt(i);
        if (c === 44 || c === 10 || c === 13) break;
        i++;
      }
      if (i > pos) {
        const seg = text.slice(pos, i);
        if (value === '') value = seg;
        else value += seg;
        added += i - pos;
        pos = i;
      }
      if (i >= len) {
        fValue = value;
        fEnded = END;
        fAdded = added;
        return;
      }
      const c = text.charCodeAt(i);
      if (c === 44) {
        pos = i + 1;
        fValue = value;
        fEnded = COMMA;
        fAdded = added;
        return;
      }
      if (c === 10) {
        pos = i + 1;
        line += 1;
        fValue = value;
        fEnded = LINE_BREAK;
        fAdded = added;
        return;
      }
      // CR: CRLF ends the line, a lone CR is dropped (stray_cr) and the field goes on.
      if (i + 1 < len && text.charCodeAt(i + 1) === 10) {
        pos = i + 2;
        line += 1;
        fValue = value;
        fEnded = LINE_BREAK;
        fAdded = added;
        return;
      }
      error('stray_cr');
      pos = i + 1;
    }
  }

  // Reads a quoted field whose opening quote is at pos. Sets fValue and fEnded.
  function readQuoted() {
    const open = pos;
    const openLine = line;
    // The closing quote is the first quote not doubled by another right after it.
    let q = text.indexOf('"', pos + 1);
    let doubled = false;
    while (q !== -1 && q + 1 < len && text.charCodeAt(q + 1) === 34) {
      doubled = true;
      q = text.indexOf('"', q + 2);
    }
    if (q === -1) {
      // The quote never closes: it is a literal character, and the text after it
      // is read again as an unquoted field.
      pos = open + 1;
      line = openLine;
      error('unterminated_quote');
      readUnquoted('"');
      return;
    }
    const content = text.slice(pos + 1, q);
    const hasCR = content.indexOf('\r') !== -1;
    const hasNL = content.indexOf('\n') !== -1;
    let value;
    if (!hasCR && !hasNL) {
      value = doubled ? content.replaceAll('""', '"') : content;
    } else {
      // CRLF and a lone CR inside quotes are each one LF; count every line
      // break the content holds (a CRLF counts once).
      let breaks = 0;
      for (let i = 0; i < content.length; i++) {
        const c = content.charCodeAt(i);
        if (c === 13) {
          breaks += 1;
          if (content.charCodeAt(i + 1) === 10) i += 1;
        } else if (c === 10) {
          breaks += 1;
        }
      }
      line += breaks;
      value = content;
      if (doubled) value = value.replaceAll('""', '"');
      if (hasCR) value = value.replace(/\r\n?/g, '\n');
    }
    pos = q + 1;
    if (pos >= len) {
      fValue = value;
      fEnded = END;
      return;
    }
    const c = text.charCodeAt(pos);
    if (c === 44) {
      pos += 1;
      fValue = value;
      fEnded = COMMA;
      return;
    }
    if (c === 10) {
      pos += 1;
      line += 1;
      fValue = value;
      fEnded = LINE_BREAK;
      return;
    }
    if (c === 13 && pos + 1 < len && text.charCodeAt(pos + 1) === 10) {
      pos += 2;
      line += 1;
      fValue = value;
      fEnded = LINE_BREAK;
      return;
    }
    // What follows the closing quote is appended as it stands, up to the next
    // comma or line break.
    readUnquoted(value);
    if (fAdded > 0) error('quote_junk');
  }

  for (;;) {
    // Lines with no characters are no records.
    while (pos < len) {
      const c = text.charCodeAt(pos);
      if (c === 10) {
        pos += 1;
        line += 1;
      } else if (c === 13 && pos + 1 < len && text.charCodeAt(pos + 1) === 10) {
        pos += 2;
        line += 1;
      } else {
        break;
      }
    }
    if (pos >= len) break;

    recordLine = line;
    recordRow = header && columns === null ? null : rows.length;
    const fields = [];
    let quoted;
    do {
      quoted = text.charCodeAt(pos) === 34;
      if (quoted) readQuoted();
      else readUnquoted('');
      fields.push(fValue);
    } while (fEnded === COMMA);

    // A line that held only stray CRs is left with no characters: no record (its stray_cr errors stay).
    if (fields.length === 1 && fields[0] === '' && !quoted) continue;

    if (width < 0) width = fields.length;
    if (header && columns === null) {
      columns = fields;
      continue;
    }
    if (fields.length < width) {
      errors.push({ code: 'short_row', line: recordLine, row: recordRow, fields: fields.length });
      while (fields.length < width) fields.push('');
    } else if (fields.length > width) {
      errors.push({ code: 'long_row', line: recordLine, row: recordRow, extra: fields.splice(width) });
    }
    rows.push(fields);
  }
  return { columns: header ? (columns ?? []) : null, rows, errors };
}
