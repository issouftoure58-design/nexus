# ARCHITECTURE NEXUS - DOCUMENTATION OFFICIELLE

> **REGLE ABSOLUE:** Cette logique ne doit JAMAIS changer.

---

## 1. DEFINITIONS

### NEXUS = Plateforme SaaS
```
NEXUS est le PRODUIT que tu vends.
C'est une plateforme multi-tenant universelle.
NEXUS n'est PAS un tenant. NEXUS est le FOURNISSEUR.
```

### TENANT = Client de NEXUS
```
Un tenant est une ENTREPRISE qui utilise NEXUS.
Exemples: Fat's Hair Afro, un restaurant, un dentiste...
Chaque tenant a son propre site, ses propres donnees, son propre plan.
Les tenants PAIENT pour utiliser NEXUS.
```

### SENTINEL = Gardien de NEXUS
```
SENTINEL protege la PLATEFORME NEXUS (pas les tenants).
Monitoring technique, securite, alertes systeme.
SENTINEL ne voit PAS les donnees business des tenants.
```

---

## 2. SCHEMA VISUEL

```
┌─────────────────────────────────────────────────────────────────┐
│                           NEXUS                                  │
│                    Plateforme SaaS                               │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                      SENTINEL                            │    │
│  │              Securite & Monitoring                       │    │
│  │         (protege NEXUS, pas les tenants)                 │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │  TENANT 1   │  │  TENANT 2   │  │  TENANT 3   │              │
│  │             │  │             │  │             │              │
│  │ Fat's Hair  │  │ Restaurant  │  │  Dentiste   │              │
│  │   Afro      │  │   Chez Jo   │  │  Dr. Smith  │              │
│  │             │  │             │  │             │              │
│  │ Plan: Pro   │  │ Plan: Start │  │ Plan: Biz   │              │
│  │ IA: Halimah │  │ IA: Josette │  │ IA: DocBot  │              │
│  │             │  │             │  │             │              │
│  │ Ses clients │  │ Ses clients │  │ Ses clients │              │
│  │ Ses RDV     │  │ Ses RDV     │  │ Ses RDV     │              │
│  │ Ses factures│  │ Ses factures│  │ Ses factures│              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│                                                                  │
│         Donnees 100% ISOLEES entre tenants                       │
│         (tenant_id sur TOUTES les tables)                        │
└─────────────────────────────────────────────────────────────────┘
```

---

## 3. ISOLATION DES DONNEES

### Regle d'or
```
TOUTE requete vers la base de donnees DOIT filtrer par tenant_id.
Sans exception. Jamais.
```

### Exemple correct
```javascript
// BIEN - Filtre par tenant_id
const clients = await supabase
  .from('clients')
  .select('*')
  .eq('tenant_id', req.admin.tenant_id);  // ← OBLIGATOIRE
```

### Exemple INTERDIT
```javascript
// MAL - Pas de filtre = FUITE DE DONNEES
const clients = await supabase
  .from('clients')
  .select('*');  // ← CATASTROPHE SECURITE
```

---

## 4. PLANS ET MODULES

### Hierarchie des plans
```
starter < pro < business

- starter: fonctions de base
- pro: + CRM, Analytics, Comptabilite, RH
- business: + SEO, Anti-Churn, SENTINEL tenant
```

### Modules optionnels (add-ons)
```
Independants du plan, actives par tenant:
- agent_ia_web: Chatbot sur site web
- agent_ia_whatsapp: Agent WhatsApp
- agent_ia_telephone: Standard telephonique
- salon: Module coiffure
- restaurant: Module restauration
```

---

## 5. FICHIERS CLES

### Backend
```
nexus/backend/
├── src/
│   ├── routes/
│   │   ├── tenants.js       # API info tenant (/api/tenants/me)
│   │   ├── quotas.js        # Gestion quotas par plan
│   │   ├── branding.js      # Personnalisation tenant
│   │   ├── agentIA.js       # Moteur IA (ex-halimahPro)
│   │   └── admin*.js        # Routes admin filtrees par tenant
│   │
│   ├── sentinel/            # Securite NEXUS
│   │   ├── security/        # Auth, passwords, rate-limit
│   │   ├── monitoring/      # Metriques systeme
│   │   └── backup/          # Sauvegardes
│   │
│   ├── core/
│   │   └── halimahAI.js     # Moteur IA (nom historique)
│   │
│   └── middleware/
│       └── tenantMiddleware.js  # Injection tenant_id
```

### Admin UI
```
nexus/admin-ui/
├── src/
│   ├── hooks/
│   │   └── useTenant.ts     # Detection auto du tenant
│   │
│   ├── contexts/
│   │   └── TenantContext.tsx # Provider global
│   │
│   ├── components/
│   │   ├── ModuleGate/      # Bloque selon plan
│   │   └── layout/
│   │       └── Sidebar.tsx  # Menu dynamique selon plan
│   │
│   └── pages/
│       └── Subscription.tsx # Page upgrade plan
```

---

## 6. PREMIER TENANT: FAT'S HAIR AFRO

### Informations
```
ID:          fatshairafro
Nom:         Fat's Hair-Afro
Proprio:     Fatou
Plan:        pro
IA:          Halimah (nom choisi par Fatou)
Activite:    Coiffure afro a domicile
Zone:        Ile-de-France
```

### Pourquoi "Halimah" dans le code?
```
Fat's Hair etait le PREMIER tenant, developpe avant que NEXUS
existe comme plateforme. Le code interne garde ce nom pour
des raisons historiques. Cela N'AFFECTE PAS la logique multi-tenant.

Fichiers concernes (internes uniquement):
- core/halimahAI.js
- services/halimahMemory.js
- workers/halimahWorker.js
- jobs/halimahLearning.js

Ces noms sont INTERNES. L'API expose des endpoints GENERIQUES.
Chaque tenant peut nommer son IA comme il veut via config.
```

---

## 7. CE QUI NE DOIT JAMAIS ARRIVER

### Interdictions absolues

1. **Melanger les donnees entre tenants**
   ```
   JAMAIS de SELECT sans WHERE tenant_id = X
   ```

2. **Confondre NEXUS et un tenant**
   ```
   NEXUS = plateforme
   Fat's Hair = client de la plateforme
   ```

3. **Afficher donnees business dans SENTINEL**
   ```
   SENTINEL = metriques TECHNIQUES (CPU, latence, uptime)
   PAS les revenus/clients/RDV des tenants
   ```

4. **Hardcoder un tenant**
   ```
   JAMAIS de if (tenant === 'fatshairafro')
   Tout doit etre dynamique via tenant_id
   ```

5. **Creer des routes specifiques a un tenant**
   ```
   BIEN: /api/admin/clients (filtre par JWT)
   MAL:  /api/fatshair/clients
   ```

---

## 8. CHECKLIST NOUVEAU DEVELOPPEMENT

Avant de merger du code, verifier:

- [ ] Toutes les requetes DB filtrent par tenant_id
- [ ] Pas de nom de tenant hardcode
- [ ] Les routes sont generiques
- [ ] ModuleGate protege les fonctions premium
- [ ] Les tests passent pour plusieurs tenants

---

## 9. CONTACTS

```
Createur: [Ton nom]
Date: Fevrier 2026
Version: 1.0
```

---

**FIN DE LA DOCUMENTATION - NE PAS MODIFIER SANS RAISON VALABLE**
