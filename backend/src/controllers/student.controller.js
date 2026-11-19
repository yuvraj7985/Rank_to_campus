import Student from '../models/Student.js';
import User from '../models/User.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { mergeStudentProfile } from '../utils/profile.js';
import { normalizeAdmissionCategory } from '../utils/admissionCategory.js';
import { normalizeIndianMobileNumber } from '../utils/identity.js';

const allowedFields = [
  'fullName',
  'phone',
  'dateOfBirth',
  'gender',
  'state',
  'city',
  'category',
  'subcategory',
  'examName',
  'rank',
  'score',
  'percentile',
  'academicInfo',
  'interestedBranches'
];

export const getProfile = asyncHandler(async (req, res) => {
  const student = await Student.findOne({ user: req.user._id }).populate('user', 'name email phone role isActive');
  if (!student) {
    return res.status(404).json({ success: false, message: 'Student profile not found.' });
  }

  const user = await User.findById(req.user._id).select('name email phone role isActive');
  res.json({
    success: true,
    data: {
      ...student.toObject(),
      user: user ? {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isActive: user.isActive
      } : null
    }
  });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const updates = Object.fromEntries(
    Object.entries(req.body).filter(([key]) => allowedFields.includes(key))
  );

  if (updates.category !== undefined) {
    const category = normalizeAdmissionCategory(updates.category);
    if (!category) {
      return res.status(400).json({
        success: false,
        message: 'Choose OPEN/GENERAL, EWS, OBC/OBC-NCL, SC, or ST.'
      });
    }
    updates.category = category;
  }

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ success: false, message: 'Provide at least one valid profile field.' });
  }

  if (updates.rank !== undefined && updates.rank !== null &&
      (!Number.isInteger(Number(updates.rank)) || Number(updates.rank) < 1)) {
    return res.status(400).json({ success: false, message: 'Rank must be a positive integer.' });
  }

  if (updates.score !== undefined && updates.score !== null &&
      (Number.isNaN(Number(updates.score)) || Number(updates.score) < 0)) {
    return res.status(400).json({ success: false, message: 'Score must be a non-negative number.' });
  }

  if (updates.percentile !== undefined && updates.percentile !== null &&
      (Number.isNaN(Number(updates.percentile)) || Number(updates.percentile) < 0 || Number(updates.percentile) > 100)) {
    return res.status(400).json({ success: false, message: 'Percentile must be between 0 and 100.' });
  }

  if (updates.phone !== undefined && updates.phone !== '') {
    const phone = normalizeIndianMobileNumber(updates.phone);
    if (!phone) {
      return res.status(400).json({
        success: false,
        message: 'Enter a valid Indian mobile number, with or without the +91 country code.'
      });
    }
    updates.phone = phone;
  }

  if (updates.interestedBranches !== undefined &&
      (!Array.isArray(updates.interestedBranches) || updates.interestedBranches.some((branch) => typeof branch !== 'string'))) {
    return res.status(400).json({ success: false, message: 'Interested branches must be a list of names.' });
  }

  if (updates.academicInfo !== undefined &&
      (!updates.academicInfo || typeof updates.academicInfo !== 'object' || Array.isArray(updates.academicInfo))) {
    return res.status(400).json({ success: false, message: 'Academic details must be an object.' });
  }

  const current = await Student.findOne({ user: req.user._id });
  if (!current) {
    return res.status(404).json({ success: false, message: 'Student profile not found.' });
  }

  const mergedStudent = mergeStudentProfile(current.toObject(), updates);
  const profileUpdates = {
    ...updates,
    ...(updates.academicInfo ? { academicInfo: mergedStudent.academicInfo } : {}),
    profileCompletion: mergedStudent.profileCompletion,
    profileCompleted: mergedStudent.profileCompleted
  };

  const student = await Student.findOneAndUpdate(
    { user: req.user._id },
    { $set: profileUpdates },
    { new: true, runValidators: true }
  );

  if (!student) {
    return res.status(404).json({ success: false, message: 'Student profile not found.' });
  }

  res.json({ success: true, data: student });
});
