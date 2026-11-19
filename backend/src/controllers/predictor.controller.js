import Cutoff from '../models/Cutoff.js';
import Branch from '../models/Branch.js';
import College from '../models/College.js';
import HistoricalCutoff from '../models/HistoricalCutoff.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { getAdmissionCategoryValues, normalizeAdmissionCategory } from '../utils/admissionCategory.js';
import { compareCutoffViews, toCutoffView } from '../utils/cutoffRecord.js';

export function classifyCutoffMatch(studentRank, closingRank) {
 const numericStudentRank = Number(studentRank);
 const numericClosingRank = Number(closingRank);

 if (!Number.isFinite(numericStudentRank) || numericStudentRank < 1 ||
     !Number.isFinite(numericClosingRank) || numericClosingRank < 1) {
   return null;
 }

 const ratio = numericStudentRank / numericClosingRank;
 const chance = ratio <= 0.8 ? 'Safe' : ratio <= 1.15 ? 'Moderate' : 'Risky';
 const matchScore = Math.max(0, Math.min(100, Math.round(100 - (ratio - 1) * 100)));

 return { chance, matchScore };
}

export const predict = asyncHandler(async(req,res) => {
 const { rank, examName='JEE Main', year, preferredLocation } = req.body;
 const category = normalizeAdmissionCategory(req.body.category || 'OPEN');
 if (!category) return res.status(400).json({success:false,message:'Choose OPEN/GENERAL, EWS, OBC/OBC-NCL, SC, or ST.'});
 const numericRank = Number(rank);
 if (!Number.isInteger(numericRank) || numericRank < 1) return res.status(400).json({success:false,message:'Enter a valid positive rank.'});
 const cutoffYear = Number(year) || new Date().getFullYear()-1;
 const cutoffFilter = { category: { $in: getAdmissionCategoryValues(category) }, examName, year: cutoffYear };
 const [catalogRecords, historicalRecords] = await Promise.all([
   Cutoff.find(cutoffFilter).populate({path:'branch',populate:{path:'college'}}).lean(),
   HistoricalCutoff.find(cutoffFilter).lean()
 ]);
 const data = [
   ...catalogRecords.filter(record => record.branch?.college),
   ...historicalRecords
 ].map(record => {
     const cutoff = toCutoffView(record);
     const match = classifyCutoffMatch(numericRank, cutoff.closingRank);
     if (!match) return null;
     return { ...cutoff, cutoffYear, studentRank:numericRank, category, chance:match.chance, matchScore:match.matchScore };
   }).filter(Boolean).filter(x => !preferredLocation || x.location.toLowerCase().includes(preferredLocation.toLowerCase()))
   .sort((a,b) => ({Safe:0,Moderate:1,Risky:2}[a.chance]-({Safe:0,Moderate:1,Risky:2}[b.chance])) || a.closingRank-b.closingRank);
 res.json({success:true,meta:{rank:numericRank,category,cutoffYear,recordsFound:data.length,notice:'Advisory estimate based on stored historical cutoffs; not an admission guarantee.'},data});
});

export const historicalCutoffs = asyncHandler(async (req, res) => {
  const filter = {};
  const historicalFilter = {};
  const category = req.query.category
    ? normalizeAdmissionCategory(String(req.query.category))
    : null;
  if (req.query.category && !category) {
    return res.status(400).json({ success: false, message: 'Category filter is invalid.' });
  }
  if (category) {
    filter.category = { $in: getAdmissionCategoryValues(category) };
    historicalFilter.category = { $in: getAdmissionCategoryValues(category) };
  }

  if (req.query.year) {
    const year = Number(req.query.year);
    if (!Number.isInteger(year) || year < 1990 || year > new Date().getFullYear() + 2) {
      return res.status(400).json({ success: false, message: 'Year filter is invalid.' });
    }
    filter.year = year;
    historicalFilter.year = year;
  }
  if (req.query.examName) {
    filter.examName = String(req.query.examName).trim();
    historicalFilter.examName = String(req.query.examName).trim();
  }

  const branchFilter = {};
  if (req.query.collegeCode) {
    const code = String(req.query.collegeCode).trim();
    const codePattern = new RegExp(`^${code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    const colleges = await College.find({
      code: codePattern
    }).select('_id').lean();
    branchFilter.college = { $in: colleges.map((college) => college._id) };
    historicalFilter.collegeCode = codePattern;
  }
  if (req.query.branchCode) {
    const code = String(req.query.branchCode).trim();
    const codePattern = new RegExp(`^${code.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    branchFilter.code = codePattern;
    historicalFilter.branchCode = codePattern;
  }
  if (Object.keys(branchFilter).length) {
    filter.branch = { $in: await Branch.find(branchFilter).distinct('_id') };
  }

  let numericRank;
  if (req.query.rank) {
    numericRank = Number(req.query.rank);
    if (!Number.isInteger(numericRank) || numericRank < 1) {
      return res.status(400).json({ success: false, message: 'Rank must be a positive integer.' });
    }
  }

  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 50);
  if (!Number.isInteger(page) || page < 1 ||
      !Number.isInteger(limit) || limit < 1 || limit > 100) {
    return res.status(400).json({ success: false, message: 'Page or page size is invalid.' });
  }

  const fetchLimit = page * limit;
  const [catalogCount, historicalCount, catalogRecords, historicalRecords] = await Promise.all([
    Cutoff.countDocuments(filter),
    HistoricalCutoff.countDocuments(historicalFilter),
    Cutoff.find(filter)
      .populate({
        path: 'branch',
        select: 'name code college',
        populate: { path: 'college', select: 'name code location' }
      })
      .sort({ year: -1, round: 1, closingRank: 1 })
      .limit(fetchLimit)
      .lean(),
    HistoricalCutoff.find(historicalFilter)
      .sort({ year: -1, round: 1, closingRank: 1 })
      .limit(fetchLimit)
      .lean()
  ]);
  const count = catalogCount + historicalCount;
  const data = [...catalogRecords, ...historicalRecords]
    .map(toCutoffView)
    .sort(compareCutoffViews)
    .slice((page - 1) * limit, page * limit)
    .map((record) => ({
      ...record,
      ...(numericRank ? { rankAnalysis: classifyCutoffMatch(numericRank, record.closingRank) } : {})
    }));

  res.json({
    success: true,
    count,
    page,
    pages: Math.ceil(count / limit),
    analysisRank: numericRank || null,
    notice: 'Historical cutoffs are reference data, not a guarantee of admission.',
    data
  });
});
