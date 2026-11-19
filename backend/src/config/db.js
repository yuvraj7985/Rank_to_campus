import mongoose from 'mongoose';

const applicationDatabaseName = 'rank2campus';
const localHosts = new Set(['localhost', '127.0.0.1', '::1']);

const getMongoHost = (uri) =>
  uri.match(/^mongodb(?:\+srv)?:\/\/(?:[^@/]+@)?(\[[^\]]+\]|[^/:?]+)/i)?.[1]
    ?.replace(/^\[|\]$/g, '')
    .toLowerCase();

const getConnectionFailureMessage = (error) => {
  const type = error?.name || 'Error';
  const detail = error?.code === 18 || /authentication failed/i.test(error?.message || '')
    ? 'Check the Atlas database username and password.'
    : /querySrv|ENOTFOUND|DNS/i.test(error?.message || '')
      ? 'Check DNS/network access and the Atlas cluster hostname.'
      : 'Check the Atlas cluster status, Network Access IP allowlist, and database-user permissions.';

  return `MongoDB Atlas connection failed (${type}). ${detail}`;
};

export default async function connectDB() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error('MONGODB_URI must be configured in backend/.env before starting the API.');
  }

  const host = getMongoHost(uri);
  if (!host) {
    throw new Error('MONGODB_URI must be a valid MongoDB connection string.');
  }

  if (localHosts.has(host)) {
    throw new Error('MONGODB_URI points to a local database. Configure your MongoDB Atlas connection string in backend/.env.');
  }

  try {
    await mongoose.connect(uri, {
      dbName: applicationDatabaseName,
      serverSelectionTimeoutMS: 15000
    });
    console.log(`MongoDB Atlas connected: ${mongoose.connection.host}`);
  } catch (error) {
    throw new Error(getConnectionFailureMessage(error));
  }
}
