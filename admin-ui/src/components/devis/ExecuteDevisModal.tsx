import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, Devis } from '@/lib/api';
import { X, Clock } from 'lucide-react';
import { useProfile } from '@/contexts/ProfileContext';
import type { Ressource, DevisLigneDetail, AffectationExec } from './types';

export interface ExecuteDevisModalProps {
  devis: Devis;
  onClose: () => void;
  onExecute: (data: {
    date_rdv: string;
    heure_rdv: string;
    affectations?: Array<{
      ressource_id: number;
      ligne_id?: number;
      membre_id?: number;
      heure_debut?: string;
      heure_fin?: string;
    }>;
  }) => void;
  isLoading: boolean;
}

export default function ExecuteDevisModal({ devis, onClose, onExecute, isLoading }: ExecuteDevisModalProps) {
  // Profile pour adapter le texte
  const { profile, t, isPricingMode, isBusinessType } = useProfile();

  // Affectation membre uniquement pour salon/service_domicile (pas restaurant/hotel)
  const showMemberAssignment = !isBusinessType('restaurant') && !isBusinessType('hotel');

  // Pre-remplir avec les valeurs du devis si disponibles
  const devisData = devis as Devis & { date_prestation?: string; heure_prestation?: string };
  const [dateRdv, setDateRdv] = useState(devisData.date_prestation || '');
  const [heureRdv, setHeureRdv] = useState(devisData.heure_prestation || '10:00');
  const [dateInitialisee, setDateInitialisee] = useState(!!devisData.date_prestation);
  // Affectations enrichies avec heures
  const [affectations, setAffectations] = useState<Record<number, AffectationExec>>({});
  const [serviceEnCours, setServiceEnCours] = useState<number | null>(null);

  // Fetch lignes du devis (avec vraies durees)
  const { data: devisDetailData, error: devisDetailError } = useQuery<{ devis: Devis & { date_prestation?: string; heure_prestation?: string }; lignes: DevisLigneDetail[] }>({
    queryKey: ['devis-detail-exec', devis.id],
    queryFn: () => api.get<{ devis: Devis & { date_prestation?: string; heure_prestation?: string }; lignes: DevisLigneDetail[] }>(`/admin/devis/${devis.id}`),
    retry: 1
  });

  // Pre-remplir quand les donnees detaillees sont chargees
  useEffect(() => {
    if (devisDetailData?.devis && !dateInitialisee) {
      if (devisDetailData.devis.date_prestation) {
        setDateRdv(devisDetailData.devis.date_prestation);
        setDateInitialisee(true);
      }
      if (devisDetailData.devis.heure_prestation) {
        setHeureRdv(devisDetailData.devis.heure_prestation);
      }
    }
  }, [devisDetailData, dateInitialisee]);

  const lignesDevis = devisDetailData?.lignes || [];

  // Pre-remplir les affectations a partir des lignes du devis (si elles ont des heures definies)
  useEffect(() => {
    if (lignesDevis.length > 0) {
      const newAffectations: Record<number, AffectationExec> = {};
      lignesDevis.forEach(ligne => {
        // Si la ligne a un membre_id ou des heures, pre-remplir
        if (ligne.membre_id || ligne.heure_debut || ligne.heure_fin) {
          newAffectations[ligne.id] = {
            membre_id: ligne.membre_id || 0,
            heure_debut: ligne.heure_debut || heureRdv,
            heure_fin: ligne.heure_fin || ''
          };
        }
      });
      // Seulement mettre a jour si on a des affectations a pre-remplir
      if (Object.keys(newAffectations).length > 0) {
        setAffectations(prev => {
          // Ne pas ecraser les modifications de l'utilisateur
          const merged = { ...prev };
          for (const [id, aff] of Object.entries(newAffectations)) {
            if (!merged[parseInt(id)]) {
              merged[parseInt(id)] = aff;
            }
          }
          return merged;
        });
      }
    }
  }, [lignesDevis, heureRdv]);

  // Calcul duree totale
  const dureeTotale = lignesDevis.reduce((sum, l) => sum + (l.duree_minutes || 60) * (l.quantite || 1), 0) || devis.duree_minutes || 60;

  // Fetch membres RH pour affectation
  const { data: membresData, isLoading: dispoLoading } = useQuery<Array<{ id: number; nom: string; prenom: string; role: string }>>({
    queryKey: ['membres-equipe-execute'],
    queryFn: () => api.get<Array<{ id: number; nom: string; prenom: string; role: string }>>('/admin/rh/membres'),
  });

  // Convertir les membres en format ressource pour compatibilite avec l'UI existante
  const ressourcesDisponibles: Ressource[] = (membresData || []).map(m => ({
    id: m.id,
    nom: `${m.prenom} ${m.nom}`,
    categorie: m.role
  }));
  const ressourcesOccupees: Array<Ressource & { raison: string }> = [];
  const prochainesDispos: Array<{ ressource_id: number; ressource_nom: string; date: string; heure_debut: string; heure_fin: string }> = [];

  // Fallback: si pas de lignes en DB, parser service_nom
  const services = (() => {
    if (lignesDevis.length > 0) {
      return lignesDevis.map(l => ({
        id: l.id,
        service_id: l.service_id,
        nom: l.service_nom,
        quantite: l.quantite,
        duree_minutes: l.duree_minutes,
        prix_total: l.prix_total
      }));
    }

    // Fallback
    const serviceNom = devis.service_nom || '';
    const parts = serviceNom.split(',').map(s => s.trim()).filter(Boolean);
    return parts.map((part, index) => {
      const match = part.match(/^(.+?)\s*x(\d+)$/);
      if (match) {
        return { id: index + 1, service_id: 0, nom: match[1].trim(), quantite: parseInt(match[2]), duree_minutes: 60, prix_total: 0 };
      }
      return { id: index + 1, service_id: 0, nom: part, quantite: 1, duree_minutes: 60, prix_total: 0 };
    });
  })();

  // Calculer les heures entre deux horaires
  const calculateHoursFromTimes = (startTime: string, endTime: string): number => {
    if (!startTime || !endTime) return 0;
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    let startMinutes = startH * 60 + (startM || 0);
    let endMinutes = endH * 60 + (endM || 0);
    if (endMinutes < startMinutes) endMinutes += 24 * 60; // Passage minuit
    return Math.round((endMinutes - startMinutes) / 60 * 10) / 10;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Creer les affectations de ressources avec heures
    const affectationsList = Object.entries(affectations)
      .filter(([, aff]) => aff.membre_id > 0)
      .map(([ligneId, aff]) => ({
        ligne_id: parseInt(ligneId),
        ressource_id: aff.membre_id,
        membre_id: aff.membre_id,
        heure_debut: aff.heure_debut || heureRdv,
        heure_fin: aff.heure_fin || ''
      }));

    // Validation: au moins un membre doit etre assigne
    if (affectationsList.length === 0) {
      alert('Vous devez affecter au moins un membre du personnel a cette prestation');
      return;
    }

    // Validation mode horaire: verifier que les heures sont definies
    if (isPricingMode('hourly')) {
      const hasValidHours = affectationsList.every(aff => aff.heure_debut && aff.heure_fin);
      if (!hasValidHours) {
        alert('Veuillez definir les heures de debut et de fin pour chaque affectation');
        return;
      }
    }

    // En mode horaire, calculer heure_rdv a partir de l'heure la plus tot des affectations
    let heureRdvFinal = heureRdv;
    if (isPricingMode('hourly') && affectationsList.length > 0) {
      const heuresDebut = affectationsList
        .map(aff => aff.heure_debut)
        .filter(Boolean)
        .sort();
      if (heuresDebut.length > 0) {
        heureRdvFinal = heuresDebut[0];
      }
    }

    onExecute({
      date_rdv: dateRdv,
      heure_rdv: heureRdvFinal,
      affectations: affectationsList
    });
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={handleBackdropClick}>
      <div className="bg-white rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto relative">
        <button onClick={onClose} className="absolute top-4 right-4 p-1 hover:bg-gray-100 rounded-full z-10">
          <X className="w-5 h-5 text-gray-500" />
        </button>
        <div className="p-6 border-b sticky top-0 bg-white">
          <h2 className="text-xl font-bold text-purple-600">Executer le devis</h2>
          <p className="text-sm text-gray-500 mt-1">
            Devis {devis.numero} - {devis.client_nom}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <p className="text-sm text-purple-800">
              <strong>Creation de la prestation</strong>
            </p>
            <p className="text-sm text-purple-700 mt-1">
              Cette action creera une prestation planifiee. Vous pouvez affecter des ressources (collaborateurs) a chaque service.
            </p>
          </div>

          {/* Date et heure */}
          <div className={isPricingMode('hourly') ? '' : 'grid grid-cols-2 gap-4'}>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date de la prestation *</label>
              <input
                type="date"
                required
                value={dateRdv}
                onChange={(e) => setDateRdv(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>
            {/* Heure de debut uniquement en mode non-horaire */}
            {!isPricingMode('hourly') && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Heure de debut *</label>
                <input
                  type="time"
                  required
                  value={heureRdv}
                  onChange={(e) => setHeureRdv(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500"
                />
              </div>
            )}
            {/* Info pour mode horaire */}
            {isPricingMode('hourly') && (
              <p className="text-xs text-gray-500 mt-1">
                Les horaires sont definis par affectation ci-dessous.
              </p>
            )}
          </div>

          {/* Affectation des services avec disponibilite intelligente */}
          {/* Uniquement pour salon/service_domicile, pas pour restaurant/hotel */}
          {showMemberAssignment && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium text-gray-700">Affectation des ressources</h3>
                {dispoLoading && <span className="text-sm text-blue-600">Verification des disponibilites...</span>}
              </div>

              {/* Message si pas de date (en mode horaire, pas besoin d'heure globale) */}
              {!dateRdv || (!isPricingMode('hourly') && !heureRdv) ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-sm text-yellow-800">
                    Selectionnez une date pour voir le personnel disponible.
                  </p>
                </div>
              ) : (
                <>
                  {/* Indicateur de disponibilite */}
                  {dateRdv && (isPricingMode('hourly') || heureRdv) && !dispoLoading && (
                    <div className={`rounded-lg p-3 text-sm ${
                      ressourcesDisponibles.length > 0
                        ? 'bg-green-50 border border-green-200 text-green-800'
                        : 'bg-red-50 border border-red-200 text-red-800'
                    }`}>
                      {ressourcesDisponibles.length > 0 ? (
                        <span>{'\u2713'} {ressourcesDisponibles.length} membre(s) disponible(s)</span>
                      ) : (
                        <span>{'\u2717'} Aucun membre dans l'equipe</span>
                      )}
                    </div>
                  )}

                  {/* Services avec affectation */}
                  {services.map((service) => {
                    const aff = affectations[service.id] || { membre_id: 0, heure_debut: heureRdv, heure_fin: '' };
                    return (
                      <div key={service.id} className="bg-gray-50 rounded-lg p-4 space-y-3">
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex-1">
                            <p className="font-medium">{service.nom}</p>
                            <p className="text-sm text-gray-500">
                              Quantite: {service.quantite} | Duree predefinie: {service.duree_minutes} min
                            </p>
                          </div>
                          <div className="w-56">
                            <select
                              value={aff.membre_id || ''}
                              onChange={(e) => {
                                const membreId = parseInt(e.target.value) || 0;
                                setAffectations({
                                  ...affectations,
                                  [service.id]: { ...aff, membre_id: membreId }
                                });
                              }}
                              onFocus={() => setServiceEnCours(service.service_id)}
                              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 text-sm"
                            >
                              <option value="">-- Selectionner --</option>
                              {ressourcesDisponibles.length > 0 && (
                                <optgroup label={'\u2713 Disponibles'}>
                                  {ressourcesDisponibles.map((r) => (
                                    <option key={r.id} value={r.id}>
                                      {r.nom} {r.categorie ? `(${r.categorie})` : ''}
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                              {ressourcesOccupees.length > 0 && (
                                <optgroup label={'\u2717 Occupees'}>
                                  {ressourcesOccupees.map((r) => (
                                    <option key={r.id} value={r.id} disabled className="text-gray-400">
                                      {r.nom} - {r.raison === 'occupee' ? 'Occupe(e)' : 'Indisponible'}
                                    </option>
                                  ))}
                                </optgroup>
                              )}
                            </select>
                          </div>
                        </div>

                        {/* Horaires personnalises (mode horaire) */}
                        {isPricingMode('hourly') && aff.membre_id > 0 && (
                          <div className="flex items-center gap-3 pl-4 border-l-2 border-purple-200">
                            <Clock className="w-4 h-4 text-purple-500" />
                            <span className="text-sm text-gray-600">Horaires:</span>
                            <input
                              type="time"
                              value={aff.heure_debut || ''}
                              onChange={(e) => setAffectations({
                                ...affectations,
                                [service.id]: { ...aff, heure_debut: e.target.value }
                              })}
                              className="px-2 py-1 text-sm border rounded focus:ring-1 focus:ring-purple-500"
                            />
                            <span className="text-gray-400">{'\u2192'}</span>
                            <input
                              type="time"
                              value={aff.heure_fin || ''}
                              onChange={(e) => setAffectations({
                                ...affectations,
                                [service.id]: { ...aff, heure_fin: e.target.value }
                              })}
                              className="px-2 py-1 text-sm border rounded focus:ring-1 focus:ring-purple-500"
                            />
                            {aff.heure_debut && aff.heure_fin && (
                              <span className="text-xs text-purple-600 font-medium">
                                ({calculateHoursFromTimes(aff.heure_debut, aff.heure_fin)}h)
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {/* Suggestions de prochaines disponibilites */}
                  {ressourcesDisponibles.length === 0 && prochainesDispos.length > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-sm font-medium text-blue-800 mb-2">{'\uD83D\uDCC5'} Prochaines disponibilites :</p>
                      <div className="space-y-2">
                        {prochainesDispos.map((dispo, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => {
                              setDateRdv(dispo.date);
                              setHeureRdv(dispo.heure_debut);
                            }}
                            className="w-full text-left px-3 py-2 bg-white rounded border border-blue-200 hover:bg-blue-100 text-sm"
                          >
                            <span className="font-medium">{dispo.ressource_nom}</span>
                            <span className="text-gray-600 ml-2">
                              {dispo.heure_debut} - {dispo.heure_fin}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Recapitulatif */}
          <div className="bg-blue-50 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Client:</span>
              <span className="font-medium">{devis.client_nom}</span>
            </div>
            {devis.lieu && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Lieu:</span>
                <span className="font-medium">{devis.lieu}</span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Duree totale:</span>
              <span className="font-medium">{devis.duree_minutes || 60} min</span>
            </div>
            <div className="flex justify-between text-sm font-medium border-t pt-2">
              <span className="text-gray-600">Montant TTC:</span>
              <span className="text-blue-600">{(devis.montant_ttc / 100).toFixed(2)} EUR</span>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={isLoading || !dateRdv}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50"
            >
              {isLoading ? 'Creation...' : 'Creer les reservations'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
