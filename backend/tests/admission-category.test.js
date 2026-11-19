import test from 'node:test';
import assert from 'node:assert/strict';
import HistoricalCutoff from '../src/models/HistoricalCutoff.js';
import { getAdmissionCategoryValues, normalizeAdmissionCategory } from '../src/utils/admissionCategory.js';
import { cleanAiAnswer } from '../src/utils/cleanAiAnswer.js';
import { prepareCutoffImportRow, toCutoffView } from '../src/utils/cutoffRecord.js';

test('normalizes common CSV and profile category labels', () => {
  assert.equal(normalizeAdmissionCategory('OBC'), 'OBC-NCL');
  assert.equal(normalizeAdmissionCategory('obc ncl'), 'OBC-NCL');
  assert.equal(normalizeAdmissionCategory('OBC (NCL)'), 'OBC-NCL');
  assert.equal(normalizeAdmissionCategory('OBC (PWD)'), null);
  assert.equal(normalizeAdmissionCategory('GENERAL'), 'OPEN');
  assert.equal(normalizeAdmissionCategory('UR'), 'OPEN');
  assert.equal(normalizeAdmissionCategory('SC'), 'SC');
  assert.equal(normalizeAdmissionCategory('unsupported'), null);
});

test('matches canonical and legacy cutoff category values', () => {
  assert.deepEqual(getAdmissionCategoryValues('OBC'), [
    'OBC-NCL',
    'OBC',
    'OBC NCL',
    'OBC_NCL',
    'OBC (NCL)',
    'OBC(NCL)',
    'OBC-NON-CREAMY-LAYER'
  ]);
});

test('cleans markdown markers without changing answer wording', () => {
  assert.equal(
    cleanAiAnswer('## **Your options**\n\n* **Option 1**: Try `Rank Predictor`.\n\n****'),
    'Your options\n\n• Option 1: Try Rank Predictor.'
  );
});

test('historical cutoffs can be stored and displayed without a catalog branch', () => {
  const record = new HistoricalCutoff({
    collegeCode: 'KIET',
    collegeName: 'KIET Group of Institutions',
    branchCode: 'ECE',
    year: 2026,
    category: 'OBC-NCL',
    closingRank: 12000
  });

  assert.equal(record.validateSync(), undefined);
  assert.deepEqual(
    (({ collegeCode, branchCode, college, branch }) => ({ collegeCode, branchCode, college, branch }))(toCutoffView(record.toObject())),
    {
      collegeCode: 'KIET',
      branchCode: 'ECE',
      college: 'KIET Group of Institutions',
      branch: 'ECE'
    }
  );
});

test('CSV rows with unknown branches become snapshots instead of requiring a catalog record', () => {
  const result = prepareCutoffImportRow({
    collegeCode: 'KIET',
    branchCode: 'ECE',
    examName: 'JEE Main',
    year: 2026,
    round: 1,
    category: 'OBC-NCL',
    closingRank: 12000
  });

  assert.equal(result.cutoff.branch, undefined);
  assert.equal(result.snapshot.collegeCode, 'KIET');
  assert.equal(result.snapshot.branchCode, 'ECE');
  assert.equal(result.snapshot.collegeName, 'KIET');
  assert.equal(result.snapshot.branchName, 'ECE');
});
