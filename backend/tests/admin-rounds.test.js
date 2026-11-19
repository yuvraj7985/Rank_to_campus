import test from 'node:test';
import assert from 'node:assert/strict';
import Application from '../src/models/Application.js';
import AdmissionRound from '../src/models/AdmissionRound.js';
import Allocation from '../src/models/Allocation.js';
import Preference from '../src/models/Preference.js';
import { deleteAdmissionRound, updateAdmissionRound } from '../src/controllers/admin.controller.js';

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

test('round deletion removes unallocated preferences and reports the cascade', async () => {
  const originalFindById = AdmissionRound.findById;
  const originalCountDocuments = Allocation.countDocuments;
  const originalDeleteMany = Preference.deleteMany;
  const originalDeleteApplications = Application.deleteMany;
  let preferencesDeleted = false;
  let applicationsDeleted = false;
  let roundDeleted = false;
  AdmissionRound.findById = async () => ({
    _id: '507f1f77bcf86cd799439011',
    deleteOne: async () => { roundDeleted = true; }
  });
  Allocation.countDocuments = async () => 0;
  Preference.deleteMany = async () => {
    preferencesDeleted = true;
    return { deletedCount: 2 };
  };
  Application.deleteMany = async () => {
    applicationsDeleted = true;
    return { deletedCount: 1 };
  };

  try {
    const response = makeResponse();
    await deleteAdmissionRound(
      { params: { id: '507f1f77bcf86cd799439011' } },
      response,
      (error) => { throw error; }
    );

    assert.equal(response.statusCode, 200);
    assert.match(response.body.message, /2 saved preference set/);
    assert.match(response.body.message, /1 application record/);
    assert.equal(preferencesDeleted, true);
    assert.equal(applicationsDeleted, true);
    assert.equal(roundDeleted, true);
  } finally {
    AdmissionRound.findById = originalFindById;
    Allocation.countDocuments = originalCountDocuments;
    Preference.deleteMany = originalDeleteMany;
    Application.deleteMany = originalDeleteApplications;
  }
});

test('round deletion preserves rounds that have allocation history', async () => {
  const originalFindById = AdmissionRound.findById;
  const originalCountDocuments = Allocation.countDocuments;
  const originalDeleteMany = Preference.deleteMany;
  const originalDeleteApplications = Application.deleteMany;
  let roundDeleted = false;
  let preferencesDeleted = false;
  AdmissionRound.findById = async () => ({
    _id: '507f1f77bcf86cd799439011',
    deleteOne: async () => { roundDeleted = true; }
  });
  Allocation.countDocuments = async () => 1;
  Preference.deleteMany = async () => { preferencesDeleted = true; };
  Application.deleteMany = async () => { preferencesDeleted = true; };

  try {
    const response = makeResponse();
    await deleteAdmissionRound(
      { params: { id: '507f1f77bcf86cd799439011' } },
      response,
      (error) => { throw error; }
    );

    assert.equal(response.statusCode, 409);
    assert.match(response.body.message, /allocation record/);
    assert.equal(preferencesDeleted, false);
    assert.equal(roundDeleted, false);
  } finally {
    AdmissionRound.findById = originalFindById;
    Allocation.countDocuments = originalCountDocuments;
    Preference.deleteMany = originalDeleteMany;
    Application.deleteMany = originalDeleteApplications;
  }
});

test('a round with allocation history cannot be reopened', async () => {
  const originalFindById = AdmissionRound.findById;
  const originalCountDocuments = Allocation.countDocuments;
  const round = {
    _id: '507f1f77bcf86cd799439011',
    status: 'allocation_completed',
    save: async () => assert.fail('A round with offers must not be changed.')
  };
  AdmissionRound.findById = async () => round;
  Allocation.countDocuments = async () => 1;

  try {
    const response = makeResponse();
    await updateAdmissionRound(
      { params: { id: '507f1f77bcf86cd799439011' }, body: { status: 'open' } },
      response,
      (error) => { throw error; }
    );

    assert.equal(response.statusCode, 409);
    assert.match(response.body.message, /cannot be reopened/);
    assert.equal(round.status, 'allocation_completed');
  } finally {
    AdmissionRound.findById = originalFindById;
    Allocation.countDocuments = originalCountDocuments;
  }
});
