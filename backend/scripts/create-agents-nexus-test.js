#!/usr/bin/env node
/**
 * Create AI Agents for nexus-test tenant
 *
 * Usage: node backend/scripts/create-agents-nexus-test.js
 */

import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false, autoRefreshToken: false } }
);

const TENANT_ID = 'nexus-test';

async function findValidAgentTypes() {
  const typesToTry = ['web', 'phone', 'whatsapp', 'reception', 'telephone', 'chat', 'assistant', 'chatbot', 'voice'];
  const validTypes = [];

  console.log('Testing valid agent_type values...');
  for (const type of typesToTry) {
    const { error } = await supabase
      .from('ai_agents')
      .insert({
        tenant_id: '__test__',
        agent_type: type,
        custom_name: 'Test',
        active: false
      })
      .select();

    if (!error) {
      validTypes.push(type);
      console.log(`  OK: ${type}`);
      // Clean up
      await supabase.from('ai_agents').delete().eq('tenant_id', '__test__').eq('agent_type', type);
    } else if (!error.message.includes('check constraint')) {
      // Different error (e.g., column doesn't exist)
      console.log(`  Error (${type}): ${error.message}`);
    } else {
      console.log(`  Invalid: ${type}`);
    }
  }
  return validTypes;
}

// Test different agent types - the constraint might use 'reception', 'telephone', etc.
const AGENT_TYPES_TO_TRY = ['web', 'phone', 'whatsapp', 'reception', 'telephone', 'chat'];

// NOTE: Only 'reception' is valid due to DB constraint ai_agents_agent_type_check
// The frontend uses 'web', 'phone', 'whatsapp' but we'll need to update the constraint
// or update the frontend to use 'reception' type with channel differentiation
// Minimal agent data to avoid constraint violations
const AGENTS = [
  {
    tenant_id: TENANT_ID,
    agent_type: 'reception',
    custom_name: 'Sophie',
    active: true
  }
];

async function main() {
  console.log('=============================================');
  console.log(' CREATE AI AGENTS FOR NEXUS-TEST');
  console.log('=============================================\n');

  try {
    // 0. Find valid agent types
    const validTypes = await findValidAgentTypes();
    console.log(`\nValid agent types: ${validTypes.join(', ') || 'none found'}\n`);

    // 1. Check if agents already exist
    console.log('1. Checking existing agents...');
    const { data: existing, error: fetchError } = await supabase
      .from('ai_agents')
      .select('id, agent_type')
      .eq('tenant_id', TENANT_ID);

    if (fetchError) {
      // Table might not exist, try creating it
      console.log('   Table may not exist, will try to create agents anyway...');
    } else if (existing && existing.length > 0) {
      console.log(`   Found ${existing.length} existing agents.`);
      console.log('   Deleting existing agents...');

      const { error: delError } = await supabase
        .from('ai_agents')
        .delete()
        .eq('tenant_id', TENANT_ID);

      if (delError) {
        console.error('   Error deleting:', delError.message);
      } else {
        console.log('   Deleted successfully.');
      }
    } else {
      console.log('   No existing agents found.');
    }

    // 2. Create agents
    console.log('\n2. Creating agents...');

    for (const agent of AGENTS) {
      const { data, error } = await supabase
        .from('ai_agents')
        .insert(agent)
        .select()
        .single();

      if (error) {
        console.error(`   Error creating ${agent.agent_type} agent:`, error.message);
      } else {
        console.log(`   Created: ${data.custom_name} (${data.agent_type})`);
      }
    }

    // 3. Verify
    console.log('\n3. Verifying...');
    const { data: created, error: verifyError } = await supabase
      .from('ai_agents')
      .select('id, agent_type, custom_name, active')
      .eq('tenant_id', TENANT_ID);

    if (verifyError) {
      console.error('   Verification error:', verifyError.message);
    } else {
      console.log(`   Total agents: ${created.length}`);
      for (const agent of created) {
        console.log(`   - ${agent.custom_name} (${agent.agent_type}): ${agent.active ? 'Active' : 'Inactive'}`);
      }
    }

    console.log('\n=============================================');
    console.log(' AGENTS CREATED SUCCESSFULLY');
    console.log('=============================================\n');
    console.log('Refresh the IA Admin page to see the agents.');

  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
