import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import User from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const protect = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ success: false, message: 'Authentication required.' });

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] });
  }
  catch { return res.status(401).json({ success: false, message: 'Session expired or invalid token.' }); }

  if (!decoded || typeof decoded !== 'object' ||
      typeof decoded.sub !== 'string' || !mongoose.Types.ObjectId.isValid(decoded.sub)) {
    return res.status(401).json({ success: false, message: 'Session expired or invalid token.' });
  }

  const user = await User.findById(decoded.sub).select('-password');
  if (!user || user.isActive === false) return res.status(401).json({ success: false, message: 'Account unavailable.' });
  req.user = user;
  next();
});

export const allowRoles = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ success: false, message: 'You do not have permission to perform this action.' });
  next();
};
