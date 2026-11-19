import { normalizeAdmissionCategory } from './admissionCategory.js';

export function prepareCutoffImportRow(cutoff, { college, branch } = {}) {
  const linkedBranch = branch?._id || null;
  const snapshot = {
    collegeCode: cutoff.collegeCode,
    collegeName: cutoff.collegeName || college?.name || cutoff.collegeCode,
    location: cutoff.location || college?.location || '',
    branchCode: cutoff.branchCode,
    branchName: cutoff.branchName || branch?.name || cutoff.branchCode,
    examName: cutoff.examName,
    year: cutoff.year,
    round: cutoff.round,
    category: cutoff.category,
    openingRank: cutoff.openingRank,
    closingRank: cutoff.closingRank
  };
  const cutoffData = {
    examName: cutoff.examName,
    year: cutoff.year,
    round: cutoff.round,
    category: cutoff.category,
    openingRank: cutoff.openingRank,
    closingRank: cutoff.closingRank
  };
  const uniqueKey = linkedBranch
    ? `branch:${linkedBranch}:${cutoff.year}:${cutoff.round}:${cutoff.category}`
    : `history:${cutoff.collegeCode}:${cutoff.branchCode}:${cutoff.examName}:${cutoff.year}:${cutoff.round}:${cutoff.category}`;

  return {
    uniqueKey,
    snapshotKey: `history:${snapshot.collegeCode}:${snapshot.branchCode}:${snapshot.examName}:${snapshot.year}:${snapshot.round}:${snapshot.category}`,
    cutoff: { ...cutoffData, ...(linkedBranch ? { branch: linkedBranch } : {}) },
    snapshot
  };
}

export function toCutoffView(record) {
  const branch = record.branch && typeof record.branch === 'object' ? record.branch : null;
  const college = branch?.college && typeof branch.college === 'object' ? branch.college : null;

  return {
    _id: record._id,
    year: record.year,
    round: record.round,
    examName: record.examName,
    category: normalizeAdmissionCategory(record.category) || record.category,
    openingRank: record.openingRank,
    closingRank: record.closingRank,
    college: college?.name || record.collegeName || record.collegeCode || 'Unknown college',
    collegeCode: college?.code || record.collegeCode || '',
    location: college?.location || record.location || '',
    branch: branch?.name || record.branchName || record.branchCode || 'Unknown branch',
    branchCode: branch?.code || record.branchCode || '',
    ...(branch?._id ? { branchId: branch._id } : {})
  };
}

export function compareCutoffViews(left, right) {
  return right.year - left.year ||
    left.round - right.round ||
    left.closingRank - right.closingRank ||
    left.collegeCode.localeCompare(right.collegeCode) ||
    left.branchCode.localeCompare(right.branchCode);
}
