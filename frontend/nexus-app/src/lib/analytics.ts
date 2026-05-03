/**
 * Google Analytics 4 — Utilitaire minimaliste
 * Respecte le consentement cookies (nexus_cookie_consent)
 */

declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
    dataLayer: unknown[];
  }
}

let initialized = false;

function hasAnalyticsConsent(): boolean {
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

export function initGA(measurementId: string | undefined): void {
  if (!measurementId || initialized) return;
  if (!hasAnalyticsConsent()) return;

  // Charger gtag.js
  const script = document.createElement('script');
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function (...args: unknown[]) {
    window.dataLayer.push(args);
  };
  window.gtag('js', new Date());
  window.gtag('config', measurementId, {
    send_page_view: false, // On envoie manuellement
  });

  initialized = true;
}

export function trackPageView(path: string, title?: string): void {
  if (!initialized || !window.gtag) return;
  window.gtag('event', 'page_view', {
    page_path: path,
    page_title: title || document.title,
  });
}

export function trackEvent(
  action: string,
  category?: string,
  label?: string,
  value?: number
): void {
  if (!initialized || !window.gtag) return;
  window.gtag('event', action, {
    event_category: category,
    event_label: label,
    value,
  });
}
