import mongoose from 'mongoose';
import multer from 'multer';
import AdmissionRound from '../models/AdmissionRound.js';
import User from '../models/User.js';
import Student from '../models/Student.js';
import Document from '../models/Document.js';
import College from '../models/College.js';
import Branch from '../models/Branch.js';
import Allocation from '../models/Allocation.js';
import Cutoff from '../models/Cutoff.js';
import HistoricalCutoff from '../models/HistoricalCutoff.js';
import Preference from '../models/Preference.js';
import ChatMessage from '../models/ChatMessage.js';
import Application from '../models/Application.js';
import Notification from '../models/Notification.js';
import { parseCsv } from '../utils/csv.js';
import { getAdmissionCategoryValues, normalizeAdmissionCategory } from '../utils/admissionCategory.js';
import { compareCutoffViews, prepareCutoffImportRow, toCutoffView } from '../utils/cutoffRecord.js';

import { asyncHandler } from '../utils/asyncHandler.js';

export const cutoffCsvUpload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 1024 * 1024 }
}).single('file');

// Admin Dashboard
export const dashboard = asyncHandler(async (_req, res) => {
    const [
        students,
        pendingDocuments,
        approvedDocuments,
        colleges,
        branches,
        allocations,
        activeRounds,
        acceptedAllocations,
        profileSummary
    ] = await Promise.all([
        User.countDocuments({ role: 'student' }),
        Document.countDocuments({ status: 'pending' }),
        Document.countDocuments({ status: 'approved' }),
        College.countDocuments({ isActive: true }),
        Branch.countDocuments({ isActive: true }),
        Allocation.countDocuments({}),
        AdmissionRound.countDocuments({ status: { $in: ['open', 'allocation_completed'] } }),
        Allocation.countDocuments({ status: 'accepted' }),
        Student.aggregate([
            {
                $group: {
                    _id: null,
                    averageProfileCompletion: { $avg: { $ifNull: ['$profileCompletion', 0] } },
                    totalStudents: { $sum: 1 }
                }
            }
        ])
    ]);

    const averageProfileCompletion = Math.round(profileSummary[0]?.averageProfileCompletion ?? 0);

    res.json({
        success: true,
        data: {
            students,
            pendingDocuments,
            approvedDocuments,
            colleges,
            branches,
            allocations,
            activeRounds,
            acceptedAllocations,
            averageProfileCompletion,
            profileReadiness: Math.min(100, Math.max(0, averageProfileCompletion))
        }
    });
});

export const reports = asyncHandler(async (_req, res) => {
    const [
        studentsByCategory,
        documentStatus,
        roundStatus,
        lockedPreferenceBreakdown,
        preferenceActivity,
        topColleges,
        recentAllocations
    ] = await Promise.all([
        Student.aggregate([
            { $group: { _id: '$category', count: { $sum: 1 } } },
            { $sort: { count: -1, _id: 1 } }
        ]),
        Document.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } },
            { $sort: { count: -1, _id: 1 } }
        ]),
        AdmissionRound.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } },
            { $sort: { count: -1, _id: 1 } }
        ]),
        Preference.aggregate([
            { $match: { isLocked: true } },
            { $group: { _id: '$admissionRound', count: { $sum: 1 } } },
            { $lookup: { from: 'admissionrounds', localField: '_id', foreignField: '_id', as: 'round' } },
            { $unwind: '$round' },
            { $project: { _id: 0, roundName: '$round.name', count: 1 } },
            { $sort: { count: -1, roundName: 1 } }
        ]),
        Preference.aggregate([
            { $group: { _id: '$admissionRound', count: { $sum: 1 } } },
            { $lookup: { from: 'admissionrounds', localField: '_id', foreignField: '_id', as: 'round' } },
            { $unwind: '$round' },
            { $project: { _id: 0, roundName: '$round.name', totalPreferences: '$count' } },
            { $sort: { totalPreferences: -1, roundName: 1 } }
        ]),
        Branch.aggregate([
            { $lookup: { from: 'colleges', localField: 'college', foreignField: '_id', as: 'collegeInfo' } },
            { $unwind: '$collegeInfo' },
            { $group: { _id: '$collegeInfo.name', totalSeats: { $sum: '$totalSeats' }, branchCount: { $sum: 1 } } },
            { $sort: { totalSeats: -1 } },
            { $limit: 5 }
        ]),
        Allocation.aggregate([
            { $lookup: { from: 'admissionrounds', localField: 'admissionRound', foreignField: '_id', as: 'round' } },
            { $unwind: '$round' },
            { $lookup: { from: 'branches', localField: 'branch', foreignField: '_id', as: 'branchInfo' } },
            { $unwind: '$branchInfo' },
            { $lookup: { from: 'colleges', localField: 'branchInfo.college', foreignField: '_id', as: 'collegeInfo' } },
            { $unwind: '$collegeInfo' },
            { $project: { _id: 0, round: '$round.name', college: '$collegeInfo.name', branch: '$branchInfo.name', status: 1, createdAt: 1 } },
            { $sort: { createdAt: -1 } },
            { $limit: 8 }
        ])
    ]);

    res.json({
        success: true,
        data: {
            studentsByCategory,
            documentStatus,
            roundStatus,
            lockedPreferenceBreakdown,
            preferenceActivity,
            topColleges,
            recentAllocations
        }
    });
});

export const exportReports = asyncHandler(async (_req, res) => {
    const { studentsByCategory, documentStatus, roundStatus, lockedPreferenceBreakdown, preferenceActivity, topColleges, recentAllocations } = await (async () => {
        const [students, documents, rounds, locked, totalPreferences, colleges, allocations] = await Promise.all([
            Student.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }, { $sort: { count: -1, _id: 1 } }]),
            Document.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }, { $sort: { count: -1, _id: 1 } }]),
            AdmissionRound.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }, { $sort: { count: -1, _id: 1 } }]),
            Preference.aggregate([{ $match: { isLocked: true } }, { $group: { _id: '$admissionRound', count: { $sum: 1 } } }, { $lookup: { from: 'admissionrounds', localField: '_id', foreignField: '_id', as: 'round' } }, { $unwind: '$round' }, { $project: { _id: 0, roundName: '$round.name', count: 1 } }, { $sort: { count: -1, roundName: 1 } }]),
            Preference.aggregate([{ $group: { _id: '$admissionRound', count: { $sum: 1 } } }, { $lookup: { from: 'admissionrounds', localField: '_id', foreignField: '_id', as: 'round' } }, { $unwind: '$round' }, { $project: { _id: 0, roundName: '$round.name', totalPreferences: '$count' } }, { $sort: { totalPreferences: -1, roundName: 1 } }]),
            Branch.aggregate([{ $lookup: { from: 'colleges', localField: 'college', foreignField: '_id', as: 'collegeInfo' } }, { $unwind: '$collegeInfo' }, { $group: { _id: '$collegeInfo.name', totalSeats: { $sum: '$totalSeats' }, branchCount: { $sum: 1 } } }, { $sort: { totalSeats: -1 } }, { $limit: 5 }]),
            Allocation.aggregate([{ $lookup: { from: 'admissionrounds', localField: 'admissionRound', foreignField: '_id', as: 'round' } }, { $unwind: '$round' }, { $lookup: { from: 'branches', localField: 'branch', foreignField: '_id', as: 'branchInfo' } }, { $unwind: '$branchInfo' }, { $lookup: { from: 'colleges', localField: 'branchInfo.college', foreignField: '_id', as: 'collegeInfo' } }, { $unwind: '$collegeInfo' }, { $project: { _id: 0, round: '$round.name', college: '$collegeInfo.name', branch: '$branchInfo.name', status: 1, createdAt: 1 } }, { $sort: { createdAt: -1 } }, { $limit: 8 }])
        ]);

        return { studentsByCategory: students, documentStatus: documents, roundStatus: rounds, lockedPreferenceBreakdown: locked, preferenceActivity: totalPreferences, topColleges: colleges, recentAllocations: allocations };
    })();

    const rows = [
        ['Section', 'Metric', 'Value'],
        ['Category Mix', 'Total categories', String(studentsByCategory.length)],
        ...studentsByCategory.map((entry) => ['Category Mix', entry._id || 'Unspecified', String(entry.count)]),
        ['Document Status', 'Total statuses', String(documentStatus.length)],
        ...documentStatus.map((entry) => ['Document Status', entry._id || 'Unknown', String(entry.count)]),
        ['Round Status', 'Total statuses', String(roundStatus.length)],
        ...roundStatus.map((entry) => ['Round Status', entry._id || 'Unknown', String(entry.count)]),
        ['Locked Preferences', 'Total locked groups', String(lockedPreferenceBreakdown.length)],
        ...lockedPreferenceBreakdown.map((entry) => ['Locked Preferences', entry.roundName || 'Unknown round', String(entry.count)]),
        ['Recent Allocations', 'Total offer records', String(recentAllocations.length)],
        ...recentAllocations.map((entry) => ['Recent Allocations', `${entry.round} | ${entry.college} | ${entry.branch}`, entry.status || 'pending'])
    ];

    const csv = rows
        .map((line) => line.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="rank2campus-report.csv"');
    res.send(csv);
});

const clearStudentCycleData = async () => {
    const preservedCatalog = {
        colleges: await College.countDocuments({ isActive: true }),
        branches: await Branch.countDocuments({ isActive: true }),
        cutoffs: await Cutoff.countDocuments({}) + await HistoricalCutoff.countDocuments({})
    };

    const studentUsers = await User.find({ role: 'student' }, '_id');
    const studentUserIds = studentUsers.map((user) => user._id);

    await Promise.all([
        Student.deleteMany({}),
        Document.deleteMany({}),
        Preference.deleteMany({}),
        Allocation.deleteMany({}),
        Application.deleteMany({}),
        ChatMessage.deleteMany({ user: { $in: studentUserIds } }),
        Notification.deleteMany({})
    ]);

    const deletedRounds = await AdmissionRound.deleteMany({});
    await Branch.updateMany({}, { $set: { allocatedSeats: 0 } });

    if (studentUserIds.length > 0) {
        await User.deleteMany({ _id: { $in: studentUserIds } });
    }

    return {
        clearedStudentAccounts: studentUserIds.length,
        clearedRounds: deletedRounds.deletedCount || 0,
        preservedCatalog
    };
};

export const resetAdmissionCycle = asyncHandler(async (_req, res) => {
    const { clearedStudentAccounts, clearedRounds, preservedCatalog } = await clearStudentCycleData();

    res.json({
        success: true,
        message: 'Admission cycle reset successfully. Colleges, branches, and historical cutoff data were preserved.',
        data: {
            clearedStudentAccounts,
            clearedRounds,
            preservedCatalog,
            note: 'All current student data, documents, preferences, allocations, and notifications were removed to start the next cycle cleanly. The institution catalog remains protected.'
        }
    });
});

export const seedFreshCycle = asyncHandler(async (req, res) => {
    const requestedYear = req.body?.year === undefined || req.body?.year === null || req.body?.year === ''
        ? new Date().getFullYear() + 1
        : Number(req.body.year);
    if (!Number.isSafeInteger(requestedYear) || requestedYear < 1900 || requestedYear > 9999) {
        return res.status(400).json({
            success: false,
            message: 'Provide a valid admission year between 1900 and 9999.'
        });
    }

    const { clearedStudentAccounts, clearedRounds, preservedCatalog } = await clearStudentCycleData();

    const admin = await User.findOne({ role: 'admin' });
    const roundName = `Demo Counselling Round ${requestedYear}`;

    await AdmissionRound.create({
        name: roundName,
        year: requestedYear,
        status: 'open',
        createdBy: admin?._id || null
    });

    await Notification.insertMany([
        {
            title: 'Fresh cycle started',
            message: `The ${requestedYear} admission cycle is now open. Students can register, complete profiles, upload documents, and submit preferences.`,
            audience: 'student',
            createdBy: admin?._id || null
        },
        {
            title: 'New round ready',
            message: `A new counselling round, ${roundName}, has been created and is open for the upcoming cycle.`,
            audience: 'all',
            createdBy: admin?._id || null
        }
    ]);

    res.json({
        success: true,
        message: `Fresh admission cycle seeded for ${requestedYear}.`,
        data: {
            year: requestedYear,
            roundName,
            clearedStudentAccounts,
            clearedRounds,
            preservedCatalog,
            nextStep: 'Students can now create new accounts, complete profiles, upload documents, and submit preferences. The college catalog will remain protected and reusable.'
        }
    });
});

// List All Students
export const listStudents = asyncHandler(async (req, res) => {
    const students = await Student.find()
        .populate('user', 'name email phone isActive')
        .sort({ createdAt: -1 })
        .limit(200);

    res.json({
        success: true,
        data: students
    });
});

export const getStudentDetails = asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({ success: false, message: 'Invalid student ID.' });
    }

    const student = await Student.findById(req.params.id)
        .populate('user', 'name email phone role isActive');

    if (!student) {
        return res.status(404).json({ success: false, message: 'Student not found.' });
    }

    const [documents, preferences, allocations] = await Promise.all([
        Document.find({ student: student._id }).sort({ createdAt: -1 }),
        Preference.find({ student: student._id })
            .populate('admissionRound', 'name year status')
            .populate({
                path: 'choices.branch',
                populate: { path: 'college', select: 'name code' }
            }),
        Allocation.find({ student: student._id })
            .populate('admissionRound', 'name year status')
            .populate({
                path: 'branch',
                populate: { path: 'college', select: 'name code' }
            })
            .sort({ createdAt: -1 })
    ]);

    res.json({
        success: true,
        data: { student, documents, preferences, allocations }
    });
});


// Add Cutoff
export const createCutoff = asyncHandler(async (req, res) => {
    const {
        branch,
        examName = 'JEE Main',
        year,
        round = 1,
        openingRank,
        closingRank
    } = req.body;
    const category = normalizeAdmissionCategory(req.body.category);

    if (!branch || !year || !category || !closingRank) {
        return res.status(400).json({
            success: false,
            message: 'Branch, year, a supported category (OPEN, EWS, OBC/OBC-NCL, SC, or ST), and closing rank are required.'
        });
    }

    if (!mongoose.Types.ObjectId.isValid(branch)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid branch ID.'
        });
    }

    const branchExists = await Branch.exists({
        _id: branch,
        isActive: true
    });

    if (!branchExists) {
        return res.status(404).json({
            success: false,
            message: 'Active branch not found.'
        });
    }

    const cutoff = await Cutoff.create({
        branch,
        examName,
        year,
        round,
        category,
        openingRank,
        closingRank
    });

    res.status(201).json({
        success: true,
        message: 'Cutoff created successfully.',
        data: cutoff
    });
});

export const importCutoffs = asyncHandler(async (req, res) => {
    if (!req.file || !req.file.originalname.toLowerCase().endsWith('.csv')) {
        return res.status(400).json({ success: false, message: 'Select a .csv file to import.' });
    }

    let rows;
    try {
        rows = parseCsv(req.file.buffer.toString('utf8').replace(/^\uFEFF/, ''));
    } catch (error) {
        return res.status(400).json({ success: false, message: error.message });
    }

    if (!rows.length || rows.length > 1000) {
        return res.status(400).json({ success: false, message: 'CSV must contain between 1 and 1,000 data rows.' });
    }

    const required = ['collegecode', 'branchcode', 'year', 'category', 'closingrank'];
    const allowed = new Set([...required, 'examname', 'round', 'openingrank', 'collegename', 'branchname', 'location']);
    const headers = Object.keys(rows[0]);
    const headerErrors = [
        ...required.filter((header) => !headers.includes(header)).map((header) => `Missing column: ${header}`),
        ...headers.filter((header) => !allowed.has(header)).map((header) => `Unknown column: ${header}`)
    ];
    if (headerErrors.length) {
        return res.status(400).json({ success: false, message: 'CSV columns do not match the supported format.', errors: headerErrors });
    }

    const errors = [];
    const preparedRows = rows.map((row, index) => {
        const line = index + 2;
        const cutoff = {
            collegeCode: row.collegecode.trim().toUpperCase(),
            branchCode: row.branchcode.trim().toUpperCase(),
            collegeName: row.collegename?.trim() || '',
            branchName: row.branchname?.trim() || '',
            location: row.location?.trim() || '',
            year: Number(row.year),
            round: row.round ? Number(row.round) : 1,
            category: normalizeAdmissionCategory(row.category),
            examName: row.examname?.trim() || 'JEE Main',
            openingRank: row.openingrank ? Number(row.openingrank) : undefined,
            closingRank: Number(row.closingrank)
        };
        if (!cutoff.collegeCode || !cutoff.branchCode) errors.push(`Row ${line}: collegeCode and branchCode are required.`);
        if (!Number.isInteger(cutoff.year) || cutoff.year < 1990 || cutoff.year > new Date().getFullYear() + 2) errors.push(`Row ${line}: year is invalid.`);
        if (!Number.isInteger(cutoff.round) || cutoff.round < 1) errors.push(`Row ${line}: round must be a positive integer.`);
        if (!cutoff.category) errors.push(`Row ${line}: category "${row.category}" is not supported. Use OPEN/GENERAL/GEN/UR, EWS, OBC/OBC-NCL, SC, or ST.`);
        if (!Number.isInteger(cutoff.closingRank) || cutoff.closingRank < 1) errors.push(`Row ${line}: closingRank must be a positive integer.`);
        if (cutoff.openingRank !== undefined && (!Number.isInteger(cutoff.openingRank) || cutoff.openingRank < 1 || cutoff.openingRank > cutoff.closingRank)) {
            errors.push(`Row ${line}: openingRank must be positive and no greater than closingRank.`);
        }
        return { line, cutoff };
    });
    if (errors.length) {
        return res.status(400).json({ success: false, message: 'Correct the invalid CSV rows and try again.', errors });
    }

    const collegeCodes = [...new Set(preparedRows.map(({ cutoff }) => cutoff.collegeCode))];
    const branchCodes = [...new Set(preparedRows.map(({ cutoff }) => cutoff.branchCode))];
    const codePattern = (code) => new RegExp(
        `^${code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
        'i'
    );
    const colleges = await College.find({ code: { $in: collegeCodes.map(codePattern) } })
        .select('_id code isActive')
        .lean();
    const collegesByCode = new Map(colleges.map((college) => [college.code.toUpperCase(), college]));
    const branches = await Branch.find({
        college: { $in: colleges.map((college) => college._id) },
        code: { $in: branchCodes.map(codePattern) }
    }).populate({ path: 'college', select: 'code isActive' })
        .select('code college isActive')
        .lean();
    const branchesByCode = new Map(branches.map((branch) => [
        `${branch.college?.code?.toUpperCase()}:${branch.code.toUpperCase()}`,
        branch
    ]));

    const seen = new Set();
    const cutoffRows = preparedRows.map(({ line, cutoff }) => {
        const college = collegesByCode.get(cutoff.collegeCode);
        const matchingBranch = branchesByCode.get(`${cutoff.collegeCode}:${cutoff.branchCode}`);
        const importRow = prepareCutoffImportRow(cutoff, { college, branch: matchingBranch });
        if (seen.has(importRow.uniqueKey)) errors.push(`Row ${line}: duplicate cutoff in this CSV.`);
        seen.add(importRow.uniqueKey);
        return {
            line,
            ...importRow
        };
    });

    const replaceExisting = req.body.replaceExisting === 'true';
    const keys = cutoffRows.filter(({ cutoff }) => cutoff.branch).map(({ cutoff }) => ({
        branch: cutoff.branch,
        year: cutoff.year,
        round: cutoff.round,
        category: { $in: getAdmissionCategoryValues(cutoff.category) }
    }));
    const existing = keys.length
        ? await Cutoff.find({ $or: keys }).select('_id branch year round category').lean()
        : [];
    const existingByKey = new Map(existing.map((cutoff) => {
        const category = normalizeAdmissionCategory(cutoff.category) || cutoff.category;
        return [
            `branch:${cutoff.branch}:${cutoff.year}:${cutoff.round}:${category}`,
            { id: cutoff._id, source: 'catalog' }
        ];
    }));
    const snapshotKeys = cutoffRows.map(({ snapshot }) => ({
        collegeCode: snapshot.collegeCode,
        branchCode: snapshot.branchCode,
        examName: snapshot.examName,
        year: snapshot.year,
        round: snapshot.round,
        category: { $in: getAdmissionCategoryValues(snapshot.category) }
    }));
    const existingSnapshots = await HistoricalCutoff.find({ $or: snapshotKeys })
        .select('_id collegeCode branchCode examName year round category')
        .lean();
    for (const cutoff of existingSnapshots) {
        const category = normalizeAdmissionCategory(cutoff.category) || cutoff.category;
        const historyKey = `history:${cutoff.collegeCode}:${cutoff.branchCode}:${cutoff.examName}:${cutoff.year}:${cutoff.round}:${category}`;
        const existingRecord = { id: cutoff._id, source: 'history' };
        existingByKey.set(historyKey, existingRecord);
        for (const row of cutoffRows) {
            if (row.snapshotKey === historyKey && !existingByKey.has(row.uniqueKey)) {
                existingByKey.set(row.uniqueKey, existingRecord);
            }
        }
    }
    for (const { line, uniqueKey } of cutoffRows) {
        if (!replaceExisting && existingByKey.has(uniqueKey)) {
            errors.push(`Row ${line}: cutoff already exists for these codes, year, round, exam, and category.`);
        }
    }
    if (errors.length) {
        return res.status(400).json({ success: false, message: 'No cutoff rows were imported.', errors });
    }

    const imported = [];
    let updated = 0;
    let snapshotsImported = 0;
    let snapshotsUpdated = 0;
    const conflicts = [];
    for (const { line, uniqueKey, cutoff, snapshot } of cutoffRows) {
        try {
            const existingRecord = existingByKey.get(uniqueKey);
            if (replaceExisting && existingRecord?.source === 'catalog') {
                await Cutoff.findByIdAndUpdate(existingRecord.id, { $set: cutoff }, { new: true, runValidators: true });
                updated += 1;
            } else if (replaceExisting && existingRecord?.source === 'history') {
                await HistoricalCutoff.findByIdAndUpdate(existingRecord.id, { $set: snapshot }, { new: true, runValidators: true });
                updated += 1;
                snapshotsUpdated += 1;
            } else if (cutoff.branch) {
                imported.push(await Cutoff.create(cutoff));
            } else {
                imported.push(await HistoricalCutoff.create(snapshot));
                snapshotsImported += 1;
            }
        } catch (error) {
            if (error.code !== 11000) throw error;
            conflicts.push(`Row ${line}: cutoff already exists for these college/branch codes, year, round, exam, and category.`);
        }
    }

    const snapshotSummary = snapshotsImported + snapshotsUpdated
        ? ` ${snapshotsImported + snapshotsUpdated} row(s) were saved independently of the catalog.`
        : '';
    res.status(conflicts.length ? 207 : 201).json({
        success: conflicts.length === 0,
        message: conflicts.length
            ? `${imported.length} cutoff rows imported and ${updated} updated; some rows conflicted with existing data.${snapshotSummary}`
            : `${imported.length} cutoff rows imported and ${updated} existing rows updated successfully.${snapshotSummary}`,
        data: {
            imported: imported.length,
            updated,
            snapshots: { imported: snapshotsImported, updated: snapshotsUpdated },
            errors: conflicts
        }
    });
});


// Get All Cutoffs
export const listCutoffs = asyncHandler(async (req, res) => {
    const filter = {};
    const historicalFilter = {};

    if (req.query.year) {
        const year = Number(req.query.year);
        if (!Number.isInteger(year) || year < 1990 || year > new Date().getFullYear() + 2) {
            return res.status(400).json({ success: false, message: 'Year filter is invalid.' });
        }
        filter.year = year;
        historicalFilter.year = year;
    }

    if (req.query.category) {
        const categoryValues = getAdmissionCategoryValues(String(req.query.category));
        if (!categoryValues.length) {
            return res.status(400).json({ success: false, message: 'Category filter is invalid.' });
        }
        filter.category = { $in: categoryValues };
        historicalFilter.category = { $in: categoryValues };
    }

    if (req.query.examName) {
        filter.examName = String(req.query.examName).trim();
        historicalFilter.examName = String(req.query.examName).trim();
    }

    if (req.query.branch) {
        if (!mongoose.Types.ObjectId.isValid(req.query.branch)) {
            return res.status(400).json({ success: false, message: 'Branch filter is invalid.' });
        }
        filter.branch = req.query.branch;
    }

    const branchFilter = {};
    if (req.query.collegeCode) {
        const collegeCode = String(req.query.collegeCode).trim();
        const colleges = await College.find({
            code: new RegExp(`^${collegeCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
        }).select('_id').lean();
        branchFilter.college = { $in: colleges.map((college) => college._id) };
        historicalFilter.collegeCode = new RegExp(`^${collegeCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    }
    if (req.query.branchCode) {
        const branchCode = String(req.query.branchCode).trim();
        branchFilter.code = new RegExp(`^${branchCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
        historicalFilter.branchCode = new RegExp(`^${branchCode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    }
    if (Object.keys(branchFilter).length) {
        const branchIds = await Branch.find(branchFilter).distinct('_id');
        if (filter.branch) {
            filter.branch = { $in: branchIds.filter((id) => id.toString() === req.query.branch) };
        } else {
            filter.branch = { $in: branchIds };
        }
    }

    const requestedPage = Number(req.query.page || 1);
    const requestedLimit = Number(req.query.limit || 50);
    if (!Number.isInteger(requestedPage) || requestedPage < 1 ||
        !Number.isInteger(requestedLimit) || requestedLimit < 1 || requestedLimit > 100) {
        return res.status(400).json({ success: false, message: 'Page or page size is invalid.' });
    }
    const fetchLimit = requestedPage * requestedLimit;
    const includeHistorical = !req.query.branch;
    const [linkedCount, historicalCount, cutoffs, historicalCutoffs] = await Promise.all([
        Cutoff.countDocuments(filter),
        includeHistorical ? HistoricalCutoff.countDocuments(historicalFilter) : 0,
        Cutoff.find(filter)
            .populate({
                path: 'branch',
                select: 'name code college',
                populate: {
                    path: 'college',
                    select: 'name code location'
                }
            })
            .sort({ year: -1, round: 1, closingRank: 1 })
            .limit(fetchLimit)
            .lean(),
        includeHistorical
            ? HistoricalCutoff.find(historicalFilter)
                .sort({ year: -1, round: 1, closingRank: 1 })
                .limit(fetchLimit)
                .lean()
            : []
    ]);

    const formatAdminCutoff = (record) => {
        const view = toCutoffView(record);
        return {
            ...record,
            ...view,
            branch: {
                _id: view.branchId,
                name: view.branch,
                code: view.branchCode,
                college: {
                    name: view.college,
                    code: view.collegeCode,
                    location: view.location
                }
            },
            collegeName: view.college,
            branchName: view.branch
        };
    };
    const data = [...cutoffs, ...historicalCutoffs]
        .map(formatAdminCutoff)
        .sort(compareCutoffViews)
        .slice((requestedPage - 1) * requestedLimit, requestedPage * requestedLimit);
    const count = linkedCount + historicalCount;

    res.json({
        success: true,
        count,
        page: requestedPage,
        pages: Math.ceil(count / requestedLimit),
        data
    });
});


// Update Cutoff
export const updateCutoff = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid cutoff ID.'
        });
    }

    const allowedFields = [
        'branch',
        'examName',
        'year',
        'round',
        'category',
        'openingRank',
        'closingRank'
    ];

    const updates = {};

    for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
            updates[field] = req.body[field];
        }
    }

    if (Object.keys(updates).length === 0) {
        return res.status(400).json({
            success: false,
            message: 'No valid fields provided for update.'
        });
    }

    if (updates.category !== undefined) {
        updates.category = normalizeAdmissionCategory(updates.category);
        if (!updates.category) {
            return res.status(400).json({
                success: false,
                message: 'Use OPEN/GENERAL/GEN/UR, EWS, OBC/OBC-NCL, SC, or ST for category.'
            });
        }
    }

    if (updates.branch) {
        if (!mongoose.Types.ObjectId.isValid(updates.branch)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid branch ID.'
            });
        }

        const branchExists = await Branch.exists({
            _id: updates.branch,
            isActive: true
        });

        if (!branchExists) {
            return res.status(404).json({
                success: false,
                message: 'Active branch not found.'
            });
        }
    }

    let cutoff = await Cutoff.findByIdAndUpdate(
        id,
        updates,
        {
            new: true,
            runValidators: true
        }
    );

    if (!cutoff && updates.branch) {
        return res.status(400).json({
            success: false,
            message: 'Historical snapshot records are not linked to catalog branches.'
        });
    }
    if (!cutoff) {
        cutoff = await HistoricalCutoff.findByIdAndUpdate(
            id,
            updates,
            {
                new: true,
                runValidators: true
            }
        );
    }

    if (!cutoff) {
        return res.status(404).json({
            success: false,
            message: 'Cutoff record not found.'
        });
    }

    res.json({
        success: true,
        message: 'Cutoff updated successfully.',
        data: cutoff
    });
});


// Delete Cutoff
export const deleteCutoff = asyncHandler(async (req, res) => {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid cutoff ID.'
        });
    }

    const cutoff = await Cutoff.findByIdAndDelete(id) ||
        await HistoricalCutoff.findByIdAndDelete(id);

    if (!cutoff) {
        return res.status(404).json({
            success: false,
            message: 'Cutoff record not found.'
        });
    }

    res.json({
        success: true,
        message: 'Cutoff deleted successfully.'
    });
});


// Create Admission Round
export const createAdmissionRound = asyncHandler(async (req, res) => {
    const { name, year, startsAt, endsAt, status = 'upcoming' } = req.body;

    if (!name || !year) {
        return res.status(400).json({
            success: false,
            message: 'Round name and year are required.'
        });
    }

    if (!['upcoming', 'open', 'closed', 'allocation_completed'].includes(status)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid round status.'
        });
    }

    if (startsAt && endsAt && new Date(startsAt) >= new Date(endsAt)) {
        return res.status(400).json({
            success: false,
            message: 'End date must be after start date.'
        });
    }

    const round = await AdmissionRound.create({
        name,
        year,
        status,
        startsAt,
        endsAt,
        createdBy: req.user._id
    });

    res.status(201).json({
        success: true,
        message: 'Admission round created successfully.',
        data: round
    });
});


// Get All Admission Rounds
export const listAdmissionRounds = asyncHandler(async (req, res) => {
    const [rounds, preferenceCounts, allocationCounts] = await Promise.all([
        AdmissionRound.find()
            .populate('createdBy', 'name email')
            .sort({ year: -1, createdAt: -1 }),
        Preference.aggregate([
            {
                $group: {
                    _id: '$admissionRound',
                    preferences: { $sum: 1 },
                    lockedPreferences: { $sum: { $cond: ['$isLocked', 1, 0] } }
                }
            }
        ]),
        Allocation.aggregate([
            { $group: { _id: '$admissionRound', offers: { $sum: 1 } } }
        ])
    ]);
    const preferenceCountsByRound = new Map(
        preferenceCounts.map((item) => [String(item._id), item])
    );
    const allocationCountsByRound = new Map(
        allocationCounts.map((item) => [String(item._id), item.offers])
    );
    const data = rounds.map((round) => {
        const preferences = preferenceCountsByRound.get(String(round._id));
        return {
            ...round.toObject(),
            preferenceCount: preferences?.preferences || 0,
            lockedPreferenceCount: preferences?.lockedPreferences || 0,
            allocationCount: allocationCountsByRound.get(String(round._id)) || 0
        };
    });

    res.json({
        success: true,
        count: data.length,
        data
    });
});


// Update Admission Round
export const updateAdmissionRound = asyncHandler(async (req, res) => {
    const allowedFields = [
        'name',
        'year',
        'status',
        'startsAt',
        'endsAt'
    ];

    const updates = {};

    for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
            updates[field] = req.body[field];
        }
    }

    if (Object.keys(updates).length === 0) {
        return res.status(400).json({
            success: false,
            message: 'No valid fields provided.'
        });
    }

    const currentRound = await AdmissionRound.findById(req.params.id);

    if (!currentRound) {
        return res.status(404).json({
            success: false,
            message: 'Admission round not found.'
        });
    }

    if (updates.status === 'open' && currentRound.status !== 'open') {
        const allocationCount = await Allocation.countDocuments({ admissionRound: currentRound._id });
        if (allocationCount > 0) {
            return res.status(409).json({
                success: false,
                message: 'This round already has allocation records and cannot be reopened. Create a new round to collect additional preferences.'
            });
        }
    }

    const start = updates.startsAt ?? currentRound.startsAt;
    const end = updates.endsAt ?? currentRound.endsAt;

    if (start && end && new Date(start) >= new Date(end)) {
        return res.status(400).json({
            success: false,
            message: 'End date must be after start date.'
        });
    }

    Object.assign(currentRound, updates);
    await currentRound.save();

    res.json({
        success: true,
        message: 'Admission round updated successfully.',
        data: currentRound
    });
});


// Delete Admission Round
export const deleteAdmissionRound = asyncHandler(async (req, res) => {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid admission round ID.'
        });
    }

    const round = await AdmissionRound.findById(req.params.id);

    if (!round) {
        return res.status(404).json({
            success: false,
            message: 'Admission round not found.'
        });
    }

    const allocationCount = await Allocation.countDocuments({ admissionRound: round._id });
    if (allocationCount > 0) {
        return res.status(409).json({
            success: false,
            message: `Cannot delete this round because it has ${allocationCount} allocation record(s). Allocation history is retained for audit purposes.`
        });
    }

    const [{ deletedCount: deletedPreferences }, { deletedCount: deletedApplications }] = await Promise.all([
        Preference.deleteMany({ admissionRound: round._id }),
        Application.deleteMany({ admissionRound: round._id })
    ]);
    await round.deleteOne();

    res.json({
        success: true,
        message: `Admission round deleted successfully. ${deletedPreferences || 0} saved preference set(s) and ${deletedApplications || 0} application record(s) were also removed.`
    });
});