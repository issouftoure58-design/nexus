import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useTenantContext } from '@/contexts/TenantContext';
import { api, servicesApi, disponibilitesApi } from '@/lib/api';
import { Loader2, Check, ArrowRight, Settings } from 'lucide-react';
import ConfigServicesList, { type ServiceItem } from '@/components/config/ConfigServicesList';
import ConfigHoursSingle, { type DayHours } from '@/components/config/ConfigHoursSingle';
import ConfigHoursMulti, { type DayMultiHours } from '@/components/config/ConfigHoursMulti';
import ConfigIAChannels, { type IAChannelConfig } from '@/components/config/ConfigIAChannels';
import ConfigTableZones, { DEFAULT_ZONES, type TableZone } from '@/components/config/ConfigTableZones';
import ConfigRoomTypes, { DEFAULT_ROOMS, DEFAULT_OPTIONS, type RoomType, type HotelOptions } from '@/components/config/ConfigRoomTypes';

// ═══════════════════════════════════════════════════════════════
// Mapping template → config type
// ═══════════════════════════════════════════════════════════════

type ConfigMode = 'salon' | 'restaurant' | 'hotel' | 'artisan' | 'commerce' | 'medical' | 'garage' | 'autre';

const TEMPLATE_TO_MODE: Record<string, ConfigMode> = {
  salon_coiffure: 'salon',
  institut_beaute: 'salon',
  restaurant: 'restaurant',
  medical: 'medical',
  garage: 'garage',
  artisan: 'artisan',
  hotel: 'hotel',
  commerce: 'commerce',
  autre: 'autre',
};

const MODE_LABELS: Record<ConfigMode, { title: string; emoji: string; description: string }> = {
  salon: { title: 'Configuration Salon', emoji: '✂️', description: 'Services, horaires et canaux IA' },
  restaurant: { title: 'Configuration Restaurant', emoji: '🍽️', description: 'Tables, services midi/soir et canaux IA' },
  hotel: { title: 'Configuration Hôtel', emoji: '🏨', description: 'Chambres, tarifs, options et canaux IA' },
  artisan: { title: 'Configuration Artisan', emoji: '🔧', description: 'Services, horaires, déplacement et canaux IA' },
  commerce: { title: 'Configuration Commerce', emoji: '🛍️', description: 'Horaires et canaux IA' },
  medical: { title: 'Configuration Cabinet', emoji: '🩺', description: 'Services, horaires matin/après-midi et canaux IA' },
  garage: { title: 'Configuration Garage', emoji: '🚗', description: 'Services, horaires matin/après-midi et canaux IA' },
  autre: { title: 'Configuration', emoji: '⚙️', description: 'Services, horaires et canaux IA' },
};

// Need multi-period for these modes
const MULTI_PERIOD_MODES = new Set<ConfigMode>(['restaurant', 'medical', 'garage']);

// Period labels per mode
const PERIOD_LABELS: Record<string, string[]> = {
  restaurant: ['Midi', 'Soir'],
  medical: ['Matin', 'Après-midi'],
  garage: ['Matin', 'Après-midi'],
};

// Default hours for single-period modes
function defaultSingleHours(): DayHours[] {
  return Array.from({ length: 7 }, (_, i) => ({
    is_active: i !== 0, // fermé dimanche
    open: '09:00',
    close: '18:00',
  }));
}

// Default hours for multi-period modes
function defaultMultiHours(mode: ConfigMode): DayMultiHours[] {
  const labels = PERIOD_LABELS[mode] || ['Midi', 'Soir'];
  const periods = mode === 'restaurant'
    ? [{ label: labels[0], open: '12:00', close: '14:30' }, { label: labels[1], open: '19:00', close: '22:30' }]
    : [{ label: labels[0], open: '09:00', close: '12:00' }, { label: labels[1], open: '14:00', close: '18:00' }];

  return Array.from({ length: 7 }, (_, i) => ({
    is_active: i !== 0,
    periods: i === 0 ? [] : [...periods.map(p => ({ ...p }))],
  }));
}

// ═══════════════════════════════════════════════════════════════
// PAGE CONFIGURATION
// ═══════════════════════════════════════════════════════════════

export default function Configuration() {
  const navigate = useNavigate();
  const { tenant, refetch } = useTenantContext();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  const templateId = (tenant as any)?.template_id || 'autre';
  const mode: ConfigMode = TEMPLATE_TO_MODE[templateId] || 'autre';
  const modeInfo = MODE_LABELS[mode];
  const isMultiPeriod = MULTI_PERIOD_MODES.has(mode);

  // State
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [singleHours, setSingleHours] = useState<DayHours[]>(defaultSingleHours());
  const [multiHours, setMultiHours] = useState<DayMultiHours[]>(defaultMultiHours(mode));
  const [iaChannels, setIAChannels] = useState<IAChannelConfig>({ web: true, whatsapp: false, telephone: false });
  const [tableZones, setTableZones] = useState<TableZone[]>(DEFAULT_ZONES);
  const [rooms, setRooms] = useState<RoomType[]>(DEFAULT_ROOMS);
  const [hotelOptions, setHotelOptions] = useState<HotelOptions>(DEFAULT_OPTIONS);

  // Load existing data
  useEffect(() => {
    const loadData = async () => {
      try {
        // Load services
        if (mode !== 'restaurant') {
          try {
            const { services: existing } = await servicesApi.list();
            if (existing?.length > 0) {
              setServices(existing.map(s => ({
                nom: s.nom,
                duree_minutes: s.duree || 30,
                prix: (s.prix || 0) / 100, // centimes → euros
                categorie: s.categorie || 'general',
              })));
            }
          } catch {
            // New tenant, no services yet — use template defaults loaded from backend
          }
        }

        // Load hours
        try {
          const { horaires } = await disponibilitesApi.getHoraires();
          if (horaires?.length > 0) {
            if (isMultiPeriod) {
              // Group by day
              const byDay: Record<number, any[]> = {};
              horaires.forEach(h => {
                if (!byDay[h.jour]) byDay[h.jour] = [];
                byDay[h.jour].push(h);
              });
              setMultiHours(Array.from({ length: 7 }, (_, i) => {
                const dayData = byDay[i];
                if (!dayData || dayData.length === 0 || !dayData[0].is_active) {
                  return { is_active: false, periods: [] };
                }
                return {
                  is_active: true,
                  periods: dayData.map(d => ({
                    label: d.period_label || 'Journée',
                    open: d.heure_debut || '09:00',
                    close: d.heure_fin || '18:00',
                  })),
                };
              }));
            } else {
              setSingleHours(Array.from({ length: 7 }, (_, i) => {
                const h = horaires.find(h => h.jour === i);
                return {
                  is_active: h?.is_active ?? i !== 0,
                  open: h?.heure_debut || '09:00',
                  close: h?.heure_fin || '18:00',
                };
              }));
            }
          }
        } catch {
          // No hours yet
        }
      } catch (err) {
        console.warn('[Configuration] Error loading data:', err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [mode, isMultiPeriod]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // 1. Save services (if applicable)
      if (mode !== 'restaurant' && services.length > 0) {
        // Delete existing and recreate (simple approach for onboarding)
        for (const service of services) {
          try {
            await servicesApi.create({
              nom: service.nom,
              duree_minutes: service.duree_minutes,
              prix: Math.round(service.prix * 100), // euros → centimes
              categorie: service.categorie,
              actif: true,
            } as any);
          } catch {
            // Service may already exist from template provisioning, skip
          }
        }
      }

      // 2. Save hours
      if (isMultiPeriod) {
        // For multi-period, we need to build the flat array
        const horaires: { jour: number; heure_debut: string | null; heure_fin: string | null; is_active: boolean; period_label?: string }[] = [];
        multiHours.forEach((day, i) => {
          if (!day.is_active || day.periods.length === 0) {
            horaires.push({
              jour: i,
              heure_debut: null,
              heure_fin: null,
              is_active: false,
              period_label: 'journee',
            });
          } else {
            day.periods.forEach(p => {
              horaires.push({
                jour: i,
                heure_debut: p.open,
                heure_fin: p.close,
                is_active: true,
                period_label: p.label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '_'),
              });
            });
          }
        });
        await disponibilitesApi.updateHoraires(horaires);
      } else {
        const horaires = singleHours.map((h, i) => ({
          jour: i,
          heure_debut: h.is_active ? h.open : null,
          heure_fin: h.is_active ? h.close : null,
          is_active: h.is_active,
        }));
        await disponibilitesApi.updateHoraires(horaires);
      }

      // 3. Complete onboarding
      await api.patch('/tenants/me/complete-onboarding');

      // Refetch tenant to update onboarding_completed
      await refetch();

      setSaved(true);
      setTimeout(() => navigate('/'), 1500);
    } catch (err) {
      console.error('[Configuration] Save error:', err);
      alert('Erreur lors de la sauvegarde. Veuillez réessayer.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-cyan-500 mx-auto mb-4" />
          <p className="text-gray-500">Chargement de votre configuration...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center">
            <span className="text-3xl">{modeInfo.emoji}</span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">{modeInfo.title}</h1>
          <p className="text-gray-500 mt-1">{modeInfo.description}</p>
          <p className="text-sm text-gray-400 mt-2">
            Personnalisez votre espace. Tout est modifiable plus tard dans les Paramètres.
          </p>
        </div>

        <div className="space-y-6">
          {/* Services (tous sauf restaurant) */}
          {mode !== 'restaurant' && mode !== 'commerce' && (
            <Card>
              <CardContent className="p-6">
                <ConfigServicesList services={services} onChange={setServices} />
              </CardContent>
            </Card>
          )}

          {/* Restaurant: tables/zones */}
          {mode === 'restaurant' && (
            <Card>
              <CardContent className="p-6">
                <ConfigTableZones zones={tableZones} onChange={setTableZones} />
              </CardContent>
            </Card>
          )}

          {/* Hôtel: chambres + options */}
          {mode === 'hotel' && (
            <Card>
              <CardContent className="p-6">
                <ConfigRoomTypes
                  rooms={rooms}
                  options={hotelOptions}
                  onRoomsChange={setRooms}
                  onOptionsChange={setHotelOptions}
                />
              </CardContent>
            </Card>
          )}

          {/* Horaires */}
          <Card>
            <CardContent className="p-6">
              {isMultiPeriod ? (
                <ConfigHoursMulti
                  hours={multiHours}
                  onChange={setMultiHours}
                  periodLabels={PERIOD_LABELS[mode]}
                />
              ) : (
                <ConfigHoursSingle hours={singleHours} onChange={setSingleHours} />
              )}
            </CardContent>
          </Card>

          {/* Canaux IA */}
          <Card>
            <CardContent className="p-6">
              <ConfigIAChannels channels={iaChannels} onChange={setIAChannels} />
            </CardContent>
          </Card>

          {/* Bouton Terminer */}
          <div className="flex justify-between items-center pt-4">
            <button
              onClick={() => navigate('/')}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Passer pour l'instant
            </button>
            <Button
              onClick={handleSave}
              disabled={saving || saved}
              className="bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 px-8"
              size="lg"
            >
              {saved ? (
                <><Check className="w-5 h-5 mr-2" /> Configuration sauvegardée !</>
              ) : saving ? (
                <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Sauvegarde...</>
              ) : (
                <><Settings className="w-5 h-5 mr-2" /> Terminer la configuration <ArrowRight className="w-4 h-4 ml-2" /></>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
