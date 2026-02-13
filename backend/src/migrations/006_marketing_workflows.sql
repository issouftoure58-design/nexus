-- Migration 006: Marketing Automation - Workflows
-- NEXUS Plan PRO Feature

-- Table des workflows
CREATE TABLE IF NOT EXISTS workflows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  nom TEXT NOT NULL,
  description TEXT,
  actif BOOLEAN DEFAULT true,
  trigger_type TEXT NOT NULL, -- 'new_client', 'rdv_completed', 'facture_payee', 'client_inactive', etc.
  config JSONB NOT NULL DEFAULT '{}',
  executions_count INTEGER DEFAULT 0,
  last_execution_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Table des exécutions de workflows
CREATE TABLE IF NOT EXISTS workflow_executions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  entity_type TEXT, -- 'client', 'rdv', 'facture'
  entity_id INTEGER,
  statut TEXT DEFAULT 'pending', -- 'pending', 'running', 'success', 'failed'
  resultat JSONB,
  error_message TEXT,
  executed_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- Table des tâches admin (pour l'action create_task)
CREATE TABLE IF NOT EXISTS admin_tasks (
  id SERIAL PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  statut TEXT DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'cancelled'
  priorite TEXT DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
  entity_type TEXT,
  entity_id INTEGER,
  assigned_to TEXT,
  due_date TIMESTAMP,
  completed_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index pour performances
CREATE INDEX IF NOT EXISTS idx_workflows_tenant ON workflows(tenant_id);
CREATE INDEX IF NOT EXISTS idx_workflows_actif ON workflows(actif) WHERE actif = true;
CREATE INDEX IF NOT EXISTS idx_workflows_trigger ON workflows(trigger_type);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_workflow ON workflow_executions(workflow_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_tenant ON workflow_executions(tenant_id);
CREATE INDEX IF NOT EXISTS idx_workflow_executions_statut ON workflow_executions(statut);
CREATE INDEX IF NOT EXISTS idx_admin_tasks_tenant ON admin_tasks(tenant_id);
CREATE INDEX IF NOT EXISTS idx_admin_tasks_statut ON admin_tasks(statut);

-- Commentaires sur la structure config JSONB:
-- {
--   "conditions": [
--     { "field": "source", "operator": "=", "value": "Instagram" },
--     { "field": "montant_total", "operator": ">", "value": 100 }
--   ],
--   "actions": [
--     { "type": "send_email", "template": "bienvenue", "to_field": "email", "delay_minutes": 0 },
--     { "type": "send_sms", "message": "Merci pour votre visite !", "to_field": "telephone", "delay_minutes": 60 },
--     { "type": "add_tag", "tag": "vip", "delay_minutes": 0 },
--     { "type": "create_task", "description": "Appeler le client", "priorite": "high", "delay_minutes": 1440 }
--   ]
-- }

-- Triggers disponibles:
-- - new_client: Nouveau client créé
-- - rdv_completed: RDV terminé avec succès
-- - rdv_cancelled: RDV annulé
-- - facture_payee: Facture payée
-- - facture_en_retard: Facture en retard de paiement
-- - client_inactive: Client sans RDV depuis X jours (cron)
-- - anniversaire: Anniversaire du client (cron)
