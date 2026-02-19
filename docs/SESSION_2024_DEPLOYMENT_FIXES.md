# Session de travail - Déploiement Admin-UI & Corrections

**Date:** Février 2024
**Objectif principal:** Déploiement de l'admin-ui multi-tenant sur Render + corrections diverses

---

## 1. Correction de l'affichage des prix (Reservations.tsx)

### Problème
Les prix s'affichaient incorrectement : `0,50€` au lieu de `50€`

### Cause
Le backend (`adminReservations.js` lignes 110 et 203) convertit déjà les centimes en euros avant de renvoyer les données. Le frontend divisait à nouveau par 100.

### Solution
Modification de `admin-ui/src/pages/Reservations.tsx` :

```typescript
// AVANT (incorrect)
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount / 100);
};

// APRÈS (correct)
const formatCurrency = (amount: number) => {
  // Backend already converts centimes to euros
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(amount);
};
```

Même correction appliquée à l'export CSV.

---

## 2. Déploiement Admin-UI sur Render

### Architecture multi-tenant
- **nexus-admin** : Dashboard admin partagé par tous les tenants (web service Node.js)
- **fatshairafro-web** : Site vitrine client Fat's Hair Afro (static site)

### Configuration render.yaml

```yaml
services:
  # Fat's Hair Afro - Site vitrine client (static)
  - type: static_site
    name: fatshairafro-web
    rootDir: frontend/nexus-app
    buildCommand: npm install && npm run build
    staticPublishPath: dist
    routes:
      - type: rewrite
        source: /*
        destination: /index.html

  # Multi-tenant Admin UI (dashboard for all tenants)
  - type: web
    name: nexus-admin
    runtime: node
    rootDir: admin-ui
    buildCommand: npm install --include=dev && npm run build
    startCommand: node server.js
    envVars:
      - key: VITE_API_URL
        value: https://nexus-backend-dev.onrender.com/api
      - key: NODE_ENV
        value: production
```

### Serveur Express pour SPA (admin-ui/server.js)

```javascript
import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createProxyMiddleware } from 'http-proxy-middleware';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const API_URL = process.env.VITE_API_URL || 'https://nexus-backend-dev.onrender.com';

// Proxy API requests
app.use('/api', createProxyMiddleware({
  target: API_URL,
  changeOrigin: true,
  secure: true,
}));

// Serve static files from dist
app.use(express.static(join(__dirname, 'dist')));

// SPA fallback - serve index.html for all routes
app.get('/{*path}', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`API proxy target: ${API_URL}`);
});
```

### Dépendances ajoutées (admin-ui/package.json)

```json
{
  "dependencies": {
    "express": "^5.2.1",
    "http-proxy-middleware": "^3.0.5"
  }
}
```

---

## 3. Erreurs de déploiement corrigées

### 3.1 TypeScript build error - @types/react-dom manquant
**Erreur:** `Cannot find module '@types/react-dom'`
**Solution:** Modifier buildCommand pour inclure les devDependencies
```yaml
buildCommand: npm install --include=dev && npm run build
```

### 3.2 Express module not found
**Erreur:** `Cannot find package 'express'`
**Solution:** Ajouter express et http-proxy-middleware aux dependencies (pas devDependencies)

### 3.3 Express 5 wildcard route error
**Erreur:** `PathError: Missing parameter name at 1`
**Cause:** Express 5 ne supporte plus `'*'` comme route wildcard
**Solution:** Utiliser `'/{*path}'` au lieu de `'*'`

### 3.4 API calls 404
**Erreur:** Les appels API retournaient 404
**Cause:** VITE_API_URL manquait le préfixe `/api`
**Solution:** Mettre à jour via Render API :
```bash
curl -X PATCH "https://api.render.com/v1/services/$SERVICE_ID/env-vars/VITE_API_URL" \
  -H "Authorization: Bearer $RENDER_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"value": "https://nexus-backend-dev.onrender.com/api"}'
```

### 3.5 CORS error pour X-Tenant-Slug
**Erreur:** `Request header field x-tenant-slug is not allowed by Access-Control-Allow-Headers`
**Solution:** Ajouter le header dans backend/src/index.js :
```javascript
allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Idempotency-Key', 'X-Tenant-ID', 'X-Tenant-Slug'],
```

---

## 4. Bug d'isolation tenant - Détection de conflits

### Problème
Lors de la modification d'un RDV pour Fat's Hair Afro, le système affichait des conflits avec des clients d'autres tenants :
- "Conflit : Camille Richard (Brushing)" - PAS un client de Fat's Hair Afro
- "Conflit : Emma Robert (Mèches)" - PAS un client de Fat's Hair Afro

### Cause
`conflictChecker.js` ne filtrait pas par `tenant_id`, vérifiant les conflits avec TOUS les RDV de la base.

### Solution

#### backend/src/utils/conflictChecker.js
```javascript
// AVANT
export async function checkConflicts(supabase, date, heure, dureeMinutes, excludeId = null) {
  const { data: rdvs, error } = await supabase
    .from('reservations')
    .select('id, heure, duree_minutes, service_nom, clients(prenom, nom)')
    .eq('date', date)
    .in('statut', ['demande', 'en_attente', 'en_attente_paiement', 'confirme']);

// APRÈS
export async function checkConflicts(supabase, date, heure, dureeMinutes, excludeId = null, tenantId = null) {
  let query = supabase
    .from('reservations')
    .select('id, heure, duree_minutes, service_nom, clients(prenom, nom)')
    .eq('date', date)
    .in('statut', ['demande', 'en_attente', 'en_attente_paiement', 'confirme']);

  // 🔒 TENANT ISOLATION - filtrer par tenant
  if (tenantId) {
    query = query.eq('tenant_id', tenantId);
  }

  const { data: rdvs, error } = await query;
```

#### backend/src/routes/adminReservations.js (ligne 414)
```javascript
// AVANT
const conflictResult = await checkConflicts(supabase, newDate, newHeure, duree, req.params.id);

// APRÈS
const conflictResult = await checkConflicts(supabase, newDate, newHeure, duree, req.params.id, tenantId);
```

---

## 5. Configuration DNS fatshairafro.fr

### Configuration Render
Domaine personnalisé ajouté au service `fatshairafro-web` via Render Dashboard.

### Configuration DNS (à faire chez le registrar)
```
Type: CNAME
Name: @ (ou www)
Value: fatshairafro-web.onrender.com
```

Ou pour le domaine apex :
```
Type: A
Name: @
Value: 216.24.57.1 (IP Render)
```

---

## 6. URLs de production

| Service | URL |
|---------|-----|
| Admin UI | https://nexus-admin.onrender.com |
| Backend API | https://nexus-backend-dev.onrender.com/api |
| Site vitrine | https://fatshairafro-web.onrender.com |
| Domaine custom | https://fatshairafro.fr (après config DNS) |

---

## 7. Commits de cette session

```
ce4fb79 fix: tenant isolation in conflict detection
146d61f [commits précédents pour déploiement et corrections]
```

---

## 8. Fichiers modifiés

| Fichier | Modification |
|---------|--------------|
| `admin-ui/src/pages/Reservations.tsx` | Fix formatCurrency (ne pas diviser par 100) |
| `admin-ui/server.js` | Nouveau serveur Express pour SPA + proxy API |
| `admin-ui/package.json` | Ajout express, http-proxy-middleware |
| `backend/src/index.js` | CORS: ajout X-Tenant-Slug aux headers autorisés |
| `backend/src/utils/conflictChecker.js` | Isolation tenant dans détection conflits |
| `backend/src/routes/adminReservations.js` | Passage tenantId à checkConflicts |
| `render.yaml` | Configuration services Render |

---

## 9. Points d'attention pour le futur

1. **Prix:** Le backend convertit les centimes en euros. Le frontend ne doit PAS diviser par 100.

2. **Express 5:** Utiliser `'/{*path}'` pour les routes wildcard, pas `'*'`.

3. **Tenant isolation:** Toujours vérifier que les requêtes Supabase incluent `.eq('tenant_id', tenantId)`.

4. **CORS:** Si un nouveau header custom est ajouté côté frontend, l'ajouter aussi dans `allowedHeaders` du backend.

5. **Render build:** Pour TypeScript, utiliser `npm install --include=dev` pour installer les devDependencies.
