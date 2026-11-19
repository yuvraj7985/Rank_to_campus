export const normalizeIndianMobileNumber = (value) => {
  if (typeof value !== 'string') return null;

  const compact = value.trim().replace(/[\s().-]/g, '');
  if (!/^(?:\+91)?[6-9]\d{9}$/.test(compact)) return null;

  return compact.startsWith('+91') ? compact : `+91${compact}`;
};
