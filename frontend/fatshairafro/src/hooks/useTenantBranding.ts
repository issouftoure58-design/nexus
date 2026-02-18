import { useEffect, useState } from 'react';

interface TenantBranding {
  businessName: string;
  assistantName: string;
  logoUrl: string;
  faviconUrl: string;
  primaryColor: string;
  accentColor: string;
}

// Default NEXUS branding
const DEFAULT_BRANDING: TenantBranding = {
  businessName: 'NEXUS',
  assistantName: 'NEXUS',
  logoUrl: '',
  faviconUrl: '/favicon-nexus.svg',
  primaryColor: '#22d3ee',
  accentColor: '#3b82f6',
};

export function useTenantBranding() {
  const [branding, setBranding] = useState<TenantBranding | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    if (!token) return;

    fetch('/api/admin/branding', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => {
        if (data.success && data.branding) {
          setBranding(data.branding);

          // Dynamic favicon (tenant-specific)
          const favicon = document.getElementById('favicon') as HTMLLinkElement;
          if (favicon && data.branding.faviconUrl) {
            favicon.href = data.branding.faviconUrl;
          }

          // Dynamic title (tenant-specific)
          document.title = `${data.branding.businessName} | ${data.branding.assistantName} Pro`;
        }
      })
      .catch(err => {
        console.error('Branding fetch error:', err);
        // Use default NEXUS branding on error
        setBranding(DEFAULT_BRANDING);
      });
  }, []);

  return branding;
}
