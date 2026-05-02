import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api, Devis, DevisCreateData } from '@/lib/api';
import { X, MapPin, FileText, Calendar, Clock, User } from 'lucide-react';
import { useProfile } from '@/contexts/ProfileContext';
import { splitHoursSegments } from '@/lib/majorations';
import type {
  Client,
  Service,
  ServiceLigne,
  ServiceAffectation,
  DevisTemplate,
} from './types';

export interface DevisFormModalProps {
  devis: Devis | null;
  templatePreFill?: DevisTemplate | null;
  onClose: () => void;
  onSubmit: (data: DevisCreateData) => void;
  isLoading: boolean;
}

export default function DevisFormModal({ devis, templatePreFill, onClose, onSubmit, isLoading }: DevisFormModalProps) {
  // Profile metier
  const { profile, t, isPricingMode, isBusinessType } = useProfile();

  // Affectation membre uniquement pour salon/service_domicile (pas restaurant/hotel)
  const showMemberAssignment = !isBusinessType('restaurant') && !isBusinessType('hotel');

  // Client state
  const [clientMode, setClientMode] = useState<'existant' | 'nouveau'>('existant');
  const [clientSearch, setClientSearch] = useState(devis?.client_nom || '');
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [nouveauClient, setNouveauClient] = useState({
    prenom: '',
    nom: '',
    email: '',
    telephone: '',
    adresse: ''
  });

  // Services state
  const [serviceLignes, setServiceLignes] = useState<ServiceLigne[]>([]);
  const [selectedServiceId, setSelectedServiceId] = useState<number>(0);

  // Form state
  const devisTyped = devis as (Devis & { date_prestation?: string; heure_prestation?: string; date_fin_prestation?: string; heure_fin_prestation?: string; nb_agents?: number }) | null;
  const [formData, setFormData] = useState({
    client_adresse: devis?.client_adresse || '',
    adresse_facturation: '',
    date_prestation: devisTyped?.date_prestation || '',
    heure_prestation: devisTyped?.heure_prestation || '',
    date_fin_prestation: devisTyped?.date_fin_prestation || '',
    heure_fin_prestation: devisTyped?.heure_fin_prestation || '',
    nb_agents: devisTyped?.nb_agents || 1,
    taux_tva: devis?.taux_tva || 20,
    validite_jours: devis?.validite_jours || 30,
    notes: devis?.notes || '',
    numero_commande: (devis as any)?.numero_commande || '',
    remise_type: 'aucune' as 'aucune' | 'pourcentage' | 'montant',
    remise_valeur: 0,
    remise_motif: '',
    acompte_pourcentage: devis?.acompte_pourcentage ?? (isBusinessType('service_domicile') ? 30 : 0),
  });

  // Adresse facturation meme que prestation
  const [memeAdresse, setMemeAdresse] = useState(true);

  // Pre-remplir depuis un template
  useEffect(() => {
    if (templatePreFill && !devis) {
      setServiceLignes(
        templatePreFill.lignes.map((l, i) => ({
          service_id: -(i + 1), // IDs negatifs temporaires pour les lignes template
          service_nom: l.description,
          quantite: l.quantite,
          prix_unitaire: l.prix_unitaire,
          duree_minutes: 0,
          affectations: Array.from({ length: l.quantite }, (_, idx) => ({ index: idx }))
        }))
      );
      if (templatePreFill.conditions) {
        setFormData(prev => ({ ...prev, notes: templatePreFill.conditions }));
      }
    }
  }, [templatePreFill, devis]);

  // Charger les lignes existantes en mode édition
  useEffect(() => {
    if (!devis?.id) return;
    api.get<{ devis: Devis; lignes?: Array<{ id: number; service_id: number; service_nom: string; quantite: number; prix_unitaire: number; prix_total: number; duree_minutes: number; date_debut?: string; date_fin?: string; heure_debut?: string; heure_fin?: string; taux_horaire?: number; membre_id?: number }> }>(`/admin/devis/${devis.id}`)
      .then(res => {
        const lg = res.lignes || [];
        if (lg.length > 0) {
          setServiceLignes(lg.map(l => ({
            service_id: l.service_id,
            service_nom: l.service_nom,
            quantite: l.quantite,
            prix_unitaire: l.prix_unitaire / 100, // centimes → euros (DevisFormModal travaille en euros)
            duree_minutes: l.duree_minutes || 0,
            date_debut: l.date_debut,
            date_fin: l.date_fin,
            heure_debut: l.heure_debut?.slice(0, 5),
            heure_fin: l.heure_fin?.slice(0, 5),
            taux_horaire: l.taux_horaire ? l.taux_horaire * 100 : undefined, // euros → centimes (formule interne)
            affectations: Array.from({ length: l.quantite }, (_, idx) => ({
              index: idx,
              membre_id: idx === 0 ? l.membre_id : undefined,
              heure_debut: l.heure_debut?.slice(0, 5),
              heure_fin: l.heure_fin?.slice(0, 5)
            }))
          })));
          // Dates mission = min/max des dates des lignes
          const dates = lg.filter(l => l.date_debut).map(l => l.date_debut!).sort();
          const datesFin = lg.filter(l => l.date_fin).map(l => l.date_fin!).sort();
          if (dates.length > 0) {
            setFormData(prev => ({
              ...prev,
              date_prestation: prev.date_prestation || dates[0],
              date_fin_prestation: prev.date_fin_prestation || datesFin[datesFin.length - 1] || dates[dates.length - 1]
            }));
          }
        }
      });
  }, [devis?.id]);

  // Fetch clients
  const { data: clientsData } = useQuery<{ data: Client[] }>({
    queryKey: ['clients-search', clientSearch],
    queryFn: async () => {
      if (!clientSearch || clientSearch.length < 2) return { data: [] };
      return api.get<{ data: Client[] }>(`/admin/clients?search=${encodeURIComponent(clientSearch)}&limit=10`);
    },
    enabled: clientSearch.length >= 2 && clientMode === 'existant'
  });

  // Fetch services — backend renvoie format pagine { data, pagination }
  const { data: servicesData } = useQuery<{ services: Service[] }>({
    queryKey: ['services'],
    queryFn: async () => {
      const { items } = await api.getPaginated<Service>('/admin/services?limit=200');
      return { services: items };
    },
  });

  // Fetch membres équipe pour assignation (via /services/equipe, accessible à tous les plans)
  const { data: membresData } = useQuery<Array<{ id: number; nom: string; prenom: string; role: string }>>({
    queryKey: ['membres-equipe'],
    queryFn: async () => {
      const raw = await api.get<any>('/admin/services/equipe');
      return Array.isArray(raw) ? raw : raw.data || [];
    },
  });

  // Add service
  const handleAddService = () => {
    if (!selectedServiceId) return;
    const service = servicesData?.services?.find(s => s.id === selectedServiceId);
    if (!service) return;

    const existing = serviceLignes.find(l => l.service_id === selectedServiceId);
    if (existing) {
      // Incrementer la quantite et ajouter une affectation
      setServiceLignes(prev => prev.map(l => {
        if (l.service_id === selectedServiceId) {
          const newQuantite = l.quantite + 1;
          const newAffectations = [...l.affectations, { index: newQuantite - 1 }];
          return { ...l, quantite: newQuantite, affectations: newAffectations };
        }
        return l;
      }));
    } else {
      setServiceLignes(prev => [...prev, {
        service_id: service.id,
        service_nom: service.nom,
        quantite: 1,
        prix_unitaire: service.prix / 100,
        duree_minutes: service.duree,
        taux_horaire: service.taux_horaire,
        affectations: [{ index: 0 }]
      }]);
    }
    setSelectedServiceId(0);
  };

  // Remove service
  const handleRemoveService = (serviceId: number) => {
    setServiceLignes(prev => prev.filter(l => l.service_id !== serviceId));
  };

  // Update service line
  const handleUpdateServiceLigne = (serviceId: number, field: keyof ServiceLigne, value: number | string) => {
    setServiceLignes(prev => prev.map(l =>
      l.service_id === serviceId ? { ...l, [field]: value } : l
    ));
  };

  // Update service quantity with affectations management
  const handleUpdateQuantite = (serviceId: number, newQuantite: number) => {
    if (newQuantite < 1) {
      handleRemoveService(serviceId);
      return;
    }

    setServiceLignes(prev => prev.map(l => {
      if (l.service_id !== serviceId) return l;

      // Ajuster le nombre d'affectations selon la nouvelle quantite
      let newAffectations = [...(l.affectations || [])];
      const currentCount = newAffectations.length;

      if (newQuantite > currentCount) {
        // Ajouter des affectations
        for (let i = currentCount; i < newQuantite; i++) {
          newAffectations.push({ index: i });
        }
      } else if (newQuantite < currentCount) {
        // Supprimer les dernieres affectations
        newAffectations = newAffectations.slice(0, newQuantite);
      }

      return { ...l, quantite: newQuantite, affectations: newAffectations };
    }));
  };

  // Helper: Calculer heure de fin depuis heure debut + duree
  const calculateEndTime = (startTime: string, durationMinutes: number): string => {
    if (!startTime) return '';
    const [hours, minutes] = startTime.split(':').map(Number);
    const totalMinutes = hours * 60 + minutes + durationMinutes;
    const endHours = Math.floor(totalMinutes / 60) % 24;
    const endMinutes = totalMinutes % 60;
    return `${endHours.toString().padStart(2, '0')}:${endMinutes.toString().padStart(2, '0')}`;
  };

  // Update individual affectation
  const updateAffectation = (
    serviceId: number,
    affectationIndex: number,
    field: keyof ServiceAffectation,
    value: number | string | undefined
  ) => {
    setServiceLignes(prev =>
      prev.map(l => {
        if (l.service_id !== serviceId) return l;

        const newAffectations = l.affectations.map((aff, idx) => {
          if (idx !== affectationIndex) return aff;

          // Auto-calcul heure_fin quand heure_debut change
          if (field === 'heure_debut' && value) {
            const heureFin = calculateEndTime(value as string, l.duree_minutes);
            return { ...aff, heure_debut: value as string, heure_fin: heureFin };
          }

          return { ...aff, [field]: value };
        });

        return { ...l, affectations: newAffectations };
      })
    );
  };

  // Helper: Calculer les heures entre deux horaires
  const calculateHours = (startTime: string, endTime: string): number => {
    if (!startTime || !endTime) return 0;
    // Nettoyer les heures (remplacer -- par 00)
    const cleanStart = startTime.replace('--', '00');
    const cleanEnd = endTime.replace('--', '00');
    const [startH, startM] = cleanStart.split(':').map(Number);
    const [endH, endM] = cleanEnd.split(':').map(Number);
    if (isNaN(startH) || isNaN(endH)) return 0;
    let startMinutes = startH * 60 + (startM || 0);
    let endMinutes = endH * 60 + (endM || 0);
    if (endMinutes < startMinutes) endMinutes += 24 * 60;
    return Math.round((endMinutes - startMinutes) / 60 * 100) / 100;
  };

  // Helper: Calculer le nombre de jours entre deux dates
  const calculateDays = (startDate: string, endDate: string): number => {
    if (!startDate || !endDate) return 1;
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1; // +1 pour inclure le jour de debut
    return Math.max(1, diffDays);
  };

  // Calculate totals
  const calculs = (() => {
    const pricingMode = profile?.pricing?.mode || 'fixed';
    let sousTotal = 0;
    let dureeTotale = 0;
    let nbJours = 1;
    let nbAgentsEffectif = 0;
    let totalHeuresAffectations = 0;

    if (pricingMode === 'hourly') {
      // Mode horaire: calculer a partir des affectations (heures par agent)
      // Dates globales de mission (fallback si pas de dates par ligne)
      nbJours = formData.date_fin_prestation && formData.date_prestation
        ? calculateDays(formData.date_prestation, formData.date_fin_prestation)
        : 1;

      sousTotal = serviceLignes.reduce((sum, l) => {
        const tauxHoraire = l.taux_horaire || l.prix_unitaire * 100; // en centimes

        // Dates par ligne (prioritaire) ou dates globales
        const ligneDebut = l.date_debut || formData.date_prestation;
        const ligneFin = l.date_fin || formData.date_fin_prestation || ligneDebut;

        let serviceMontantCentimes = 0; // accumuler en centimes pour precision arrondi
        l.affectations.forEach(aff => {
          if (aff.heure_debut && aff.heure_fin) {
            // Si dates disponibles, calculer jour par jour avec majorations
            if (ligneDebut && ligneFin) {
              const d = new Date(ligneDebut + 'T12:00:00');
              const dFin = new Date(ligneFin + 'T12:00:00');
              while (d <= dFin) {
                const dateStr = d.toISOString().slice(0, 10);
                const segs = splitHoursSegments(dateStr, aff.heure_debut, aff.heure_fin);
                for (const seg of segs) {
                  serviceMontantCentimes += Math.round(seg.hours * tauxHoraire * (1 + seg.pourcentage / 100));
                  totalHeuresAffectations += seg.hours;
                }
                d.setDate(d.getDate() + 1);
              }
            } else {
              // Pas de dates : simple calcul heures × jours globaux
              const heuresAgent = calculateHours(aff.heure_debut, aff.heure_fin);
              serviceMontantCentimes += Math.round(tauxHoraire * heuresAgent * nbJours);
              totalHeuresAffectations += heuresAgent;
            }
            nbAgentsEffectif++;
          }
        });

        return sum + serviceMontantCentimes / 100; // centimes → euros
      }, 0);

      dureeTotale = Math.round(totalHeuresAffectations * 60);
    } else {
      // Mode fixe: prix x quantite
      sousTotal = serviceLignes.reduce((sum, l) => sum + (l.prix_unitaire * l.quantite), 0);
      dureeTotale = serviceLignes.reduce((sum, l) => sum + (l.duree_minutes * l.quantite), 0);
    }

    let montantHT = sousTotal;
    let montantRemise = 0;

    if (formData.remise_type === 'pourcentage' && formData.remise_valeur > 0) {
      montantRemise = montantHT * formData.remise_valeur / 100;
    } else if (formData.remise_type === 'montant' && formData.remise_valeur > 0) {
      montantRemise = formData.remise_valeur;
    }

    montantHT -= montantRemise;

    // CNAPS: taxe sur les services qui ont taxe_cnaps=true
    let montantCnaps = 0;
    const services = servicesData?.services || [];
    serviceLignes.forEach(sl => {
      const service = services.find(s => s.id === sl.service_id);
      if (service?.taxe_cnaps && (service.taux_cnaps ?? 0) > 0) {
        let ligneHTCentimes = 0; // centimes pour precision arrondi
        if (pricingMode === 'hourly') {
          const tauxH = sl.taux_horaire || sl.prix_unitaire * 100;
          const ligneDebut = sl.date_debut || formData.date_prestation;
          const ligneFin = sl.date_fin || formData.date_fin_prestation || ligneDebut;
          sl.affectations.forEach(aff => {
            if (aff.heure_debut && aff.heure_fin) {
              if (ligneDebut && ligneFin) {
                const d = new Date(ligneDebut + 'T12:00:00');
                const dFin = new Date(ligneFin + 'T12:00:00');
                while (d <= dFin) {
                  const dateStr = d.toISOString().slice(0, 10);
                  const segs = splitHoursSegments(dateStr, aff.heure_debut, aff.heure_fin);
                  for (const seg of segs) {
                    ligneHTCentimes += Math.round(seg.hours * tauxH * (1 + seg.pourcentage / 100));
                  }
                  d.setDate(d.getDate() + 1);
                }
              } else {
                ligneHTCentimes += Math.round(tauxH * calculateHours(aff.heure_debut, aff.heure_fin) * nbJours);
              }
            }
          });
        } else {
          ligneHTCentimes = sl.prix_unitaire * sl.quantite * 100;
        }
        montantCnaps += (ligneHTCentimes / 100) * (service.taux_cnaps ?? 0) / 100;
      }
    });
    montantCnaps = Math.round(montantCnaps * 100) / 100;

    montantHT += montantCnaps;
    const montantTVA = montantHT * formData.taux_tva / 100;
    const montantTTC = montantHT + montantTVA;

    return { sousTotal, dureeTotale, montantRemise, montantCnaps, montantHT, montantTVA, montantTTC, pricingMode, nbJours, nbAgents: nbAgentsEffectif || formData.nb_agents };
  })();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const clientNom = clientMode === 'existant' && selectedClient
      ? (selectedClient.type_client === 'professionnel' || selectedClient.raison_sociale
          ? selectedClient.raison_sociale || `${selectedClient.prenom} ${selectedClient.nom}`
          : `${selectedClient.prenom} ${selectedClient.nom}`)
      : `${nouveauClient.prenom} ${nouveauClient.nom}`;

    const clientEmail = clientMode === 'existant' && selectedClient
      ? selectedClient.email
      : nouveauClient.email;

    const clientTelephone = clientMode === 'existant' && selectedClient
      ? selectedClient.telephone
      : nouveauClient.telephone;

    const clientAdresse = clientMode === 'existant' && selectedClient
      ? selectedClient.adresse || formData.client_adresse
      : nouveauClient.adresse;

    // Adresse de facturation : si "meme adresse", utiliser l'adresse de prestation
    const adresseFacturation = memeAdresse ? clientAdresse : formData.adresse_facturation;

    const serviceNom = serviceLignes.map(l => `${l.service_nom} x${l.quantite}`).join(', ');
    const dureeMinutes = calculs.dureeTotale;

    // Preparer les lignes de services pour stockage individuel avec affectations
    const lignes = serviceLignes.map(l => ({
      service_id: l.service_id,
      service_nom: l.service_nom,
      quantite: l.quantite,
      duree_minutes: l.duree_minutes,
      prix_unitaire: Math.round(l.prix_unitaire * 100),
      prix_total: Math.round(l.prix_unitaire * l.quantite * 100),
      taux_horaire: l.taux_horaire || null,
      // Plage de dates par ligne (security / multi-day)
      ...(l.date_debut && { date_debut: l.date_debut }),
      ...(l.date_fin && { date_fin: l.date_fin }),
      // Affectations avec heures et membres (pour mode horaire)
      affectations: l.affectations.map(aff => ({
        membre_id: aff.membre_id,
        heure_debut: aff.heure_debut,
        heure_fin: aff.heure_fin
      }))
    }));

    // Extraire les membre_ids uniques des affectations
    const membreIdsFromServices: number[] = [];
    serviceLignes.forEach(sl => {
      sl.affectations.forEach(aff => {
        if (aff.membre_id) {
          membreIdsFromServices.push(aff.membre_id);
        }
      });
    });
    const uniqueMembreIds = [...new Set(membreIdsFromServices)];

    onSubmit({
      // Client ID pour lien avec la base clients
      client_id: clientMode === 'existant' && selectedClient ? selectedClient.id : undefined,
      client_nom: clientNom,
      client_email: clientEmail,
      client_telephone: clientTelephone,
      client_adresse: formData.client_adresse || clientAdresse,
      adresse_facturation: adresseFacturation,
      service_nom: serviceNom,
      service_description: formData.notes,
      duree_minutes: dureeMinutes,
      montant_ht: Math.round(calculs.montantHT * 100),
      taux_tva: formData.taux_tva,
      validite_jours: formData.validite_jours,
      notes: formData.notes,
      numero_commande: formData.numero_commande || undefined,
      lignes: lignes,
      date_prestation: formData.date_prestation || undefined,
      date_fin_prestation: formData.date_fin_prestation || undefined,
      heure_prestation: formData.heure_prestation || undefined,
      // Mode horaire : informations supplementaires
      pricing_mode: calculs.pricingMode,
      nb_jours: calculs.nbJours,
      nb_agents: calculs.nbAgents,
      // Liste des membres assignes
      membre_ids: uniqueMembreIds,
      // Acompte
      acompte_pourcentage: formData.acompte_pourcentage > 0 ? formData.acompte_pourcentage : undefined,
    });
  };

  // Handle click outside to close
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div className="bg-white rounded-lg w-full max-w-3xl max-h-[90vh] overflow-y-auto relative">
        {/* Header with close button */}
        <div className="p-6 border-b flex justify-between items-center sticky top-0 bg-white z-10">
          <h2 className="text-xl font-bold">
            {devis ? `Modifier devis ${devis.numero}` : 'Nouveau devis'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Section Client */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-4">
            <h3 className="font-semibold text-gray-700">Contact</h3>

            {/* Mode selection */}
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={clientMode === 'existant'}
                  onChange={() => setClientMode('existant')}
                  className="text-blue-600"
                />
                <span>Contact existant</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={clientMode === 'nouveau'}
                  onChange={() => setClientMode('nouveau')}
                  className="text-blue-600"
                />
                <span>Nouveau contact</span>
              </label>
            </div>

            {clientMode === 'existant' ? (
              <div className="relative">
                <input
                  type="text"
                  value={clientSearch}
                  onChange={(e) => {
                    setClientSearch(e.target.value);
                    setShowClientDropdown(true);
                    setSelectedClient(null);
                  }}
                  onFocus={() => setShowClientDropdown(true)}
                  placeholder="Rechercher un contact..."
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                {showClientDropdown && (clientsData?.data?.length ?? 0) > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {clientsData!.data.map((client: Client) => {
                      const isPro = client.type_client === 'professionnel' || !!client.raison_sociale;
                      const displayName = isPro && client.raison_sociale
                        ? client.raison_sociale
                        : `${client.prenom} ${client.nom}`;
                      return (
                        <button
                          key={client.id}
                          type="button"
                          onClick={() => {
                            setSelectedClient(client);
                            setClientSearch(displayName);
                            setShowClientDropdown(false);
                            // Construire l'adresse complete si disponible
                            const adresseComplete = [
                              client.adresse,
                              client.code_postal,
                              client.ville
                            ].filter(Boolean).join(', ');
                            if (adresseComplete) {
                              setFormData(prev => ({ ...prev, client_adresse: adresseComplete }));
                            }
                          }}
                          className="w-full px-3 py-2 text-left hover:bg-gray-100 border-b last:border-b-0"
                        >
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{displayName}</span>
                            {isPro && (
                              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-orange-100 text-orange-700 rounded">PRO</span>
                            )}
                          </div>
                          {isPro && client.raison_sociale && (
                            <div className="text-xs text-gray-400">Contact: {client.prenom} {client.nom}</div>
                          )}
                          <div className="text-sm text-gray-500">{client.telephone} - {client.email}</div>
                        </button>
                      );
                    })}
                  </div>
                )}
                {selectedClient && (() => {
                  const isPro = selectedClient.type_client === 'professionnel' || !!selectedClient.raison_sociale;
                  const displayName = isPro && selectedClient.raison_sociale
                    ? selectedClient.raison_sociale
                    : `${selectedClient.prenom} ${selectedClient.nom}`;
                  return (
                    <div className={`mt-2 p-3 rounded-lg ${isPro ? 'bg-orange-50' : 'bg-blue-50'}`}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{displayName}</span>
                        {isPro && (
                          <span className="px-1.5 py-0.5 text-[10px] font-medium bg-orange-100 text-orange-700 rounded">PRO</span>
                        )}
                      </div>
                      {isPro && selectedClient.raison_sociale && (
                        <div className="text-xs text-gray-500">Contact: {selectedClient.prenom} {selectedClient.nom}</div>
                      )}
                      <div className="text-sm text-gray-600">{selectedClient.telephone} - {selectedClient.email}</div>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                <input
                  type="text"
                  placeholder="Prenom *"
                  value={nouveauClient.prenom}
                  onChange={(e) => setNouveauClient({ ...nouveauClient, prenom: e.target.value })}
                  className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  required={clientMode === 'nouveau'}
                />
                <input
                  type="text"
                  placeholder="Nom *"
                  value={nouveauClient.nom}
                  onChange={(e) => setNouveauClient({ ...nouveauClient, nom: e.target.value })}
                  className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  required={clientMode === 'nouveau'}
                />
                <input
                  type="tel"
                  placeholder="Telephone *"
                  value={nouveauClient.telephone}
                  onChange={(e) => setNouveauClient({ ...nouveauClient, telephone: e.target.value })}
                  className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  required={clientMode === 'nouveau'}
                />
                <input
                  type="email"
                  placeholder="Email"
                  value={nouveauClient.email}
                  onChange={(e) => setNouveauClient({ ...nouveauClient, email: e.target.value })}
                  className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

          </div>

          {/* Section Adresse / Lieu de prestation */}
          <div className="bg-blue-50 rounded-lg p-4 space-y-3">
            <h3 className="font-semibold text-gray-700 flex items-center gap-2">
              <MapPin className="w-4 h-4 text-blue-600" />
              Adresse de prestation
            </h3>
            <textarea
              value={clientMode === 'nouveau' ? nouveauClient.adresse : formData.client_adresse}
              onChange={(e) => {
                if (clientMode === 'nouveau') {
                  setNouveauClient({ ...nouveauClient, adresse: e.target.value });
                } else {
                  setFormData({ ...formData, client_adresse: e.target.value });
                }
              }}
              placeholder={"Adresse compl\u00e8te du lieu de prestation\nEx: 123 Rue de Paris, 75001 Paris\nou: Salon - 45 Avenue des Champs-\u00c9lys\u00e9es"}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
              rows={3}
            />
            <p className="text-xs text-gray-500">
              Indiquez l'adresse ou aura lieu la prestation (salon, domicile du client, hotel, etc.)
            </p>
          </div>

          {/* Section Adresse de facturation */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-600" />
                Adresse de facturation
              </h3>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={memeAdresse}
                  onChange={(e) => setMemeAdresse(e.target.checked)}
                  className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm text-gray-600">Identique a l'adresse de prestation</span>
              </label>
            </div>
            {!memeAdresse && (
              <textarea
                value={formData.adresse_facturation}
                onChange={(e) => setFormData({ ...formData, adresse_facturation: e.target.value })}
                placeholder={"Adresse de facturation si diff\u00e9rente\nEx: 456 Boulevard Saint-Germain, 75006 Paris"}
                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                rows={3}
              />
            )}
          </div>

          {/* Section Periode (Mode Horaire - avant les services) */}
          {isPricingMode('hourly') && (
            <div className="bg-blue-50 rounded-lg p-4 space-y-3">
              <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                Periode de la {t('reservation', false).toLowerCase()} *
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Du *</label>
                  <input
                    type="date"
                    value={formData.date_prestation}
                    onChange={(e) => setFormData({ ...formData, date_prestation: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Au *</label>
                  <input
                    type="date"
                    value={formData.date_fin_prestation || formData.date_prestation}
                    onChange={(e) => setFormData({ ...formData, date_fin_prestation: e.target.value })}
                    min={formData.date_prestation}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>
              </div>
              {formData.date_prestation && formData.date_fin_prestation && formData.date_fin_prestation !== formData.date_prestation && (
                <p className="text-sm text-blue-600">
                  {calculateDays(formData.date_prestation, formData.date_fin_prestation)} jour(s)
                </p>
              )}
            </div>
          )}

          {/* Section Services */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-4">
            <h3 className="font-semibold text-gray-700">Prestations</h3>

            {/* Add service */}
            <div className="flex gap-2">
              <select
                value={selectedServiceId}
                onChange={(e) => setSelectedServiceId(parseInt(e.target.value))}
                className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value={0}>Selectionner un service...</option>
                {servicesData?.services?.map((service: Service) => (
                  <option key={service.id} value={service.id}>
                    {service.nom} - {(service.prix / 100).toFixed(2)} EUR ({service.duree} min)
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={handleAddService}
                disabled={!selectedServiceId}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                Ajouter
              </button>
            </div>

            {/* Services list */}
            {serviceLignes.length > 0 && (
              <div className="space-y-2">
                {serviceLignes.map((ligne) => {
                  const tauxHoraire = ligne.taux_horaire || ligne.prix_unitaire * 100;
                  const heures = isPricingMode('hourly') && formData.heure_prestation && formData.heure_fin_prestation
                    ? calculateHours(formData.heure_prestation, formData.heure_fin_prestation)
                    : 0;
                  const prixLigne = isPricingMode('hourly')
                    ? (tauxHoraire / 100) * heures * formData.nb_agents
                    : ligne.prix_unitaire * ligne.quantite;

                  return (
                  <div key={ligne.service_id} className="p-3 bg-white rounded-lg border space-y-2">
                    {/* Ligne 1: Service + Prix */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <div className="font-medium">{ligne.service_nom}</div>
                        <div className="text-sm text-gray-500">
                          {isPricingMode('hourly')
                            ? `${(tauxHoraire / 100).toFixed(2)}\u20AC/h`
                            : `${ligne.duree_minutes} min`
                          }
                        </div>
                      </div>
                      {/* Quantite uniquement en mode fixe */}
                      {!isPricingMode('hourly') && (
                        <div className="flex items-center gap-2">
                          <label className="text-sm text-gray-600">Qte:</label>
                          <input
                            type="number"
                            min="1"
                            value={ligne.quantite}
                            onChange={(e) => handleUpdateQuantite(ligne.service_id, parseInt(e.target.value) || 1)}
                            className="w-16 px-2 py-1 border rounded text-center"
                          />
                        </div>
                      )}
                      {!isPricingMode('hourly') && (
                        <div className="flex items-center gap-2">
                          <label className="text-sm text-gray-600">Prix:</label>
                          <input
                            type="number"
                            step="0.01"
                            value={ligne.prix_unitaire}
                            onChange={(e) => handleUpdateServiceLigne(ligne.service_id, 'prix_unitaire', parseFloat(e.target.value) || 0)}
                            className="w-24 px-2 py-1 border rounded text-right"
                          />
                          <span className="text-sm">EUR</span>
                        </div>
                      )}
                      <div className="font-medium text-blue-600 min-w-[100px] text-right">
                        {isPricingMode('hourly') && heures > 0 ? (
                          <div>
                            <div>{prixLigne.toFixed(2)} EUR</div>
                            <div className="text-xs text-gray-400 font-normal">
                              {heures}h x {formData.nb_agents} {t('employee', formData.nb_agents > 1).toLowerCase()}
                            </div>
                          </div>
                        ) : isPricingMode('hourly') ? (
                          <span className="text-xs text-amber-600 font-normal">Saisir les heures</span>
                        ) : (
                          <span>{prixLigne.toFixed(2)} EUR</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveService(ligne.service_id)}
                        className="p-1 text-red-500 hover:bg-red-50 rounded"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Dates par ligne (security / multi-day) */}
                    {profile?.duration?.allowMultiDay && (
                      <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                        <span className="text-xs text-gray-500">Du</span>
                        <input
                          type="date"
                          value={ligne.date_debut || formData.date_prestation || ''}
                          onChange={(e) => setServiceLignes(prev => prev.map(l =>
                            l.service_id === ligne.service_id ? { ...l, date_debut: e.target.value } : l
                          ))}
                          className="px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <span className="text-xs text-gray-500">au</span>
                        <input
                          type="date"
                          value={ligne.date_fin || formData.date_fin_prestation || formData.date_prestation || ''}
                          onChange={(e) => setServiceLignes(prev => prev.map(l =>
                            l.service_id === ligne.service_id ? { ...l, date_fin: e.target.value } : l
                          ))}
                          min={ligne.date_debut || formData.date_prestation || ''}
                          className="px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>
                    )}

                    {/* Affectations multiples (une par quantite) - uniquement salon/service_domicile */}
                    {showMemberAssignment && (ligne.affectations || []).map((affectation, affIdx) => (
                      <div key={affIdx} className="pt-2 border-t border-gray-100 space-y-2">
                        {/* Label si plusieurs affectations */}
                        {ligne.quantite > 1 && (
                          <p className="text-xs font-medium text-blue-600 mb-1">
                            Affectation #{affIdx + 1}
                          </p>
                        )}

                        {/* Assignation membre */}
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <select
                            value={affectation.membre_id || ''}
                            onChange={(e) => updateAffectation(
                              ligne.service_id,
                              affIdx,
                              'membre_id',
                              e.target.value ? parseInt(e.target.value) : undefined
                            )}
                            className="flex-1 px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="">-- Assigner {t('employee', false).toLowerCase()} --</option>
                            {membresData?.map((m) => (
                              <option key={m.id} value={m.id}>
                                {m.prenom} {m.nom} ({m.role})
                              </option>
                            ))}
                          </select>
                          {affectation.membre_id && (
                            <span className="text-xs text-green-600">{'\u2713'}</span>
                          )}
                        </div>

                        {/* Horaires pour cette affectation */}
                        <div className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-gray-400 flex-shrink-0" />
                          <span className="text-sm text-gray-600">Horaires:</span>
                          <input
                            type="time"
                            value={affectation.heure_debut || ''}
                            onChange={(e) => updateAffectation(
                              ligne.service_id,
                              affIdx,
                              'heure_debut',
                              e.target.value
                            )}
                            className="px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="Debut"
                          />
                          <span className="text-gray-400">{'\u2192'}</span>
                          <input
                            type="time"
                            value={affectation.heure_fin || ''}
                            onChange={(e) => updateAffectation(
                              ligne.service_id,
                              affIdx,
                              'heure_fin',
                              e.target.value
                            )}
                            className="px-2 py-1 text-sm border rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder="Fin"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  );
                })}
              </div>
            )}

            {serviceLignes.length === 0 && (
              <p className="text-center text-gray-500 py-4">Aucune prestation selectionnee</p>
            )}
          </div>

          {/* Section Periode de la Prestation (Mode NON-Horaire) */}
          {!isPricingMode('hourly') && (
          <div className="bg-green-50 rounded-lg p-4 space-y-3">
            <h3 className="font-semibold text-gray-700 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-green-600" />
              Periode de la prestation
            </h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date debut *</label>
                <input
                  type="date"
                  value={formData.date_prestation}
                  onChange={(e) => setFormData({ ...formData, date_prestation: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Heure debut *</label>
                <input
                  type="time"
                  value={formData.heure_prestation}
                  onChange={(e) => setFormData({ ...formData, heure_prestation: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date fin</label>
                <input
                  type="date"
                  value={formData.date_fin_prestation}
                  onChange={(e) => setFormData({ ...formData, date_fin_prestation: e.target.value })}
                  min={formData.date_prestation}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Heure fin</label>
                <input
                  type="time"
                  value={formData.heure_fin_prestation}
                  onChange={(e) => setFormData({ ...formData, heure_fin_prestation: e.target.value })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Validite du devis (jours)</label>
                <input
                  type="number"
                  value={formData.validite_jours}
                  onChange={(e) => setFormData({ ...formData, validite_jours: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <p className="text-xs text-gray-500">
              Ces informations seront utilisees lors de l'execution du devis pour planifier la prestation.
            </p>
          </div>
          )}

          {/* Geste commercial */}
          <div className="bg-yellow-50 rounded-lg p-4 space-y-3">
            <h3 className="font-semibold text-gray-700">Geste commercial</h3>
            <div className="flex gap-4 items-center">
              <select
                value={formData.remise_type}
                onChange={(e) => setFormData({ ...formData, remise_type: e.target.value as 'aucune' | 'pourcentage' | 'montant' })}
                className="px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="aucune">Aucune remise</option>
                <option value="pourcentage">Remise %</option>
                <option value="montant">Remise EUR</option>
              </select>
              {formData.remise_type !== 'aucune' && (
                <>
                  <input
                    type="number"
                    step={formData.remise_type === 'pourcentage' ? '1' : '0.01'}
                    min="0"
                    value={formData.remise_valeur}
                    onChange={(e) => setFormData({ ...formData, remise_valeur: parseFloat(e.target.value) || 0 })}
                    className="w-24 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                  <span>{formData.remise_type === 'pourcentage' ? '%' : 'EUR'}</span>
                  <input
                    type="text"
                    placeholder="Motif (optionnel)"
                    value={formData.remise_motif}
                    onChange={(e) => setFormData({ ...formData, remise_motif: e.target.value })}
                    className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </>
              )}
            </div>
          </div>

          {/* Acompte */}
          <div className="bg-green-50 rounded-lg p-4 space-y-3">
            <h3 className="font-semibold text-gray-700">Acompte</h3>
            <div className="flex gap-4 items-center">
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="5"
                  value={formData.acompte_pourcentage}
                  onChange={(e) => setFormData({ ...formData, acompte_pourcentage: parseInt(e.target.value) || 0 })}
                  className="w-20 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-600">%</span>
              </div>
              {formData.acompte_pourcentage > 0 && calculs.montantTTC > 0 && (
                <span className="text-sm text-green-700 font-medium">
                  = {(calculs.montantTTC * formData.acompte_pourcentage / 100).toFixed(2)} EUR
                </span>
              )}
            </div>
            {formData.acompte_pourcentage === 0 && (
              <p className="text-xs text-gray-500">Aucun acompte ne sera demande.</p>
            )}
          </div>

          {/* Numero commande + Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">N° commande / bon de commande</label>
            <input
              type="text"
              value={formData.numero_commande}
              onChange={(e) => setFormData({ ...formData, numero_commande: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              placeholder="PO-2026-001..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500"
              rows={2}
              placeholder="Informations complementaires..."
            />
          </div>

          {/* Resume montants */}
          <div className="bg-blue-50 rounded-lg p-4 space-y-2">
            {/* Mode horaire: afficher detail du calcul */}
            {calculs.pricingMode === 'hourly' && calculs.nbAgents > 0 && (
              <div className="text-xs text-blue-700 bg-blue-100 rounded p-2 mb-2">
                <span className="font-medium">Mode horaire:</span>{' '}
                {calculs.nbAgents} agent{calculs.nbAgents > 1 ? 's' : ''} x {calculs.nbJours} jour{calculs.nbJours > 1 ? 's' : ''}
                <span className="block mt-1 text-blue-600">
                  Total: {Math.round(calculs.dureeTotale / 60)}h de vacation
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm">
              <span>Sous-total prestations:</span>
              <span>{calculs.sousTotal.toFixed(2)} EUR</span>
            </div>
            {calculs.montantRemise > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Remise ({formData.remise_type === 'pourcentage' ? `${formData.remise_valeur}%` : 'fixe'}):</span>
                <span>-{calculs.montantRemise.toFixed(2)} EUR</span>
              </div>
            )}
            {calculs.montantCnaps > 0 && (
              <div className="flex justify-between text-sm">
                <span>Taxe CNAPS (0.50%):</span>
                <span>{calculs.montantCnaps.toFixed(2)} EUR</span>
              </div>
            )}
            <div className="flex justify-between text-sm border-t pt-2">
              <span>Montant HT{calculs.montantCnaps > 0 ? ' (incl. CNAPS)' : ''}:</span>
              <span>{calculs.montantHT.toFixed(2)} EUR</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>TVA ({formData.taux_tva}%):</span>
              <span>{calculs.montantTVA.toFixed(2)} EUR</span>
            </div>
            <div className="flex justify-between font-bold text-lg border-t pt-2">
              <span>Total TTC:</span>
              <span className="text-blue-600">{calculs.montantTTC.toFixed(2)} EUR</span>
            </div>
            <div className="flex justify-between text-sm text-gray-500">
              <span>Duree totale:</span>
              <span>{Math.floor(calculs.dureeTotale / 60)}h{calculs.dureeTotale % 60 > 0 ? ` ${calculs.dureeTotale % 60}min` : ''}</span>
            </div>
          </div>

          {/* Actions */}
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
              disabled={isLoading || serviceLignes.length === 0}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? 'Enregistrement...' : devis ? 'Modifier' : 'Creer le devis'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
