# ⚠️ TENANT SHIELD - PROTECTION ABSOLUE ⚠️

```
╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║   ████████╗███████╗███╗   ██╗ █████╗ ███╗   ██╗████████╗                      ║
║   ╚══██╔══╝██╔════╝████╗  ██║██╔══██╗████╗  ██║╚══██╔══╝                      ║
║      ██║   █████╗  ██╔██╗ ██║███████║██╔██╗ ██║   ██║                         ║
║      ██║   ██╔══╝  ██║╚██╗██║██╔══██║██║╚██╗██║   ██║                         ║
║      ██║   ███████╗██║ ╚████║██║  ██║██║ ╚████║   ██║                         ║
║      ╚═╝   ╚══════╝╚═╝  ╚═══╝╚═╝  ╚═╝╚═╝  ╚═══╝   ╚═╝                         ║
║                                                                               ║
║   ███████╗██╗  ██╗██╗███████╗██╗     ██████╗                                  ║
║   ██╔════╝██║  ██║██║██╔════╝██║     ██╔══██╗                                 ║
║   ███████╗███████║██║█████╗  ██║     ██║  ██║                                 ║
║   ╚════██║██╔══██║██║██╔══╝  ██║     ██║  ██║                                 ║
║   ███████║██║  ██║██║███████╗███████╗██████╔╝                                 ║
║   ╚══════╝╚═╝  ╚═╝╚═╝╚══════╝╚══════╝╚═════╝                                  ║
║                                                                               ║
║                    🛡️ PROTECTION MULTI-TENANT 🛡️                              ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
```

## 🚨 RÈGLE N°1 - LA LOI ABSOLUE

> **CHAQUE requête base de données DOIT filtrer par `tenant_id`**
>
> **AUCUNE EXCEPTION. JAMAIS. POINT FINAL.**

---

## 🔴 AVANT DE CODER - LIS CECI

### Tu touches à une requête Supabase ?

```javascript
// ❌ INTERDIT - BLOQUÉ PAR LE SYSTÈME
const { data } = await supabase
  .from('reservations')
  .select('*');

// ✅ OBLIGATOIRE - LA SEULE FAÇON
const { data } = await supabase
  .from('reservations')
  .select('*')
  .eq('tenant_id', tenantId);  // 🛡️ TENANT SHIELD
```

### Tu crées une nouvelle route API ?

```javascript
// ❌ INTERDIT - JAMAIS SANS TENANT
router.get('/data', async (req, res) => {
  const data = await getData(); // D'OÙ VIENT LE TENANT ?!
});

// ✅ OBLIGATOIRE - TOUJOURS AVEC TENANT
router.get('/data', async (req, res) => {
  const tenantId = req.tenantId; // 🛡️ VIENT DU MIDDLEWARE
  if (!tenantId) throw new Error('TENANT_REQUIRED');
  const data = await getData(tenantId);
});
```

---

## 🛡️ LES 5 COMMANDEMENTS DU TENANT SHIELD

### 1️⃣ TOUTE requête SELECT filtre par tenant_id
```javascript
.eq('tenant_id', tenantId)  // OBLIGATOIRE
```

### 2️⃣ TOUTE requête INSERT inclut tenant_id
```javascript
.insert({ ...data, tenant_id: tenantId })  // OBLIGATOIRE
```

### 3️⃣ TOUTE requête UPDATE/DELETE filtre par tenant_id
```javascript
.update(data).eq('tenant_id', tenantId)  // OBLIGATOIRE
.delete().eq('tenant_id', tenantId)      // OBLIGATOIRE
```

### 4️⃣ TOUTE fonction reçoit tenantId en paramètre
```javascript
async function maFonction(tenantId, ...autres) {  // tenantId EN PREMIER
  if (!tenantId) throw new Error('TENANT_SHIELD: tenant_id requis');
}
```

### 5️⃣ JAMAIS de fallback sur un tenant par défaut
```javascript
// ❌ INTERDIT
const tenantId = req.tenantId || 'fatshairafro';

// ✅ OBLIGATOIRE
const tenantId = req.tenantId;
if (!tenantId) throw new TenantRequiredError();
```

---

## 🚦 TABLES SYSTÈME vs TABLES TENANT

### Tables SYSTÈME (pas de tenant_id)
```
tenants          - Configuration des tenants
tenant_phone_numbers - Mapping téléphone → tenant
plans            - Plans tarifaires
```

### Tables TENANT (tenant_id OBLIGATOIRE)
```
reservations     ← TOUJOURS filtrer par tenant_id
clients          ← TOUJOURS filtrer par tenant_id
services         ← TOUJOURS filtrer par tenant_id
conversations    ← TOUJOURS filtrer par tenant_id
... TOUTES LES AUTRES
```

---

## 🔒 CHECKLIST AVANT COMMIT

```
□ Chaque .from('table') a un .eq('tenant_id', tenantId) ?
□ Chaque INSERT inclut tenant_id ?
□ Chaque fonction a tenantId en paramètre ?
□ Pas de fallback tenant par défaut ?
□ Les tests tenant isolation passent ?
```

**Si tu réponds NON à une seule question → NE COMMIT PAS**

---

## 🧪 COMMENT TESTER

```bash
# Lancer les tests d'isolation tenant
npm run test:tenant

# Vérifier le code avant commit
npm run lint:tenant
```

---

## 📞 EN CAS DE DOUTE

1. **ARRÊTE** ce que tu fais
2. **LIS** ce document à nouveau
3. **DEMANDE** si tu n'es pas sûr
4. **NE COMMIT PAS** de code non sécurisé

---

## 🎯 RAPPEL VISUEL

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│   TENANT A          │          TENANT B                 │
│   fatshairafro      │          decoevent                │
│                     │                                   │
│   ┌───────────┐     │     ┌───────────┐                 │
│   │ Clients A │     │     │ Clients B │                 │
│   │ RDV A     │  🔒 │  🔒 │ RDV B     │                 │
│   │ Services A│     │     │ Services B│                 │
│   └───────────┘     │     └───────────┘                 │
│                     │                                   │
│   ⛔ JAMAIS         │     ⛔ JAMAIS                      │
│   d'accès croisé    │     d'accès croisé                │
│                     │                                   │
└─────────────────────────────────────────────────────────┘
```

---

## ⚡ LE SHIELD EN ACTION

Le système vérifie automatiquement :

1. **Pre-commit hook** - Bloque les commits dangereux
2. **Runtime middleware** - Valide chaque requête
3. **Tests automatiques** - Vérifie l'isolation
4. **Linter tenant** - Scanne le code

**Tu ne peux pas contourner le TENANT SHIELD.**

---

*Dernière mise à jour: 2026-03-02*
*Mainteneur: NEXUS Team*
*Version: 3.3.0*
