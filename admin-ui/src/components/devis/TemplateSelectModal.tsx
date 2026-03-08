import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { X, LayoutTemplate } from 'lucide-react';
import type { DevisTemplate } from './types';
import { METIER_LABELS } from './types';

export interface TemplateSelectModalProps {
  onClose: () => void;
  onSelect: (template: DevisTemplate) => void;
}

export default function TemplateSelectModal({ onClose, onSelect }: TemplateSelectModalProps) {
  const { data, isLoading } = useQuery<{ templates: DevisTemplate[] }>({
    queryKey: ['devis-templates'],
    queryFn: () => api.get<{ templates: DevisTemplate[] }>('/admin/devis/templates'),
  });

  const templates = data?.templates || [];
  const metiers = [...new Set(templates.map(t => t.metier))];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[80vh] overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <LayoutTemplate className="w-5 h-5" />
            Templates de devis
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto max-h-[65vh]">
          {isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            </div>
          ) : (
            metiers.map(metier => (
              <div key={metier} className="mb-6">
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">
                  {METIER_LABELS[metier] || metier}
                </h3>
                <div className="grid gap-3">
                  {templates.filter(t => t.metier === metier).map(template => {
                    const total = template.lignes.reduce((s, l) => s + l.quantite * l.prix_unitaire, 0);
                    return (
                      <button
                        key={template.id}
                        onClick={() => onSelect(template)}
                        className="text-left p-4 border rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium text-gray-900">{template.nom}</p>
                            <p className="text-sm text-gray-500 mt-0.5">{template.description}</p>
                            <p className="text-xs text-gray-400 mt-1">{template.lignes.length} ligne{template.lignes.length > 1 ? 's' : ''}</p>
                          </div>
                          <span className="text-sm font-semibold text-blue-600 whitespace-nowrap ml-4">
                            {new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(total)}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
