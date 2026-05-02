/**
 * ╔═══════════════════════════════════════════════════════════════════╗
 * ║   ROUTES ADMIN FORFAITS - Contrats recurrents Security           ║
 * ║   CRUD + periodes + affectations bulk + executer + cloturer      ║
 * ╚═══════════════════════════════════════════════════════════════════╝
 */

import express from 'express';
import { z } from 'zod';
import { supabase } from '../config/supabase.js';
import { authenticateAdmin } from './adminAuth.js';
import { requireModule } from '../middleware/moduleProtection.js';
import { validate } from '../middleware/validate.js';
import { generateNumeroFacture } from './factures.js';
import { sendEmail } from '../services/emailService.js';
import { checkMemberMultiDayConflicts } from '../utils/conflictChecker.js';

const router = express.Router();
router.use(authenticateAdmin, requireModule('devis'));

// ============================================
// SCHEMAS
// ============================================

const createForfaitSchema = z.object({
  nom: z.string().min(1).max(300),
  client_id: z.number().int().optional().nullable(),
  client_nom: z.string().max(200).optional().nullable(),
  date_debut: z.string().min(10),
  date_fin: z.string().min(10),
  montant_mensuel_ht: z.number().int().min(0),
  taux_tva: z.number().min(0).max(100).optional(),
  notes: z.string().max(2000).optional().nullable(),
  numero_commande: z.string().max(100).optional().nullable(),
  devis_id: z.number().int().optional().nullable(),
  postes: z.array(z.object({
    service_id: z.number().int().optional().nullable(),
    service_nom: z.string().min(1).max(300),
    effectif: z.number().int().min(1),
    jours: z.array(z.boolean()).length(7),
    heure_debut: z.string().min(5).max(5),
    heure_fin: z.string().min(5).max(5),
    taux_horaire: z.number().int().min(0),
    cout_mensuel_ht: z.number().int().optional(),
  })).min(1),
}).passthrough();

const affectationBulkSchema = z.object({
  mode: z.enum(['jour', 'semaine', 'mois', 'trimestre', 'annee']),
  membre_id: z.number().int().min(0), // 0 = effacer les affectations
  poste_id: z.number().int(),
  scope: z.object({
    date: z.string().optional(),
    semaine_debut: z.string().optional(),
    mois: z.string().optional(),
    clear_membre_id: z.number().int().optional(), // pour retirer un agent specifique
  }).optional().default({}),
}).passthrough();

// ============================================
// HELPERS
// ============================================

async function generateNumeroForfait(tenantId) {
  const year = new Date().getFullYear();
  const prefix = tenantId.substring(0, 3).toUpperCase();

  const { data: last } = await supabase
    .from('forfaits')
    .select('numero')
    .eq('tenant_id', tenantId)
    .like('numero', `FOR-${prefix}-${year}-%`)
    .order('numero', { ascending: false })
    .limit(1)
    .single();

  let sequence = 1;
  if (last?.numero) {
    const match = last.numero.match(/-(\d+)$/);
    if (match) sequence = parseInt(match[1], 10) + 1;
  }

  return `FOR-${prefix}-${year}-${String(sequence).padStart(4, '0')}`;
}

/** Formate une Date locale en YYYY-MM-DD (sans conversion UTC) */
function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Genere les periodes mensuelles entre date_debut et date_fin, avec prorata pour mois incomplets */
function genererPeriodes(dateDebut, dateFin) {
  const periodes = [];
  // Parser en local (pas UTC) pour eviter les decalages de timezone
  const [sy, sm, sd] = dateDebut.split('-').map(Number);
  const [ey, em, ed] = dateFin.split('-').map(Number);
  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);

  let current = new Date(start);
  while (current <= end) {
    const year = current.getFullYear();
    const month = current.getMonth();
    const mois = `${year}-${String(month + 1).padStart(2, '0')}`;

    const premierDuMois = new Date(year, month, 1);
    const pDebut = premierDuMois < start ? start : premierDuMois;
    // Dernier jour reel du mois (28/29/30/31)
    const dernierDuMois = new Date(year, month + 1, 0);
    const pFin = dernierDuMois > end ? end : dernierDuMois;

    // Prorata : jours calendaires de la periode / jours calendaires du mois complet
    const joursComplets = dernierDuMois.getDate(); // nb jours du mois (28/29/30/31)
    const joursPeriode = Math.round((pFin - pDebut) / 86400000) + 1; // +1 car inclusif
    const prorata = joursPeriode / joursComplets; // 1.0 = mois complet

    periodes.push({
      mois,
      date_debut: fmtDate(pDebut),
      date_fin: fmtDate(pFin),
      prorata, // ratio 0..1
    });

    // Mois suivant
    current = new Date(year, month + 1, 1);
  }

  return periodes;
}

/** Jours travailles pour un poste dans une plage */
function joursTravailes(posteJours, dateDebut, dateFin) {
  const dates = [];
  const [sy, sm, sd] = dateDebut.split('-').map(Number);
  const [ey, em, ed] = dateFin.split('-').map(Number);
  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    const joursIndex = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    if (posteJours[joursIndex]) {
      dates.push(fmtDate(d));
    }
  }
  return dates;
}

// ============================================
// ROUTES
// ============================================

// GET / — Liste des forfaits
router.get('/', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { statut, client_id } = req.query;

    let query = supabase
      .from('forfaits')
      .select(`
        *,
        forfait_postes (id, service_nom, effectif, heure_debut, heure_fin),
        forfait_periodes (id, mois, statut)
      `)
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: false });

    if (statut) query = query.eq('statut', statut);
    if (client_id) query = query.eq('client_id', parseInt(client_id));

    const { data: forfaits, error } = await query;
    if (error) throw error;

    // Enrichir avec stats periodes
    const enriched = (forfaits || []).map(f => {
      const periodes = f.forfait_periodes || [];
      return {
        ...f,
        postes: f.forfait_postes,
        stats: {
          total_periodes: periodes.length,
          periodes_cloturees: periodes.filter(p => p.statut === 'cloture').length,
          periodes_planifiees: periodes.filter(p => p.statut === 'planifie').length,
          periodes_en_cours: periodes.filter(p => p.statut === 'en_cours').length,
        },
        forfait_postes: undefined,
        forfait_periodes: undefined,
      };
    });

    res.json({ success: true, forfaits: enriched });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST / — Creer un forfait (immuable ensuite)
router.post('/', validate(createForfaitSchema), async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { nom, client_id, client_nom, date_debut, date_fin, montant_mensuel_ht, taux_tva, notes, numero_commande, devis_id, postes } = req.body;

    const numero = await generateNumeroForfait(tenantId);

    // 1. Creer le forfait
    const { data: forfait, error: errForfait } = await supabase
      .from('forfaits')
      .insert({
        tenant_id: tenantId,
        numero,
        nom,
        client_id: client_id || null,
        client_nom: client_nom || null,
        date_debut,
        date_fin,
        montant_mensuel_ht,
        taux_tva: taux_tva || 20,
        notes: notes || null,
        numero_commande: numero_commande || null,
        devis_id: devis_id || null,
        statut: 'brouillon',
      })
      .select()
      .single();

    if (errForfait) throw errForfait;

    // 2. Creer les postes
    const postesData = postes.map(p => ({
      tenant_id: tenantId,
      forfait_id: forfait.id,
      service_id: p.service_id || null,
      service_nom: p.service_nom,
      effectif: p.effectif,
      jours: p.jours,
      heure_debut: p.heure_debut,
      heure_fin: p.heure_fin,
      taux_horaire: p.taux_horaire,
      cout_mensuel_ht: p.cout_mensuel_ht || 0,
    }));

    const { error: errPostes } = await supabase
      .from('forfait_postes')
      .insert(postesData);

    if (errPostes) throw errPostes;

    // Note: Les periodes ne sont PAS generees a la creation.
    // Elles seront generees lors de l'acceptation du forfait (POST /:id/accepter).
    // Le forfait reste en brouillon (modifiable) jusqu'a envoi + acceptation.

    // Relire le forfait complet
    const { data: full } = await supabase
      .from('forfaits')
      .select(`
        *,
        forfait_postes (*),
        forfait_periodes (*)
      `)
      .eq('id', forfait.id)
      .eq('tenant_id', tenantId)
      .single();

    res.status(201).json({
      success: true,
      forfait: {
        ...full,
        postes: full.forfait_postes,
        periodes: full.forfait_periodes,
        forfait_postes: undefined,
        forfait_periodes: undefined,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /:id — Detail forfait (lecture seule)
router.get('/:id', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;

    const { data: forfait, error } = await supabase
      .from('forfaits')
      .select(`
        *,
        forfait_postes (*),
        forfait_periodes (*)
      `)
      .eq('id', parseInt(id))
      .eq('tenant_id', tenantId)
      .single();

    if (error || !forfait) {
      return res.status(404).json({ success: false, error: 'Forfait non trouve' });
    }

    res.json({
      success: true,
      forfait: {
        ...forfait,
        postes: forfait.forfait_postes,
        periodes: (forfait.forfait_periodes || []).sort((a, b) => a.mois.localeCompare(b.mois)),
        forfait_postes: undefined,
        forfait_periodes: undefined,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /:id — Modifier un forfait brouillon (postes, montant, dates)
router.put('/:id', validate(createForfaitSchema), async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;

    // Verifier que le forfait est en brouillon
    const { data: existing } = await supabase
      .from('forfaits')
      .select('statut')
      .eq('id', parseInt(id))
      .eq('tenant_id', tenantId)
      .single();

    if (!existing) return res.status(404).json({ success: false, error: 'Forfait non trouve' });
    if (existing.statut !== 'brouillon') {
      return res.status(400).json({ success: false, error: 'Seul un forfait en brouillon est modifiable' });
    }

    const { nom, client_id, client_nom, date_debut, date_fin, montant_mensuel_ht, taux_tva, notes, numero_commande, postes } = req.body;

    // 1. Mettre a jour le forfait
    await supabase
      .from('forfaits')
      .update({
        nom, client_id: client_id || null, client_nom: client_nom || null,
        date_debut, date_fin, montant_mensuel_ht,
        taux_tva: taux_tva || 20, notes: notes || null,
        numero_commande: numero_commande || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', parseInt(id))
      .eq('tenant_id', tenantId);

    // 2. Supprimer les anciens postes et recreer
    await supabase
      .from('forfait_postes')
      .delete()
      .eq('forfait_id', parseInt(id))
      .eq('tenant_id', tenantId);

    const postesData = postes.map(p => ({
      tenant_id: tenantId,
      forfait_id: parseInt(id),
      service_id: p.service_id || null,
      service_nom: p.service_nom,
      effectif: p.effectif,
      jours: p.jours,
      heure_debut: p.heure_debut,
      heure_fin: p.heure_fin,
      taux_horaire: p.taux_horaire,
      cout_mensuel_ht: p.cout_mensuel_ht || 0,
    }));

    await supabase.from('forfait_postes').insert(postesData);

    // Relire le forfait complet
    const { data: full } = await supabase
      .from('forfaits')
      .select('*, forfait_postes (*), forfait_periodes (*)')
      .eq('id', parseInt(id))
      .eq('tenant_id', tenantId)
      .single();

    res.json({
      success: true,
      forfait: { ...full, postes: full.forfait_postes, periodes: full.forfait_periodes, forfait_postes: undefined, forfait_periodes: undefined },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /:id/envoyer — Envoyer le forfait au client par email
router.post('/:id/envoyer', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;

    // Charger forfait + postes
    const { data: forfait } = await supabase
      .from('forfaits')
      .select('*, forfait_postes (*)')
      .eq('id', parseInt(id))
      .eq('tenant_id', tenantId)
      .single();

    if (!forfait) return res.status(404).json({ success: false, error: 'Forfait non trouve' });
    if (!['brouillon', 'envoye'].includes(forfait.statut)) {
      return res.status(400).json({ success: false, error: 'Ce forfait ne peut pas etre envoye' });
    }

    // Recuperer email client
    let clientEmail = null;
    if (forfait.client_id) {
      const { data: client } = await supabase
        .from('clients')
        .select('email, nom, prenom')
        .eq('id', forfait.client_id)
        .eq('tenant_id', tenantId)
        .single();
      clientEmail = client?.email;
    }

    if (!clientEmail) {
      return res.status(400).json({ success: false, error: 'Email client requis pour l\'envoi. Ajoutez un email au client.' });
    }

    // Infos tenant
    const { data: tenant } = await supabase
      .from('tenants')
      .select('business_name, email, telephone')
      .eq('id', tenantId)
      .single();

    const businessName = tenant?.business_name || 'NEXUS';
    const montantHT = forfait.montant_mensuel_ht || 0;
    const tauxTVA = forfait.taux_tva || 20;
    const montantTVA = Math.round(montantHT * tauxTVA / 100);
    const montantTTC = montantHT + montantTVA;
    const postes = forfait.forfait_postes || [];

    // Construire le detail des postes
    const joursLabels = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
    const postesHtml = postes.map(p => {
      const joursActifs = (p.jours || []).map((j, i) => j ? joursLabels[i] : null).filter(Boolean).join(', ');
      return `
        <tr>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${p.effectif}x ${p.service_nom}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${joursActifs}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb;">${p.heure_debut} - ${p.heure_fin}</td>
          <td style="padding: 8px 12px; border-bottom: 1px solid #e5e7eb; text-align: right;">${p.cout_mensuel_ht ? (p.cout_mensuel_ht / 100).toFixed(2) + ' €' : '—'}</td>
        </tr>`;
    }).join('');

    const dateDebut = new Date(forfait.date_debut + 'T12:00:00').toLocaleDateString('fr-FR');
    const dateFin = new Date(forfait.date_fin + 'T12:00:00').toLocaleDateString('fr-FR');

    await sendEmail({
      to: clientEmail,
      subject: `Proposition de contrat ${forfait.numero} — ${businessName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 32px;">
          <div style="text-align: center; margin-bottom: 24px;">
            <div style="width: 48px; height: 48px; margin: 0 auto; border-radius: 12px; background: linear-gradient(135deg, #06b6d4, #2563eb); display: flex; align-items: center; justify-content: center;">
              <span style="color: white; font-weight: bold; font-size: 20px;">N</span>
            </div>
          </div>
          <h2 style="text-align: center; color: #111827;">Proposition de contrat</h2>
          <p style="text-align: center; color: #6b7280; margin-bottom: 24px;">${forfait.numero} — ${businessName}</p>

          <p style="color: #374151;">Bonjour${forfait.client_nom ? ' ' + forfait.client_nom : ''},</p>
          <p style="color: #374151; margin-bottom: 24px;">Veuillez trouver ci-dessous le detail de notre proposition de contrat <strong>${forfait.nom}</strong> :</p>

          <div style="background: #f9fafb; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; font-size: 14px;">
            <strong>Periode :</strong> ${dateDebut} → ${dateFin}
          </div>

          <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 14px;">
            <thead>
              <tr style="background: #f3f4f6;">
                <th style="padding: 8px 12px; text-align: left;">Poste</th>
                <th style="padding: 8px 12px; text-align: left;">Jours</th>
                <th style="padding: 8px 12px; text-align: left;">Horaires</th>
                <th style="padding: 8px 12px; text-align: right;">Cout/mois</th>
              </tr>
            </thead>
            <tbody>${postesHtml}</tbody>
          </table>

          <div style="text-align: right; margin-bottom: 24px; font-size: 14px;">
            <p style="color: #6b7280; margin: 4px 0;">Total mensuel HT : <strong>${(montantHT / 100).toFixed(2)} €</strong></p>
            ${montantTVA > 0 ? `<p style="color: #6b7280; margin: 4px 0;">TVA (${tauxTVA}%) : ${(montantTVA / 100).toFixed(2)} €</p>` : ''}
            <p style="color: #111827; font-size: 16px; margin: 8px 0;"><strong>Total mensuel TTC : ${(montantTTC / 100).toFixed(2)} €</strong></p>
          </div>

          ${forfait.notes ? `<div style="background: #f9fafb; border-radius: 8px; padding: 12px 16px; margin-bottom: 16px; font-size: 13px; color: #6b7280;"><strong>Notes :</strong> ${forfait.notes}</div>` : ''}

          <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 24px 0;" />
          <p style="text-align: center; color: #9ca3af; font-size: 12px;">
            ${businessName}${tenant?.telephone ? ' — ' + tenant.telephone : ''}${tenant?.email ? ' — ' + tenant.email : ''}
          </p>
        </div>
      `,
    });

    // Passer en envoye
    await supabase
      .from('forfaits')
      .update({ statut: 'envoye', updated_at: new Date().toISOString() })
      .eq('id', parseInt(id))
      .eq('tenant_id', tenantId);

    console.log(`[FORFAITS] Forfait ${forfait.numero} envoye a ${clientEmail}`);
    res.json({ success: true, message: `Forfait envoye a ${clientEmail}` });
  } catch (error) {
    console.error('[FORFAITS] Erreur envoi:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /:id/accepter — Accepter le forfait → generer periodes → statut actif
router.post('/:id/accepter', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;

    const { data: forfait } = await supabase
      .from('forfaits')
      .select('*')
      .eq('id', parseInt(id))
      .eq('tenant_id', tenantId)
      .single();

    if (!forfait) return res.status(404).json({ success: false, error: 'Forfait non trouve' });
    if (!['envoye', 'brouillon'].includes(forfait.statut)) {
      return res.status(400).json({ success: false, error: 'Ce forfait ne peut pas etre accepte (statut: ' + forfait.statut + ')' });
    }

    // Generer les periodes mensuelles (differe de la creation)
    const periodesList = genererPeriodes(forfait.date_debut, forfait.date_fin);
    const periodesData = periodesList.map(p => ({
      tenant_id: tenantId,
      forfait_id: parseInt(id),
      mois: p.mois,
      date_debut: p.date_debut,
      date_fin: p.date_fin,
      statut: 'planifie',
      montant_prevu: Math.round(forfait.montant_mensuel_ht * p.prorata),
    }));

    // Supprimer d'eventuelles anciennes periodes (securite)
    await supabase
      .from('forfait_periodes')
      .delete()
      .eq('forfait_id', parseInt(id))
      .eq('tenant_id', tenantId);

    const { error: errPeriodes } = await supabase
      .from('forfait_periodes')
      .insert(periodesData);

    if (errPeriodes) throw errPeriodes;

    // Passer en actif
    await supabase
      .from('forfaits')
      .update({ statut: 'actif', updated_at: new Date().toISOString() })
      .eq('id', parseInt(id))
      .eq('tenant_id', tenantId);

    console.log(`[FORFAITS] Forfait ${forfait.numero} accepte — ${periodesData.length} periodes generees`);
    res.json({
      success: true,
      message: `Forfait accepte — ${periodesData.length} periodes generees`,
      periodes_count: periodesData.length,
    });
  } catch (error) {
    console.error('[FORFAITS] Erreur acceptation:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// PATCH /:id/annuler — Annuler forfait
router.patch('/:id/annuler', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id } = req.params;

    const { data: forfait, error } = await supabase
      .from('forfaits')
      .update({ statut: 'annule', updated_at: new Date().toISOString() })
      .eq('id', parseInt(id))
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error) throw error;
    if (!forfait) return res.status(404).json({ success: false, error: 'Forfait non trouve' });

    res.json({ success: true, forfait });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// PERIODES + AFFECTATIONS
// ============================================

// GET /:id/periodes/:pid — Detail periode + affectations
router.get('/:id/periodes/:pid', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id, pid } = req.params;

    // Verifier ownership
    const { data: forfait } = await supabase
      .from('forfaits')
      .select('id, nom, client_nom, montant_mensuel_ht')
      .eq('id', parseInt(id))
      .eq('tenant_id', tenantId)
      .single();

    if (!forfait) return res.status(404).json({ success: false, error: 'Forfait non trouve' });

    const { data: periode, error } = await supabase
      .from('forfait_periodes')
      .select('*')
      .eq('id', parseInt(pid))
      .eq('forfait_id', parseInt(id))
      .eq('tenant_id', tenantId)
      .single();

    if (error || !periode) {
      return res.status(404).json({ success: false, error: 'Periode non trouvee' });
    }

    // Charger postes
    const { data: postes } = await supabase
      .from('forfait_postes')
      .select('*')
      .eq('forfait_id', parseInt(id))
      .eq('tenant_id', tenantId);

    // Charger affectations avec nom du membre
    const { data: affectations } = await supabase
      .from('forfait_affectations')
      .select(`
        *,
        rh_membres (id, nom, prenom)
      `)
      .eq('periode_id', parseInt(pid))
      .eq('tenant_id', tenantId)
      .order('date', { ascending: true });

    const enrichedAffectations = (affectations || []).map(a => ({
      ...a,
      membre_nom: a.rh_membres ? `${a.rh_membres.prenom} ${a.rh_membres.nom}` : null,
      rh_membres: undefined,
    }));

    res.json({
      success: true,
      forfait,
      periode,
      postes: postes || [],
      affectations: enrichedAffectations,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// PUT /:id/periodes/:pid/affectations — Bulk upsert affectations
router.put('/:id/periodes/:pid/affectations', validate(affectationBulkSchema), async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id, pid } = req.params;
    const { mode, membre_id, poste_id, scope } = req.body;

    // Verifier que le forfait est actif
    const { data: forfaitCheck } = await supabase
      .from('forfaits')
      .select('statut')
      .eq('id', parseInt(id))
      .eq('tenant_id', tenantId)
      .single();

    if (!forfaitCheck) return res.status(404).json({ success: false, error: 'Forfait non trouve' });
    if (forfaitCheck.statut !== 'actif') {
      return res.status(400).json({ success: false, error: 'Le forfait doit etre accepte (actif) pour planifier des affectations' });
    }

    // Verifier periode existe et pas cloturee
    const { data: periode } = await supabase
      .from('forfait_periodes')
      .select('*')
      .eq('id', parseInt(pid))
      .eq('forfait_id', parseInt(id))
      .eq('tenant_id', tenantId)
      .single();

    if (!periode) return res.status(404).json({ success: false, error: 'Periode non trouvee' });
    if (periode.statut === 'cloture') {
      return res.status(400).json({ success: false, error: 'Periode deja cloturee' });
    }

    // Charger le poste pour jours/heures
    const { data: poste } = await supabase
      .from('forfait_postes')
      .select('*')
      .eq('id', poste_id)
      .eq('forfait_id', parseInt(id))
      .eq('tenant_id', tenantId)
      .single();

    if (!poste) return res.status(404).json({ success: false, error: 'Poste non trouve' });

    // membre_id=0 → effacer les affectations pour ce poste dans la plage
    if (membre_id === 0) {
      let delDebut, delFin;
      if (mode === 'jour') {
        delDebut = scope.date || periode.date_debut;
        delFin = delDebut;
      } else if (mode === 'semaine') {
        delDebut = scope.semaine_debut || periode.date_debut;
        const d = new Date(delDebut + 'T12:00:00');
        d.setDate(d.getDate() + 6);
        delFin = fmtDate(d);
        if (delFin > periode.date_fin) delFin = periode.date_fin;
      } else {
        delDebut = periode.date_debut;
        delFin = periode.date_fin;
      }

      let delQuery = supabase
        .from('forfait_affectations')
        .delete()
        .eq('periode_id', parseInt(pid))
        .eq('poste_id', poste_id)
        .eq('tenant_id', tenantId)
        .gte('date', delDebut)
        .lte('date', delFin);

      // Si clear_membre_id specifie, ne supprimer que cet agent (clic cellule)
      // Sinon, supprimer TOUS les agents (bouton "Tout retirer")
      if (scope.clear_membre_id) {
        delQuery = delQuery.eq('membre_id', scope.clear_membre_id);
      }

      const { error, count } = await delQuery;

      if (error) throw error;
      return res.json({ success: true, count: count || 0, message: `Affectations effacees` });
    }

    // Verifier les conflits de chevauchement pour ce membre
    {
      let checkDebut, checkFin;
      if (mode === 'jour') {
        checkDebut = scope.date || periode.date_debut;
        checkFin = checkDebut;
      } else if (mode === 'semaine') {
        checkDebut = scope.semaine_debut || periode.date_debut;
        const d = new Date(checkDebut + 'T12:00:00');
        d.setDate(d.getDate() + 6);
        checkFin = fmtDate(d);
        if (checkFin > periode.date_fin) checkFin = periode.date_fin;
      } else if (mode === 'mois') {
        checkDebut = periode.date_debut;
        checkFin = periode.date_fin;
      } else {
        // trimestre/annee: check toute la duree du forfait
        const { data: ff } = await supabase.from('forfaits').select('date_debut, date_fin')
          .eq('id', parseInt(id)).eq('tenant_id', tenantId).single();
        checkDebut = ff?.date_debut || periode.date_debut;
        checkFin = ff?.date_fin || periode.date_fin;
      }

      const conflict = await checkMemberMultiDayConflicts(
        supabase, tenantId, membre_id, checkDebut, checkFin,
        poste.heure_debut, poste.heure_fin, null, poste_id
      );

      if (conflict.conflict) {
        const msg = conflict.existingService
          ? `Conflit le ${conflict.date} : ${conflict.existingService} (${conflict.existingHeure})`
          : 'Ce membre est deja affecte sur ce creneau';
        return res.status(409).json({
          success: false,
          error: msg,
          conflict,
        });
      }
    }

    // Determiner la plage de dates selon le mode
    let dateDebut, dateFin;

    if (mode === 'jour') {
      dateDebut = scope.date || periode.date_debut;
      dateFin = dateDebut;
    } else if (mode === 'semaine') {
      dateDebut = scope.semaine_debut || periode.date_debut;
      const d = new Date(dateDebut + 'T12:00:00');
      d.setDate(d.getDate() + 6);
      dateFin = d.toISOString().slice(0, 10);
      // Clipper a la periode
      if (dateFin > periode.date_fin) dateFin = periode.date_fin;
    } else if (mode === 'mois') {
      dateDebut = periode.date_debut;
      dateFin = periode.date_fin;
    } else if (mode === 'trimestre' || mode === 'annee') {
      // Charger toutes les periodes du forfait
      const { data: allPeriodes } = await supabase
        .from('forfait_periodes')
        .select('*')
        .eq('forfait_id', parseInt(id))
        .eq('tenant_id', tenantId)
        .neq('statut', 'cloture')
        .order('mois', { ascending: true });

      const currentIdx = (allPeriodes || []).findIndex(p => p.id === parseInt(pid));
      let targetPeriodes;

      if (mode === 'trimestre') {
        targetPeriodes = (allPeriodes || []).slice(currentIdx, currentIdx + 3);
      } else {
        targetPeriodes = allPeriodes || [];
      }

      // Generer affectations pour toutes les periodes cibles
      const allAffectations = [];
      for (const tp of targetPeriodes) {
        const days = joursTravailes(poste.jours, tp.date_debut, tp.date_fin);
        for (const day of days) {
          allAffectations.push({
            tenant_id: tenantId,
            forfait_id: parseInt(id),
            periode_id: tp.id,
            poste_id,
            membre_id,
            date: day,
            heure_debut: poste.heure_debut,
            heure_fin: poste.heure_fin,
          });
        }
      }

      if (allAffectations.length > 0) {
        // Supprimer uniquement les affectations de CE membre (pas des autres agents)
        for (const tp of targetPeriodes) {
          await supabase
            .from('forfait_affectations')
            .delete()
            .eq('periode_id', tp.id)
            .eq('poste_id', poste_id)
            .eq('membre_id', membre_id)
            .eq('tenant_id', tenantId);
        }

        // Verifier la capacite par jour pour chaque periode
        const effectif = poste.effectif || 1;
        let totalInserted = 0;
        let totalSkipped = 0;

        for (const tp of targetPeriodes) {
          const periodeAffectations = allAffectations.filter(a => a.periode_id === tp.id);
          if (periodeAffectations.length === 0) continue;

          const { data: existing } = await supabase
            .from('forfait_affectations')
            .select('date')
            .eq('periode_id', tp.id)
            .eq('poste_id', poste_id)
            .eq('tenant_id', tenantId);

          const countByDate = {};
          for (const e of (existing || [])) {
            countByDate[e.date] = (countByDate[e.date] || 0) + 1;
          }

          const filtered = periodeAffectations.filter(a => (countByDate[a.date] || 0) < effectif);
          if (filtered.length > 0) {
            // filtered contient tenant_id dans chaque row (herite de allAffectations)
            const { error } = await supabase.from('forfait_affectations').insert(filtered);
            if (error) throw error;
          }
          totalInserted += filtered.length;
          totalSkipped += periodeAffectations.length - filtered.length;
        }

        const msg = totalSkipped > 0
          ? `${totalInserted} affectations creees, ${totalSkipped} jours deja complets (${mode})`
          : `${totalInserted} affectations creees (${mode})`;

        return res.json({ success: true, count: totalInserted, skipped: totalSkipped, message: msg });
      }

      return res.json({
        success: true,
        count: 0,
        message: `Aucun jour travaille dans la plage (${mode})`,
      });
    }

    // Mode jour/semaine/mois: generer les jours travailles
    const days = joursTravailes(poste.jours, dateDebut, dateFin);
    const affectations = days.map(day => ({
      tenant_id: tenantId,
      forfait_id: parseInt(id),
      periode_id: parseInt(pid),
      poste_id,
      membre_id,
      date: day,
      heure_debut: poste.heure_debut,
      heure_fin: poste.heure_fin,
    }));

    if (affectations.length > 0) {
      // Supprimer uniquement les affectations de CE membre (pas des autres agents)
      // pour eviter les doublons si on re-affecte le meme membre
      await supabase
        .from('forfait_affectations')
        .delete()
        .eq('periode_id', parseInt(pid))
        .eq('poste_id', poste_id)
        .eq('membre_id', membre_id)
        .eq('tenant_id', tenantId)
        .gte('date', dateDebut)
        .lte('date', dateFin);

      // Verifier la capacite (effectif) du poste : ne pas depasser le nb d'agents prevus
      const { data: existing } = await supabase
        .from('forfait_affectations')
        .select('date')
        .eq('periode_id', parseInt(pid))
        .eq('poste_id', poste_id)
        .eq('tenant_id', tenantId)
        .gte('date', dateDebut)
        .lte('date', dateFin);

      // Compter les affectations existantes par jour
      const countByDate = {};
      for (const e of (existing || [])) {
        countByDate[e.date] = (countByDate[e.date] || 0) + 1;
      }

      // Ne garder que les jours ou il reste de la place
      const effectif = poste.effectif || 1;
      const filtered = affectations.filter(a => (countByDate[a.date] || 0) < effectif);

      if (filtered.length > 0) {
        const { error } = await supabase
          .from('forfait_affectations')
          .insert(filtered);
        if (error) throw error;
      }

      const skipped = affectations.length - filtered.length;
      const msg = skipped > 0
        ? `${filtered.length} affectations creees, ${skipped} jours deja complets (${mode})`
        : `${filtered.length} affectations creees (${mode})`;

      return res.json({ success: true, count: filtered.length, skipped, message: msg });
    }

    res.json({
      success: true,
      count: affectations.length,
      message: `${affectations.length} affectations creees (${mode})`,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================
// EXECUTER + CLOTURER
// ============================================

// POST /:id/periodes/:pid/executer — Creer prestation depuis affectations
router.post('/:id/periodes/:pid/executer', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id, pid } = req.params;

    // Charger forfait + periode
    const { data: forfait } = await supabase
      .from('forfaits')
      .select('*')
      .eq('id', parseInt(id))
      .eq('tenant_id', tenantId)
      .single();

    if (!forfait) return res.status(404).json({ success: false, error: 'Forfait non trouve' });

    const { data: periode } = await supabase
      .from('forfait_periodes')
      .select('*')
      .eq('id', parseInt(pid))
      .eq('forfait_id', parseInt(id))
      .eq('tenant_id', tenantId)
      .single();

    if (!periode) return res.status(404).json({ success: false, error: 'Periode non trouvee' });
    if (periode.statut === 'cloture') {
      return res.status(400).json({ success: false, error: 'Periode deja cloturee' });
    }
    if (periode.reservation_id) {
      return res.status(400).json({ success: false, error: 'Periode deja executee' });
    }

    // Charger postes et affectations
    const { data: postes } = await supabase
      .from('forfait_postes')
      .select('*')
      .eq('forfait_id', parseInt(id))
      .eq('tenant_id', tenantId);

    const { data: affectations } = await supabase
      .from('forfait_affectations')
      .select('*')
      .eq('periode_id', parseInt(pid))
      .eq('tenant_id', tenantId)
      .order('date', { ascending: true });

    if (!affectations || affectations.length === 0) {
      return res.status(400).json({ success: false, error: 'Aucune affectation pour cette periode' });
    }

    // Creer la reservation (prestation)
    const serviceNom = `Forfait ${periode.mois} - ${forfait.nom}`;
    const montantPeriode = periode.montant_prevu || forfait.montant_mensuel_ht;

    // Si un seul membre affecte, l'assigner sur la resa pour le planning
    const membreIds = [...new Set(affectations.map(a => a.membre_id).filter(Boolean))];
    const resaMembreId = membreIds.length === 1 ? membreIds[0] : null;

    const resaData = {
      tenant_id: tenantId,
      client_id: forfait.client_id,
      service_nom: serviceNom,
      date: periode.date_debut,
      date_depart: periode.date_fin,
      heure: postes?.[0]?.heure_debut || '09:00',
      heure_fin: postes?.[0]?.heure_fin || '18:00',
      prix_total: montantPeriode,
      statut: 'confirme',
      is_forfait: true,
      forfait_periode_id: parseInt(pid),
      membre_id: resaMembreId,
      numero_commande: forfait.numero_commande || null,
      notes: `Forfait ${forfait.numero} - ${periode.mois}`,
    };
    const { data: reservation, error: errResa } = await supabase
      .from('reservations')
      .insert(resaData)
      .select()
      .single();

    if (errResa) throw errResa;

    // Creer 1 reservation_ligne par jour travaille (evite l'expansion planning sur sam/dim)
    const lignes = [];
    const postesMap = Object.fromEntries((postes || []).map(p => [p.id, p]));

    // Calculer la duree en minutes d'un creneau (heure_debut → heure_fin)
    function dureeMinutes(hd, hf) {
      const [h1, m1] = hd.split(':').map(Number);
      const [h2, m2] = hf.split(':').map(Number);
      let diff = (h2 * 60 + m2) - (h1 * 60 + m1);
      if (diff <= 0) diff += 24 * 60; // overnight
      return diff;
    }

    // Repartir le montant au prorata : montantPeriode / nb total d'affectations
    const prixParJour = affectations.length > 0
      ? Math.round(montantPeriode / affectations.length)
      : 0;

    for (const a of affectations) {
      const poste = postesMap[a.poste_id];
      if (!poste) continue;

      const duree = dureeMinutes(a.heure_debut, a.heure_fin);

      lignes.push({
        tenant_id: tenantId,
        reservation_id: reservation.id,
        service_id: poste.service_id || null,
        service_nom: poste.service_nom,
        quantite: 1,
        duree_minutes: duree,
        prix_unitaire: poste.taux_horaire || 0,
        prix_total: prixParJour,
        membre_id: a.membre_id || null,
        heure_debut: a.heure_debut,
        heure_fin: a.heure_fin,
        date: a.date, // date du jour pour planning + conflits
        date_debut: a.date,
        date_fin: a.date, // meme jour = pas d'expansion multi-day
      });
    }

    if (lignes.length > 0) {
      const { error: errLignes } = await supabase
        .from('reservation_lignes')
        .insert(lignes);

      if (errLignes) throw errLignes;
    }

    // Mettre a jour la periode
    await supabase
      .from('forfait_periodes')
      .update({
        statut: 'en_cours',
        reservation_id: reservation.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', parseInt(pid))
      .eq('tenant_id', tenantId);

    res.json({
      success: true,
      reservation_id: reservation.id,
      lignes_count: lignes.length,
      message: `Periode ${periode.mois} executee — ${lignes.length} lignes creees`,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /:id/periodes/:pid/reinitialiser — Reset periode: supprimer resa + lignes, retour planifie
router.post('/:id/periodes/:pid/reinitialiser', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    const { id, pid } = req.params;

    const { data: periode } = await supabase
      .from('forfait_periodes')
      .select('*')
      .eq('id', parseInt(pid))
      .eq('forfait_id', parseInt(id))
      .eq('tenant_id', tenantId)
      .single();

    if (!periode) return res.status(404).json({ success: false, error: 'Periode non trouvee' });
    if (periode.statut === 'cloture') {
      return res.status(400).json({ success: false, error: 'Impossible de reinitialiser une periode cloturee' });
    }

    if (periode.reservation_id) {
      // 1. D'abord retirer la FK sur la periode (sinon DELETE reservation echoue)
      await supabase
        .from('forfait_periodes')
        .update({ statut: 'planifie', reservation_id: null, updated_at: new Date().toISOString() })
        .eq('id', parseInt(pid))
        .eq('tenant_id', tenantId);

      // 2. Supprimer reservation_lignes puis reservation
      await supabase.from('reservation_lignes')
        .delete()
        .eq('reservation_id', periode.reservation_id)
        .eq('tenant_id', tenantId);

      await supabase.from('reservations')
        .delete()
        .eq('id', periode.reservation_id)
        .eq('tenant_id', tenantId);
    } else {
      // Pas de reservation, juste reset le statut
      await supabase
        .from('forfait_periodes')
        .update({ statut: 'planifie', reservation_id: null, updated_at: new Date().toISOString() })
        .eq('id', parseInt(pid))
        .eq('tenant_id', tenantId);
    }

    res.json({ success: true, message: 'Periode reinitialisee' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /:id/periodes/:pid/cloturer — Cloturer periode + facture
router.post('/:id/periodes/:pid/cloturer', async (req, res) => {
  try {
    const tenantId = req.admin.tenant_id;
    let { id, pid } = req.params;

    // Si id=0 (appel depuis Planning/Activites sans connaitre le forfait_id),
    // on cherche la periode directement par son ID
    let forfait, periode;

    if (parseInt(id) === 0) {
      const { data: p } = await supabase
        .from('forfait_periodes')
        .select('*')
        .eq('id', parseInt(pid))
        .eq('tenant_id', tenantId)
        .single();

      if (!p) return res.status(404).json({ success: false, error: 'Periode non trouvee' });
      periode = p;
      id = String(p.forfait_id);

      const { data: f } = await supabase
        .from('forfaits')
        .select('*')
        .eq('id', p.forfait_id)
        .eq('tenant_id', tenantId)
        .single();

      forfait = f;
    } else {
      // Charger forfait + periode
      const { data: f } = await supabase
        .from('forfaits')
        .select('*')
        .eq('id', parseInt(id))
        .eq('tenant_id', tenantId)
        .single();

      forfait = f;

      const { data: p } = await supabase
        .from('forfait_periodes')
        .select('*')
        .eq('id', parseInt(pid))
        .eq('forfait_id', parseInt(id))
        .eq('tenant_id', tenantId)
        .single();

      periode = p;
    }

    if (!forfait) return res.status(404).json({ success: false, error: 'Forfait non trouve' });

    if (!periode) return res.status(404).json({ success: false, error: 'Periode non trouvee' });
    if (periode.statut === 'cloture') {
      return res.status(400).json({ success: false, error: 'Periode deja cloturee' });
    }
    if (!periode.reservation_id) {
      return res.status(400).json({ success: false, error: 'Periode non executee — executez d\'abord' });
    }

    // 1. Passer la prestation en terminee
    await supabase
      .from('reservations')
      .update({ statut: 'termine', updated_at: new Date().toISOString() })
      .eq('id', periode.reservation_id)
      .eq('tenant_id', tenantId);

    // 2. Charger postes pour le detail facture
    const { data: postes } = await supabase
      .from('forfait_postes')
      .select('*')
      .eq('forfait_id', parseInt(id))
      .eq('tenant_id', tenantId);

    // Construire description facture
    const moisLabel = new Date(periode.date_debut + 'T12:00:00')
      .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
    const moisLabelCap = moisLabel.charAt(0).toUpperCase() + moisLabel.slice(1);

    const montantHT = forfait.montant_mensuel_ht;
    const tauxTVA = forfait.taux_tva || 20;
    const montantTVA = Math.round(montantHT * tauxTVA / 100);
    const montantTTC = montantHT + montantTVA;

    const lignesFacture = [
      {
        nom: `Forfait ${moisLabelCap}`,
        quantite: 1,
        prix_unitaire: montantHT,
        taux_tva: tauxTVA,
        total: montantHT,
      },
    ];

    // Ajouter lignes de detail (informatif, prix 0)
    if (postes && postes.length > 0) {
      lignesFacture.push({
        nom: '  Detail :',
        quantite: 1,
        prix_unitaire: 0,
        taux_tva: tauxTVA,
        total: 0,
      });
      for (const p of postes) {
        const joursLabels = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
        const joursActifs = (p.jours || [])
          .map((j, i) => j ? joursLabels[i] : null)
          .filter(Boolean)
          .join('-');
        lignesFacture.push({
          nom: `  - ${p.effectif} ${p.service_nom} (${joursActifs} ${p.heure_debut}-${p.heure_fin})`,
          quantite: 1,
          prix_unitaire: 0,
          taux_tva: tauxTVA,
          total: 0,
        });
      }
    }

    // 3. Creer la facture
    const numero = await generateNumeroFacture(tenantId);
    const { data: facture, error: errFacture } = await supabase
      .from('factures')
      .insert({
        tenant_id: tenantId,
        numero,
        type: 'facture',
        reservation_id: periode.reservation_id,
        client_id: forfait.client_id || null,
        client_nom: forfait.client_nom || '',
        service_nom: `Forfait ${moisLabelCap} - ${forfait.nom}`,
        service_description: JSON.stringify(lignesFacture),
        date_facture: new Date().toISOString().slice(0, 10),
        date_prestation: periode.date_debut,
        montant_ht: montantHT,
        taux_tva: tauxTVA,
        montant_tva: montantTVA,
        montant_ttc: montantTTC,
        statut: 'generee',
        notes: `Forfait ${forfait.numero} - ${periode.mois}`,
      })
      .select()
      .single();

    if (errFacture) throw errFacture;

    // 4. Mettre a jour la periode
    await supabase
      .from('forfait_periodes')
      .update({
        statut: 'cloture',
        facture_id: facture.id,
        montant_reel: montantHT,
        updated_at: new Date().toISOString(),
      })
      .eq('id', parseInt(pid))
      .eq('tenant_id', tenantId);

    res.json({
      success: true,
      facture_id: facture.id,
      facture_numero: facture.numero,
      message: `Periode ${periode.mois} cloturee — facture ${facture.numero} generee`,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
