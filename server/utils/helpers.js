// Small shared helpers.

// Read ?page=&limit= safely with sensible bounds.
const getPagination = (query, { defaultLimit = 20, maxLimit = 100 } = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(maxLimit, Math.max(1, parseInt(query.limit, 10) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
};

const paginated = (items, total, { page, limit }) => ({
  items,
  pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
});

// Escape user input before putting it into a RegExp (prevents ReDoS / injection).
const escapeRegex = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Case-insensitive exact-match regex for skill names etc.
const exactCI = (s) => new RegExp(`^${escapeRegex(s.trim())}$`, 'i');

const uniqueCI = (arr = []) => {
  const seen = new Set();
  return arr
    .map((s) => String(s).trim())
    .filter((s) => {
      const k = s.toLowerCase();
      if (!s || seen.has(k)) return false;
      seen.add(k);
      return true;
    });
};

const sameId = (a, b) => String(a?._id ?? a) === String(b?._id ?? b);

module.exports = { getPagination, paginated, escapeRegex, exactCI, uniqueCI, sameId };
