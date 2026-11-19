import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import User from '../src/models/User.js';
import Student from '../src/models/Student.js';
import { register } from '../src/controllers/auth.controller.js';
import { allowRoles, protect } from '../src/middleware/auth.middleware.js';
import { normalizeIndianMobileNumber } from '../src/utils/identity.js';

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

test('Indian mobile numbers normalize to E.164 and invalid values are rejected', () => {
  assert.equal(normalizeIndianMobileNumber('98765 43210'), '+919876543210');
  assert.equal(normalizeIndianMobileNumber('+91-98765-43210'), '+919876543210');
  assert.equal(normalizeIndianMobileNumber('0123456789'), null);
  assert.equal(normalizeIndianMobileNumber('not-a-number'), null);
});

test('student registration ignores a requested admin role', async () => {
  const originalExists = User.exists;
  const originalCreate = User.create;
  const originalDeleteOne = User.deleteOne;
  const originalStudentCreate = Student.create;
  const originalSecret = process.env.JWT_SECRET;
  const expectedId = '507f1f77bcf86cd799439011';
  let createdUser;
  let createdStudent;
  User.exists = async () => false;
  User.create = async (input) => {
    createdUser = input;
    return { ...input, _id: expectedId };
  };
  User.deleteOne = async () => ({ deletedCount: 1 });
  Student.create = async (input) => { createdStudent = input; };
  process.env.JWT_SECRET = 'test-secret-with-more-than-thirty-two-characters';

  try {
    const response = makeResponse();
    await register({
      body: {
        name: 'Aarav Sharma',
        email: 'aarav@example.com',
        password: 'strong-pass-123',
        phone: '+919876543210',
        role: 'admin',
        isActive: true
      }
    }, response, (error) => { throw error; });

    assert.equal(response.statusCode, 201);
    assert.equal(createdUser.role, 'student');
    assert.equal(createdUser.isActive, undefined);
    assert.equal(createdStudent.fullName, 'Aarav Sharma');
    assert.equal(createdStudent.phone, '+919876543210');
    assert.equal(response.body.user.role, 'student');
    assert.ok(response.body.token);
  } finally {
    User.exists = originalExists;
    User.create = originalCreate;
    User.deleteOne = originalDeleteOne;
    Student.create = originalStudentCreate;
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  }
});

test('student accounts cannot pass admin role authorization', () => {
  const response = makeResponse();
  let nextCalled = false;
  allowRoles('admin')(
    { user: { role: 'student' } },
    response,
    () => { nextCalled = true; }
  );

  assert.equal(response.statusCode, 403);
  assert.equal(nextCalled, false);
});

test('tokens with non-ObjectId subjects are rejected before user lookup', async () => {
  const secret = 'test-secret-with-more-than-thirty-two-characters';
  const originalSecret = process.env.JWT_SECRET;
  const originalFindById = User.findById;
  process.env.JWT_SECRET = secret;
  User.findById = () => assert.fail('Invalid token subject must not reach the user query.');

  try {
    const response = makeResponse();
    const token = jwt.sign({ sub: 'not-an-object-id' }, secret, { algorithm: 'HS256' });
    await protect(
      { headers: { authorization: `Bearer ${token}` } },
      response,
      (error) => { throw error; }
    );

    assert.equal(response.statusCode, 401);
    assert.match(response.body.message, /invalid token/i);
  } finally {
    User.findById = originalFindById;
    if (originalSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = originalSecret;
  }
});
