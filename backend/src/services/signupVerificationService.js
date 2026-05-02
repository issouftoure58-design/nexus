/**
 * signupVerificationService — Anti-abuse Free tier
 *
 * Fournit trois briques :
 *   1. validateSiret(siret)  : format Luhn 14 chiffres + (optionnel) appel INSEE
 *   2. SMS verification flow :
 *      - createPhoneVerification(phone, ip)  → envoie SMS avec code 6 chiffres
 *      - verifyPhoneCode(phone, code)        → retourne verified_token
 *      - consumePhoneToken(phone, token)     → invalide le token apres signup
 *   3. Email verification flow :
 *      - createEmailVerification(email, ip)  → envoie lien cliquable par email
 *      - verifyEmailToken(token)             → retourne verified_token
 *      - consumeEmailToken(email, token)     → invalide le token apres signup
 */

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { supabase } from '../config/supabase.js';
import { sendSMS, formatPhoneE164 } from './smsService.js';
import { sendEmail } from './emailService.js';
import { templateEmailVerification } from './emailService.js';

const CODE_TTL_MINUTES = 10;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 60;
const MAX_VERIFICATIONS_PER_IP_PER_HOUR = 5;

// ════════════════════════════════════════════════════════════════════
// SIRET VALIDATION
// ════════════════════════════════════════════════════════════════════

/**
 * Verifie le checksum Luhn d'un SIRET (14 chiffres).
 * Algorithme officiel INSEE : meme regle que numero de carte bancaire,
 * mais on double les chiffres en position paire (et non impaire).
 * @param {string} siret
 * @returns {boolean}
 */
export function isValidSiretLuhn(siret) {
  if (!siret || typeof siret !== 'string') return false;
  const digits = siret.replace(/\s/g, '');
  if (!/^\d{14}$/.test(digits)) return false;

  let sum = 0;
  for (let i = 0; i < 14; i++) {
    let n = parseInt(digits[i], 10);
    // Double les chiffres en position paire (index impair en base 0)
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}

/**
 * Valide un SIRET : format + Luhn + (optionnel) verification INSEE.
 * Retourne { valid, error?, company? }.
 *
 * Note : l'API INSEE Sirene necessite un token (INSEE_API_TOKEN). Si absent,
 * on se contente de la validation locale Luhn (suffisante pour bloquer 99%
 * des SIRET inventes).
 *
 * @param {string} siret
 * @returns {Promise<{valid: boolean, error?: string, company?: object}>}
 */
export async function validateSiret(siret) {
  if (!siret) return { valid: false, error: 'SIRET requis' };

  const normalized = siret.replace(/\s/g, '');

  if (!/^\d{14}$/.test(normalized)) {
    return { valid: false, error: 'Le SIRET doit contenir 14 chiffres' };
  }

  if (!isValidSiretLuhn(normalized)) {
    return { valid: false, error: 'SIRET invalide (checksum Luhn)' };
  }

  // Verification INSEE optionnelle (si token configure)
  if (process.env.INSEE_API_TOKEN) {
    try {
      const response = await fetch(
        `https://api.insee.fr/entreprises/sirene/V3/siret/${normalized}`,
        {
          headers: { Authorization: `Bearer ${process.env.INSEE_API_TOKEN}` },
        }
      );
      if (response.status === 404) {
        return { valid: false, error: "Ce SIRET n'existe pas dans le repertoire INSEE" };
      }
      if (response.ok) {
        const json = await response.json();
        return {
          valid: true,
          company: {
            denomination: json?.etablissement?.uniteLegale?.denominationUniteLegale || null,
            ape: json?.etablissement?.uniteLegale?.activitePrincipaleUniteLegale || null,
          },
        };
      }
      // Erreur reseau / quota INSEE → on accepte (Luhn deja valide)
      return { valid: true };
    } catch (err) {
      console.warn('[SIRET] Erreur verification INSEE, fallback Luhn :', err.message);
      return { valid: true };
    }
  }

  return { valid: true };
}

// ════════════════════════════════════════════════════════════════════
// SMS PHONE VERIFICATION
// ════════════════════════════════════════════════════════════════════

/**
 * Genere un code 6 chiffres aleatoire.
 * @returns {string}
 */
function generateSixDigitCode() {
  // crypto.randomInt est uniformement distribue (pas de biais comme Math.random)
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

/**
 * Cree une verification SMS pour un numero. Envoie un code 6 chiffres
 * via Twilio. Rate-limite par IP et par numero.
 *
 * @param {string} phone - Numero brut (sera formate E164)
 * @param {string} ip - IP du client (pour rate limit)
 * @returns {Promise<{success: boolean, error?: string, simulated?: boolean}>}
 */
export async function createPhoneVerification(phone, ip = null) {
  if (!phone) {
    return { success: false, error: 'Numero de telephone requis' };
  }

  const phoneE164 = formatPhoneE164(phone);

  // Rate limit par IP : max 5 verifications/heure (skip en dev si SKIP_RATE_LIMIT)
  if (ip && !process.env.SKIP_RATE_LIMIT) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from('signup_phone_verifications')
      .select('id', { count: 'exact', head: true })
      .eq('ip', ip)
      .gte('created_at', oneHourAgo);

    if ((count || 0) >= MAX_VERIFICATIONS_PER_IP_PER_HOUR) {
      return {
        success: false,
        error: 'Trop de demandes de verification depuis cette adresse. Reessayez dans 1 heure.',
        code: 'RATE_LIMITED',
      };
    }
  }

  // Cooldown : pas de renvoi avant 60s pour le meme numero
  const cooldownSince = new Date(Date.now() - RESEND_COOLDOWN_SECONDS * 1000).toISOString();
  const { data: recent } = await supabase
    .from('signup_phone_verifications')
    .select('id, created_at')
    .eq('phone_e164', phoneE164)
    .gte('created_at', cooldownSince)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recent) {
    return {
      success: false,
      error: `Patientez ${RESEND_COOLDOWN_SECONDS} secondes avant de renvoyer un code.`,
      code: 'COOLDOWN',
    };
  }

  // Genere et hash le code
  const code = generateSixDigitCode();
  const codeHash = await bcrypt.hash(code, 8);
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000).toISOString();

  // Invalide les anciennes verifications non utilisees pour ce numero
  await supabase
    .from('signup_phone_verifications')
    .delete()
    .eq('phone_e164', phoneE164)
    .is('consumed_at', null);

  // Insere la nouvelle verification
  const { error: insertError } = await supabase
    .from('signup_phone_verifications')
    .insert({
      phone_e164: phoneE164,
      ip: ip || null,
      code_hash: codeHash,
      attempts: 0,
      expires_at: expiresAt,
    });

  if (insertError) {
    console.error('[SignupVerif] Erreur insert verification:', insertError);
    return { success: false, error: "Erreur lors de la generation du code" };
  }

  // Envoie le SMS via le numero NEXUS global (pas de tenantId encore)
  const message = `NEXUS — Votre code de verification : ${code}\nValide ${CODE_TTL_MINUTES} minutes. Ne le partagez jamais.`;
  const result = await sendSMS(phoneE164, message, null, { essential: true });

  if (!result.success && !result.simulated) {
    return { success: false, error: result.error || "Erreur d'envoi du SMS" };
  }

  return { success: true, simulated: !!result.simulated };
}

/**
 * Verifie un code SMS pour un numero. Retourne un verified_token a usage
 * unique en cas de succes, qui devra etre presente lors du POST /signup.
 *
 * @param {string} phone
 * @param {string} code
 * @returns {Promise<{success: boolean, token?: string, error?: string}>}
 */
export async function verifyPhoneCode(phone, code) {
  if (!phone || !code) {
    return { success: false, error: 'Telephone et code requis' };
  }

  const phoneE164 = formatPhoneE164(phone);
  const cleanCode = String(code).replace(/\s/g, '');

  if (!/^\d{6}$/.test(cleanCode)) {
    return { success: false, error: 'Le code doit contenir 6 chiffres' };
  }

  // Recupere la derniere verification non consommee pour ce numero
  const { data: verif, error } = await supabase
    .from('signup_phone_verifications')
    .select('*')
    .eq('phone_e164', phoneE164)
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !verif) {
    return { success: false, error: 'Aucune verification en cours pour ce numero' };
  }

  // Expire ?
  if (new Date(verif.expires_at) < new Date()) {
    return { success: false, error: 'Code expire, demandez-en un nouveau' };
  }

  // Trop de tentatives ?
  if (verif.attempts >= MAX_ATTEMPTS) {
    return { success: false, error: 'Trop de tentatives, demandez un nouveau code' };
  }

  // Verifie le code
  const codeOk = await bcrypt.compare(cleanCode, verif.code_hash);

  if (!codeOk) {
    await supabase
      .from('signup_phone_verifications')
      .update({ attempts: verif.attempts + 1 })
      .eq('id', verif.id);

    const remaining = MAX_ATTEMPTS - (verif.attempts + 1);
    return {
      success: false,
      error: `Code incorrect. ${remaining} tentative(s) restante(s).`,
    };
  }

  // Succes : genere un verified_token a usage unique
  const verifiedToken = crypto.randomBytes(32).toString('hex');

  const { error: updateError } = await supabase
    .from('signup_phone_verifications')
    .update({
      verified_at: new Date().toISOString(),
      verified_token: verifiedToken,
    })
    .eq('id', verif.id);

  if (updateError) {
    console.error('[SignupVerif] Erreur update verified:', updateError);
    return { success: false, error: 'Erreur interne' };
  }

  return { success: true, token: verifiedToken };
}

/**
 * Consomme un verified_token apres signup reussi. Verifie qu'il correspond
 * bien au numero fourni et qu'il n'a pas deja ete utilise. Marque consumed_at.
 *
 * @param {string} phone - Numero du signup
 * @param {string} token - verified_token retourne par verifyPhoneCode
 * @returns {Promise<{valid: boolean, error?: string}>}
 */
export async function consumePhoneToken(phone, token) {
  if (!phone || !token) {
    return { valid: false, error: 'Token de verification SMS requis' };
  }

  const phoneE164 = formatPhoneE164(phone);

  const { data: verif } = await supabase
    .from('signup_phone_verifications')
    .select('id, phone_e164, verified_at, consumed_at, expires_at')
    .eq('verified_token', token)
    .maybeSingle();

  if (!verif) {
    return { valid: false, error: 'Token de verification invalide' };
  }

  if (verif.phone_e164 !== phoneE164) {
    return { valid: false, error: 'Token ne correspond pas au numero fourni' };
  }

  if (verif.consumed_at) {
    return { valid: false, error: 'Token deja utilise' };
  }

  if (!verif.verified_at) {
    return { valid: false, error: 'Numero non verifie' };
  }

  // Token expire ? On accepte 1h apres verification (le temps de finir le signup)
  const verifiedAt = new Date(verif.verified_at);
  if (Date.now() - verifiedAt.getTime() > 60 * 60 * 1000) {
    return { valid: false, error: 'Token de verification expire, recommencez' };
  }

  // Marque consume
  await supabase
    .from('signup_phone_verifications')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', verif.id);

  return { valid: true };
}

// ════════════════════════════════════════════════════════════════════
// EMAIL VERIFICATION (lien cliquable, pas de code 6 chiffres)
// ════════════════════════════════════════════════════════════════════

const EMAIL_TOKEN_TTL_HOURS = 24;
const EMAIL_RESEND_COOLDOWN_SECONDS = 120;
const MAX_EMAIL_VERIFICATIONS_PER_IP_PER_HOUR = 3;

/**
 * Cree une verification email. Envoie un lien cliquable contenant un token 64 hex.
 * Rate-limite par IP (3/h) et cooldown 120s par email.
 *
 * @param {string} email
 * @param {string} ip - IP du client
 * @returns {Promise<{success: boolean, error?: string, code?: string, simulated?: boolean}>}
 */
export async function createEmailVerification(email, ip = null) {
  if (!email) {
    return { success: false, error: 'Email requis' };
  }

  const normalizedEmail = email.trim().toLowerCase();

  // Rate limit par IP : max 3 verifications/heure
  if (ip && !process.env.SKIP_RATE_LIMIT) {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count } = await supabase
      .from('signup_email_verifications')
      .select('id', { count: 'exact', head: true })
      .eq('ip', ip)
      .gte('created_at', oneHourAgo);

    if ((count || 0) >= MAX_EMAIL_VERIFICATIONS_PER_IP_PER_HOUR) {
      return {
        success: false,
        error: 'Trop de demandes de verification depuis cette adresse. Reessayez dans 1 heure.',
        code: 'RATE_LIMITED',
      };
    }
  }

  // Cooldown : pas de renvoi avant 120s pour le meme email
  const cooldownSince = new Date(Date.now() - EMAIL_RESEND_COOLDOWN_SECONDS * 1000).toISOString();
  const { data: recent } = await supabase
    .from('signup_email_verifications')
    .select('id, created_at')
    .eq('email', normalizedEmail)
    .gte('created_at', cooldownSince)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recent) {
    return {
      success: false,
      error: `Patientez ${EMAIL_RESEND_COOLDOWN_SECONDS} secondes avant de renvoyer un email.`,
      code: 'COOLDOWN',
    };
  }

  // Genere un token 64 hex (32 bytes)
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + EMAIL_TOKEN_TTL_HOURS * 60 * 60 * 1000).toISOString();

  // Invalide les anciennes verifications non consommees pour cet email
  await supabase
    .from('signup_email_verifications')
    .delete()
    .eq('email', normalizedEmail)
    .is('consumed_at', null);

  // Insere la nouvelle verification
  const { error: insertError } = await supabase
    .from('signup_email_verifications')
    .insert({
      email: normalizedEmail,
      ip: ip || null,
      token,
      expires_at: expiresAt,
    });

  if (insertError) {
    console.error('[SignupVerif] Erreur insert email verification:', insertError);
    return { success: false, error: "Erreur lors de la generation du lien de verification" };
  }

  // Construire le lien de verification
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
  const verificationUrl = `${frontendUrl}/signup/verify-email?token=${token}`;

  // Envoyer l'email
  const html = templateEmailVerification(verificationUrl);
  const result = await sendEmail({
    to: normalizedEmail,
    subject: 'NEXUS — Verifiez votre adresse email',
    html,
    tags: ['signup-email-verification'],
  });

  if (!result.success && !result.simulated) {
    return { success: false, error: result.error || "Erreur d'envoi de l'email" };
  }

  return { success: true, simulated: !!result.simulated };
}

/**
 * Verifie un token email recu via lien cliquable.
 * Retourne un verified_token a usage unique pour le signup.
 *
 * @param {string} token - Le token 64 hex du lien
 * @returns {Promise<{success: boolean, verified_token?: string, email?: string, error?: string}>}
 */
export async function verifyEmailToken(token) {
  if (!token) {
    return { success: false, error: 'Token requis' };
  }

  // Cherche le token non consomme
  const { data: verif, error } = await supabase
    .from('signup_email_verifications')
    .select('*')
    .eq('token', token)
    .is('consumed_at', null)
    .maybeSingle();

  if (error || !verif) {
    return { success: false, error: 'Lien de verification invalide ou deja utilise' };
  }

  // Expire ?
  if (new Date(verif.expires_at) < new Date()) {
    return { success: false, error: 'Lien expire, demandez-en un nouveau' };
  }

  // Deja verifie ? Retourner le meme verified_token
  if (verif.verified_at && verif.verified_token) {
    return { success: true, verified_token: verif.verified_token, email: verif.email };
  }

  // Genere un verified_token a usage unique
  const verifiedToken = crypto.randomBytes(32).toString('hex');

  const { error: updateError } = await supabase
    .from('signup_email_verifications')
    .update({
      verified_at: new Date().toISOString(),
      verified_token: verifiedToken,
    })
    .eq('id', verif.id);

  if (updateError) {
    console.error('[SignupVerif] Erreur update email verified:', updateError);
    return { success: false, error: 'Erreur interne' };
  }

  return { success: true, verified_token: verifiedToken, email: verif.email };
}

/**
 * Consomme un verified_token email apres signup reussi.
 * Verifie qu'il correspond au bon email et n'est pas deja consomme.
 *
 * @param {string} email
 * @param {string} token - verified_token retourne par verifyEmailToken
 * @returns {Promise<{valid: boolean, error?: string}>}
 */
export async function consumeEmailToken(email, token) {
  if (!email || !token) {
    return { valid: false, error: 'Token de verification email requis' };
  }

  const normalizedEmail = email.trim().toLowerCase();

  const { data: verif } = await supabase
    .from('signup_email_verifications')
    .select('id, email, verified_at, consumed_at')
    .eq('verified_token', token)
    .maybeSingle();

  if (!verif) {
    return { valid: false, error: 'Token de verification email invalide' };
  }

  if (verif.email !== normalizedEmail) {
    return { valid: false, error: 'Token ne correspond pas a l\'email fourni' };
  }

  if (verif.consumed_at) {
    return { valid: false, error: 'Token deja utilise' };
  }

  if (!verif.verified_at) {
    return { valid: false, error: 'Email non verifie' };
  }

  // Token expire ? On accepte 24h apres verification (meme TTL que le lien)
  const verifiedAt = new Date(verif.verified_at);
  if (Date.now() - verifiedAt.getTime() > 24 * 60 * 60 * 1000) {
    return { valid: false, error: 'Token de verification expire, recommencez' };
  }

  // Marque consomme
  await supabase
    .from('signup_email_verifications')
    .update({ consumed_at: new Date().toISOString() })
    .eq('id', verif.id);

  return { valid: true };
}

export default {
  validateSiret,
  isValidSiretLuhn,
  createPhoneVerification,
  verifyPhoneCode,
  consumePhoneToken,
  createEmailVerification,
  verifyEmailToken,
  consumeEmailToken,
};
