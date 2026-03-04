/**
 * Strategie Handler — strategie_analyze, strategie_pricing, strategie_objectifs, strategie_rapport
 * Outils strategiques utilisant Claude Haiku et les donnees tenant.
 */

import { supabase } from '../../config/supabase.js';
import logger from '../../config/logger.js';
import { generateContent, getTenantContext } from './shared/claudeHelper.js';

async function strategie_analyze(toolInput, tenantId, adminId) {
  if (!tenantId) throw new Error('TENANT_SHIELD: tenant_id requis');

  try {
    const ctx = await getTenantContext(supabase, tenantId);

    const { count: clientsCount } = await supabase
      .from('clients')
      .select('id', { count: 'exact' })
      .eq('tenant_id', tenantId);

    const today = new Date();
    const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;

    const { data: reservations } = await supabase
      .from('reservations')
      .select('id, prix_total, prix_service, frais_deplacement, statut')
      .eq('tenant_id', tenantId)
      .gte('date', monthStart)
      .in('statut', ['confirme', 'termine']);

    const revenuMois = (reservations || []).reduce((sum, r) => {
      return sum + (r.prix_total || (r.prix_service || 0) + (r.frais_deplacement || 0));
    }, 0);

    const { data: services } = await supabase
      .from('services')
      .select('nom, prix, actif')
      .eq('tenant_id', tenantId);

    const prompt = `Tu es un consultant en strategie d'entreprise. Realise une analyse SWOT complete.

Entreprise: ${ctx.businessName}
Type: ${ctx.businessType}
Description: ${ctx.description}

Donnees:
- Clients actifs: ${clientsCount || 0}
- Revenu du mois: ${((revenuMois || 0) / 100).toFixed(2)} EUR
- RDV confirmes ce mois: ${reservations?.length || 0}
- Services proposes: ${services?.length || 0}
- Services actifs: ${services?.filter(s => s.actif)?.length || 0}

Services:
${ctx.servicesText}

${toolInput.focus ? `Focus particulier: ${toolInput.focus}` : ''}

Reponds en JSON:
{
  "forces": ["..."],
  "faiblesses": ["..."],
  "opportunites": ["..."],
  "menaces": ["..."],
  "recommandations_prioritaires": [
    { "action": "...", "impact": "fort|moyen|faible", "delai": "court|moyen|long" }
  ],
  "score_sante": 0-100
}`;

    const analysis = await generateContent(prompt, 2000);

    return {
      success: true,
      type: 'SWOT',
      entreprise: ctx.businessName,
      donnees: {
        clients: clientsCount || 0,
        revenu_mois: `${((revenuMois || 0) / 100).toFixed(2)} EUR`,
        rdv_mois: reservations?.length || 0,
        services: services?.length || 0
      },
      analyse: analysis
    };
  } catch (error) {
    logger.error('[STRATEGIE HANDLER] Erreur strategie_analyze:', { error: error.message, tenantId });
    return { success: false, error: error.message };
  }
}

async function strategie_pricing(toolInput, tenantId, adminId) {
  if (!tenantId) throw new Error('TENANT_SHIELD: tenant_id requis');

  try {
    const ctx = await getTenantContext(supabase, tenantId);

    const { data: services } = await supabase
      .from('services')
      .select('nom, prix, duree, description, actif')
      .eq('tenant_id', tenantId)
      .eq('actif', true);

    const servicesDetail = (services || [])
      .map(s => `- ${s.nom}: ${(s.prix / 100).toFixed(2)} EUR (${s.duree || '?'} min)`)
      .join('\n');

    const prompt = `Tu es un expert en strategie de prix. Analyse les tarifs de cette entreprise.

Entreprise: ${ctx.businessName}
Type: ${ctx.businessType}
${toolInput.location ? `Localisation: ${toolInput.location}` : ''}

Services et prix actuels:
${servicesDetail}

${toolInput.competitors ? `Concurrents mentionnes: ${toolInput.competitors}` : ''}

Reponds en JSON:
{
  "analyse_globale": "...",
  "positionnement": "premium|milieu_de_gamme|economique",
  "services_analyses": [
    { "service": "...", "prix_actuel": "...", "prix_suggere": "...", "justification": "..." }
  ],
  "strategies_possibles": [
    { "nom": "...", "description": "...", "risque": "faible|moyen|eleve" }
  ],
  "potentiel_augmentation_ca": "..."
}`;

    const analysis = await generateContent(prompt, 2000);

    return {
      success: true,
      type: 'pricing',
      entreprise: ctx.businessName,
      nb_services: services?.length || 0,
      analyse: analysis
    };
  } catch (error) {
    logger.error('[STRATEGIE HANDLER] Erreur strategie_pricing:', { error: error.message, tenantId });
    return { success: false, error: error.message };
  }
}

async function strategie_objectifs(toolInput, tenantId, adminId) {
  if (!tenantId) throw new Error('TENANT_SHIELD: tenant_id requis');

  try {
    const action = toolInput.action || 'voir';

    if (action === 'voir') {
      const { data, error } = await supabase
        .from('sentinel_goals')
        .select('*')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: false });

      if (error) {
        return { success: false, error: `Erreur lecture objectifs: ${error.message}` };
      }

      return {
        success: true,
        action: 'voir',
        objectifs: data || [],
        count: data?.length || 0
      };
    }

    if (action === 'definir') {
      if (!toolInput.title || !toolInput.target_value) {
        return { success: false, error: 'Parametres "title" et "target_value" requis pour definir un objectif' };
      }

      const { data, error } = await supabase
        .from('sentinel_goals')
        .insert({
          tenant_id: tenantId,
          title: toolInput.title,
          description: toolInput.description || '',
          metric: toolInput.metric || 'custom',
          target_value: toolInput.target_value,
          current_value: toolInput.current_value || 0,
          deadline: toolInput.deadline || null,
          status: 'active'
        })
        .select();

      if (error) {
        return { success: false, error: `Erreur creation objectif: ${error.message}` };
      }

      return {
        success: true,
        action: 'definir',
        message: `Objectif cree: "${toolInput.title}"`,
        objectif: data?.[0]
      };
    }

    if (action === 'suivre') {
      if (!toolInput.goalId) {
        return { success: false, error: 'Parametre "goalId" requis pour suivre un objectif' };
      }

      const { data: goal, error: fetchError } = await supabase
        .from('sentinel_goals')
        .select('*')
        .eq('id', toolInput.goalId)
        .eq('tenant_id', tenantId)
        .single();

      if (fetchError || !goal) {
        return { success: false, error: `Objectif ${toolInput.goalId} introuvable` };
      }

      if (toolInput.current_value !== undefined) {
        const { error: updateError } = await supabase
          .from('sentinel_goals')
          .update({ current_value: toolInput.current_value })
          .eq('id', toolInput.goalId)
          .eq('tenant_id', tenantId);

        if (updateError) {
          return { success: false, error: `Erreur mise a jour: ${updateError.message}` };
        }

        goal.current_value = toolInput.current_value;
      }

      const progression = goal.target_value > 0
        ? ((goal.current_value / goal.target_value) * 100).toFixed(1)
        : 0;

      return {
        success: true,
        action: 'suivre',
        objectif: goal,
        progression: `${progression}%`
      };
    }

    return { success: false, error: `Action "${action}" non reconnue. Utilisez: voir, definir, suivre` };
  } catch (error) {
    logger.error('[STRATEGIE HANDLER] Erreur strategie_objectifs:', { error: error.message, tenantId });
    return { success: false, error: error.message };
  }
}

async function strategie_rapport(toolInput, tenantId, adminId) {
  if (!tenantId) throw new Error('TENANT_SHIELD: tenant_id requis');

  try {
    const ctx = await getTenantContext(supabase, tenantId);

    // KPIs
    const today = new Date();
    const monthStart = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-01`;

    const [clientsRes, rdvRes, goalsRes] = await Promise.all([
      supabase
        .from('clients')
        .select('id', { count: 'exact' })
        .eq('tenant_id', tenantId),
      supabase
        .from('reservations')
        .select('id, prix_total, prix_service, frais_deplacement, statut')
        .eq('tenant_id', tenantId)
        .gte('date', monthStart)
        .in('statut', ['confirme', 'termine']),
      supabase
        .from('sentinel_goals')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('status', 'active')
    ]);

    const clients = clientsRes.count || 0;
    const rdvs = rdvRes.data || [];
    const revenu = rdvs.reduce((sum, r) => {
      return sum + (r.prix_total || (r.prix_service || 0) + (r.frais_deplacement || 0));
    }, 0);
    const goals = goalsRes.data || [];

    const goalsText = goals.map(g => {
      const prog = g.target_value > 0 ? ((g.current_value / g.target_value) * 100).toFixed(0) : 0;
      return `- ${g.title}: ${prog}% (${g.current_value}/${g.target_value})`;
    }).join('\n') || 'Aucun objectif defini';

    const prompt = `Tu es un directeur de strategie. Genere un rapport strategique mensuel.

Entreprise: ${ctx.businessName}
Type: ${ctx.businessType}
Mois: ${today.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })}

KPIs du mois:
- Clients total: ${clients}
- RDV confirmes: ${rdvs.length}
- Revenu: ${(revenu / 100).toFixed(2)} EUR

Objectifs actifs:
${goalsText}

${toolInput.notes ? `Notes additionnelles: ${toolInput.notes}` : ''}

Reponds en JSON:
{
  "resume_executif": "...",
  "performance": { "note": "A-F", "tendance": "hausse|stable|baisse", "commentaire": "..." },
  "objectifs_progress": "...",
  "risques": ["..."],
  "actions_recommandees": [
    { "action": "...", "priorite": "haute|moyenne|basse", "responsable": "..." }
  ],
  "previsions_prochain_mois": "..."
}`;

    const rapport = await generateContent(prompt, 2500);

    return {
      success: true,
      type: 'rapport_strategique',
      entreprise: ctx.businessName,
      mois: today.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
      kpis: {
        clients,
        rdv_mois: rdvs.length,
        revenu: `${(revenu / 100).toFixed(2)} EUR`
      },
      objectifs_actifs: goals.length,
      rapport
    };
  } catch (error) {
    logger.error('[STRATEGIE HANDLER] Erreur strategie_rapport:', { error: error.message, tenantId });
    return { success: false, error: error.message };
  }
}

export const strategieHandlers = {
  strategie_analyze,
  strategie_pricing,
  strategie_objectifs,
  strategie_rapport
};
