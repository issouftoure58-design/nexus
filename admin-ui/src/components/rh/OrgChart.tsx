/**
 * OrgChart — Organigramme de l'équipe
 * Arbre CSS flexbox depuis données rh_membres
 */
import { useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Users, Crown, UserCheck, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Membre {
  id: number;
  nom: string;
  prenom: string;
  role: string;
  statut: string;
  poste?: string;
  email: string;
  telephone: string;
}

interface OrgChartProps {
  membres: Membre[];
}

// Hiérarchie des rôles
const ROLE_HIERARCHY: Record<string, number> = {
  gerant: 0,
  manager: 1,
  responsable: 1,
  senior: 2,
  employe: 3,
  stagiaire: 4,
  apprenti: 4,
};

const ROLE_LABELS: Record<string, string> = {
  gerant: 'Gérant',
  manager: 'Manager',
  responsable: 'Responsable',
  senior: 'Senior',
  employe: 'Employé',
  stagiaire: 'Stagiaire',
  apprenti: 'Apprenti',
};

const ROLE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  gerant: { bg: 'bg-gradient-to-br from-yellow-400 to-orange-500', text: 'text-white', border: 'border-yellow-400' },
  manager: { bg: 'bg-gradient-to-br from-blue-500 to-indigo-600', text: 'text-white', border: 'border-blue-400' },
  responsable: { bg: 'bg-gradient-to-br from-blue-500 to-indigo-600', text: 'text-white', border: 'border-blue-400' },
  senior: { bg: 'bg-gradient-to-br from-cyan-500 to-blue-500', text: 'text-white', border: 'border-cyan-400' },
  employe: { bg: 'bg-white', text: 'text-gray-900', border: 'border-gray-200' },
  stagiaire: { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' },
  apprenti: { bg: 'bg-gray-50', text: 'text-gray-600', border: 'border-gray-200' },
};

function PersonCard({ membre }: { membre: Membre }) {
  const colors = ROLE_COLORS[membre.role] || ROLE_COLORS.employe;
  const RoleIcon = membre.role === 'gerant' ? Crown :
                   membre.role === 'manager' || membre.role === 'responsable' ? UserCheck : User;

  return (
    <div className={cn(
      'inline-flex flex-col items-center px-4 py-3 rounded-xl border-2 shadow-sm min-w-[140px] transition-shadow hover:shadow-md',
      colors.bg, colors.border
    )}>
      <div className={cn(
        'w-10 h-10 rounded-full flex items-center justify-center mb-2',
        colors.text === 'text-white' ? 'bg-white/20' : 'bg-gray-100'
      )}>
        <RoleIcon className={cn('w-5 h-5', colors.text === 'text-white' ? 'text-white' : 'text-gray-600')} />
      </div>
      <p className={cn('font-semibold text-sm', colors.text)}>
        {membre.prenom} {membre.nom}
      </p>
      <p className={cn('text-xs mt-0.5', colors.text === 'text-white' ? 'text-white/80' : 'text-gray-500')}>
        {membre.poste || ROLE_LABELS[membre.role] || membre.role}
      </p>
      {membre.statut !== 'actif' && (
        <span className="text-xs mt-1 px-2 py-0.5 bg-red-100 text-red-600 rounded-full">
          {membre.statut}
        </span>
      )}
    </div>
  );
}

interface OrgLevel {
  level: number;
  membres: Membre[];
}

export default function OrgChart({ membres }: OrgChartProps) {
  const levels = useMemo((): OrgLevel[] => {
    const activeMembres = membres.filter(m => m.statut === 'actif');

    // Grouper par niveau hiérarchique
    const grouped = new Map<number, Membre[]>();
    for (const m of activeMembres) {
      const level = ROLE_HIERARCHY[m.role] ?? 3;
      if (!grouped.has(level)) grouped.set(level, []);
      grouped.get(level)!.push(m);
    }

    return Array.from(grouped.entries())
      .sort(([a], [b]) => a - b)
      .map(([level, members]) => ({ level, membres: members }));
  }, [membres]);

  if (membres.filter(m => m.statut === 'actif').length === 0) {
    return (
      <Card className="p-8 text-center text-gray-500">
        <Users className="w-10 h-10 mx-auto mb-3 text-gray-300" />
        <p className="font-medium">Aucun employé actif</p>
        <p className="text-sm mt-1">Ajoutez des employés pour voir l'organigramme</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
          <Users className="w-5 h-5 text-cyan-600" />
          Organigramme
        </h3>
        <p className="text-sm text-gray-500 mt-1">
          {membres.filter(m => m.statut === 'actif').length} membres actifs
        </p>
      </div>

      <Card className="p-6 overflow-x-auto">
        <div className="flex flex-col items-center gap-0 min-w-max">
          {levels.map((level, levelIndex) => (
            <div key={level.level} className="flex flex-col items-center">
              {/* Connector line from top */}
              {levelIndex > 0 && (
                <div className="flex flex-col items-center">
                  <div className="w-px h-6 bg-gray-300" />
                  {level.membres.length > 1 && (
                    <div className="flex items-center">
                      <div
                        className="h-px bg-gray-300"
                        style={{ width: `${(level.membres.length - 1) * 180}px` }}
                      />
                    </div>
                  )}
                </div>
              )}

              {/* Members at this level */}
              <div className="flex items-start gap-6 justify-center">
                {level.membres.map((membre, _i) => (
                  <div key={membre.id} className="flex flex-col items-center">
                    {/* Individual connector */}
                    {levelIndex > 0 && level.membres.length > 1 && (
                      <div className="w-px h-4 bg-gray-300" />
                    )}
                    <PersonCard membre={membre} />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {Object.entries(ROLE_LABELS).map(([key, label]) => {
          const colors = ROLE_COLORS[key] || ROLE_COLORS.employe;
          const count = membres.filter(m => m.role === key && m.statut === 'actif').length;
          if (count === 0) return null;
          return (
            <div key={key} className="flex items-center gap-1.5">
              <div className={cn('w-3 h-3 rounded-full border', colors.bg, colors.border)} />
              <span className="text-gray-600">{label} ({count})</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
