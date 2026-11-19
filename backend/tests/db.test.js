import test from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import connectDB from '../src/config/db.js';

const withMongoUri = async (uri, action) => {
  const previousUri = process.env.MONGODB_URI;
  if (uri === undefined) delete process.env.MONGODB_URI;
  else process.env.MONGODB_URI = uri;

  try {
    await action();
  } finally {
    if (previousUri === undefined) delete process.env.MONGODB_URI;
    else process.env.MONGODB_URI = previousUri;
  }
};

test('database startup requires an explicit connection string', async () => {
  await withMongoUri(undefined, async () => {
    await assert.rejects(connectDB(), /MONGODB_URI must be configured/);
  });
});

test('database startup refuses to fall back to a local MongoDB instance', async () => {
  await withMongoUri('mongodb://127.0.0.1:27017/rank2campus', async () => {
    await assert.rejects(connectDB(), /points to a local database/);
  });
});

test('database startup connects using the configured Atlas URI', async () => {
  const originalConnect = mongoose.connect;
  const originalLog = console.log;
  const uri = 'mongodb+srv://user:password@cluster.example.mongodb.net/rank2campus';
  let connection;
  mongoose.connect = async (...args) => { connection = args; };
  console.log = () => {};

  try {
    await withMongoUri(uri, async () => {
      await connectDB();
      assert.equal(connection[0], uri);
      assert.deepEqual(connection[1], {
        dbName: 'rank2campus',
        serverSelectionTimeoutMS: 15000
      });
    });
  } finally {
    mongoose.connect = originalConnect;
    console.log = originalLog;
  }
});

test('Atlas connection errors are actionable without exposing the connection string', async () => {
  const originalConnect = mongoose.connect;
  const uri = 'mongodb+srv://dbuser:private-password@cluster.example.mongodb.net/rank2campus';
  mongoose.connect = async () => {
    const error = new Error(`Authentication failed for ${uri}`);
    error.name = 'MongoServerError';
    error.code = 18;
    throw error;
  };

  try {
    await withMongoUri(uri, async () => {
      await assert.rejects(connectDB(), (error) => {
        assert.match(error.message, /Atlas database username and password/);
        assert.doesNotMatch(error.message, /private-password|dbuser/);
        return true;
      });
    });
  } finally {
    mongoose.connect = originalConnect;
  }
});
