/**
 * Middleware de pagination obligatoire
 * Parse ?page=1&limit=50 avec défauts sécurisés
 * Attache req.pagination = { page, limit, offset }
 */

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export function paginate(defaults = {}) {
  const defaultLimit = defaults.limit || DEFAULT_LIMIT;
  const maxLimit = defaults.maxLimit || MAX_LIMIT;

  return (req, res, next) => {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(maxLimit, Math.max(1, parseInt(req.query.limit) || defaultLimit));
    const offset = (page - 1) * limit;

    req.pagination = { page, limit, offset };
    next();
  };
}
