/**
 * Central Interval Registry
 *
 * All setInterval() calls should be registered here for proper cleanup
 * during graceful shutdown.
 *
 * Usage:
 *   import { registerInterval, shutdownAllIntervals } from './utils/intervalRegistry.js';
 *
 *   const id = setInterval(fn, 5000);
 *   registerInterval('myCleanup', id);
 *
 *   // On shutdown:
 *   shutdownAllIntervals();
 */

const registry = new Map(); // name -> { intervalId, registeredAt }

/**
 * Register a setInterval for cleanup on shutdown
 * @param {string} name - Unique name for this interval
 * @param {NodeJS.Timeout} intervalId - Return value of setInterval()
 */
export function registerInterval(name, intervalId) {
  if (registry.has(name)) {
    // Clear previous interval with same name (prevents double-registration)
    clearInterval(registry.get(name).intervalId);
  }
  registry.set(name, { intervalId, registeredAt: Date.now() });
}

/**
 * Unregister and clear a specific interval
 * @param {string} name
 */
export function unregisterInterval(name) {
  const entry = registry.get(name);
  if (entry) {
    clearInterval(entry.intervalId);
    registry.delete(name);
  }
}

/**
 * Clear ALL registered intervals (called during graceful shutdown)
 * @returns {number} Number of intervals cleared
 */
export function shutdownAllIntervals() {
  let count = 0;
  for (const [name, entry] of registry.entries()) {
    clearInterval(entry.intervalId);
    count++;
  }
  registry.clear();
  if (count > 0) {
    console.log(`[SHUTDOWN] Cleared ${count} registered intervals`);
  }
  return count;
}

/**
 * Get registry status (for monitoring/debugging)
 */
export function getRegistryStatus() {
  const entries = [];
  for (const [name, entry] of registry.entries()) {
    entries.push({ name, registeredAt: new Date(entry.registeredAt).toISOString() });
  }
  return { count: registry.size, intervals: entries };
}
