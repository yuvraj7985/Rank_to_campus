const canonicalCategories = new Set(['OPEN', 'EWS', 'OBC-NCL', 'SC', 'ST']);

const categoryAliases = new Map([
  ['OPEN', 'OPEN'],
  ['GENERAL', 'OPEN'],
  ['UNRESERVED', 'OPEN'],
  ['GEN', 'OPEN'],
  ['UR', 'OPEN'],
  ['EWS', 'EWS'],
  ['OBC', 'OBC-NCL'],
  ['OBC-NCL', 'OBC-NCL'],
  ['OBC-NON-CREAMY-LAYER', 'OBC-NCL'],
  ['SC', 'SC'],
  ['ST', 'ST']
]);

export function normalizeAdmissionCategory(value) {
  if (typeof value !== 'string') return null;
  const normalized = value.trim().toUpperCase()
    .replace(/\s*\((?:NCL|NON[\s-]*CREAMY(?:[\s-]*LAYER)?)\)/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-');
  return categoryAliases.get(normalized) || null;
}

export function getAdmissionCategoryValues(value) {
  const category = normalizeAdmissionCategory(value);
  if (!category || !canonicalCategories.has(category)) return [];
  if (category === 'OPEN') return ['OPEN', 'GENERAL', 'GEN', 'UR', 'UNRESERVED'];
  if (category === 'OBC-NCL') {
    return ['OBC-NCL', 'OBC', 'OBC NCL', 'OBC_NCL', 'OBC (NCL)', 'OBC(NCL)', 'OBC-NON-CREAMY-LAYER'];
  }
  return [category];
}


