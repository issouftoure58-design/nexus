/**
 * OnboardingChecklist — Checklist d'intégration pour nouveaux employés
 * Basé sur les données rh_membres, pas de backend dédié
 */
import { useState, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import {
  CheckCircle, Circle, User, ChevronDown, ChevronUp,
  ClipboardList, Calendar, Shield, Book, Monitor, Users
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Membre {
  id: number;
  nom: string;
  prenom: string;
  role: string;
  statut: string;
  date_embauche: string;
  email: string;
  telephone: string;
  nir?: string;
  iban?: string;
  contact_urgence_nom?: string;
  mutuelle_obligatoire?: boolean;
}

interface OnboardingChecklistProps {
  membres: Membre[];
}

interface ChecklistItem {
  id: string;
  label: string;
  description: string;
  icon: React.ElementType;
  category: string;
  autoCheck?: (membre: Membre) => boolean;
}

const CHECKLIST_ITEMS: ChecklistItem[] = [
  // Administratif
  { id: 'contrat', label: 'Contrat de travail signé', description: 'Contrat signé par les deux parties', icon: ClipboardList, category: 'Administratif' },
  { id: 'nir', label: 'N° Sécurité sociale renseigné', description: 'NIR du salarié enregistré', icon: Shield, category: 'Administratif', autoCheck: (m) => !!m.nir },
  { id: 'iban', label: 'RIB / IBAN fourni', description: 'Coordonnées bancaires pour le virement', icon: Shield, category: 'Administratif', autoCheck: (m) => !!m.iban },
  { id: 'urgence', label: 'Contact d\'urgence', description: 'Personne à contacter en cas d\'urgence', icon: Users, category: 'Administratif', autoCheck: (m) => !!m.contact_urgence_nom },
  { id: 'mutuelle', label: 'Mutuelle configurée', description: 'Adhésion ou dispense mutuelle', icon: Shield, category: 'Administratif', autoCheck: (m) => m.mutuelle_obligatoire !== undefined },
  // Formation
  { id: 'visite', label: 'Visite des locaux', description: 'Tour du lieu de travail et présentation équipe', icon: Monitor, category: 'Formation' },
  { id: 'formation_poste', label: 'Formation au poste', description: 'Formation initiale sur les tâches et outils', icon: Book, category: 'Formation' },
  { id: 'outils', label: 'Accès aux outils', description: 'Email, logiciels, badges, clés', icon: Monitor, category: 'Formation' },
  { id: 'securite', label: 'Formation sécurité', description: 'Consignes de sécurité et procédures d\'évacuation', icon: Shield, category: 'Formation' },
  // Intégration
  { id: 'presentation', label: 'Présentation à l\'équipe', description: 'Introduction formelle aux collègues', icon: Users, category: 'Intégration' },
  { id: 'parrain', label: 'Parrain/tuteur désigné', description: 'Un collègue référent pour les premières semaines', icon: User, category: 'Intégration' },
  { id: 'rdv_suivi', label: 'RDV de suivi planifié', description: 'Point après 1 semaine, 1 mois, 3 mois', icon: Calendar, category: 'Intégration' },
];

export default function OnboardingChecklist({ membres }: OnboardingChecklistProps) {
  // Stocker la progression en local (pas de backend dédié)
  const [checkedItems, setCheckedItems] = useState<Record<number, Set<string>>>(() => {
    try {
      const saved = localStorage.getItem('nexus_onboarding_progress');
      if (saved) {
        const parsed = JSON.parse(saved);
        const result: Record<number, Set<string>> = {};
        for (const [key, items] of Object.entries(parsed)) {
          result[Number(key)] = new Set(items as string[]);
        }
        return result;
      }
    } catch { /* noop */ }
    return {};
  });

  const [expandedMembre, setExpandedMembre] = useState<number | null>(null);

  // Nouveaux employés (embauché dans les 90 derniers jours)
  const newMembers = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 90);
    return membres
      .filter(m => m.statut === 'actif' && new Date(m.date_embauche) >= cutoff)
      .sort((a, b) => new Date(b.date_embauche).getTime() - new Date(a.date_embauche).getTime());
  }, [membres]);

  const toggleItem = (membreId: number, itemId: string) => {
    setCheckedItems(prev => {
      const membreSet = new Set(prev[membreId] || []);
      if (membreSet.has(itemId)) {
        membreSet.delete(itemId);
      } else {
        membreSet.add(itemId);
      }
      const updated = { ...prev, [membreId]: membreSet };

      // Persist
      const serializable: Record<number, string[]> = {};
      for (const [key, set] of Object.entries(updated)) {
        serializable[Number(key)] = Array.from(set);
      }
      localStorage.setItem('nexus_onboarding_progress', JSON.stringify(serializable));

      return updated;
    });
  };

  const isChecked = (membre: Membre, item: ChecklistItem): boolean => {
    if (item.autoCheck?.(membre)) return true;
    return checkedItems[membre.id]?.has(item.id) || false;
  };

  const getProgress = (membre: Membre): number => {
    const total = CHECKLIST_ITEMS.length;
    const done = CHECKLIST_ITEMS.filter(item => isChecked(membre, item)).length;
    return Math.round((done / total) * 100);
  };

  const categories = [...new Set(CHECKLIST_ITEMS.map(i => i.category))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-cyan-600" />
            Onboarding — Checklist d'intégration
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            Suivi des {newMembers.length} employé(s) embauchés ces 90 derniers jours
          </p>
        </div>
      </div>

      {newMembers.length === 0 ? (
        <Card className="p-8 text-center text-gray-500">
          <Users className="w-10 h-10 mx-auto mb-3 text-gray-300" />
          <p className="font-medium">Aucun nouvel employé récent</p>
          <p className="text-sm mt-1">La checklist apparaîtra pour les employés embauchés dans les 90 derniers jours</p>
        </Card>
      ) : (
        <div className="space-y-4">
          {newMembers.map(membre => {
            const progress = getProgress(membre);
            const isExpanded = expandedMembre === membre.id;

            return (
              <Card key={membre.id} className="overflow-hidden">
                {/* Header */}
                <button
                  onClick={() => setExpandedMembre(isExpanded ? null : membre.id)}
                  className="w-full px-5 py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-sm font-semibold text-blue-600">
                        {membre.prenom[0]}{membre.nom[0]}
                      </span>
                    </div>
                    <div className="text-left">
                      <p className="font-medium text-gray-900">{membre.prenom} {membre.nom}</p>
                      <p className="text-xs text-gray-500">
                        Embauché le {new Date(membre.date_embauche).toLocaleDateString('fr-FR')} — {membre.role}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {/* Progress bar */}
                    <div className="hidden sm:flex items-center gap-2">
                      <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full transition-all',
                            progress >= 100 ? 'bg-green-500' :
                            progress >= 50 ? 'bg-cyan-500' : 'bg-orange-500'
                          )}
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className={cn(
                        'text-sm font-medium',
                        progress >= 100 ? 'text-green-600' :
                        progress >= 50 ? 'text-cyan-600' : 'text-orange-600'
                      )}>
                        {progress}%
                      </span>
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                  </div>
                </button>

                {/* Checklist */}
                {isExpanded && (
                  <div className="border-t px-5 py-4 space-y-6">
                    {categories.map(category => (
                      <div key={category}>
                        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{category}</h4>
                        <div className="space-y-1">
                          {CHECKLIST_ITEMS.filter(i => i.category === category).map(item => {
                            const checked = isChecked(membre, item);
                            const isAuto = item.autoCheck?.(membre);
                            return (
                              <button
                                key={item.id}
                                onClick={() => !isAuto && toggleItem(membre.id, item.id)}
                                className={cn(
                                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors',
                                  checked ? 'bg-green-50' : 'hover:bg-gray-50',
                                  isAuto && 'cursor-default'
                                )}
                              >
                                {checked ? (
                                  <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                                ) : (
                                  <Circle className="w-5 h-5 text-gray-300 flex-shrink-0" />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className={cn('text-sm font-medium', checked && 'text-green-700 line-through')}>
                                    {item.label}
                                  </p>
                                  <p className="text-xs text-gray-500">{item.description}</p>
                                </div>
                                {isAuto && (
                                  <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded">Auto</span>
                                )}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
