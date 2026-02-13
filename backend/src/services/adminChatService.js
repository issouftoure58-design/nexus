/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║   ADMIN CHAT SERVICE - Streaming avec Claude + Tool Execution     ║
 * ║   Chat admin style Claude.ai avec exécution des outils            ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

import Anthropic from '@anthropic-ai/sdk';
import { supabase } from '../config/supabase.js';
import { TOOLS_ADMIN, getToolsForPlan } from '../tools/toolsRegistry.js';
// Import des outils Pro
import {
  executeAdvancedQuery,
  createAutomation,
  scheduleTask,
  analyzePattern
} from '../ai/adminProTools.js';

// Client Anthropic (singleton)
let anthropicClient = null;

function getAnthropicClient() {
  if (!anthropicClient) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY non configurée');
    }
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return anthropicClient;
}

// Modèle par défaut
const MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 4096;
const MAX_TOOL_ITERATIONS = 5; // Limite pour éviter les boucles infinies

/**
 * Récupère les informations du tenant
 */
export async function getTenant(tenantId) {
  try {
    const { data, error } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', tenantId)
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[ADMIN CHAT] Erreur getTenant:', error);
    return null;
  }
}

/**
 * Construit le prompt système pour Claude
 */
export function buildSystemPrompt(tenant) {
  const businessName = tenant?.business_name || 'NEXUS';
  const businessType = tenant?.business_type || 'business';
  const plan = tenant?.subscription_plan || 'starter';
  const credits = tenant?.ai_credits_remaining ?? 1000;

  return `Tu es l'Assistant Admin Pro de ${businessName}, propulsé par NEXUS.

## IDENTITÉ
- Tu es un assistant IA expert en gestion d'entreprise
- Tu as accès à des outils pour gérer le business
- Tu es proactif : tu utilises les outils directement

## CONTEXTE BUSINESS
- Entreprise : ${businessName}
- Type : ${businessType}
- Plan : ${plan}
- Crédits IA : ${credits}

## RÈGLES IMPORTANTES
1. **Sois proactif** : Utilise les outils directement. Ne demande pas "Voulez-vous que je...". Fais-le.
2. **Concis** : Maximum 300 mots sauf demande explicite
3. **Markdown** : Utilise le markdown pour structurer (tableaux, listes)
4. **Pas d'emoji excessif** : 1-2 max par message

## ACTIONS CRITIQUES (confirmation requise)
- Suppression de données
- Envoi d'emails/SMS en masse
- Modifications irréversibles`;
}

/**
 * Calcule le prix total d'une réservation
 * Utilise prix_total si disponible, sinon prix_service + frais_deplacement
 */
function getPrixReservation(r) {
  if (r.prix_total) return r.prix_total;
  if (r.prix_service) return (r.prix_service || 0) + (r.frais_deplacement || 0);
  return 0;
}

/**
 * Exécute un outil et retourne le résultat
 */
async function executeTool(toolName, toolInput, tenantId) {
  console.log(`[ADMIN CHAT] Exécution outil: ${toolName}`, { toolInput, tenantId });

  try {
    switch (toolName) {
      // ═══════════════════════════════════════════════════════════════
      // OUTILS STATS & DASHBOARD
      // ═══════════════════════════════════════════════════════════════
      case 'get_stats': {
        const today = new Date().toISOString().split('T')[0];
        const monthStart = today.substring(0, 7) + '-01';
        const periode = toolInput.periode || 'mois';

        console.log(`[ADMIN CHAT] get_stats - tenant: ${tenantId}, month: ${monthStart}`);

        // RDV aujourd'hui
        const { data: rdvToday, error: errToday } = await supabase
          .from('reservations')
          .select('id, prix_total, prix_service, frais_deplacement')
          .eq('tenant_id', tenantId)
          .eq('date', today);

        if (errToday) console.error('[ADMIN CHAT] Erreur rdvToday:', errToday);

        // RDV ce mois
        const { data: rdvMonth, error: errMonth } = await supabase
          .from('reservations')
          .select('id, prix_total, prix_service, frais_deplacement, statut, service_nom, client_id')
          .eq('tenant_id', tenantId)
          .gte('date', monthStart);

        if (errMonth) console.error('[ADMIN CHAT] Erreur rdvMonth:', errMonth);
        console.log(`[ADMIN CHAT] RDV mois trouvés: ${rdvMonth?.length || 0}`, rdvMonth?.slice(0, 3));

        // Clients total
        const { count: clientsCount, error: errClients } = await supabase
          .from('clients')
          .select('id', { count: 'exact' })
          .eq('tenant_id', tenantId);

        if (errClients) console.error('[ADMIN CHAT] Erreur clients:', errClients);

        // Compter confirme ET termine pour les revenus
        const rdvFacturables = rdvMonth?.filter(r => r.statut === 'confirme' || r.statut === 'termine') || [];
        const revenusMois = rdvFacturables.reduce((sum, r) => sum + getPrixReservation(r), 0);
        console.log(`[ADMIN CHAT] RDV facturables: ${rdvFacturables.length}, Revenus: ${revenusMois}`);

        // Top services
        const serviceCount = {};
        rdvFacturables.forEach(r => {
          if (r.service_nom) {
            serviceCount[r.service_nom] = (serviceCount[r.service_nom] || 0) + 1;
          }
        });
        const topServices = Object.entries(serviceCount)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([nom, count]) => ({ nom, count }));

        return {
          success: true,
          periode,
          date: today,
          rdv_aujourdhui: rdvToday?.length || 0,
          rdv_mois: rdvMonth?.length || 0,
          rdv_confirmes: rdvFacturables.length,
          revenus_mois: `${(revenusMois / 100).toFixed(2)}€`,
          clients_total: clientsCount || 0,
          top_services: topServices
        };
      }

      case 'get_top_clients':
      case 'get_best_clients': {
        console.log(`[ADMIN CHAT] get_top_clients - tenant: ${tenantId}`);

        const { data: clients, error } = await supabase
          .from('clients')
          .select(`
            id, prenom, nom, telephone, email,
            reservations:reservations(id, prix_total, prix_service, frais_deplacement, statut)
          `)
          .eq('tenant_id', tenantId)
          .limit(100);

        if (error) console.error('[ADMIN CHAT] Erreur get_top_clients:', error);
        console.log(`[ADMIN CHAT] Clients trouvés: ${clients?.length || 0}`);

        if (!clients || clients.length === 0) {
          return { success: true, message: "Aucun client trouvé", clients: [] };
        }

        // Calculer le CA par client (confirme + termine)
        const clientsWithRevenue = clients.map(c => {
          const rdvFacturables = c.reservations?.filter(r => r.statut === 'confirme' || r.statut === 'termine') || [];
          const totalRevenu = rdvFacturables.reduce((sum, r) => sum + getPrixReservation(r), 0);
          return {
            id: c.id,
            nom: `${c.prenom} ${c.nom}`,
            telephone: c.telephone,
            email: c.email,
            nb_rdv: c.reservations?.length || 0,
            revenu_total: totalRevenu,
            revenu_formatte: `${(totalRevenu / 100).toFixed(2)}€`
          };
        });

        // Trier par revenu décroissant
        clientsWithRevenue.sort((a, b) => b.revenu_total - a.revenu_total);

        return {
          success: true,
          top_clients: clientsWithRevenue.slice(0, toolInput.limit || 10)
        };
      }

      // ═══════════════════════════════════════════════════════════════
      // OUTILS RDV
      // ═══════════════════════════════════════════════════════════════
      case 'get_rdv': {
        // Gère tous les cas: aujourd'hui, date spécifique, période
        const today = new Date().toISOString().split('T')[0];
        const date = toolInput.date || today;

        let query = supabase
          .from('reservations')
          .select(`
            id, date, heure, statut, service_nom, prix_total, prix_service, frais_deplacement,
            clients:client_id(prenom, nom, telephone)
          `)
          .eq('tenant_id', tenantId);

        // Filtre par date si spécifié
        if (toolInput.date) {
          query = query.eq('date', toolInput.date);
        } else {
          // Par défaut, aujourd'hui et les 7 prochains jours
          const weekEnd = new Date();
          weekEnd.setDate(weekEnd.getDate() + 7);
          query = query.gte('date', today).lte('date', weekEnd.toISOString().split('T')[0]);
        }

        // Filtre par statut si spécifié
        if (toolInput.statut) {
          query = query.eq('statut', toolInput.statut);
        }

        // Filtre par client si spécifié
        if (toolInput.client_id) {
          query = query.eq('client_id', toolInput.client_id);
        }

        const { data: rdvs } = await query.order('date').order('heure');

        return {
          success: true,
          date_filtre: toolInput.date || 'semaine',
          rdv_count: rdvs?.length || 0,
          rdv: rdvs?.map(r => ({
            id: r.id,
            date: r.date,
            heure: r.heure,
            client: r.clients ? `${r.clients.prenom} ${r.clients.nom}` : 'Client inconnu',
            telephone: r.clients?.telephone,
            service: r.service_nom,
            statut: r.statut,
            montant: `${(getPrixReservation(r) / 100).toFixed(2)}€`
          })) || []
        };
      }

      // ═══════════════════════════════════════════════════════════════
      // OUTILS REVENUS
      // ═══════════════════════════════════════════════════════════════
      case 'get_revenus_mois':
      case 'analyze_revenue': {
        const today = new Date();
        const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);

        console.log(`[ADMIN CHAT] get_revenus_mois - tenant: ${tenantId}`);

        const { data: rdvs, error } = await supabase
          .from('reservations')
          .select('id, date, prix_total, prix_service, frais_deplacement, statut, service_nom')
          .eq('tenant_id', tenantId)
          .gte('date', monthStart.toISOString().split('T')[0])
          .lte('date', monthEnd.toISOString().split('T')[0]);

        if (error) console.error('[ADMIN CHAT] Erreur get_revenus_mois:', error);
        console.log(`[ADMIN CHAT] RDV du mois: ${rdvs?.length || 0}`, rdvs?.slice(0, 3));

        // Confirme + termine = facturables
        const facturables = rdvs?.filter(r => r.statut === 'confirme' || r.statut === 'termine') || [];
        const enAttente = rdvs?.filter(r => r.statut === 'en_attente' || r.statut === 'demande' || r.statut === 'en_attente_paiement') || [];

        const revenusFacturables = facturables.reduce((sum, r) => sum + getPrixReservation(r), 0);
        const revenusEnAttente = enAttente.reduce((sum, r) => sum + getPrixReservation(r), 0);

        console.log(`[ADMIN CHAT] Facturables: ${facturables.length}, Revenus: ${revenusFacturables}`);

        // Top services
        const serviceRevenue = {};
        facturables.forEach(r => {
          if (r.service_nom) {
            serviceRevenue[r.service_nom] = (serviceRevenue[r.service_nom] || 0) + getPrixReservation(r);
          }
        });
        const topServices = Object.entries(serviceRevenue)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([nom, montant]) => ({ nom, montant: `${(montant / 100).toFixed(2)}€` }));

        return {
          success: true,
          mois: monthStart.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
          revenus_confirmes: `${(revenusFacturables / 100).toFixed(2)}€`,
          revenus_en_attente: `${(revenusEnAttente / 100).toFixed(2)}€`,
          nb_rdv_confirmes: facturables.length,
          nb_rdv_en_attente: enAttente.length,
          top_services: topServices
        };
      }

      // ═══════════════════════════════════════════════════════════════
      // OUTILS CLIENTS
      // ═══════════════════════════════════════════════════════════════
      case 'search_clients': {
        const query = toolInput.query || toolInput.search || '';
        const { data: clients } = await supabase
          .from('clients')
          .select('id, prenom, nom, telephone, email')
          .eq('tenant_id', tenantId)
          .or(`prenom.ilike.%${query}%,nom.ilike.%${query}%,telephone.ilike.%${query}%`)
          .limit(10);

        return {
          success: true,
          query,
          results: clients || []
        };
      }

      case 'get_client_info': {
        let query = supabase
          .from('clients')
          .select(`
            id, prenom, nom, telephone, email, adresse, created_at,
            reservations:reservations(id, date, service_nom, statut, prix_total, prix_service, frais_deplacement)
          `)
          .eq('tenant_id', tenantId);

        // Recherche par ID ou téléphone
        if (toolInput.client_id) {
          query = query.eq('id', toolInput.client_id);
        } else if (toolInput.telephone) {
          query = query.eq('telephone', toolInput.telephone);
        } else {
          return { success: false, error: 'client_id ou telephone requis' };
        }

        const { data: client } = await query.single();

        if (!client) {
          return { success: false, error: 'Client non trouvé' };
        }

        // Calculer CA total (confirme + termine)
        const rdvFacturables = client.reservations?.filter(r => r.statut === 'confirme' || r.statut === 'termine') || [];
        const caTotal = rdvFacturables.reduce((sum, r) => sum + getPrixReservation(r), 0);

        return {
          success: true,
          client: {
            id: client.id,
            nom: `${client.prenom} ${client.nom}`,
            telephone: client.telephone,
            email: client.email,
            adresse: client.adresse,
            inscrit_depuis: client.created_at,
            nb_rdv_total: client.reservations?.length || 0,
            nb_rdv_confirmes: rdvFacturables.length,
            ca_total: `${(caTotal / 100).toFixed(2)}€`,
            derniers_rdv: client.reservations?.slice(0, 5).map(r => ({
              date: r.date,
              service: r.service_nom,
              statut: r.statut
            }))
          }
        };
      }

      // ═══════════════════════════════════════════════════════════════
      // OUTILS SERVICES
      // ═══════════════════════════════════════════════════════════════
      case 'get_services':
      case 'list_services': {
        const { data: services } = await supabase
          .from('services')
          .select('id, nom, description, prix, duree_minutes, categorie, actif')
          .eq('tenant_id', tenantId)
          .eq('actif', true)
          .order('categorie', { ascending: true });

        return {
          success: true,
          services: services?.map(s => ({
            id: s.id,
            nom: s.nom,
            prix: `${(s.prix / 100).toFixed(2)}€`,
            duree: s.duree_minutes >= 60
              ? `${Math.floor(s.duree_minutes / 60)}h${s.duree_minutes % 60 > 0 ? s.duree_minutes % 60 : ''}`
              : `${s.duree_minutes}min`,
            categorie: s.categorie
          })) || []
        };
      }

      // ═══════════════════════════════════════════════════════════════
      // OUTILS COMPTABILITÉ
      // ═══════════════════════════════════════════════════════════════
      case 'comptable_depenses': {
        const action = toolInput.action || 'lister';
        const today = new Date();
        const targetMois = toolInput.periode || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

        if (action === 'ajouter') {
          // Ajouter une dépense
          if (!toolInput.categorie || !toolInput.montant) {
            return { success: false, error: 'Catégorie et montant requis' };
          }

          const { data, error } = await supabase
            .from('depenses')
            .insert({
              tenant_id: tenantId,
              categorie: toolInput.categorie,
              libelle: toolInput.description || toolInput.categorie,
              montant: Math.round(toolInput.montant * 100), // Convertir en centimes
              date_depense: today.toISOString().split('T')[0]
            })
            .select()
            .single();

          if (error) throw error;

          return {
            success: true,
            message: `Dépense ajoutée: ${toolInput.montant}€ (${toolInput.categorie})`,
            depense: data
          };
        }

        if (action === 'analyser' || action === 'lister') {
          const [year, month] = targetMois.split('-');
          const startDate = `${year}-${month}-01`;
          const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];

          const { data: depenses } = await supabase
            .from('depenses')
            .select('*')
            .eq('tenant_id', tenantId)
            .gte('date_depense', startDate)
            .lte('date_depense', endDate);

          // Grouper par catégorie
          const parCategorie = {};
          let total = 0;
          (depenses || []).forEach(d => {
            parCategorie[d.categorie] = (parCategorie[d.categorie] || 0) + d.montant;
            total += d.montant;
          });

          return {
            success: true,
            mois: targetMois,
            total_euros: (total / 100).toFixed(2),
            nb_depenses: depenses?.length || 0,
            par_categorie: Object.entries(parCategorie).map(([cat, montant]) => ({
              categorie: cat,
              montant_euros: (montant / 100).toFixed(2)
            })),
            depenses: depenses?.map(d => ({
              id: d.id,
              date: d.date_depense,
              categorie: d.categorie,
              libelle: d.libelle,
              montant_euros: (d.montant / 100).toFixed(2)
            }))
          };
        }

        return { success: false, error: 'Action non reconnue' };
      }

      case 'get_compte_resultat':
      case 'compte_resultat': {
        const today = new Date();
        const targetMois = toolInput.mois || `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        const [year, month] = targetMois.split('-');
        const startDate = `${year}-${month}-01`;
        const endDate = new Date(parseInt(year), parseInt(month), 0).toISOString().split('T')[0];

        // Revenus (réservations confirmées/terminées)
        const { data: reservations } = await supabase
          .from('reservations')
          .select('prix_total, prix_service, frais_deplacement, statut')
          .eq('tenant_id', tenantId)
          .gte('date', startDate)
          .lte('date', endDate)
          .in('statut', ['confirme', 'termine']);

        const revenus = (reservations || []).reduce((sum, r) => {
          return sum + getPrixReservation(r);
        }, 0);

        // Charges
        const { data: depenses } = await supabase
          .from('depenses')
          .select('categorie, montant')
          .eq('tenant_id', tenantId)
          .gte('date_depense', startDate)
          .lte('date_depense', endDate);

        const chargesParCategorie = {};
        let totalCharges = 0;
        (depenses || []).forEach(d => {
          chargesParCategorie[d.categorie] = (chargesParCategorie[d.categorie] || 0) + d.montant;
          totalCharges += d.montant;
        });

        const resultatNet = revenus - totalCharges;
        const margeNette = revenus > 0 ? ((resultatNet / revenus) * 100).toFixed(1) : 0;

        return {
          success: true,
          mois: targetMois,
          chiffre_affaires: `${(revenus / 100).toFixed(2)}€`,
          charges_totales: `${(totalCharges / 100).toFixed(2)}€`,
          resultat_net: `${(resultatNet / 100).toFixed(2)}€`,
          marge_nette: `${margeNette}%`,
          detail_charges: Object.entries(chargesParCategorie).map(([cat, montant]) => ({
            categorie: cat,
            montant_euros: (montant / 100).toFixed(2)
          })),
          nb_rdv: reservations?.length || 0,
          nb_depenses: depenses?.length || 0
        };
      }

      // ═══════════════════════════════════════════════════════════════
      // OUTILS MARKETING - Génération posts réseaux sociaux
      // ═══════════════════════════════════════════════════════════════
      case 'marketing_generer_post':
      case 'generer_post_marketing': {
        const { plateforme, occasion, tone, details } = toolInput;

        console.log(`[ADMIN CHAT] Génération post marketing - plateforme: ${plateforme}, occasion: ${occasion}`);

        // Récupérer infos tenant pour personnaliser
        const { data: tenant } = await supabase
          .from('tenants')
          .select('business_name, business_type, description')
          .eq('id', tenantId)
          .single();

        // Récupérer les services pour inspiration
        const { data: services } = await supabase
          .from('services')
          .select('nom, prix, description')
          .eq('tenant_id', tenantId)
          .eq('actif', true)
          .limit(10);

        const servicesText = services?.map(s => `- ${s.nom}: ${(s.prix/100).toFixed(0)}€`).join('\n') || '';

        // Générer le post via Claude
        const client = getAnthropicClient();
        const prompt = `Tu es expert en marketing digital et community management pour ${tenant?.business_name || 'ce salon de coiffure'}.

Génère un post ${plateforme || 'Instagram'} professionnel et engageant.

CONTEXTE :
- Business : ${tenant?.business_name || 'Salon de coiffure'}
- Type : ${tenant?.business_type || 'Coiffure'}
- Description : ${tenant?.description || 'Salon spécialisé'}
- Services proposés :
${servicesText}

DEMANDE :
- Occasion : ${occasion || 'promotion générale'}
- Ton souhaité : ${tone || 'professionnel et engageant'}
- Détails spécifiques : ${details || 'Aucun détail particulier'}

RÈGLES :
1. Le texte doit faire 150-280 caractères (adapté ${plateforme || 'Instagram'})
2. Utilise 2-4 emojis pertinents
3. Inclus un call-to-action engageant
4. Propose 5-8 hashtags pertinents

Réponds UNIQUEMENT en JSON valide (pas de markdown) :
{
  "titre": "Titre accrocheur court (optionnel, max 50 car)",
  "contenu": "Texte du post avec emojis intégrés",
  "hashtags": ["hashtag1", "hashtag2"],
  "call_to_action": "Phrase finale engageante"
}`;

        try {
          const response = await client.messages.create({
            model: MODEL,
            max_tokens: 1000,
            messages: [{ role: 'user', content: prompt }]
          });

          const responseText = response.content[0].text.trim();
          // Nettoyer le JSON (enlever ```json si présent)
          const cleanJson = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          const postJson = JSON.parse(cleanJson);

          // Construire le contenu final
          const contenuFinal = postJson.call_to_action
            ? `${postJson.contenu}\n\n${postJson.call_to_action}`
            : postJson.contenu;

          // Sauvegarder en brouillon
          const { data: savedPost, error } = await supabase
            .from('posts_marketing')
            .insert({
              tenant_id: tenantId,
              type: plateforme || 'instagram',
              titre: postJson.titre || null,
              contenu: contenuFinal,
              hashtags: postJson.hashtags || [],
              occasion: occasion || 'promo',
              tone: tone || 'professionnel',
              statut: 'brouillon'
            })
            .select()
            .single();

          if (error) throw error;

          return {
            success: true,
            message: 'Post généré et sauvegardé en brouillon',
            post: {
              id: savedPost.id,
              type: savedPost.type,
              titre: savedPost.titre,
              contenu: savedPost.contenu,
              hashtags: savedPost.hashtags,
              statut: savedPost.statut
            },
            preview: {
              texte: savedPost.contenu,
              hashtags_formatte: savedPost.hashtags?.map(h => `#${h}`).join(' ')
            }
          };
        } catch (parseError) {
          console.error('[ADMIN CHAT] Erreur parsing JSON post:', parseError);
          return {
            success: false,
            error: 'Erreur lors de la génération du post. Réessayez.'
          };
        }
      }

      case 'marketing_lister_posts':
      case 'lister_posts_marketing': {
        const { statut, type, limit: postLimit } = toolInput;

        let query = supabase
          .from('posts_marketing')
          .select('id, type, titre, contenu, hashtags, statut, occasion, created_at')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(postLimit || 10);

        if (statut) query = query.eq('statut', statut);
        if (type) query = query.eq('type', type);

        const { data: posts, error } = await query;

        if (error) throw error;

        return {
          success: true,
          posts: posts?.map(p => ({
            id: p.id,
            type: p.type,
            titre: p.titre || '(Sans titre)',
            extrait: p.contenu?.substring(0, 80) + '...',
            hashtags_count: p.hashtags?.length || 0,
            statut: p.statut,
            occasion: p.occasion,
            date: p.created_at
          })) || [],
          count: posts?.length || 0
        };
      }

      case 'marketing_publier_post': {
        const { post_id } = toolInput;

        if (!post_id) {
          return { success: false, error: 'ID du post requis' };
        }

        const { data, error } = await supabase
          .from('posts_marketing')
          .update({
            statut: 'publie',
            date_publication: new Date().toISOString()
          })
          .eq('id', post_id)
          .eq('tenant_id', tenantId)
          .select()
          .single();

        if (error) throw error;

        return {
          success: true,
          message: 'Post marqué comme publié',
          post: data
        };
      }

      // ═══════════════════════════════════════════════════════════════
      // OUTILS ANALYTICS - KPI, Prédictions & Anomalies
      // ═══════════════════════════════════════════════════════════════
      case 'analytics_kpi':
      case 'get_kpi': {
        const { analyticsService } = await import('./analyticsService.js');
        const { debut, fin } = toolInput;

        const now = new Date();
        const dateDebut = debut || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const dateFin = fin || now.toISOString().split('T')[0];

        console.log(`[ADMIN CHAT] Analytics KPI - ${dateDebut} à ${dateFin}`);

        const kpi = await analyticsService.getKPI(tenantId, dateDebut, dateFin);

        return {
          success: true,
          ...kpi
        };
      }

      case 'analytics_predictions': {
        const { analyticsService } = await import('./analyticsService.js');

        console.log(`[ADMIN CHAT] Analytics Prédictions`);

        const predictions = await analyticsService.getPredictions(tenantId);

        return {
          success: true,
          ...predictions
        };
      }

      case 'analytics_anomalies': {
        const { analyticsService } = await import('./analyticsService.js');

        console.log(`[ADMIN CHAT] Analytics Anomalies`);

        const anomalies = await analyticsService.getAnomalies(tenantId);

        return {
          success: true,
          ...anomalies
        };
      }

      case 'analytics_evolution': {
        const { analyticsService } = await import('./analyticsService.js');
        const { debut, fin, granularite } = toolInput;

        const now = new Date();
        const dateDebut = debut || new Date(now.setDate(now.getDate() - 30)).toISOString().split('T')[0];
        const dateFin = fin || new Date().toISOString().split('T')[0];

        console.log(`[ADMIN CHAT] Analytics Évolution - ${dateDebut} à ${dateFin}, ${granularite || 'jour'}`);

        const result = await analyticsService.getEvolution(tenantId, dateDebut, dateFin, granularite || 'jour');

        return {
          success: true,
          ...result,
          granularite: granularite || 'jour'
        };
      }

      case 'analytics_rapport': {
        const { analyticsService } = await import('./analyticsService.js');
        const { debut, fin } = toolInput;

        const now = new Date();
        const dateDebut = debut || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
        const dateFin = fin || now.toISOString().split('T')[0];

        console.log(`[ADMIN CHAT] Analytics Rapport complet - ${dateDebut} à ${dateFin}`);

        const rapport = await analyticsService.getRapportComplet(tenantId, dateDebut, dateFin);

        return {
          success: true,
          ...rapport
        };
      }

      case 'analytics_comparaison': {
        const { analyticsService } = await import('./analyticsService.js');
        const { debut1, fin1, debut2, fin2 } = toolInput;

        if (!debut1 || !fin1 || !debut2 || !fin2) {
          return {
            success: false,
            error: 'Paramètres requis: debut1, fin1, debut2, fin2'
          };
        }

        console.log(`[ADMIN CHAT] Analytics Comparaison - ${debut1}/${fin1} vs ${debut2}/${fin2}`);

        const [kpi1, kpi2] = await Promise.all([
          analyticsService.getKPI(tenantId, debut1, fin1),
          analyticsService.getKPI(tenantId, debut2, fin2)
        ]);

        const diffCA = parseFloat(kpi2.revenus.ca_total_euros) - parseFloat(kpi1.revenus.ca_total_euros);
        const diffRDV = kpi2.rdv.confirmes - kpi1.rdv.confirmes;

        return {
          success: true,
          periode_1: { debut: debut1, fin: fin1, ...kpi1 },
          periode_2: { debut: debut2, fin: fin2, ...kpi2 },
          differences: {
            ca_euros: diffCA.toFixed(2),
            ca_pourcent: parseFloat(kpi1.revenus.ca_total_euros) > 0
              ? ((diffCA / parseFloat(kpi1.revenus.ca_total_euros)) * 100).toFixed(1)
              : '0',
            rdv: diffRDV
          }
        };
      }

      // ═══════════════════════════════════════════════════════════════
      // OUTILS COMMERCIAL - Détection inactifs & Relances
      // ═══════════════════════════════════════════════════════════════
      case 'commercial_detecter_inactifs': {
        const periode = toolInput.periode || 3; // mois par défaut

        console.log(`[ADMIN CHAT] Détection clients inactifs - période: ${periode} mois`);

        // Récupérer tous les clients avec leurs réservations
        const { data: clients, error } = await supabase
          .from('clients')
          .select(`
            id, nom, prenom, email, telephone, created_at,
            reservations(id, date, statut, prix_total, prix_service, frais_deplacement, service_nom)
          `)
          .eq('tenant_id', tenantId);

        if (error) throw error;

        const dateLimit = new Date();
        dateLimit.setMonth(dateLimit.getMonth() - parseInt(periode));

        const clientsInactifs = [];

        for (const client of clients || []) {
          const rdvs = (client.reservations || []).filter(r =>
            r.statut === 'confirme' || r.statut === 'termine'
          );

          if (rdvs.length === 0) continue;

          rdvs.sort((a, b) => new Date(b.date) - new Date(a.date));
          const dernierRdv = rdvs[0];
          const dateDernierRdv = new Date(dernierRdv.date);

          if (dateDernierRdv < dateLimit) {
            const joursInactivite = Math.floor((Date.now() - dateDernierRdv.getTime()) / (1000 * 60 * 60 * 24));
            const moisInactivite = Math.floor(joursInactivite / 30);
            const caTotal = rdvs.reduce((sum, r) => sum + getPrixReservation(r), 0);

            // Scoring
            let score = 0;
            const moisDepuisPremier = Math.max(1, moisInactivite + 3);
            const frequence = rdvs.length / moisDepuisPremier;
            if (frequence >= 1) score += 10;
            else if (frequence >= 0.33) score += 5;
            else score += 2;

            if (caTotal >= 50000) score += 10;
            else if (caTotal >= 20000) score += 5;
            else score += 2;

            const premierRdv = new Date(rdvs[rdvs.length - 1].date);
            const anciennete = Math.floor((Date.now() - premierRdv.getTime()) / (1000 * 60 * 60 * 24 * 30));
            if (anciennete >= 24) score += 10;
            else if (anciennete >= 6) score += 5;
            else score += 2;

            let segment = 'standard';
            if (score >= 20) segment = 'vip';
            else if (score >= 10) segment = 'fidele';

            let niveauInactivite = 'leger';
            let offreSuggeree = 5;
            if (moisInactivite >= 12) { niveauInactivite = 'fort'; offreSuggeree = 20; }
            else if (moisInactivite >= 6) { niveauInactivite = 'moyen'; offreSuggeree = 10; }

            // Service préféré
            const servicesFreq = {};
            rdvs.forEach(r => {
              const svc = r.service_nom || 'Service';
              servicesFreq[svc] = (servicesFreq[svc] || 0) + 1;
            });
            const servicePrefere = Object.entries(servicesFreq).sort((a, b) => b[1] - a[1])[0]?.[0];

            clientsInactifs.push({
              id: client.id,
              nom: client.nom,
              prenom: client.prenom,
              email: client.email,
              telephone: client.telephone,
              dernier_rdv: dernierRdv.date,
              mois_inactivite: moisInactivite,
              niveau_inactivite: niveauInactivite,
              nb_rdv_total: rdvs.length,
              ca_total_euros: (caTotal / 100).toFixed(2),
              score,
              segment,
              service_prefere: servicePrefere,
              offre_suggeree: offreSuggeree
            });
          }
        }

        clientsInactifs.sort((a, b) => b.score - a.score);

        return {
          success: true,
          periode_mois: periode,
          nb_clients_inactifs: clientsInactifs.length,
          segments: {
            vip: clientsInactifs.filter(c => c.segment === 'vip').length,
            fidele: clientsInactifs.filter(c => c.segment === 'fidele').length,
            standard: clientsInactifs.filter(c => c.segment === 'standard').length
          },
          clients_prioritaires: clientsInactifs.slice(0, 10),
          message: `${clientsInactifs.length} clients inactifs depuis ${periode}+ mois`
        };
      }

      case 'commercial_generer_relance': {
        const { client_id, segment, offre, canal, details } = toolInput;

        console.log(`[ADMIN CHAT] Génération relance - client: ${client_id}, segment: ${segment}`);

        // Récupérer infos client
        let clientInfo = toolInput.client;
        if (!clientInfo && client_id) {
          const { data } = await supabase
            .from('clients')
            .select(`
              id, nom, prenom, email, telephone,
              reservations(date, service_nom, statut)
            `)
            .eq('id', client_id)
            .eq('tenant_id', tenantId)
            .single();

          if (data) {
            const rdvs = (data.reservations || []).filter(r => r.statut === 'confirme' || r.statut === 'termine');
            rdvs.sort((a, b) => new Date(b.date) - new Date(a.date));
            const servicesFreq = {};
            rdvs.forEach(r => {
              const svc = r.service_nom || 'Service';
              servicesFreq[svc] = (servicesFreq[svc] || 0) + 1;
            });

            clientInfo = {
              nom: data.nom,
              prenom: data.prenom,
              email: data.email,
              telephone: data.telephone,
              service_prefere: Object.entries(servicesFreq).sort((a, b) => b[1] - a[1])[0]?.[0] || 'coiffure',
              mois_inactivite: rdvs[0] ? Math.floor((Date.now() - new Date(rdvs[0].date).getTime()) / (1000 * 60 * 60 * 24 * 30)) : 0
            };
          }
        }

        if (!clientInfo) {
          return { success: false, error: 'Informations client requises (client_id ou client)' };
        }

        // Récupérer infos tenant
        const { data: tenant } = await supabase
          .from('tenants')
          .select('business_name')
          .eq('id', tenantId)
          .single();

        // Générer message personnalisé
        const canalChoisi = canal || 'email';
        const client = getAnthropicClient();
        const prompt = `Tu es expert en relance client pour ${tenant?.business_name || 'ce salon de coiffure'}.

Génère un message de relance ${canalChoisi} personnalisé.

CLIENT :
- Nom : ${clientInfo.prenom} ${clientInfo.nom}
- Segment : ${segment || 'standard'} (VIP = très fidèle, Fidèle = régulier, Standard = occasionnel)
- Dernier RDV : Il y a ${clientInfo.mois_inactivite || 'plusieurs'} mois
- Service préféré : ${clientInfo.service_prefere || 'coiffure'}

OFFRE : ${offre || 10}% de réduction

DÉTAILS SUPPLÉMENTAIRES : ${details || 'Aucun'}

RÈGLES :
1. Ton chaleureux et personnalisé (utilise le prénom)
2. Non insistant, bienveillant
3. Longueur : ${canalChoisi === 'sms' ? '40-60 mots' : '80-120 mots'}
4. Mentionner le service préféré si pertinent
5. Call-to-action clair

Réponds UNIQUEMENT en JSON valide :
{
  "objet": "Objet accrocheur (si email)",
  "message": "Texte personnalisé avec prénom",
  "call_to_action": "Phrase finale engageante"
}`;

        try {
          const response = await client.messages.create({
            model: MODEL,
            max_tokens: 800,
            messages: [{ role: 'user', content: prompt }]
          });

          const responseText = response.content[0].text.trim();
          const cleanJson = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          const relanceJson = JSON.parse(cleanJson);

          // Sauvegarder campagne
          const messageComplet = relanceJson.call_to_action
            ? `${relanceJson.message}\n\n${relanceJson.call_to_action}`
            : relanceJson.message;

          const { data: campagne, error } = await supabase
            .from('campagnes_relance')
            .insert({
              tenant_id: tenantId,
              titre: `Relance ${clientInfo.prenom} ${clientInfo.nom}`,
              type_campagne: 'inactifs',
              canal: canalChoisi,
              objet: relanceJson.objet || null,
              message: messageComplet,
              offre_type: 'reduction_pourcentage',
              offre_valeur: offre || 10,
              segment_cible: segment || 'standard',
              nb_cibles: 1,
              statut: 'brouillon'
            })
            .select()
            .single();

          if (error) throw error;

          return {
            success: true,
            message: 'Message de relance généré et sauvegardé',
            campagne_id: campagne.id,
            canal: canalChoisi,
            client: `${clientInfo.prenom} ${clientInfo.nom}`,
            preview: {
              objet: relanceJson.objet,
              message: messageComplet
            }
          };
        } catch (parseError) {
          console.error('[ADMIN CHAT] Erreur génération relance:', parseError);
          return { success: false, error: 'Erreur lors de la génération. Réessayez.' };
        }
      }

      case 'commercial_stats_relances':
      case 'commercial_stats': {
        const { data: campagnes } = await supabase
          .from('campagnes_relance')
          .select('*')
          .eq('tenant_id', tenantId);

        const stats = {
          total_campagnes: campagnes?.length || 0,
          total_envoyes: 0,
          total_conversions: 0,
          taux_conversion: '0%',
          par_statut: {},
          par_canal: {}
        };

        (campagnes || []).forEach(c => {
          stats.total_envoyes += c.nb_envoyes || 0;
          stats.total_conversions += c.nb_conversions || 0;
          stats.par_statut[c.statut] = (stats.par_statut[c.statut] || 0) + 1;
          stats.par_canal[c.canal] = (stats.par_canal[c.canal] || 0) + 1;
        });

        if (stats.total_envoyes > 0) {
          stats.taux_conversion = ((stats.total_conversions / stats.total_envoyes) * 100).toFixed(1) + '%';
        }

        return {
          success: true,
          stats
        };
      }

      case 'commercial_lister_campagnes': {
        const { statut, limit: campLimit } = toolInput;

        let query = supabase
          .from('campagnes_relance')
          .select('id, titre, type_campagne, canal, statut, segment_cible, nb_cibles, nb_envoyes, nb_conversions, created_at')
          .eq('tenant_id', tenantId)
          .order('created_at', { ascending: false })
          .limit(campLimit || 10);

        if (statut) query = query.eq('statut', statut);

        const { data: campagnes, error } = await query;

        if (error) throw error;

        return {
          success: true,
          campagnes: campagnes?.map(c => ({
            id: c.id,
            titre: c.titre,
            type: c.type_campagne,
            canal: c.canal,
            statut: c.statut,
            segment: c.segment_cible,
            nb_cibles: c.nb_cibles,
            nb_envoyes: c.nb_envoyes,
            nb_conversions: c.nb_conversions,
            date: c.created_at
          })) || [],
          count: campagnes?.length || 0
        };
      }

      // ═══════════════════════════════════════════════════════════════
      // OUTILS RH - Ressources Humaines
      // ═══════════════════════════════════════════════════════════════
      case 'rh_liste_equipe': {
        const { actif, role } = toolInput;

        let query = supabase
          .from('equipe')
          .select('*')
          .eq('tenant_id', tenantId)
          .order('prenom', { ascending: true });

        if (actif !== undefined) {
          query = query.eq('actif', actif);
        }
        if (role) {
          query = query.eq('role', role);
        }

        const { data: equipe, error } = await query;
        if (error) throw error;

        return {
          success: true,
          effectif: equipe?.length || 0,
          equipe: (equipe || []).map(m => ({
            id: m.id,
            nom: `${m.prenom} ${m.nom}`,
            role: m.role,
            type_contrat: m.type_contrat,
            heures_semaine: m.heures_semaine,
            date_embauche: m.date_embauche,
            actif: m.actif,
            email: m.email,
            telephone: m.telephone
          }))
        };
      }

      case 'rh_heures_mois': {
        const { membre_id, mois } = toolInput;

        // Période (mois courant par défaut)
        const now = new Date();
        const targetMonth = mois || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const [year, month] = targetMonth.split('-').map(Number);
        const startOfMonth = new Date(year, month - 1, 1);
        const endOfMonth = new Date(year, month, 0);
        const dateDebut = startOfMonth.toISOString().split('T')[0];
        const dateFin = endOfMonth.toISOString().split('T')[0];

        let query = supabase
          .from('pointages')
          .select('*, equipe(id, prenom, nom, heures_semaine)')
          .eq('tenant_id', tenantId)
          .gte('date_pointage', dateDebut)
          .lte('date_pointage', dateFin);

        if (membre_id) {
          query = query.eq('membre_id', membre_id);
        }

        const { data: pointages, error } = await query;
        if (error) throw error;

        // Grouper par membre
        const parMembre = {};
        (pointages || []).forEach(p => {
          const membreId = p.membre_id;
          if (!parMembre[membreId]) {
            parMembre[membreId] = {
              nom: p.equipe ? `${p.equipe.prenom} ${p.equipe.nom}` : 'Inconnu',
              heures_semaine: p.equipe?.heures_semaine || 35,
              heures_travaillees: 0,
              heures_supplementaires: 0,
              nb_jours: 0
            };
          }
          parMembre[membreId].heures_travaillees += p.heures_travaillees || 0;
          parMembre[membreId].heures_supplementaires += p.heures_supplementaires || 0;
          parMembre[membreId].nb_jours += 1;
        });

        // Calculer heures attendues et écart
        const nbSemaines = Math.ceil(endOfMonth.getDate() / 7);
        const membres = Object.entries(parMembre).map(([id, data]) => {
          const heuresAttendues = data.heures_semaine * nbSemaines;
          return {
            membre_id: id,
            nom: data.nom,
            heures_travaillees: Math.round(data.heures_travaillees * 10) / 10,
            heures_supplementaires: Math.round(data.heures_supplementaires * 10) / 10,
            heures_attendues: heuresAttendues,
            ecart: Math.round((data.heures_travaillees - heuresAttendues) * 10) / 10,
            nb_jours_pointes: data.nb_jours
          };
        });

        const totalHeures = membres.reduce((sum, m) => sum + m.heures_travaillees, 0);
        const totalSupp = membres.reduce((sum, m) => sum + m.heures_supplementaires, 0);

        return {
          success: true,
          mois: targetMonth,
          total_heures_travaillees: Math.round(totalHeures * 10) / 10,
          total_heures_supplementaires: Math.round(totalSupp * 10) / 10,
          membres,
          nb_pointages: pointages?.length || 0
        };
      }

      case 'rh_absences': {
        const { action = 'lister', membre_id, statut, type_absence, date_debut, date_fin, absence_id, motif, commentaire_refus } = toolInput;

        if (action === 'creer') {
          // Créer une absence
          if (!membre_id || !date_debut || !date_fin || !type_absence) {
            return { success: false, error: 'membre_id, date_debut, date_fin et type_absence sont requis' };
          }

          const { data: newAbsence, error } = await supabase
            .from('absences')
            .insert({
              tenant_id: tenantId,
              membre_id,
              date_debut,
              date_fin,
              type_absence,
              motif: motif || null,
              statut: 'en_attente'
            })
            .select('*, equipe(prenom, nom)')
            .single();

          if (error) throw error;

          return {
            success: true,
            message: 'Absence créée',
            absence: {
              id: newAbsence.id,
              membre: newAbsence.equipe ? `${newAbsence.equipe.prenom} ${newAbsence.equipe.nom}` : 'Inconnu',
              type: newAbsence.type_absence,
              debut: newAbsence.date_debut,
              fin: newAbsence.date_fin,
              nb_jours: newAbsence.nb_jours,
              statut: newAbsence.statut
            }
          };
        }

        if (action === 'valider' || action === 'refuser') {
          if (!absence_id) {
            return { success: false, error: 'absence_id est requis pour valider/refuser' };
          }

          const updates = {
            statut: action === 'valider' ? 'approuve' : 'refuse',
            date_validation: new Date().toISOString()
          };
          if (action === 'refuser' && commentaire_refus) {
            updates.commentaire_refus = commentaire_refus;
          }

          const { data: updated, error } = await supabase
            .from('absences')
            .update(updates)
            .eq('id', absence_id)
            .eq('tenant_id', tenantId)
            .select('*, equipe(prenom, nom)')
            .single();

          if (error) throw error;

          return {
            success: true,
            message: action === 'valider' ? 'Absence approuvée' : 'Absence refusée',
            absence: {
              id: updated.id,
              membre: updated.equipe ? `${updated.equipe.prenom} ${updated.equipe.nom}` : 'Inconnu',
              type: updated.type_absence,
              debut: updated.date_debut,
              fin: updated.date_fin,
              statut: updated.statut
            }
          };
        }

        // Lister les absences
        let query = supabase
          .from('absences')
          .select('*, equipe(id, prenom, nom, role)')
          .eq('tenant_id', tenantId)
          .order('date_debut', { ascending: false });

        if (membre_id) query = query.eq('membre_id', membre_id);
        if (statut && statut !== 'tous') query = query.eq('statut', statut);
        if (type_absence) query = query.eq('type_absence', type_absence);
        if (date_debut) query = query.gte('date_debut', date_debut);
        if (date_fin) query = query.lte('date_fin', date_fin);

        const { data: absences, error } = await query.limit(50);
        if (error) throw error;

        // Compter par type et statut
        const parType = {};
        const parStatut = {};
        (absences || []).forEach(a => {
          parType[a.type_absence] = (parType[a.type_absence] || 0) + (a.nb_jours || 0);
          parStatut[a.statut] = (parStatut[a.statut] || 0) + 1;
        });

        return {
          success: true,
          nb_absences: absences?.length || 0,
          jours_par_type: parType,
          par_statut: parStatut,
          absences: (absences || []).map(a => ({
            id: a.id,
            membre: a.equipe ? `${a.equipe.prenom} ${a.equipe.nom}` : 'Inconnu',
            role: a.equipe?.role,
            type: a.type_absence,
            debut: a.date_debut,
            fin: a.date_fin,
            nb_jours: a.nb_jours,
            statut: a.statut,
            motif: a.motif
          }))
        };
      }

      case 'rh_stats': {
        const { mois } = toolInput;

        // Période (mois courant par défaut)
        const now = new Date();
        const targetMonth = mois || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const [year, month] = targetMonth.split('-').map(Number);
        const startOfMonth = new Date(year, month - 1, 1);
        const endOfMonth = new Date(year, month, 0);
        const dateDebut = startOfMonth.toISOString().split('T')[0];
        const dateFin = endOfMonth.toISOString().split('T')[0];

        // Équipe active
        const { data: equipe } = await supabase
          .from('equipe')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('actif', true);

        // Absences approuvées du mois
        const { data: absences } = await supabase
          .from('absences')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('statut', 'approuve')
          .gte('date_debut', dateDebut)
          .lte('date_fin', dateFin);

        // Pointages du mois
        const { data: pointages } = await supabase
          .from('pointages')
          .select('*')
          .eq('tenant_id', tenantId)
          .gte('date_pointage', dateDebut)
          .lte('date_pointage', dateFin);

        // Absences en attente
        const { data: absencesEnAttente } = await supabase
          .from('absences')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('statut', 'en_attente');

        // Calculs
        const totalHeures = (pointages || []).reduce((sum, p) => sum + (p.heures_travaillees || 0), 0);
        const totalSupp = (pointages || []).reduce((sum, p) => sum + (p.heures_supplementaires || 0), 0);
        const joursAbsence = (absences || []).reduce((sum, a) => sum + (a.nb_jours || 0), 0);

        // Par type d'absence
        const absencesParType = {};
        (absences || []).forEach(a => {
          absencesParType[a.type_absence] = (absencesParType[a.type_absence] || 0) + (a.nb_jours || 0);
        });

        return {
          success: true,
          mois: targetMonth,
          stats: {
            effectif_actif: equipe?.length || 0,
            heures_travaillees_total: Math.round(totalHeures * 10) / 10,
            heures_supplementaires_total: Math.round(totalSupp * 10) / 10,
            jours_absence_total: joursAbsence,
            absences_par_type: absencesParType,
            absences_en_attente: absencesEnAttente?.length || 0,
            nb_pointages_mois: pointages?.length || 0
          }
        };
      }

      // ═══════════════════════════════════════════════════════════════
      // OUTILS PRO - Capabilities avancées (Pro/Business uniquement)
      // ═══════════════════════════════════════════════════════════════
      case 'executeAdvancedQuery': {
        console.log(`[ADMIN CHAT] executeAdvancedQuery - tenant: ${tenantId}`);
        const result = await executeAdvancedQuery({
          query_description: toolInput.query_description,
          tenant_id: tenantId
        });
        return result;
      }

      case 'createAutomation': {
        console.log(`[ADMIN CHAT] createAutomation - tenant: ${tenantId}`);
        const result = await createAutomation({
          automation_description: toolInput.automation_description,
          tenant_id: tenantId
        });
        return result;
      }

      case 'scheduleTask': {
        console.log(`[ADMIN CHAT] scheduleTask - tenant: ${tenantId}`);
        const result = await scheduleTask({
          task_description: toolInput.task_description,
          tenant_id: tenantId
        });
        return result;
      }

      case 'analyzePattern': {
        console.log(`[ADMIN CHAT] analyzePattern - tenant: ${tenantId}`);
        const result = await analyzePattern({
          question: toolInput.question,
          tenant_id: tenantId
        });
        return result;
      }

      // ═══════════════════════════════════════════════════════════════
      // OUTILS NON IMPLÉMENTÉS - Retourner message informatif
      // ═══════════════════════════════════════════════════════════════
      default:
        console.log(`[ADMIN CHAT] Outil non implémenté: ${toolName}`, toolInput);

        // Pour les outils courants non implémentés, retourner un message utile
        if (toolName.includes('client') || toolName.includes('top') || toolName.includes('best')) {
          // Fallback: retourner les stats clients
          const { data: clients } = await supabase
            .from('clients')
            .select(`
              id, prenom, nom, telephone,
              reservations:reservations(prix_total, prix_service, frais_deplacement, statut)
            `)
            .eq('tenant_id', tenantId)
            .limit(50);

          const clientsWithCA = (clients || []).map(c => {
            const facturable = c.reservations?.filter(r => r.statut === 'confirme' || r.statut === 'termine') || [];
            const ca = facturable.reduce((sum, r) => sum + getPrixReservation(r), 0);
            return {
              nom: `${c.prenom} ${c.nom}`,
              telephone: c.telephone,
              nb_rdv: c.reservations?.length || 0,
              ca_total: `${(ca / 100).toFixed(2)}€`,
              ca_raw: ca
            };
          });
          clientsWithCA.sort((a, b) => b.ca_raw - a.ca_raw);

          return {
            success: true,
            note: `Outil ${toolName} non disponible, voici les meilleurs clients`,
            top_clients: clientsWithCA.slice(0, 10)
          };
        }

        return {
          success: false,
          error: `L'outil "${toolName}" n'est pas encore implémenté. Outils disponibles: get_stats, get_rdv, get_client_info, search_clients, get_services.`
        };
    }
  } catch (error) {
    console.error(`[ADMIN CHAT] Erreur outil ${toolName}:`, error);
    return {
      success: false,
      error: `Erreur lors de l'exécution de ${toolName}: ${error.message}`
    };
  }
}

/**
 * Chat avec streaming SSE et exécution des outils
 */
export async function chatStream(tenantId, messages, res, conversationId) {
  console.log(`[ADMIN CHAT] ========== DEBUT CHAT STREAM ==========`);
  console.log(`[ADMIN CHAT] TenantId reçu: "${tenantId}" (type: ${typeof tenantId})`);

  const client = getAnthropicClient();
  const tenant = await getTenant(tenantId);
  console.log(`[ADMIN CHAT] Tenant récupéré:`, tenant?.business_name || 'NON TROUVÉ');

  // Récupérer les outils disponibles selon le plan du tenant
  const tenantPlan = tenant?.subscription_plan || 'starter';
  const availableTools = getToolsForPlan(tenantPlan);
  console.log(`[ADMIN CHAT] Plan: ${tenantPlan}, Outils disponibles: ${availableTools.length}`);

  // Headers SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');

  // Formater les messages pour Anthropic
  let conversationMessages = messages.map(m => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.content,
  }));

  let fullResponse = '';
  let iterations = 0;

  try {
    console.log(`[ADMIN CHAT] Stream démarré - Tenant: ${tenantId}, Conv: ${conversationId}`);

    // Boucle pour gérer les outils
    while (iterations < MAX_TOOL_ITERATIONS) {
      iterations++;
      console.log(`[ADMIN CHAT] Itération ${iterations}`);

      // Appel Claude (non-streaming pour la boucle d'outils)
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: buildSystemPrompt(tenant),
        messages: conversationMessages,
        tools: availableTools,
      });

      console.log(`[ADMIN CHAT] Stop reason: ${response.stop_reason}`);

      // Extraire le texte de la réponse
      const textBlocks = response.content.filter(b => b.type === 'text');
      const toolBlocks = response.content.filter(b => b.type === 'tool_use');

      // Envoyer le texte au client
      for (const block of textBlocks) {
        fullResponse += block.text;
        res.write(`data: ${JSON.stringify({ type: 'text', content: block.text })}\n\n`);
      }

      // Si pas d'outils, on a terminé
      if (response.stop_reason !== 'tool_use' || toolBlocks.length === 0) {
        console.log(`[ADMIN CHAT] Terminé (pas d'outils)`);
        break;
      }

      // Exécuter les outils
      console.log(`[ADMIN CHAT] ${toolBlocks.length} outil(s) à exécuter`);

      // Informer le client
      for (const tool of toolBlocks) {
        res.write(`data: ${JSON.stringify({ type: 'tool_start', tool: tool.name })}\n\n`);
      }

      // Ajouter la réponse de l'assistant aux messages
      conversationMessages.push({
        role: 'assistant',
        content: response.content
      });

      // Exécuter chaque outil et collecter les résultats
      const toolResults = [];
      for (const tool of toolBlocks) {
        const result = await executeTool(tool.name, tool.input, tenantId);
        console.log(`[ADMIN CHAT] Résultat ${tool.name}:`, result.success);

        toolResults.push({
          type: 'tool_result',
          tool_use_id: tool.id,
          content: JSON.stringify(result)
        });

        res.write(`data: ${JSON.stringify({ type: 'tool_complete', tool: tool.name, success: result.success })}\n\n`);
      }

      // Ajouter les résultats des outils aux messages
      conversationMessages.push({
        role: 'user',
        content: toolResults
      });
    }

    // Sauvegarder la réponse en BDD
    if (conversationId && fullResponse) {
      await saveMessage(conversationId, 'assistant', fullResponse);
    }

    res.write(`data: ${JSON.stringify({ type: 'done', stop_reason: 'end_turn' })}\n\n`);
    res.end();

  } catch (error) {
    console.error('[ADMIN CHAT] Erreur chatStream:', error);
    res.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
    res.end();
  }
}

/**
 * Chat sans streaming (fallback)
 */
export async function chat(tenantId, messages) {
  const client = getAnthropicClient();
  const tenant = await getTenant(tenantId);

  // Récupérer les outils disponibles selon le plan du tenant
  const tenantPlan = tenant?.subscription_plan || 'starter';
  const availableTools = getToolsForPlan(tenantPlan);

  let conversationMessages = messages.map(m => ({
    role: m.role === 'user' ? 'user' : 'assistant',
    content: m.content,
  }));

  let fullResponse = '';
  let iterations = 0;

  try {
    while (iterations < MAX_TOOL_ITERATIONS) {
      iterations++;

      const response = await client.messages.create({
        model: MODEL,
        max_tokens: MAX_TOKENS,
        system: buildSystemPrompt(tenant),
        messages: conversationMessages,
        tools: availableTools,
      });

      // Extraire le texte
      const textBlocks = response.content.filter(b => b.type === 'text');
      const toolBlocks = response.content.filter(b => b.type === 'tool_use');

      for (const block of textBlocks) {
        fullResponse += block.text;
      }

      if (response.stop_reason !== 'tool_use' || toolBlocks.length === 0) {
        break;
      }

      // Ajouter réponse assistant
      conversationMessages.push({
        role: 'assistant',
        content: response.content
      });

      // Exécuter outils
      const toolResults = [];
      for (const tool of toolBlocks) {
        const result = await executeTool(tool.name, tool.input, tenantId);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: tool.id,
          content: JSON.stringify(result)
        });
      }

      conversationMessages.push({
        role: 'user',
        content: toolResults
      });
    }

    return {
      success: true,
      response: fullResponse,
    };
  } catch (error) {
    console.error('[ADMIN CHAT] Erreur chat:', error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Sauvegarder un message en BDD
 */
export async function saveMessage(conversationId, role, content, toolUse = null) {
  try {
    const { data, error } = await supabase
      .from('admin_messages')
      .insert({
        conversation_id: conversationId,
        role,
        content,
        tool_use: toolUse,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[ADMIN CHAT] Erreur saveMessage:', error);
    return null;
  }
}

/**
 * Récupérer les messages d'une conversation
 */
export async function getMessages(conversationId) {
  try {
    const { data, error } = await supabase
      .from('admin_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('[ADMIN CHAT] Erreur getMessages:', error);
    return [];
  }
}

/**
 * Créer une nouvelle conversation
 */
export async function createConversation(tenantId, adminId, title = 'Nouvelle conversation') {
  try {
    const { data, error } = await supabase
      .from('admin_conversations')
      .insert({
        tenant_id: tenantId,
        admin_id: adminId,
        title,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[ADMIN CHAT] Erreur createConversation:', error);
    return null;
  }
}

/**
 * Récupérer les conversations d'un tenant/admin
 */
export async function getConversations(tenantId, adminId) {
  try {
    const { data, error } = await supabase
      .from('admin_conversations')
      .select('*, admin_messages(count)')
      .eq('tenant_id', tenantId)
      .eq('admin_id', adminId)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('[ADMIN CHAT] Erreur getConversations:', error);
    return [];
  }
}

/**
 * Mettre à jour le titre d'une conversation
 */
export async function updateConversation(conversationId, updates) {
  try {
    const { data, error } = await supabase
      .from('admin_conversations')
      .update(updates)
      .eq('id', conversationId)
      .select()
      .single();

    if (error) throw error;
    return data;
  } catch (error) {
    console.error('[ADMIN CHAT] Erreur updateConversation:', error);
    return null;
  }
}

/**
 * Supprimer une conversation
 */
export async function deleteConversation(conversationId) {
  try {
    const { error } = await supabase
      .from('admin_conversations')
      .delete()
      .eq('id', conversationId);

    if (error) throw error;
    return true;
  } catch (error) {
    console.error('[ADMIN CHAT] Erreur deleteConversation:', error);
    return false;
  }
}

/**
 * Vérifier ownership d'une conversation
 */
export async function verifyConversationOwnership(conversationId, tenantId, adminId) {
  try {
    const { data, error } = await supabase
      .from('admin_conversations')
      .select('id')
      .eq('id', conversationId)
      .eq('tenant_id', tenantId)
      .eq('admin_id', adminId)
      .single();

    if (error || !data) return false;
    return true;
  } catch {
    return false;
  }
}

export default {
  getTenant,
  buildSystemPrompt,
  chatStream,
  chat,
  saveMessage,
  getMessages,
  createConversation,
  getConversations,
  updateConversation,
  deleteConversation,
  verifyConversationOwnership,
};
