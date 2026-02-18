import { Link, useLocation } from 'wouter';
import { Bot, Menu, X } from 'lucide-react';
import { useState } from 'react';

const navLinks = [
  { to: '/website', label: 'Accueil' },
  { to: '/website/pricing', label: 'Tarifs' },
  { to: '/website/contact', label: 'Contact' },
];

export default function WebsiteLayout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [location] = useLocation();

  return (
    <div className="min-h-screen flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link to="/website" className="flex items-center gap-2 text-2xl font-bold">
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg flex items-center justify-center">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <span className="bg-gradient-to-r from-cyan-600 to-blue-600 bg-clip-text text-transparent">
                NEXUS
              </span>
            </Link>

            {/* Desktop nav */}
            <div className="hidden md:flex items-center gap-8">
              {navLinks.map(l => (
                <Link key={l.to} to={l.to} className={`font-medium transition-colors ${location === l.to ? 'text-cyan-600' : 'text-gray-600 hover:text-gray-900'}`}>
                  {l.label}
                </Link>
              ))}
              <Link to="/nexus/login" className="text-cyan-600 hover:text-cyan-700 font-medium">
                Connexion
              </Link>
              <Link
                to="/website/contact"
                className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg font-semibold hover:shadow-lg transition-all"
              >
                Démarrer
              </Link>
            </div>

            {/* Mobile toggle */}
            <button onClick={() => setMobileOpen(!mobileOpen)} className="md:hidden p-2">
              {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

          {/* Mobile nav */}
          {mobileOpen && (
            <div className="md:hidden mt-4 pb-4 space-y-3 border-t pt-4">
              {navLinks.map(l => (
                <Link key={l.to} to={l.to} onClick={() => setMobileOpen(false)} className="block text-gray-700 font-medium py-2">
                  {l.label}
                </Link>
              ))}
              <Link to="/nexus/login" onClick={() => setMobileOpen(false)} className="block text-cyan-600 font-medium py-2">
                Connexion
              </Link>
              <Link
                to="/website/contact"
                onClick={() => setMobileOpen(false)}
                className="block text-center px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-lg font-semibold"
              >
                Démarrer
              </Link>
            </div>
          )}
        </nav>
      </header>

      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Bot className="w-6 h-6" />
                <span className="text-xl font-bold">NEXUS</span>
              </div>
              <p className="text-gray-400">L'IA qui fait tourner votre business</p>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Produit</h3>
              <ul className="space-y-2 text-gray-400">
                <li><Link to="/website" className="hover:text-white">Accueil</Link></li>
                <li><Link to="/website/pricing" className="hover:text-white">Tarifs</Link></li>
                <li><Link to="/website/contact" className="hover:text-white">Démo</Link></li>
              </ul>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Légal</h3>
              <ul className="space-y-2 text-gray-400">
                <li><span className="text-gray-500">CGV</span></li>
                <li><span className="text-gray-500">Confidentialité</span></li>
                <li><span className="text-gray-500">Mentions légales</span></li>
              </ul>
              <p className="text-xs text-gray-600 mt-2">Bientôt disponibles</p>
            </div>

            <div>
              <h3 className="font-semibold mb-4">Contact</h3>
              <ul className="space-y-2 text-gray-400">
                <li><a href="mailto:contact@nexus-platform.fr" className="hover:text-white">contact@nexus-platform.fr</a></li>
                <li>Île-de-France</li>
                <li><Link to="/website/contact" className="hover:text-white">Formulaire de contact</Link></li>
              </ul>
            </div>
          </div>

          <div className="border-t border-gray-800 mt-12 pt-8 text-center text-gray-400">
            © 2026 NEXUS. Tous droits réservés.
          </div>
        </div>
      </footer>
    </div>
  );
}
