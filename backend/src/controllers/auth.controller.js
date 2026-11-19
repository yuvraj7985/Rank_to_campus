import { validationResult } from 'express-validator';
import User from '../models/User.js';
import Student from '../models/Student.js';
import { signToken } from '../utils/token.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const register = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorsByField = errors.array().map(({ path, msg }) => ({ field: path, message: msg }));
    return res.status(400).json({
      success: false,
      message: errorsByField[0].message,
      errors: errorsByField
    });
  }

  const { name, email, password, phone } = req.body;
  if (await User.exists({ email })) {
    return res.status(409).json({ success: false, message: 'Email is already registered.' });
  }

  const user = await User.create({ name, email, password, phone, role: 'student' });
  try {
    await Student.create({
      user: user._id,
      fullName: user.name,
      phone: user.phone,
      applicationNumber: `R2C${Date.now().toString().slice(-9)}`
    });
  } catch (error) {
    await User.deleteOne({ _id: user._id });
    throw error;
  }

  res.status(201).json({
    success: true,
    message: 'Registration successful.',
    token: signToken(user._id),
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role
    }
  });
});

export const login = asyncHandler(async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorsByField = errors.array().map(({ path, msg }) => ({ field: path, message: msg }));
    return res.status(400).json({
      success: false,
      message: errorsByField[0].message,
      errors: errorsByField
    });
  }

  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password))) return res.status(401).json({ success: false, message: 'Invalid email or password.' });
  if (user.isActive === false) return res.status(403).json({ success: false, message: 'Account is disabled.' });
  res.json({
    success: true,
    message: 'Login successful.',
    token: signToken(user._id),
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role
    }
  });
});

export const me = asyncHandler(async (req, res) => {
  const student = req.user.role === 'student' ? await Student.findOne({ user: req.user._id }) : null;
  res.json({
    success: true,
    user: {
      id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      phone: req.user.phone
    },
    student
  });
});
