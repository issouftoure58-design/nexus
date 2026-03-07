/**
 * Helpers de réponse API standardisés
 * Usage: import { success, error, paginated } from '../utils/response.js';
 */

export function success(res, data, status = 200) {
  return res.status(status).json({ success: true, ...data });
}

export function error(res, message, code = 'INTERNAL_ERROR', status = 500) {
  return res.status(status).json({ success: false, error: { code, message } });
}

export function paginated(res, { data, page, limit, total }) {
  return res.json({
    success: true,
    data,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  });
}

export default { success, error, paginated };
