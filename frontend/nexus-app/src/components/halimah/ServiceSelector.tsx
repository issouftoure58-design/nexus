import { useState, useEffect } from 'react';
import { ChevronDown, Clock, Sparkles } from 'lucide-react';
import { apiFetch } from '@/lib/api-config';
import { useChatBooking, Service } from '@/contexts/ChatBookingContext';

interface ServiceFromAPI {
  id: number;
  nom: string;
  description: string;
  duree: number;
  prix: number;
  categorie?: string;
}

export default function ServiceSelector() {
  const { selectService, formatPrice, formatDuration } = useChatBooking();
  const [services, setServices] = useState<ServiceFromAPI[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    try {
      const response = await apiFetch('/api/services');
      const data = await response.json();
      setServices(data.services || []);
    } catch (error) {
      console.error('Erreur chargement services:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = (service: ServiceFromAPI) => {
    setSelectedId(service.id);
    setIsOpen(false);

    // Convertir au format du contexte
    const bookingService: Service = {
      id: String(service.id),
      nom: service.nom,
      description: service.description,
      duree: service.duree,
      prix: service.prix,
    };

    selectService(bookingService);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl p-4 border border-amber-200 shadow-sm">
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin h-5 w-5 border-2 border-amber-500 border-t-transparent rounded-full" />
          <span className="ml-2 text-zinc-500">Chargement des services...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3 border-b border-amber-100">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-amber-500" />
          <span className="font-medium text-zinc-700">Choisissez votre prestation</span>
        </div>
      </div>

      {/* Dropdown trigger */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-amber-50 transition-colors"
      >
        <span className={selectedId ? 'text-zinc-800' : 'text-zinc-400'}>
          {selectedId
            ? services.find(s => s.id === selectedId)?.nom
            : 'Sélectionnez un service...'
          }
        </span>
        <ChevronDown
          className={`h-5 w-5 text-zinc-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Dropdown list */}
      {isOpen && (
        <div className="border-t border-amber-100 max-h-64 overflow-y-auto">
          {services.map((service) => (
            <button
              key={service.id}
              onClick={() => handleSelect(service)}
              className={`w-full px-4 py-3 text-left hover:bg-amber-50 transition-colors border-b border-zinc-100 last:border-b-0 ${
                selectedId === service.id ? 'bg-amber-50' : ''
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-zinc-800 truncate">
                    {service.nom}
                  </div>
                  {service.description && (
                    <div className="text-xs text-zinc-500 mt-0.5 line-clamp-1">
                      {service.description}
                    </div>
                  )}
                </div>
                <div className="text-right ml-3 flex-shrink-0">
                  <div className="font-semibold text-amber-600">
                    {formatPrice(service.prix)}
                  </div>
                  <div className="text-xs text-zinc-400 flex items-center justify-end gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDuration(service.duree)}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Hint text */}
      <div className="px-4 py-2 bg-zinc-50 border-t border-zinc-100">
        <p className="text-xs text-zinc-400 text-center">
          Ou decrivez directement ce que vous souhaitez dans le chat
        </p>
      </div>
    </div>
  );
}
