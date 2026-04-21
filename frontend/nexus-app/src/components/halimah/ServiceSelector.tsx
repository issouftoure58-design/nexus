import { useState, useEffect } from 'react';
import { Clock, Sparkles, Check, X, ShoppingBag, ArrowRight } from 'lucide-react';
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
  const { services: selectedServices, toggleService, doneSelecting, formatPrice, formatDuration } = useChatBooking();
  const [services, setServices] = useState<ServiceFromAPI[]>([]);
  const [loading, setLoading] = useState(true);

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

  const isSelected = (id: number) => selectedServices.some(s => s.id === String(id));

  const handleToggle = (service: ServiceFromAPI) => {
    const bookingService: Service = {
      id: String(service.id),
      nom: service.nom,
      description: service.description,
      duree: service.duree,
      prix: service.prix,
    };
    toggleService(bookingService);
  };

  const totalDuree = selectedServices.reduce((sum, s) => sum + s.duree, 0);
  const totalPrix = selectedServices.reduce((sum, s) => sum + s.prix, 0);

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
          <span className="font-medium text-zinc-700">Choisissez vos prestations</span>
        </div>
        <p className="text-xs text-zinc-500 mt-0.5">Vous pouvez en selectionner plusieurs</p>
      </div>

      {/* Service list — checklist */}
      <div className="max-h-64 overflow-y-auto divide-y divide-zinc-100">
        {services.map((service) => {
          const selected = isSelected(service.id);
          return (
            <button
              key={service.id}
              onClick={() => handleToggle(service)}
              className={`w-full px-4 py-3 text-left transition-colors flex items-center gap-3 ${
                selected ? 'bg-amber-50' : 'hover:bg-zinc-50'
              }`}
            >
              {/* Checkbox */}
              <div className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                selected
                  ? 'bg-amber-500 border-amber-500 text-white'
                  : 'border-zinc-300'
              }`}>
                {selected && <Check className="h-3.5 w-3.5" />}
              </div>

              {/* Service info */}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-zinc-800 truncate">{service.nom}</div>
                {service.description && (
                  <div className="text-xs text-zinc-500 mt-0.5 line-clamp-1">{service.description}</div>
                )}
              </div>

              {/* Price & duration */}
              <div className="text-right flex-shrink-0">
                <div className="font-semibold text-amber-600">{formatPrice(service.prix)}</div>
                <div className="text-xs text-zinc-400 flex items-center justify-end gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDuration(service.duree)}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Cart / selection summary */}
      {selectedServices.length > 0 && (
        <div className="border-t-2 border-amber-200 bg-amber-50 p-3">
          <div className="flex items-center gap-2 mb-2">
            <ShoppingBag className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-700">
              {selectedServices.length} prestation{selectedServices.length > 1 ? 's' : ''}
            </span>
          </div>

          {/* Selected services list */}
          <div className="space-y-1 mb-3">
            {selectedServices.map((s) => (
              <div key={s.id} className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-zinc-700 truncate">{s.nom}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleService(s); }}
                    className="flex-shrink-0 p-0.5 rounded-full hover:bg-amber-200 text-amber-500"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <span className="text-zinc-500 flex-shrink-0 ml-2">{formatPrice(s.prix)}</span>
              </div>
            ))}
          </div>

          {/* Total line */}
          <div className="flex items-center justify-between pt-2 border-t border-amber-200">
            <div className="text-sm text-zinc-600">
              Total: <span className="font-bold text-zinc-800">{formatPrice(totalPrix)}</span>
              <span className="text-xs text-zinc-400 ml-2">{formatDuration(totalDuree)}</span>
            </div>
            <button
              onClick={doneSelecting}
              className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 text-white text-sm font-medium rounded-lg
                hover:bg-amber-600 transition-colors shadow-sm"
            >
              Continuer
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Hint text */}
      {selectedServices.length === 0 && (
        <div className="px-4 py-2 bg-zinc-50 border-t border-zinc-100">
          <p className="text-xs text-zinc-400 text-center">
            Ou decrivez directement ce que vous souhaitez dans le chat
          </p>
        </div>
      )}
    </div>
  );
}
