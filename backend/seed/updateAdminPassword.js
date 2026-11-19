import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
dotenv.config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });

import mongoose from 'mongoose';
import connectDB from '../src/config/db.js';
import User from '../src/models/User.js';

const email = process.env.SEED_ADMIN_EMAIL?.trim().toLowerCase() || '';
const password = process.env.SEED_ADMIN_PASSWORD || '';
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Set SEED_ADMIN_EMAIL to a valid email address.');
}
if (Buffer.byteLength(password, 'utf8') < 8 || Buffer.byteLength(password, 'utf8') > 72) {
    throw new Error('Set SEED_ADMIN_PASSWORD to 8–72 UTF-8 bytes.');
}

await connectDB();

try {
    const admin = await User.findOne({ email });

    if (!admin) {
        throw new Error('Admin account not found. Run npm run seed first.');
    }

    admin.password = password;
    await admin.save();

    console.log('Admin password updated successfully.');
} catch (error) {
    console.error('Password update failed:', error.message);
    process.exitCode = 1;
} finally {
    await mongoose.disconnect();
}