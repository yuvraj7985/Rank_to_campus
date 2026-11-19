import College from '../models/College.js';
import Branch from '../models/Branch.js';
import Cutoff from '../models/Cutoff.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { normalizeAdmissionCategory } from '../utils/admissionCategory.js';

const protectedCatalogSpecs = [
  {
    name: 'North Valley Institute of Technology',
    code: 'NVIT',
    location: 'Delhi NCR',
    type: 'Private',
    branches: [
      ['Computer Science and Engineering', 'CSE', 120, 160000, 5000],
      ['Information Technology', 'IT', 90, 150000, 7500],
      ['Electronics and Communication', 'ECE', 90, 145000, 11000]
    ]
  },
  {
    name: 'National Institute of Applied Sciences',
    code: 'NIAS',
    location: 'Uttar Pradesh',
    type: 'Government',
    branches: [
      ['Computer Science and Engineering', 'CSE', 80, 95000, 2500],
      ['Mechanical Engineering', 'ME', 100, 85000, 16000]
    ]
  },
  {
    name: 'Riverdale University',
    code: 'RU',
    location: 'Haryana',
    type: 'Deemed',
    branches: [
      ['Computer Science and Engineering', 'CSE', 150, 220000, 9000],
      ['Artificial Intelligence and Data Science', 'AIDS', 120, 210000, 10500]
    ]
  },
  {
    name: 'KIET Group of Institutions',
    code: 'KIET',
    location: 'Ghaziabad, Uttar Pradesh',
    type: 'Private',
    branches: [['Computer Science and Engineering', 'CSE', 180, 175000, 2800]]
  }
];

export const ensureProtectedCatalog = async () => {
  const hasCollege = await College.exists({});
  if (hasCollege) return { restored: false, count: await College.countDocuments({}) };

  let createdCount = 0;
  const currentYear = new Date().getFullYear();

  for (const spec of protectedCatalogSpecs) {
    const college = await College.create({
      name: spec.name,
      code: spec.code,
      location: spec.location,
      type: spec.type,
      isActive: true
    });

    createdCount += 1;

    for (const [branchName, branchCode, totalSeats, fees, cutoffBase] of spec.branches) {
      const branch = await Branch.create({
        college: college._id,
        name: branchName,
        code: branchCode,
        totalSeats,
        fees,
        isActive: true
      });

      for (const category of ['OPEN', 'EWS', 'OBC-NCL', 'SC', 'ST']) {
        const factor = { OPEN: 1, EWS: 1.15, 'OBC-NCL': 1.25, SC: 2.8, ST: 3.5 }[category];
        await Cutoff.create({
          branch: branch._id,
          year: currentYear - 1,
          round: 1,
          category,
          examName: 'JEE Main',
          openingRank: 1,
          closingRank: Math.round(cutoffBase * factor)
        });
      }
    }
  }

  return { restored: true, count: createdCount };
};

export const listColleges = asyncHandler(async (req, res) => {
  await ensureProtectedCatalog();

  const includeInactive = req.query.includeInactive === 'true';
  const filter = includeInactive ? {} : { isActive: true };

  if (req.query.search) {
    filter.name = { $regex: req.query.search, $options: 'i' };
  }

  const colleges = await College.find(filter).sort('name').lean();
  const ids = colleges.map((c) => c._id);
  const branches = await Branch.find({
    college: { $in: ids },
    ...(includeInactive ? {} : { isActive: true })
  }).lean();
  const branchIds = branches.map((branch) => branch._id);
  const cutoffs = branchIds.length
    ? await Cutoff.find({ branch: { $in: branchIds } })
      .sort({ year: -1, round: -1 })
      .select('branch examName year round category openingRank closingRank')
      .lean()
    : [];
  const cutoffsByBranch = new Map();
  for (const cutoff of cutoffs) {
    const key = String(cutoff.branch);
    const records = cutoffsByBranch.get(key) || [];
    records.push({
      ...cutoff,
      category: normalizeAdmissionCategory(cutoff.category) || cutoff.category
    });
    cutoffsByBranch.set(key, records);
  }

  res.json({
    success: true,
    data: colleges.map((college) => ({
      ...college,
      branches: branches
        .filter((branch) => String(branch.college) === String(college._id))
        .map((branch) => ({
          ...branch,
          cutoffs: cutoffsByBranch.get(String(branch._id)) || []
        }))
    }))
  });
});

export const createCollege = asyncHandler(async (req, res) => {
  const college = await College.create({ ...req.body, isActive: req.body.isActive !== false });
  res.status(201).json({ success: true, data: college });
});

export const createBranch = asyncHandler(async (req, res) => {
  if (!await College.exists({ _id: req.body.college })) {
    return res.status(404).json({ success: false, message: 'College not found.' });
  }

  const branch = await Branch.create({
    ...req.body,
    isActive: req.body.isActive !== false,
    totalSeats: Number(req.body.totalSeats || 0),
    fees: Number(req.body.fees || 0)
  });

  res.status(201).json({ success: true, data: branch });
});

export const updateCollegeStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body;

  const college = await College.findByIdAndUpdate(
    id,
    { isActive: Boolean(isActive) },
    { new: true }
  );

  if (!college) {
    return res.status(404).json({ success: false, message: 'College not found.' });
  }

  res.json({ success: true, message: 'College visibility updated.', data: college });
});

export const updateBranchStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body;

  const branch = await Branch.findByIdAndUpdate(
    id,
    { isActive: Boolean(isActive) },
    { new: true }
  );

  if (!branch) {
    return res.status(404).json({ success: false, message: 'Branch not found.' });
  }

  res.json({ success: true, message: 'Branch visibility updated.', data: branch });
});

export const deleteCollege = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const branchIds = await Branch.find({ college: id }, '_id').lean();

  await Promise.all([
    College.findByIdAndDelete(id),
    Branch.deleteMany({ college: id }),
    Cutoff.deleteMany({ branch: { $in: branchIds.map((branch) => branch._id) } })
  ]);

  res.json({ success: true, message: 'College and related branches removed.' });
});

export const deleteBranch = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const deleted = await Branch.findByIdAndDelete(id);

  if (!deleted) {
    return res.status(404).json({ success: false, message: 'Branch not found.' });
  }

  await Cutoff.deleteMany({ branch: deleted._id });
  res.json({ success: true, message: 'Branch and cutoff data removed.' });
});

export const clearCollegeCatalog = asyncHandler(async (_req, res) => {
  const [colleges, branches, cutoffs] = await Promise.all([
    College.deleteMany({}),
    Branch.deleteMany({}),
    Cutoff.deleteMany({})
  ]);

  const restored = await ensureProtectedCatalog();

  res.json({
    success: true,
    message: 'College catalog was cleared and restored to the protected defaults.',
    data: {
      colleges: colleges.deletedCount,
      branches: branches.deletedCount,
      cutoffs: cutoffs.deletedCount,
      restored
    }
  });
});
