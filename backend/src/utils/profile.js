export function calculateProfileCompletion(student) {
  const academicInfo = student.academicInfo || {};
  const fields = [
    student.fullName,
    student.dateOfBirth,
    student.gender,
    student.state,
    student.city,
    student.category,
    student.examName,
    student.rank,
    student.score !== null && student.score !== undefined,
    student.percentile !== null && student.percentile !== undefined,
    Array.isArray(student.interestedBranches) && student.interestedBranches.length > 0,
    academicInfo.board,
    academicInfo.schoolName,
    academicInfo.class10Percentage !== null && academicInfo.class10Percentage !== undefined,
    academicInfo.class12Percentage !== null && academicInfo.class12Percentage !== undefined
  ];

  const validCount = fields.filter(Boolean).length;
  const completion = Math.min(100, Math.round((validCount / fields.length) * 100));

  return {
    profileCompletion: completion,
    profileCompleted: completion >= 75
  };
}

export function mergeStudentProfile(current, updates) {
  const academicInfo = {
    ...(current.academicInfo || {}),
    ...(updates.academicInfo || {})
  };
  const merged = { ...current, ...updates, academicInfo };

  return { ...merged, ...calculateProfileCompletion(merged) };
}
