import test from 'node:test';
import assert from 'node:assert/strict';
import Application from '../src/models/Application.js';
import AdmissionRound from '../src/models/AdmissionRound.js';
import Allocation from '../src/models/Allocation.js';
import Branch from '../src/models/Branch.js';
import ChatMessage from '../src/models/ChatMessage.js';
import College from '../src/models/College.js';
import Cutoff from '../src/models/Cutoff.js';
import Document from '../src/models/Document.js';
import HistoricalCutoff from '../src/models/HistoricalCutoff.js';
import Notification from '../src/models/Notification.js';
import Preference from '../src/models/Preference.js';
import Student from '../src/models/Student.js';
import User from '../src/models/User.js';
import { resetAdmissionCycle, seedFreshCycle } from '../src/controllers/admin.controller.js';

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

test('cycle reset clears branch seat reservations and reports deleted rounds', async () => {
  const patched = [];
  const deleteFilters = new Map();
  let seatReset = null;
  const replace = (model, key, implementation) => {
    patched.push([model, key, model[key]]);
    model[key] = implementation;
  };

  replace(College, 'countDocuments', async () => 1);
  replace(Branch, 'countDocuments', async () => 2);
  replace(Branch, 'updateMany', async (...args) => { seatReset = args; });
  replace(Cutoff, 'countDocuments', async () => 3);
  replace(HistoricalCutoff, 'countDocuments', async () => 4);
  replace(User, 'find', async () => [{ _id: 'student-user' }]);
  replace(User, 'deleteMany', async () => ({ deletedCount: 1 }));
  for (const model of [
    Student,
    Document,
    Preference,
    Allocation,
    Application,
    ChatMessage,
    Notification
  ]) {
    replace(model, 'deleteMany', async (filter) => {
      deleteFilters.set(model, filter);
      return { deletedCount: 1 };
    });
  }
  replace(AdmissionRound, 'deleteMany', async () => ({ deletedCount: 3 }));

  try {
    const response = makeResponse();
    await resetAdmissionCycle({}, response, (error) => { throw error; });

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.data.clearedRounds, 3);
    assert.deepEqual(response.body.data.preservedCatalog, {
      colleges: 1,
      branches: 2,
      cutoffs: 7
    });
    assert.deepEqual(seatReset, [{}, { $set: { allocatedSeats: 0 } }]);
    for (const model of [Student, Document, Preference, Allocation, Application, Notification]) {
      assert.deepEqual(deleteFilters.get(model), {});
    }
  } finally {
    for (const [model, key, original] of patched.reverse()) model[key] = original;
  }
});

test('fresh-cycle rejects an invalid year before clearing existing data', async () => {
  const response = makeResponse();
  await seedFreshCycle(
    { body: { year: 'not-a-year' } },
    response,
    (error) => { throw error; }
  );

  assert.equal(response.statusCode, 400);
  assert.match(response.body.message, /valid admission year/i);
});
