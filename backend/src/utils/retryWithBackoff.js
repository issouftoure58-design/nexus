/**
 * Retry with Exponential Backoff
 *
 * Usage:
 *   const data = await retryWithBackoff(() => supabase.from('x').select('*'), { maxRetries: 3 });
 */

/**
 * Execute a function with exponential backoff on failure
 * @param {Function} fn - Async function to execute
 * @param {Object} options
 * @param {number} options.maxRetries - Max retry attempts (default: 3)
 * @param {number} options.baseDelayMs - Base delay in ms (default: 500)
 * @param {number} options.maxDelayMs - Max delay cap in ms (default: 5000)
 * @param {Function} options.shouldRetry - Custom retry predicate (default: retry on all errors)
 * @param {string} options.label - Label for logging
 * @returns {Promise<*>} Result of fn()
 */
export async function retryWithBackoff(fn, options = {}) {
  const {
    maxRetries = 3,
    baseDelayMs = 500,
    maxDelayMs = 5000,
    shouldRetry = () => true,
    label = 'operation',
  } = options;

  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await fn();

      // Handle Supabase-style responses: { data, error }
      if (result && typeof result === 'object' && 'error' in result && result.error) {
        const err = new Error(result.error.message || 'Supabase query error');
        err.code = result.error.code;
        err.details = result.error.details;
        throw err;
      }

      return result;
    } catch (err) {
      lastError = err;

      if (attempt >= maxRetries || !shouldRetry(err, attempt)) {
        break;
      }

      // Exponential backoff with jitter
      const delay = Math.min(baseDelayMs * Math.pow(2, attempt), maxDelayMs);
      const jitter = delay * 0.2 * Math.random(); // 0-20% jitter
      const waitMs = Math.round(delay + jitter);

      console.log(`[RETRY] ${label} attempt ${attempt + 1}/${maxRetries} failed, retrying in ${waitMs}ms: ${err.message}`);
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }
  }

  console.error(`[RETRY] ${label} failed after ${maxRetries + 1} attempts: ${lastError.message}`);
  throw lastError;
}

/**
 * Default predicate: retry on transient/network errors, not on auth/validation
 */
export function isTransientError(err) {
  // Network errors
  if (err.code === 'ECONNRESET' || err.code === 'ETIMEDOUT' || err.code === 'ENOTFOUND') return true;

  // HTTP 5xx or 429
  if (err.status >= 500 || err.status === 429) return true;

  // Supabase rate limit / timeout codes
  if (err.code === '57014' || err.code === 'PGRST301') return true; // statement_timeout, pool timeout

  // Do NOT retry auth errors (401, 403) or validation (400, 404, 409, 422)
  if (err.status >= 400 && err.status < 500) return false;

  // Default: retry unknown errors
  return true;
}
