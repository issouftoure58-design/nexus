/**
 * PermissionSelector — Grille de selection des permissions par module
 * Reutilisable dans le formulaire d'invitation et l'edition de membre
 */

import { useCallback } from 'react';
import { cn } from '@/lib/utils';

// Matrice RBAC par defaut (miroir de backend/src/middleware/rbac.js)
const ROLE_PERMISSIONS: Record<string, Record<string, string[]>> = {
  admin: {
    clients: ['read', 'write', 'delete'],
    reservations: ['read', 'write', 'delete'],
    services: ['read', 'write', 'delete'],
    disponibilites: ['read', 'write', 'delete'],
    parametres: ['read', 'write', 'delete'],
    equipe: ['read', 'write', 'delete'],
    comptabilite: ['read', 'write', 'delete'],
    stock: ['read', 'write', 'delete'],
    rh: ['read', 'write', 'delete'],
    marketing: ['read', 'write', 'delete'],
    devis: ['read', 'write', 'delete'],
    seo: ['read', 'write', 'delete'],
    ia: ['read', 'write', 'delete'],
    billing: ['read', 'write', 'delete'],
    api_keys: ['read', 'write', 'delete'],
    audit: ['read'],
    stats: ['read'],
    modules: ['read', 'write', 'delete'],
  },
  manager: {
    clients: ['read', 'write'],
    reservations: ['read', 'write'],
    services: ['read', 'write'],
    disponibilites: ['read', 'write'],
    parametres: ['read'],
    equipe: ['read'],
    comptabilite: ['read', 'write'],
    stock: ['read', 'write'],
    rh: ['read'],
    marketing: ['read', 'write'],
    devis: ['read', 'write'],
    seo: ['read', 'write'],
    ia: ['read'],
    billing: ['read'],
    api_keys: [],
    audit: ['read'],
    stats: ['read'],
    modules: ['read'],
  },
  viewer: {
    clients: ['read'],
    reservations: ['read'],
    services: ['read'],
    disponibilites: ['read'],
    parametres: ['read'],
    equipe: [],
    comptabilite: ['read'],
    stock: ['read'],
    rh: [],
    marketing: ['read'],
    devis: ['read'],
    seo: ['read'],
    ia: ['read'],
    billing: [],
    api_keys: [],
    audit: [],
    stats: ['read'],
    modules: ['read'],
  },
};

// Groupes de modules pour l'affichage
const MODULE_GROUPS = [
  {
    label: 'Principal',
    modules: [
      { key: 'clients', label: 'Clients' },
      { key: 'reservations', label: 'Reservations' },
      { key: 'services', label: 'Services' },
      { key: 'disponibilites', label: 'Disponibilites' },
    ],
  },
  {
    label: 'IA & Automatisation',
    modules: [
      { key: 'ia', label: 'Agents IA' },
    ],
  },
  {
    label: 'Business',
    modules: [
      { key: 'comptabilite', label: 'Comptabilite' },
      { key: 'stock', label: 'Stock' },
      { key: 'rh', label: 'Equipe RH' },
      { key: 'devis', label: 'Devis' },
      { key: 'stats', label: 'Analytics' },
    ],
  },
  {
    label: 'Marketing',
    modules: [
      { key: 'marketing', label: 'Marketing' },
      { key: 'seo', label: 'SEO' },
    ],
  },
  {
    label: 'Systeme',
    modules: [
      { key: 'parametres', label: 'Parametres' },
      { key: 'equipe', label: 'Equipe' },
      { key: 'billing', label: 'Facturation' },
      { key: 'api_keys', label: 'Cles API' },
      { key: 'audit', label: 'Audit' },
      { key: 'modules', label: 'Modules' },
    ],
  },
];

interface PermissionSelectorProps {
  value: Record<string, string[]>;
  onChange: (permissions: Record<string, string[]>) => void;
  disabled?: boolean;
}

export function getDefaultPermissions(role: string): Record<string, string[]> {
  return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.viewer;
}

export function PermissionSelector({ value, onChange, disabled = false }: PermissionSelectorProps) {
  const togglePermission = useCallback((module: string, permission: string) => {
    if (disabled) return;
    const current = value[module] || [];
    let updated: string[];

    if (current.includes(permission)) {
      // Remove permission (and remove dependents: delete requires write, write requires read)
      if (permission === 'read') {
        updated = []; // Removing read removes all
      } else if (permission === 'write') {
        updated = current.filter(p => p !== 'write' && p !== 'delete');
      } else {
        updated = current.filter(p => p !== permission);
      }
    } else {
      // Add permission (and add dependencies: write requires read, delete requires write+read)
      if (permission === 'delete') {
        updated = [...new Set([...current, 'read', 'write', 'delete'])];
      } else if (permission === 'write') {
        updated = [...new Set([...current, 'read', 'write'])];
      } else {
        updated = [...new Set([...current, permission])];
      }
    }

    onChange({ ...value, [module]: updated });
  }, [value, onChange, disabled]);

  return (
    <div className="space-y-4">
      {MODULE_GROUPS.map(group => (
        <div key={group.label}>
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            {group.label}
          </h4>
          <div className="border rounded-lg overflow-hidden">
            {/* Header */}
            <div className="grid grid-cols-[1fr_60px_60px_80px] bg-gray-50 px-3 py-1.5 text-xs font-medium text-gray-500 border-b">
              <span>Module</span>
              <span className="text-center">Voir</span>
              <span className="text-center">Editer</span>
              <span className="text-center">Supprimer</span>
            </div>
            {/* Rows */}
            {group.modules.map((mod, idx) => {
              const perms = value[mod.key] || [];
              return (
                <div
                  key={mod.key}
                  className={cn(
                    'grid grid-cols-[1fr_60px_60px_80px] px-3 py-2 items-center',
                    idx < group.modules.length - 1 && 'border-b'
                  )}
                >
                  <span className="text-sm text-gray-700">{mod.label}</span>
                  {(['read', 'write', 'delete'] as const).map(perm => (
                    <div key={perm} className="flex justify-center">
                      <input
                        type="checkbox"
                        checked={perms.includes(perm)}
                        onChange={() => togglePermission(mod.key, perm)}
                        disabled={disabled}
                        className={cn(
                          'w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500',
                          disabled && 'opacity-50 cursor-not-allowed'
                        )}
                      />
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

export default PermissionSelector;
