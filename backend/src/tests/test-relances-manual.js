/**
 * Test manuel du job relances J+7/J+14/J+21
 */

import { traiterToutesRelancesJ7J14J21 } from '../jobs/relancesFacturesJob.js';

console.log('🚀 Test manuel du job relances J+7/J+14/J+21...\n');
console.log('Date:', new Date().toLocaleString('fr-FR'));
console.log('─'.repeat(50));

try {
  const result = await traiterToutesRelancesJ7J14J21();
  console.log('\n' + '─'.repeat(50));
  console.log('📊 RÉSULTAT FINAL:');
  console.log(JSON.stringify(result, null, 2));
} catch (err) {
  console.error('❌ Erreur:', err.message);
  console.error(err.stack);
}
