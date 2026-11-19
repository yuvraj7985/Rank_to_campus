import test from 'node:test';
import assert from 'node:assert/strict';
import AdmissionRound from '../src/models/AdmissionRound.js';
import Allocation from '../src/models/Allocation.js';
import Branch from '../src/models/Branch.js';
import Document from '../src/models/Document.js';
import Preference from '../src/models/Preference.js';
import Student from '../src/models/Student.js';
import { runAllocation } from '../src/controllers/allocation.controller.js';

const makeResponse = () => ({
  statusCode: 200,
  body: null,
  status(code) {
    this.statusCode = code;
    return this;
  },
  json(body) {
    this.body = body;
    return this;
  }
});

test('allocation follows merit order and falls through to the next available preference', async () => {
  const round = {
    _id: '507f1f77bcf86cd799439011',
    status: 'closed',
    save: async () => {}
  };
  const students = [
    { _id: 'student-lower-merit', rank: 20, fullName: 'Second' },
    { _id: 'student-higher-merit', rank: 10, fullName: 'First' }
  ];
  const preferences = {
    'student-higher-merit': {
      choices: [{ branch: 'branch-b', order: 2 }, { branch: 'branch-a', order: 1 }]
    },
    'student-lower-merit': {
      choices: [{ branch: 'branch-a', order: 1 }, { branch: 'branch-b', order: 2 }]
    }
  };
  const documents = ['marksheet_10', 'marksheet_12', 'rank_card'].map((type) => ({
    type,
    status: 'approved'
  }));
  const branches = {
    'branch-a': { _id: 'branch-a', totalSeats: 1, allocatedSeats: 0 },
    'branch-b': { _id: 'branch-b', totalSeats: 1, allocatedSeats: 0 }
  };
  const allocations = [];
  const patched = [];
  const replace = (model, key, implementation) => {
    patched.push([model, key, model[key]]);
    model[key] = implementation;
  };

  replace(AdmissionRound, 'findById', async () => round);
  replace(Student, 'find', () => ({
    sort: async () => [...students].sort((a, b) => a.rank - b.rank)
  }));
  replace(Allocation, 'exists', async ({ student, admissionRound }) => allocations.some(
    (item) => item.student === student && item.admissionRound === admissionRound
  ));
  replace(Allocation, 'create', async (record) => {
    const created = { _id: `allocation-${allocations.length + 1}`, ...record };
    allocations.push(created);
    return created;
  });
  replace(Preference, 'findOne', (filter) => ({
    populate: async () => preferences[String(filter.student)]
  }));
  replace(Document, 'find', () => ({ sort: async () => documents }));
  replace(Branch, 'findOneAndUpdate', async (filter) => {
    const branch = branches[String(filter._id)];
    if (!branch || branch.allocatedSeats >= branch.totalSeats) return null;
    branch.allocatedSeats += 1;
    return branch;
  });

  try {
    const response = makeResponse();
    await runAllocation(
      { params: { roundId: round._id } },
      response,
      (error) => { throw error; }
    );

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.data.allocated, 2);
    assert.deepEqual(
      allocations.map(({ student, branch }) => [student, branch]),
      [
        ['student-higher-merit', 'branch-a'],
        ['student-lower-merit', 'branch-b']
      ]
    );
    assert.equal(branches['branch-a'].allocatedSeats, 1);
    assert.equal(branches['branch-b'].allocatedSeats, 1);
    assert.equal(round.status, 'allocation_completed');
  } finally {
    for (const [model, key, original] of patched.reverse()) model[key] = original;
  }
});
