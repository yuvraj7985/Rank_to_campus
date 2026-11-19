import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateProfileCompletion, mergeStudentProfile } from '../src/utils/profile.js';
import {
  getMissingRequiredDocuments,
  isAllocationRoundReady
} from '../src/controllers/allocation.controller.js';
import { classifyCutoffMatch } from '../src/controllers/predictor.controller.js';

test('calculateProfileCompletion returns a valid percentage for a mostly complete profile', () => {
  const student = {
    fullName: 'Aarav Sharma',
    dateOfBirth: '2006-05-12',
    gender: 'Male',
    state: 'Maharashtra',
    city: 'Pune',
    category: 'OPEN',
    examName: 'JEE Main',
    rank: 15432,
    score: 246,
    percentile: 96.4,
    interestedBranches: ['CSE', 'ECE'],
    academicInfo: {
      board: 'CBSE',
      schoolName: 'Greenfield Academy',
      class10Percentage: 94,
      class12Percentage: 96.2
    }
  };

  const result = calculateProfileCompletion(student);
  assert.equal(result.profileCompletion, 100);
  assert.equal(result.profileCompleted, true);
});

test('calculateProfileCompletion marks incomplete profiles as not ready', () => {
  const student = {
    fullName: 'Student One',
    dateOfBirth: null,
    gender: 'Other',
    state: '',
    city: '',
    category: 'OPEN',
    examName: '',
    rank: null,
    score: null,
    percentile: null,
    interestedBranches: [],
    academicInfo: {
      board: '',
      schoolName: '',
      class10Percentage: null,
      class12Percentage: null
    }
  };

  const result = calculateProfileCompletion(student);
  assert.ok(result.profileCompletion < 75);
  assert.equal(result.profileCompleted, false);
});

test('mergeStudentProfile preserves existing academic fields on partial updates', () => {
  const current = {
    fullName: 'Aarav Sharma',
    state: 'Maharashtra',
    city: 'Pune',
    academicInfo: {
      board: 'CBSE',
      schoolName: 'Greenfield Academy',
      class10Percentage: 94
    }
  };

  const result = mergeStudentProfile(current, {
    academicInfo: { class12Percentage: 96 }
  });

  assert.deepEqual(result.academicInfo, {
    board: 'CBSE',
    schoolName: 'Greenfield Academy',
    class10Percentage: 94,
    class12Percentage: 96
  });
  assert.equal(result.profileCompletion, calculateProfileCompletion(result).profileCompletion);
});

test('allocation can only run after preference intake is closed and can be safely rerun', () => {
  const openRound = isAllocationRoundReady({ status: 'open' });
  assert.equal(openRound.valid, false);
  assert.match(openRound.message, /Close this round/);
  assert.equal(isAllocationRoundReady({ status: 'closed' }).valid, true);
  assert.equal(isAllocationRoundReady({ status: 'allocation_completed' }).valid, true);
  assert.equal(isAllocationRoundReady({ status: 'upcoming' }).valid, false);
});

test('allocation diagnostics identify each required document that is missing or unapproved', () => {
  assert.deepEqual(
    getMissingRequiredDocuments([
      { type: 'marksheet_10', status: 'approved' },
      { type: 'rank_card', status: 'rejected' }
    ]),
    [
      { type: 'marksheet_12', status: 'missing' },
      { type: 'rank_card', status: 'rejected' }
    ]
  );
  assert.deepEqual(getMissingRequiredDocuments([]), [
    { type: 'marksheet_10', status: 'missing' },
    { type: 'marksheet_12', status: 'missing' },
    { type: 'rank_card', status: 'missing' }
  ]);
  assert.deepEqual(
    getMissingRequiredDocuments([
      { type: 'marksheet_10', status: 'approved' },
      { type: 'marksheet_12', status: 'approved' },
      { type: 'rank_card', status: 'approved', createdAt: '2026-01-01' },
      { type: 'rank_card', status: 'rejected', createdAt: '2026-02-01' }
    ]),
    [{ type: 'rank_card', status: 'rejected' }]
  );
});

test('classifyCutoffMatch categorizes rank-to-cutoff ratios consistently', () => {
  assert.deepEqual(classifyCutoffMatch(8000, 10000), { chance: 'Safe', matchScore: 100 });
  assert.deepEqual(classifyCutoffMatch(11000, 10000), { chance: 'Moderate', matchScore: 90 });
  assert.deepEqual(classifyCutoffMatch(12000, 10000), { chance: 'Risky', matchScore: 80 });
});

test('classifyCutoffMatch rejects invalid ranks and cutoffs', () => {
  assert.equal(classifyCutoffMatch(0, 10000), null);
  assert.equal(classifyCutoffMatch(10000, 0), null);
  assert.equal(classifyCutoffMatch('unknown', 10000), null);
});
