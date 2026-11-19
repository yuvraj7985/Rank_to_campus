import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv } from '../src/utils/csv.js';

test('parseCsv handles quoted commas, escaped quotes, and CRLF rows', () => {
  const rows = parseCsv('name,note\r\n"North, Valley","Says ""hello"""');

  assert.deepEqual(rows, [{
    name: 'North, Valley',
    note: 'Says "hello"'
  }]);
});

test('parseCsv rejects rows with missing values', () => {
  assert.throws(
    () => parseCsv('collegeCode,branchCode,year\nNVIT,CSE'),
    /expected 3/
  );
});

test('parseCsv rejects malformed quoting and duplicate headers', () => {
  assert.throws(() => parseCsv('name,note\n"open'), /unclosed quoted/);
  assert.throws(() => parseCsv('name,name\none,two'), /duplicate column/);
});
