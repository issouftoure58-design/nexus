/**
 * Startup wrapper - catches import/initialization errors
 * and logs them clearly to stdout before exiting.
 */
console.log('[START] Loading backend...');
console.log('[START] Node:', process.version);
console.log('[START] CWD:', process.cwd());
console.log('[START] ENV keys:', Object.keys(process.env).filter(k => !k.startsWith('npm_')).sort().join(', '));

try {
  await import('./index.js');
  console.log('[START] Backend loaded successfully');
} catch (err) {
  console.error('[START] FATAL: Failed to load backend');
  console.error('[START] Error:', err.message);
  console.error('[START] Stack:', err.stack);
  if (err.code) console.error('[START] Code:', err.code);
  process.exit(1);
}
