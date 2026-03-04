import { MapPin, Phone, Clock, Navigation, Car } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function GoogleMap() {
  // Coordonnées de Fatou à Franconville
  const latitude = 48.9892;
  const longitude = 2.2308;
  const address = "8 rue des Monts Rouges, 95130 Franconville";
  const googleMapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
  const embedUrl = `https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2619.8!2d${longitude}!3d${latitude}!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2zNDjCsDU5JzIxLjEiTiAywrAxMyczOC45IkU!5e0!3m2!1sfr!2sfr!4v1600000000000!5m2!1sfr!2sfr`;

  const horaires = [
    { jour: "Lundi", horaires: "9h - 18h" },
    { jour: "Mardi", horaires: "9h - 18h" },
    { jour: "Mercredi", horaires: "9h - 18h" },
    { jour: "Jeudi", horaires: "9h - 13h" },
    { jour: "Vendredi", horaires: "13h - 18h" },
    { jour: "Samedi", horaires: "9h - 18h" },
    { jour: "Dimanche", horaires: "Fermé", closed: true }
  ];

  // Déterminer le jour actuel
  const today = new Date().getDay();
  const joursSemaine = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
  const jourActuel = joursSemaine[today];

  return (
    <section className="py-20 bg-gradient-to-b from-white to-amber-50">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        {/* Header */}
        <div className="text-center mb-12">
          <span className="inline-block px-4 py-1.5 bg-amber-100 text-amber-700 text-sm font-medium rounded-full mb-4">
            Localisation
          </span>
          <h2 className="text-3xl md:text-4xl font-bold text-zinc-900 mb-4">
            Où nous <span className="text-amber-600">trouver</span>
          </h2>
          <p className="text-zinc-600 max-w-2xl mx-auto">
            Fatou vous accueille à Franconville ou se déplace chez vous en Île-de-France
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Map */}
          <div className="relative h-[400px] lg:h-full min-h-[400px] rounded-3xl overflow-hidden shadow-xl border border-amber-100">
            <iframe
              src={embedUrl}
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Localisation Fat's Hair-Afro"
              className="grayscale-[20%] contrast-[1.1]"
            />
            {/* Overlay gradient */}
            <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
          </div>

          {/* Info cards */}
          <div className="space-y-6">
            {/* Adresse */}
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-amber-100 hover:shadow-xl transition-shadow">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-amber-100 rounded-xl">
                  <MapPin className="w-6 h-6 text-amber-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-zinc-900 mb-1">Adresse de Fatou</h3>
                  <p className="text-zinc-600 mb-3">{address}</p>
                  <a
                    href={googleMapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-amber-600 hover:text-amber-700 font-medium text-sm"
                  >
                    <Navigation className="w-4 h-4" />
                    Ouvrir dans Google Maps
                  </a>
                </div>
              </div>
            </div>

            {/* Zone déplacement */}
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-amber-100 hover:shadow-xl transition-shadow">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-amber-100 rounded-xl">
                  <Car className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-zinc-900 mb-1">Service à domicile</h3>
                  <p className="text-zinc-600 mb-2">
                    Franconville et toute l'Île-de-France
                  </p>
                  <p className="text-sm text-zinc-500">
                    Frais de déplacement calculés selon la distance
                  </p>
                </div>
              </div>
            </div>

            {/* Téléphone */}
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-amber-100 hover:shadow-xl transition-shadow">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-amber-100 rounded-xl">
                  <Phone className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-zinc-900 mb-1">Téléphone</h3>
                  <a
                    href="tel:+33939240269"
                    className="text-2xl font-bold text-amber-600 hover:text-amber-700"
                  >
                    09 39 24 02 69
                  </a>
                  <p className="text-sm text-zinc-500 mt-1">
                    Ou via WhatsApp : 07 82 23 50 20
                  </p>
                </div>
              </div>
            </div>

            {/* Horaires */}
            <div className="bg-white rounded-2xl p-6 shadow-lg border border-amber-100 hover:shadow-xl transition-shadow">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-amber-100 rounded-xl">
                  <Clock className="w-6 h-6 text-amber-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-zinc-900 mb-3">Horaires d'ouverture</h3>
                  <ul className="space-y-2">
                    {horaires.map((h) => (
                      <li
                        key={h.jour}
                        className={`flex justify-between text-sm ${
                          h.jour === jourActuel
                            ? 'font-semibold text-amber-600'
                            : h.closed
                            ? 'text-zinc-400'
                            : 'text-zinc-600'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          {h.jour === jourActuel && (
                            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                          )}
                          {h.jour}
                        </span>
                        <span className={h.closed ? 'text-red-400' : ''}>
                          {h.horaires}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-12 text-center">
          <Button
            asChild
            size="lg"
            className="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 shadow-lg shadow-amber-500/30"
          >
            <a href="tel:+33939240269">
              <Phone className="w-5 h-5 mr-2" />
              Appeler maintenant
            </a>
          </Button>
        </div>
      </div>
    </section>
  );
}
