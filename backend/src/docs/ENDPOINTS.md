# NEXUS API — Endpoints Documentation (Sessions 39-54)

> Auto-generated documentation for endpoints added in sessions 39-54.
> For the public API v1, see `swagger.yaml`.

---

## Table of Contents

| # | Method | Path | Auth | Session |
|---|--------|------|------|---------|
| 1 | POST | `/signup/email/send` | signupLimiter | 54 |
| 2 | POST | `/signup/email/verify` | None | 54 |
| 3 | POST | `/signup` | signupLimiter + tokens | 54 |
| 4 | GET | `/credits/balance` | authenticateAdmin | 52 |
| 5 | GET | `/credits/transactions` | authenticateAdmin | 52 |
| 6 | GET | `/credits/packs` | None | 52 |
| 7 | POST | `/credits/checkout` | authenticateAdmin | 52 |
| 8 | PATCH | `/credits/overage` | authenticateAdmin | 52 |
| 9 | POST | `/dsn/valider` | authenticateAdmin | 46 |
| 10 | GET | `/dsn/:id/valider` | authenticateAdmin | 46 |
| 11 | POST | `/generate-post` | authenticateAdmin + quota | 39 |
| 12 | POST | `/generate-ideas` | authenticateAdmin | 39 |
| 13 | POST | `/generate-image` | authenticateAdmin + quota | 39 |
| 14 | PATCH | `/reservations/:id/statut` | authenticateAdmin | 53 |

---

## 1. POST `/api/admin/auth/signup/email/send`

**Session 54** — Email verification step during signup.

- **Auth**: `signupLimiter` (rate limiting)
- **Body**:
  | Field | Type | Required | Description |
  |-------|------|----------|-------------|
  | `email` | string | Yes | Email to verify |
- **Response 200**:
  ```json
  { "success": true, "message": "Email de verification envoye" }
  ```
- **Errors**: `400` missing email / email already exists, `429` rate limited

---

## 2. POST `/api/admin/auth/signup/email/verify`

**Session 54** — Verify email token from verification email.

- **Auth**: None (public)
- **Body**:
  | Field | Type | Required | Description |
  |-------|------|----------|-------------|
  | `token` | string | Yes | Token from verification email |
- **Response 200**:
  ```json
  { "success": true, "verified_token": "token_xxx", "email": "user@example.com" }
  ```
- **Errors**: `400` missing/invalid/expired token

---

## 3. POST `/api/admin/auth/signup`

**Session 54** — Create a new tenant account. Requires both SMS and email verification tokens.

- **Auth**: `signupLimiter`, guards: `email_verified_token` + `sms_verified_token`
- **Body**:
  | Field | Type | Required | Description |
  |-------|------|----------|-------------|
  | `entreprise` | string | Yes | Company name |
  | `nom` | string | Yes | Admin name |
  | `email` | string | Yes | Admin email (normalized lowercase) |
  | `telephone` | string | Yes | Company phone (SMS-verified) |
  | `password` | string | Yes | Admin password (strength validated) |
  | `accept_cgv` | boolean | Yes | Must be `true` |
  | `sms_verified_token` | string | Yes | SMS verification token |
  | `email_verified_token` | string | Yes | Email verification token |
  | `template_type` | string | No | Business template (service, autre, etc.) |
  | `profession_id` | string | No | Professional category ID |
  | `adresse` | string | No | Company address |
  | `siret` | string | No | SIRET (Luhn-validated) |
- **Response 201**:
  ```json
  {
    "success": true,
    "token": "jwt_xxx",
    "tenant_id": "company-slug",
    "template_type": "service",
    "admin": { "id": "uuid", "email": "...", "nom": "..." },
    "plan": "free",
    "tenant": { "id": "company-slug", "slug": "company-slug", "plan": "free" }
  }
  ```
- **Errors**: `400` missing fields / weak password / invalid SIRET / tokens invalid / email-phone-SIRET already exists, `429` rate limited

---

## 4. GET `/api/billing/credits/balance`

**Session 52** — Get current tenant credit balance with overage info.

- **Auth**: `authenticateAdmin` (JWT)
- **Response 200**:
  ```json
  {
    "success": true,
    "balance": 1200,
    "total_purchased": 5000,
    "total_consumed": 3800,
    "monthly_included": 1000,
    "monthly_used": 200,
    "monthly_reset_at": "2026-06-02T00:00:00.000Z",
    "auto_recharge_enabled": false,
    "overage_enabled": true,
    "overage_limit_eur": 100.00,
    "overage_used_eur": 25.50
  }
  ```
- **Errors**: `401` unauthorized

---

## 5. GET `/api/billing/credits/transactions`

**Session 52** — List credit transactions for tenant.

- **Auth**: `authenticateAdmin` (JWT)
- **Query params**:
  | Field | Type | Default | Description |
  |-------|------|---------|-------------|
  | `limit` | number | 50 | Max 200 |
  | `type` | string | — | Filter: consume, purchase, monthly_grant, etc. |
- **Response 200**:
  ```json
  {
    "success": true,
    "transactions": [
      { "id": "txn_xxx", "tenant_id": "...", "type": "consume", "amount": 50, "description": "...", "created_at": "..." }
    ],
    "count": 1
  }
  ```
- **Errors**: `401` unauthorized

---

## 6. GET `/api/billing/credits/packs`

**Session 52** — List available credit top-up packs and IA costs.

- **Auth**: None (public)
- **Response 200**:
  ```json
  {
    "success": true,
    "packs": [
      { "id": "topup_15", "code": "nexus_topup_15", "label": "15 € top-up", "price_cents": 1500, "price_eur": 15.00, "discount_pct": 0 }
    ],
    "costs": { "social_post_generated": 12, "generate_image_dalle": 25 }
  }
  ```

---

## 7. POST `/api/billing/credits/checkout`

**Session 52** — Create Stripe checkout session for credit pack purchase.

- **Auth**: `authenticateAdmin` (JWT)
- **Body**:
  | Field | Type | Required | Description |
  |-------|------|----------|-------------|
  | `packId` | string | Yes | Pack ID (topup_15, topup_50, topup_100) |
  | `successUrl` | string | No | Redirect URL on success |
  | `cancelUrl` | string | No | Redirect URL on cancel |
- **Response 200**:
  ```json
  { "success": true, "pack": { "id": "topup_15", "price_cents": 1500 }, "url": "https://checkout.stripe.com/...", "session_id": "cs_xxx" }
  ```
- **Errors**: `400` invalid packId, `401` unauthorized

---

## 8. PATCH `/api/billing/credits/overage`

**Session 52** — Enable/disable overage (usage-based) credits.

- **Auth**: `authenticateAdmin` (JWT)
- **Body**:
  | Field | Type | Required | Description |
  |-------|------|----------|-------------|
  | `enabled` | boolean | Yes | Enable/disable overage |
  | `limit_eur` | number | If enabled | Monthly EUR limit (0-10000) |
- **Response 200**:
  ```json
  {
    "success": true,
    "overage_enabled": true,
    "overage_limit_eur": 100.00,
    "overage_used_eur": 0.00,
    "overage_rate_eur": 0.0125,
    "overage_presets": [50, 100, 200]
  }
  ```
- **Errors**: `400` invalid params, `401` unauthorized, `403` insufficient permissions

---

## 9. POST `/api/admin/rh/dsn/valider`

**Session 46** — Validate a DSN (Declaration Sociale Nominative) file.

- **Auth**: `authenticateAdmin` (JWT)
- **Body** (one of):
  | Field | Type | Required | Description |
  |-------|------|----------|-------------|
  | `dsn_id` | string | One of | Existing DSN record ID |
  | `contenu_dsn` | string | One of | Raw DSN content to validate |
- **Response 200**:
  ```json
  {
    "success": true,
    "valide": true,
    "erreurs": [],
    "avertissements": ["..."],
    "stats": { "nb_salaries": 5, "nb_lignes": 150 },
    "rapport": "Formatted validation report",
    "dsnval": { "disponible": true, "etat": "VALID", "anomalies_bloquantes": [], "anomalies_non_bloquantes": [] }
  }
  ```
- **Errors**: `400` missing content, `404` DSN ID not found, `401` unauthorized

---

## 10. GET `/api/admin/rh/dsn/:id/valider`

**Session 46** — Validate an existing DSN record by ID.

- **Auth**: `authenticateAdmin` (JWT)
- **Params**: `id` (string) — DSN record ID
- **Response 200**: Same as POST `/dsn/valider`
- **Errors**: `404` not found, `400` content unavailable, `401` unauthorized

---

## 11. POST `/api/social/generate-post`

**Session 39** — Generate a social media post using Claude AI.

- **Auth**: `authenticateAdmin` (JWT) + `requirePostsQuota` middleware
- **Body**:
  | Field | Type | Required | Description |
  |-------|------|----------|-------------|
  | `sujet` | string | Yes | Topic for the post |
  | `plateforme` | string | Yes | Target: linkedin, facebook, instagram, twitter, tiktok |
- **Response 200**:
  ```json
  { "success": true, "contenu": "Generated post content...", "plateforme": "instagram", "sujet": "...", "secteur": "salon" }
  ```
- **Errors**: `400` missing fields, `402` INSUFFICIENT_CREDITS or OVERAGE_LIMIT_REACHED, `401` unauthorized

---

## 12. POST `/api/social/generate-ideas`

**Session 39** — Generate social media post ideas (free, no quota check).

- **Auth**: `authenticateAdmin` (JWT)
- **Body**:
  | Field | Type | Required | Description |
  |-------|------|----------|-------------|
  | `theme` | string | No | Optional theme/context |
  | `count` | number | No | Number of ideas (default: 5) |
- **Response 200**:
  ```json
  {
    "success": true,
    "ideas": [
      { "sujet": "...", "plateforme": "instagram", "type": "promo", "description": "..." }
    ],
    "secteur": "salon"
  }
  ```
- **Errors**: `400` invalid params, `401` unauthorized

---

## 13. POST `/api/social/generate-image`

**Session 39** — Generate an image using DALL-E.

- **Auth**: `authenticateAdmin` (JWT) + `requireImagesQuota` middleware
- **Body**:
  | Field | Type | Required | Description |
  |-------|------|----------|-------------|
  | `prompt` | string | Yes | Image description |
  | `style` | string | No | 'natural' (default) or 'vivid' |
  | `size` | string | No | '1024x1024' (default), '1792x1024', '1024x1792' |
- **Response 200**:
  ```json
  {
    "success": true,
    "image_url": "https://...",
    "revised_prompt": "Enhanced prompt...",
    "size": "1024x1024",
    "quota": { "restant": 9, "limite": 10 }
  }
  ```
- **Errors**: `400` missing prompt / content policy, `402` quota exceeded, `401` unauthorized

---

## 14. PATCH `/api/admin/reservations/:id/statut`

**Session 53** — Update reservation status with state machine validation.

- **Auth**: `authenticateAdmin` (JWT)
- **Params**: `id` (number) — Reservation ID
- **Body**:
  | Field | Type | Required | Description |
  |-------|------|----------|-------------|
  | `statut` | string | Yes | New status (see transitions below) |
  | `membre_id` | string | No | Staff member ID (required for some business types) |
  | `mode_paiement` | string | No | especes, cb, cheque, virement, echeance |
  | `checkout` | object | No | Restaurant checkout: `{ items, total, mode_paiement }` |
  | `motif_annulation` | string | No | Cancellation reason |

**Valid state transitions**:
```
demande       → en_attente, en_attente_paiement, confirme, annule, no_show
en_attente    → en_attente_paiement, confirme, annule, no_show
en_attente_paiement → confirme, annule
confirme      → termine, annule, no_show
termine       → (terminal)
annule        → (terminal)
no_show       → (terminal)
```

- **Response 200**:
  ```json
  {
    "data": { "id": 123, "statut": "confirme", "..." : "full reservation" },
    "changes": { "statut": "demande → confirme" },
    "facture": { "id": "uuid", "numero": "INV-2026-001" }
  }
  ```
- **Errors**: `400` invalid transition / MEMBRE_REQUIS, `404` not found, `401` unauthorized
