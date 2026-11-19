export function parseCsv(text) {
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error('CSV file is empty.');
  }

  const rows = [[]];
  let value = '';
  let quoted = false;
  let closedQuote = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (quoted) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          value += '"';
          index += 1;
        } else {
          quoted = false;
          closedQuote = true;
        }
      } else {
        value += character;
      }
      continue;
    }

    if (character === '"' && value.length === 0 && !closedQuote) {
      quoted = true;
    } else if (character === ',') {
      rows[rows.length - 1].push(value.trim());
      value = '';
      closedQuote = false;
    } else if (character === '\n' || character === '\r') {
      rows[rows.length - 1].push(value.trim());
      rows.push([]);
      value = '';
      closedQuote = false;
      if (character === '\r' && text[index + 1] === '\n') index += 1;
    } else if (closedQuote && character.trim()) {
      throw new Error(`Unexpected character after a quoted value at position ${index + 1}.`);
    } else if (!closedQuote) {
      value += character;
    }
  }

  if (quoted) throw new Error('CSV contains an unclosed quoted value.');
  rows[rows.length - 1].push(value.trim());

  while (rows.length && rows[rows.length - 1].every((cell) => !cell)) rows.pop();
  if (!rows.length) throw new Error('CSV file is empty.');

  const headers = rows.shift().map((header) => header.trim().toLowerCase());
  if (headers.some((header) => !header)) throw new Error('CSV contains an empty column name.');
  if (new Set(headers).size !== headers.length) throw new Error('CSV contains duplicate column names.');

  return rows.map((row, index) => {
    if (row.length !== headers.length) {
      throw new Error(`CSV row ${index + 2} has ${row.length} values; expected ${headers.length}.`);
    }
    return Object.fromEntries(headers.map((header, column) => [header, row[column]]));
  });
}
