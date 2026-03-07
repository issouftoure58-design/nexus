/**
 * Génère une palette de nuances (50-900) à partir d'une couleur hex.
 * Utilisé pour appliquer dynamiquement la couleur primaire du tenant.
 */

function hexToHsl(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return [197, 71, 73]; // cyan-500 fallback

  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

export function generatePalette(hex: string): Record<string, string> {
  const [h, s] = hexToHsl(hex);

  // Générer les nuances en gardant la teinte, en ajustant saturation et luminosité
  return {
    '50':  hslToHex(h, Math.min(s, 100), 96),
    '100': hslToHex(h, Math.min(s, 96), 90),
    '200': hslToHex(h, Math.min(s, 90), 80),
    '300': hslToHex(h, Math.min(s, 85), 66),
    '400': hslToHex(h, Math.min(s, 80), 53),
    '500': hex,
    '600': hslToHex(h, Math.min(s + 5, 100), 40),
    '700': hslToHex(h, Math.min(s + 5, 100), 33),
    '800': hslToHex(h, Math.min(s + 5, 100), 26),
    '900': hslToHex(h, Math.min(s + 5, 100), 20),
  };
}

/**
 * Applique la couleur primaire du tenant comme CSS custom properties.
 * Injecte un <style> qui override les classes Tailwind cyan-*.
 */
export function applyTenantTheme(hex: string | undefined): void {
  const STYLE_ID = 'nexus-tenant-theme';

  // Retirer l'ancien style s'il existe
  const existing = document.getElementById(STYLE_ID);
  if (existing) existing.remove();

  if (!hex || hex === '#0EA5E9' || hex === '#06B6D4') {
    // Couleur par défaut (cyan Tailwind) — pas besoin d'override
    return;
  }

  const palette = generatePalette(hex);

  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    /* NEXUS Tenant Theme Override */
    .bg-cyan-50 { background-color: ${palette['50']} !important; }
    .bg-cyan-100 { background-color: ${palette['100']} !important; }
    .bg-cyan-200 { background-color: ${palette['200']} !important; }
    .bg-cyan-300 { background-color: ${palette['300']} !important; }
    .bg-cyan-400 { background-color: ${palette['400']} !important; }
    .bg-cyan-500 { background-color: ${palette['500']} !important; }
    .bg-cyan-600 { background-color: ${palette['600']} !important; }
    .bg-cyan-700 { background-color: ${palette['700']} !important; }

    .text-cyan-400 { color: ${palette['400']} !important; }
    .text-cyan-500 { color: ${palette['500']} !important; }
    .text-cyan-600 { color: ${palette['600']} !important; }
    .text-cyan-700 { color: ${palette['700']} !important; }
    .text-cyan-800 { color: ${palette['800']} !important; }

    .border-cyan-200 { border-color: ${palette['200']} !important; }
    .border-cyan-300 { border-color: ${palette['300']} !important; }
    .border-cyan-500 { border-color: ${palette['500']} !important; }

    .ring-cyan-500 { --tw-ring-color: ${palette['500']} !important; }
    .focus\\:ring-cyan-500:focus { --tw-ring-color: ${palette['500']} !important; }

    .from-cyan-500 { --tw-gradient-from: ${palette['500']} !important; }
    .to-cyan-600 { --tw-gradient-to: ${palette['600']} !important; }
    .from-cyan-50 { --tw-gradient-from: ${palette['50']} !important; }
    .to-blue-50 { --tw-gradient-to: ${palette['100']} !important; }

    .hover\\:bg-cyan-600:hover { background-color: ${palette['600']} !important; }
    .hover\\:text-cyan-600:hover { color: ${palette['600']} !important; }
    .hover\\:text-cyan-700:hover { color: ${palette['700']} !important; }
    .hover\\:border-cyan-500:hover { border-color: ${palette['500']} !important; }
  `;

  document.head.appendChild(style);
}
