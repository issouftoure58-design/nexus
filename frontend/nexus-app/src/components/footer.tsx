import { Link } from "wouter";
import { Phone, Clock, Instagram, Facebook, MessageCircle, Car, Home } from "lucide-react";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-zinc-900 text-white">
      {/* Main Footer */}
      <div className="max-w-7xl mx-auto px-4 md:px-6 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-3 mb-4">
              <img
                src="/logo/logo-icon.svg"
                alt="Fat's Hair-Afro"
                className="h-14 w-14"
              />
              <div>
                <h3 className="font-bold text-lg">Fat's Hair-Afro</h3>
                <p className="text-xs text-amber-400">Coiffure Afro</p>
              </div>
            </div>
            <p className="text-sm text-zinc-400 leading-relaxed">
              Coiffeuse afro à Franconville et en Île-de-France. Spécialiste en tresses, locks, soins hydratants et brushing afro. 25 ans d'expérience.
            </p>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-semibold text-lg mb-4 text-amber-400">Contact</h4>
            <ul className="space-y-3">
              <li>
                <a
                  href="tel:+33939240269"
                  className="flex items-center gap-3 text-sm text-zinc-400 hover:text-white transition-colors"
                >
                  <Phone className="h-4 w-4 text-amber-500" />
                  09 39 24 02 69
                </a>
              </li>
              <li>
                <a
                  href="https://wa.me/18302894929"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-3 text-sm text-zinc-400 hover:text-white transition-colors"
                >
                  <MessageCircle className="h-4 w-4 text-green-400" />
                  WhatsApp Halimah : +1 830 289 4929
                </a>
              </li>
              <li className="flex items-start gap-3 text-sm text-zinc-400">
                <Car className="h-4 w-4 mt-0.5 text-amber-500 shrink-0" />
                <span>Chez Fatou ou à domicile<br />Île-de-France</span>
              </li>
            </ul>
          </div>

          {/* Zone d'intervention */}
          <div>
            <h4 className="font-semibold text-lg mb-4 text-amber-400">Zone d'intervention</h4>
            <ul className="space-y-2 text-sm text-zinc-400">
              <li className="flex items-center gap-2">
                <Home className="h-3 w-3 text-amber-500" />
                Franconville & environs
              </li>
              <li>Sannois, Ermont, Eaubonne</li>
              <li>Argenteuil, Cergy, Pontoise</li>
              <li>Saint-Denis, Colombes</li>
              <li className="text-zinc-500 italic">+ toute l'Île-de-France</li>
            </ul>
            <p className="mt-4 text-xs text-amber-500/80 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Horaires flexibles (soir & week-end)
            </p>
          </div>

          {/* Liens rapides */}
          <div>
            <h4 className="font-semibold text-lg mb-4 text-amber-400">Liens rapides</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/" className="text-sm text-zinc-400 hover:text-amber-400 transition-colors">
                  Accueil
                </Link>
              </li>
              <li>
                <Link href="/services" className="text-sm text-zinc-400 hover:text-amber-400 transition-colors">
                  Services & Tarifs
                </Link>
              </li>
              <li>
                <Link href="/a-propos" className="text-sm text-zinc-400 hover:text-amber-400 transition-colors">
                  À propos de Fatou
                </Link>
              </li>
              <li>
                <Link href="/reserver" className="text-sm text-zinc-400 hover:text-amber-400 transition-colors">
                  Réserver avec Halimah
                </Link>
              </li>
              <li>
                <Link href="/mon-compte" className="text-sm text-zinc-400 hover:text-amber-400 transition-colors">
                  Mon Compte Fidélité
                </Link>
              </li>
            </ul>

            <h4 className="font-semibold text-lg mt-6 mb-3 text-amber-400">Informations légales</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/charte" className="text-sm text-zinc-400 hover:text-amber-400 transition-colors">
                  Charte & Conditions
                </Link>
              </li>
              <li>
                <Link href="/cgv" className="text-sm text-zinc-400 hover:text-amber-400 transition-colors">
                  CGV
                </Link>
              </li>
              <li>
                <Link href="/confidentialite" className="text-sm text-zinc-400 hover:text-amber-400 transition-colors">
                  Politique de confidentialité
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Social Links */}
        <div className="mt-8 pt-8 border-t border-zinc-800">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <span className="text-sm text-zinc-400">Suivez-nous :</span>
              <div className="flex gap-3">
                <a
                  href="https://instagram.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 bg-zinc-800 rounded-lg hover:bg-amber-600 transition-colors"
                  aria-label="Instagram"
                >
                  <Instagram className="h-4 w-4" />
                </a>
                <a
                  href="https://facebook.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 bg-zinc-800 rounded-lg hover:bg-amber-600 transition-colors"
                  aria-label="Facebook"
                >
                  <Facebook className="h-4 w-4" />
                </a>
                <a
                  href="https://wa.me/18302894929"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 bg-zinc-800 rounded-lg hover:bg-green-600 transition-colors"
                  aria-label="WhatsApp"
                >
                  <MessageCircle className="h-4 w-4" />
                </a>
              </div>
            </div>
            <Link
              href="/reserver"
              className="px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-medium rounded-lg transition-all shadow-lg shadow-amber-500/25 hover:shadow-amber-500/40"
            >
              Réserver maintenant
            </Link>
          </div>
        </div>
      </div>

      {/* Copyright */}
      <div className="bg-zinc-950 py-4">
        <div className="max-w-7xl mx-auto px-4 md:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-zinc-500">
            <p>© {currentYear} Fat's Hair-Afro. Tous droits réservés.</p>
            <p className="flex items-center gap-1">
              <span className="text-amber-500">Halimah</span> - Assistante IA disponible 24h/24
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
