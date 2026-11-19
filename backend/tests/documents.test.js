import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import Document from '../src/models/Document.js';
import Student from '../src/models/Student.js';
import { createRequiredDocuments, reviewDocument } from '../src/controllers/document.controller.js';

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

test('required document submission stores all three verified files in one request', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'rank2campus-docs-'));
  const originalFindOne = Student.findOne;
  const originalInsertMany = Document.insertMany;
  const types = ['marksheet_10', 'marksheet_12', 'rank_card'];
  const files = {};
  let inserted;
  try {
    for (const [index, type] of types.entries()) {
      const filePath = path.join(directory, `${type}.pdf`);
      await fs.writeFile(filePath, '%PDF-test');
      files[type] = [{
        path: filePath,
        originalname: `${type}.pdf`,
        filename: `${index}-${type}.pdf`,
        mimetype: 'application/pdf',
        size: 9
      }];
    }
    Student.findOne = async () => ({ _id: 'student-id' });
    Document.insertMany = async (records) => {
      inserted = records;
      return records;
    };

    const response = makeResponse();
    await createRequiredDocuments(
      { files, user: { _id: 'user-id' } },
      response,
      (error) => { throw error; }
    );

    assert.equal(response.statusCode, 201);
    assert.deepEqual(inserted.map((record) => record.type), types);
    assert.equal(response.body.data.length, 3);
    assert.match(response.body.message, /submitted together/);
  } finally {
    Student.findOne = originalFindOne;
    Document.insertMany = originalInsertMany;
    await fs.rm(directory, { recursive: true, force: true });
  }
});

test('required document submission rejects incomplete sets', async () => {
  const originalFindOne = Student.findOne;
  let studentLookupCalled = false;
  Student.findOne = async () => {
    studentLookupCalled = true;
    return { _id: 'student-id' };
  };

  try {
    const response = makeResponse();
    await createRequiredDocuments(
      { files: { marksheet_10: [] }, user: { _id: 'user-id' } },
      response,
      (error) => { throw error; }
    );

    assert.equal(response.statusCode, 400);
    assert.match(response.body.message, /Class 10 marksheet, Class 12 marksheet/);
    assert.equal(studentLookupCalled, false);
  } finally {
    Student.findOne = originalFindOne;
  }
});

test('rejecting a document requires a review note before updating it', async () => {
  const originalFindOneAndUpdate = Document.findOneAndUpdate;
  let updated = false;
  Document.findOneAndUpdate = async () => {
    updated = true;
    return {};
  };

  try {
    const response = makeResponse();
    await reviewDocument(
      { params: { id: 'document-id' }, body: { status: 'rejected', reviewNote: '  ' }, user: { _id: 'admin-id' } },
      response,
      (error) => { throw error; }
    );
    assert.equal(response.statusCode, 400);
    assert.equal(updated, false);
  } finally {
    Document.findOneAndUpdate = originalFindOneAndUpdate;
  }
});

test('a document that is no longer pending cannot receive another decision', async () => {
  const originalFindOneAndUpdate = Document.findOneAndUpdate;
  const originalExists = Document.exists;
  let filter;
  Document.findOneAndUpdate = async (query) => {
    filter = query;
    return null;
  };
  Document.exists = async () => true;

  try {
    const response = makeResponse();
    await reviewDocument(
      { params: { id: 'document-id' }, body: { status: 'approved' }, user: { _id: 'admin-id' } },
      response,
      (error) => { throw error; }
    );
    assert.deepEqual(filter, { _id: 'document-id', status: 'pending' });
    assert.equal(response.statusCode, 409);
    assert.match(response.body.message, /already been reviewed/);
  } finally {
    Document.findOneAndUpdate = originalFindOneAndUpdate;
    Document.exists = originalExists;
  }
});
