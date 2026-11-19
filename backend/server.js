import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
dotenv.config({ path: fileURLToPath(new URL('./.env', import.meta.url)) });
import app from './src/app.js';
import connectDB from './src/config/db.js';

const DEFAULT_PORT = Number(process.env.PORT || 5000);
const jwtSecret = process.env.JWT_SECRET || '';

if (jwtSecret.length < 32 || /replace_with|change_this/i.test(jwtSecret)) {
  throw new Error('JWT_SECRET must be a unique secret of at least 32 characters.');
}
if (process.env.NODE_ENV === 'production' && !process.env.CLIENT_URL) {
  throw new Error('CLIENT_URL must be configured in production.');
}

const listen = (port) => new Promise((resolve, reject) => {
  const server = app.listen(port, () => resolve(server));
  server.once('error', reject);
});

const startServer = async () => {
  try {
    await connectDB();
    await listen(DEFAULT_PORT);
    console.log(`Rank2Campus API running on port ${DEFAULT_PORT}`);
  } catch (error) {
    console.error(`Server startup failed on port ${DEFAULT_PORT}:`, error.message);
    process.exit(1);
  }
};

startServer();
