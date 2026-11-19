import mongoose from 'mongoose';
import AdmissionRound from '../models/AdmissionRound.js';
import Student from '../models/Student.js';
import Preference from '../models/Preference.js';
import Document from '../models/Document.js';
import Allocation from '../models/Allocation.js';
import Branch from '../models/Branch.js';
import { asyncHandler } from '../utils/asyncHandler.js';

export const isAllocationRoundReady = (round) => {
  if (!round) {
    return { valid: false, message: 'Admission round not found.' };
  }

  if (!['closed', 'allocation_completed'].includes(round.status)) {
    return {
      valid: false,
      message: 'Close this round before running allocation so students cannot change their preferences.'
    };
  }

  return { valid: true, message: 'Round is ready for allocation or a safe rerun.' };
};

export const getMissingRequiredDocuments = (documents) => {
  const required = ['marksheet_10', 'marksheet_12', 'rank_card'];
  const latestByType = new Map();
  for (const document of documents) {
    if (!required.includes(document.type)) continue;
    const current = latestByType.get(document.type);
    const currentTime = current?.createdAt ? new Date(current.createdAt).getTime() : -1;
    const documentTime = document.createdAt ? new Date(document.createdAt).getTime() : 0;
    const newerId = current && String(document._id || '') > String(current._id || '');
    if (!current || documentTime > currentTime || (documentTime === currentTime && newerId)) {
      latestByType.set(document.type, document);
    }
  }

  return required
    .filter((type) => latestByType.get(type)?.status !== 'approved')
    .map((type) => ({ type, status: latestByType.get(type)?.status || 'missing' }));
};

export const runAllocation = asyncHandler(async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.roundId)) {
    return res.status(400).json({ success: false, message: 'Invalid admission round ID.' });
  }

  const round = await AdmissionRound.findById(req.params.roundId);
  const readiness = isAllocationRoundReady(round);
  if (!readiness.valid) {
    return res.status(400).json({ success: false, message: readiness.message });
  }

  // Fetch students sorted by rank (best rank first = lowest number first)
  const students = await Student.find().sort({ rank: 1 });
  const studentById = new Map(students.map((student) => [String(student._id), student]));

  const results = [];
  const skipped = [];

  for (const student of students) {
    if (!Number.isInteger(student.rank) || student.rank < 1) {
      skipped.push({ studentId: student._id, reason: 'rank_not_set' });
      continue;
    }

    // Skip if already allocated for this round (idempotency)
    const alreadyAllocated = await Allocation.exists({
      student: student._id,
      admissionRound: round._id
    });
    if (alreadyAllocated) {
      skipped.push({ studentId: student._id, reason: 'already_allocated' });
      continue;
    }

    // Must have locked preferences for this round
    const pref = await Preference.findOne({
      student: student._id,
      admissionRound: round._id,
      isLocked: true
    }).populate('choices.branch');

    if (!pref) {
      skipped.push({ studentId: student._id, reason: 'no_locked_preferences' });
      continue;
    }

    // Must have required documents approved
    const docs = await Document.find({ student: student._id }).sort({ createdAt: -1 });
    const missingDocuments = getMissingRequiredDocuments(docs);
    if (missingDocuments.length > 0) {
      skipped.push({ studentId: student._id, reason: 'documents_not_approved', missingDocuments });
      continue;
    }

    // Try to allocate the first available seat from preferences (in order)
    const sortedChoices = [...pref.choices].sort((a, b) => a.order - b.order);
    let allocated = null;
    let allocationConflict = false;

    for (const choice of sortedChoices) {
      const branchId = choice.branch?._id || choice.branch;
      if (!branchId) continue;

      const branch = await Branch.findOneAndUpdate(
        {
          _id: branchId,
          isActive: true,
          $expr: { $lt: [{ $ifNull: ['$allocatedSeats', 0] }, '$totalSeats'] }
        },
        { $inc: { allocatedSeats: 1 } },
        { new: true }
      );

      if (!branch) continue;

      try {
        allocated = await Allocation.create({
          student: student._id,
          admissionRound: round._id,
          branch: branch._id,
          rankAtAllocation: student.rank,
          status: 'provisional'
        });
      } catch (error) {
        await Branch.findOneAndUpdate(
          { _id: branch._id, allocatedSeats: { $gt: 0 } },
          { $inc: { allocatedSeats: -1 } }
        );
        if (error.code === 11000) {
          skipped.push({ studentId: student._id, reason: 'already_allocated' });
          allocationConflict = true;
          break;
        }
        throw error;
      }

      break;
    }

    if (allocated) {
      results.push(allocated);
    } else if (!allocationConflict) {
      skipped.push({ studentId: student._id, reason: 'no_seats_available_in_preferences' });
    }
  }

  round.status = 'allocation_completed';
  await round.save();

  return res.json({
    success: true,
    message: 'Allocation run completed.',
    data: {
      allocated: results.length,
      skipped: skipped.length,
      skipReasons: skipped.reduce((acc, s) => {
        acc[s.reason] = (acc[s.reason] || 0) + 1;
        return acc;
      }, {}),
      skippedStudents: skipped.map((item) => {
        const student = studentById.get(String(item.studentId));
        return {
          ...item,
          studentName: student?.fullName || 'Student',
          applicationNumber: student?.applicationNumber || '',
          rank: student?.rank ?? null
        };
      }),
      results
    }
  });
});

export const myAllocation = asyncHandler(async (req, res) => {
  const student = await Student.findOne({ user: req.user._id });
  if (!student) {
    return res.status(404).json({ success: false, message: 'Student profile not found.' });
  }

  const data = await Allocation.find({ student: student._id })
    .populate({ path: 'branch', populate: { path: 'college' } })
    .populate('admissionRound');

  res.json({ success: true, data });
});

// Student accepts or declines a seat offer
export const respondToAllocation = asyncHandler(async (req, res) => {
  const { action } = req.body; // 'accept' or 'decline'
  if (!['accept', 'decline'].includes(action)) {
    return res.status(400).json({ success: false, message: "Action must be 'accept' or 'decline'." });
  }

  const student = await Student.findOne({ user: req.user._id });
  if (!student) {
    return res.status(404).json({ success: false, message: 'Student profile not found.' });
  }

  const allocation = await Allocation.findOneAndUpdate({
    _id: req.params.id,
    student: student._id,
    status: 'provisional'
  }, {
    $set: { status: action === 'accept' ? 'accepted' : 'declined' }
  }, { new: true });

  if (!allocation) {
    return res.status(404).json({
      success: false,
      message: 'Allocation not found or already responded to.'
    });
  }

  if (action === 'decline') {
    const releasedBranch = await Branch.findOneAndUpdate(
      { _id: allocation.branch, allocatedSeats: { $gt: 0 } },
      { $inc: { allocatedSeats: -1 } },
      { new: true }
    );
    if (!releasedBranch) {
      await Allocation.findOneAndUpdate(
        { _id: allocation._id, status: 'declined' },
        { $set: { status: 'provisional' } }
      );
      return res.status(409).json({
        success: false,
        message: 'The seat counter could not be updated. The offer remains provisional.'
      });
    }
  }

  res.json({
    success: true,
    message: `Allocation ${action === 'accept' ? 'accepted' : 'declined'} successfully.`,
    data: allocation
  });
});

export const listAllocations = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.round) filter.admissionRound = req.query.round;
  if (req.query.status) filter.status = req.query.status;

  const data = await Allocation.find(filter)
    .populate({ path: 'student', populate: { path: 'user', select: 'name email' } })
    .populate({ path: 'branch', populate: { path: 'college' } })
    .populate('admissionRound')
    .sort({ rankAtAllocation: 1 });

  res.json({ success: true, count: data.length, data });
});
