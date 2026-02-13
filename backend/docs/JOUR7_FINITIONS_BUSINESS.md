# JOUR 7 - Finitions Business Plan

## Resume

Implementation des dernieres fonctionnalites du Plan Business (399EUR/mois):
- Prevention Churn avancee
- Module RH basique
- Job automatise churn

---

## 1. Prevention Churn

### Backend

**Fichier:** `src/ai/predictions.js`

Fonctions ajoutees:
- `analyzeChurnRiskAll(tenant_id)` - Analyse tous les clients et calcule score de risque
- `scheduleChurnPrevention(tenant_id, client_id, action_type)` - Programme action anti-churn
- `jobChurnPrevention()` - Job quotidien de detection

**Score de risque calcule sur:**
- Inactivite (jours depuis derniere visite) - 40%
- Baisse frequence visites - 25%
- Baisse depenses - 20%
- Engagement (annulations, no-shows) - 15%

**Routes:** `src/routes/adminAnalytics.js`

```
GET  /api/admin/analytics/churn           - Liste clients a risque
POST /api/admin/analytics/churn/:id/prevent - Programmer action
```

### Frontend

**Fichier:** `admin-ui/src/pages/ChurnPrevention.tsx`

Interface complete avec:
- KPIs (total clients, a risque, critique, attention)
- Filtres par niveau de risque
- Liste clients avec score et facteurs
- Actions: Email retention, SMS rappel, Promo personnalisee
- Barre visuelle de score

**Route:** `/churn`

---

## 2. Module RH

### Migration

**Fichier:** `src/migrations/011_rh_equipe.sql`

Tables creees:
- `rh_membres` - Membres de l'equipe (nom, prenom, role, statut, etc.)
- `rh_performances` - Performances mensuelles (CA, RDV, taux conversion)
- `rh_absences` - Gestion conges et absences

### Backend

**Fichier:** `src/routes/adminRH.js`

Routes:
```
GET    /api/admin/rh/membres              - Liste membres
POST   /api/admin/rh/membres              - Ajouter membre
PUT    /api/admin/rh/membres/:id          - Modifier membre
DELETE /api/admin/rh/membres/:id          - Desactiver membre

GET    /api/admin/rh/performances         - Liste performances
POST   /api/admin/rh/performances         - Enregistrer performance

GET    /api/admin/rh/absences             - Liste absences
POST   /api/admin/rh/absences             - Demander absence
PUT    /api/admin/rh/absences/:id/:action - Approuver/Refuser

GET    /api/admin/rh/dashboard            - Stats RH globales
```

### Frontend

**Fichier:** `admin-ui/src/pages/RH.tsx`

Interface avec onglets:
- **Equipe:** CRUD membres avec formulaire
- **Absences:** Approbation/refus demandes
- **Performances:** Stats mensuelles

**Route:** `/rh`

---

## 3. Job Churn Automatise

**Fichier:** `src/jobs/scheduler.js`

Configuration:
```javascript
churnPrevention: { hour: 8, minute: 0 }  // Tous les jours a 8h
```

Le job:
1. Scanne tous les tenants Plan Business
2. Detecte clients a risque (score > 50)
3. Cree des taches dans `admin_tasks`
4. Les admins voient les alertes dans leur dashboard

Execution manuelle:
```javascript
import { runJobManually } from './jobs/scheduler.js';
await runJobManually('churnPrevention');
```

---

## 4. Fichiers Modifies/Crees

### Backend
| Fichier | Action |
|---------|--------|
| `src/ai/predictions.js` | Modifie - Ajout fonctions churn |
| `src/routes/adminAnalytics.js` | Modifie - Routes churn |
| `src/routes/adminRH.js` | Cree |
| `src/migrations/011_rh_equipe.sql` | Cree |
| `src/jobs/scheduler.js` | Modifie - Job churn |
| `src/services/emailService.js` | Cree |
| `src/index.js` | Modifie - Enregistrement routes RH |

### Frontend
| Fichier | Action |
|---------|--------|
| `src/pages/ChurnPrevention.tsx` | Cree |
| `src/pages/RH.tsx` | Cree |
| `src/App.tsx` | Modifie - Routes /churn et /rh |

---

## 5. Test des Endpoints

```bash
# Login
curl -X POST http://localhost:3001/api/admin/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"fatou@fatshairafro.fr","password":"halimah2024"}'

# RH Dashboard
curl http://localhost:3001/api/admin/rh/dashboard \
  -H "Authorization: Bearer TOKEN"

# Churn Analysis
curl http://localhost:3001/api/admin/analytics/churn \
  -H "Authorization: Bearer TOKEN"

# Ajouter membre equipe
curl -X POST http://localhost:3001/api/admin/rh/membres \
  -H "Authorization: Bearer TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"nom":"Dupont","prenom":"Marie","role":"commercial"}'
```

---

## 6. Configuration .env

Variables requises:
```
DATABASE_URL=postgresql://...
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...
ANTHROPIC_API_KEY=sk-ant-...
```

---

## 7. Prochaines Etapes

- [ ] Tests E2E complets
- [ ] Documentation API Swagger
- [ ] Deploiement production
