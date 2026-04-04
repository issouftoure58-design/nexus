/**
 * Query Validation — NEXUS Security Hardening
 * Validates sort, order, and pagination parameters from user input
 * Prevents SQL/column injection via .order() and bounds-checks pagination
 */

/**
 * Validates a sort field against a whitelist of allowed columns
 * @param {string} sort - The sort field from query params
 * @param {string[]} allowedFields - Whitelist of valid column names
 * @param {string} [defaultField='created_at'] - Fallback if sort is invalid
 * @returns {string} A safe sort field
 */
export function validateSort(sort, allowedFields, defaultField = 'created_at') {
  if (!sort || typeof sort !== 'string') return defaultField;
  const cleaned = sort.trim().toLowerCase();
  return allowedFields.includes(cleaned) ? cleaned : defaultField;
}

/**
 * Validates sort order direction
 * @param {string} order - The order direction from query params
 * @param {string} [defaultOrder='desc'] - Fallback if order is invalid
 * @returns {string} 'asc' or 'desc'
 */
export function validateOrder(order, defaultOrder = 'desc') {
  if (!order || typeof order !== 'string') return defaultOrder;
  const cleaned = order.trim().toLowerCase();
  return cleaned === 'asc' ? 'asc' : 'desc';
}

/**
 * Validates and bounds-checks pagination parameters
 * @param {*} page - The page number from query params
 * @param {*} limit - The limit/page size from query params
 * @param {number} [maxLimit=200] - Maximum allowed limit
 * @returns {{ page: number, limit: number, offset: number }}
 */
export function validatePagination(page, limit, maxLimit = 200) {
  const p = Math.max(1, parseInt(page) || 1);
  const l = Math.min(Math.max(1, parseInt(limit) || 20), maxLimit);
  return { page: p, limit: l, offset: (p - 1) * l };
}
