// Replay subscription.created event pour un tenant (apres checkout sans webhook forward)
// Usage: node scripts/replay-sub-webhook.mjs <tenantId>
import 'dotenv/config';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { handleWebhookEvent } from '../src/services/stripeBillingService.js';

const tenantId = process.argv[2];
if (!tenantId) { console.error('Usage: node replay-sub-webhook.mjs <tenantId>'); process.exit(1); }

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: t } = await supabase.from('tenants').select('stripe_customer_id').eq('id', tenantId).single();
if (!t?.stripe_customer_id) { console.error('Pas de stripe_customer_id'); process.exit(1); }

const subs = await stripe.subscriptions.list({ customer: t.stripe_customer_id, limit: 1 });
if (!subs.data.length) { console.error('Aucune subscription'); process.exit(1); }
const sub = subs.data[0];
console.log(`Subscription: ${sub.id} status=${sub.status} price=${sub.items.data[0]?.price.id}`);
console.log(`Metadata tenant_id: ${sub.metadata?.tenant_id}`);

// Replay customer.subscription.created
const event = {
  id: `evt_replay_${Date.now()}`,
  type: 'customer.subscription.created',
  data: { object: sub }
};
await handleWebhookEvent(event);
console.log('\n[OK] subscription.created replayed');

// Etat final
const { data: t2 } = await supabase.from('tenants').select('plan, statut, stripe_subscription_id, subscription_status').eq('id', tenantId).single();
console.log('\nDB apres sync:', JSON.stringify(t2, null, 2));
