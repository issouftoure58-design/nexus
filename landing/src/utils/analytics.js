/**
 * Google Analytics 4 — Utilitaire minimaliste (Landing NEXUS)
 * Respecte le consentement cookies (nexus_cookie_consent)
 */

let initialized = false;

function hasAnalyticsConsent() {
  try {
    const raw = localStorage.getItem('nexus_cookie_consent');
    if (!raw) return false;
    const parsed = JSON.parse(raw);
    if (Date.now() > parsed.expiry) return false;
    return parsed.analytics === true;
  } catch {
    return false;
  }
}

export function initGA(measurementId) {
  if (!measurementId || initialized) return;
  if (!hasAnalyticsConsent()) return;

  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function (...args) {
    window.dataLayer.push(args);
  };
  window.gtag('js', new Date());
  window.gtag('config', measurementId);

  initialized = true;
}

export function trackEvent(action, category, label, value) {
  if (!initialized || !window.gtag) return;
  window.gtag('event', action, {
    event_category: category,
    event_label: label,
    value,
  });
}

export function isGAInitialized() {
  return initialized;
}
