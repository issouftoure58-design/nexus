import { useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout';
import QuotasWidget from '../../components/admin/QuotasWidget';
import {
  TrendingUp,
  Calendar,
  Users,
  Euro,
  Clock,
  MapPin,
  Sparkles,
  AlertCircle,
  Scissors,
  CalendarCheck,
  Settings,
  ArrowRight,
  ExternalLink
} from 'lucide-react';
import { Link } from 'wouter';

// Icônes SVG pour les réseaux sociaux
const InstagramIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
    <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
  </svg>
);

const TikTokIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
  </svg>
);

const FacebookIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
  </svg>
);

const LinkedInIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
);

const WhatsAppIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

const SnapchatIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
    <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.162-.105-.949-.199-2.403.041-3.439.217-.937 1.407-5.965 1.407-5.965s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.099.12.112.225.085.345-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.401.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.354-.629-2.758-1.379l-.749 2.848c-.269 1.045-1.004 2.352-1.498 3.146 1.123.345 2.306.535 3.55.535 6.607 0 11.985-5.365 11.985-11.987C23.97 5.39 18.592.026 11.985.026L12.017 0z"/>
  </svg>
);

const XIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
  </svg>
);

const GlobeIcon = () => (
  <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/>
  </svg>
);
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

// Mapping des services vers leurs images
const SERVICE_IMAGES: { [key: string]: string } = {
  // Locks
  'Création crochet locks': '/gallery/creation-locks.jpg',
  'Création microlocks crochet': '/gallery/creation-locks.jpg',
  'Création microlocks twist': '/gallery/creation-locks.jpg',
  'Reprise racines locks': '/gallery/entretien-locks.jpg',
  'Reprise racines microlocks': '/gallery/entretien-locks.jpg',
  'Décapage locks': '/gallery/entretien-locks.jpg',
  'Création Locks': '/gallery/creation-locks.jpg',
  'Microlocks': '/gallery/creation-locks.jpg',
  'Entretien Locks': '/gallery/entretien-locks.jpg',
  // Tresses
  'Braids (Box braids)': '/gallery/braids-service.jpg',
  'Box braids': '/gallery/braids-service.jpg',
  'Braids / Box braids': '/gallery/braids-service.jpg',
  'Nattes collées sans rajout': '/gallery/nattes-service.jpg',
  'Nattes collées avec rajout': '/gallery/nattes-service.jpg',
  'Nattes collées': '/gallery/nattes-service.jpg',
  // Soins
  'Soin complet': '/gallery/soin-complet.jpg',
  'Soin hydratant': '/gallery/soin-complet.jpg',
  'Shampoing': '/gallery/soin-complet.jpg',
  // Coloration
  'Brushing afro': '/gallery/brushing-01.jpg',
  'Brushing Afro': '/gallery/brushing-01.jpg',
  'Teinture sans ammoniaque': '/gallery/coloration-naturelle.jpg',
  'Coloration naturelle': '/gallery/coloration-naturelle.jpg',
  'Décoloration': '/gallery/coloration-naturelle.jpg',
};

// Fonction pour obtenir l'image d'un service
const getServiceImage = (serviceName: string | undefined | null): string => {
  if (!serviceName) {
    return '/gallery/creation-locks.jpg'; // Image par défaut
  }
  // Recherche exacte
  if (SERVICE_IMAGES[serviceName]) {
    return SERVICE_IMAGES[serviceName];
  }
  // Recherche partielle (si le nom contient un mot-clé)
  const lowerName = serviceName.toLowerCase();
  if (lowerName.includes('lock')) return '/gallery/creation-locks.jpg';
  if (lowerName.includes('braid') || lowerName.includes('tresse')) return '/gallery/braids-service.jpg';
  if (lowerName.includes('natte')) return '/gallery/nattes-service.jpg';
  if (lowerName.includes('soin')) return '/gallery/soin-complet.jpg';
  if (lowerName.includes('brush')) return '/gallery/brushing-01.jpg';
  if (lowerName.includes('color') || lowerName.includes('teint')) return '/gallery/coloration-naturelle.jpg';
  // Image par défaut
  return '/gallery/creation-locks.jpg';
};

interface Stats {
  ca: {
    jour: number;
    mois: number;
  };
  rdv: {
    confirmes: number;
    en_attente: number;
    annules: number;
    termines: number;
  };
  servicesPopulaires: Array<{
    service: string;
    count: number;
  }>;
  nbClients: number;
  prochainRdv: {
    service_nom: string;
    date: string;
    heure: string;
    adresse_client: string | null;
    clients: {
      nom: string;
      prenom: string;
      telephone: string;
    };
  } | null;
  graphiqueCa: Array<{
    date: string;
    jour: string;
    ca: number;
  }>;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch('/api/admin/stats/dashboard', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Erreur chargement stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-full min-h-[60vh]">
          <div className="h-8 w-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
        </div>
      </AdminLayout>
    );
  }

  if (!stats) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-full min-h-[60vh]">
          <div className="flex items-center gap-2 text-red-400">
            <AlertCircle className="h-5 w-5" />
            Erreur de chargement des statistiques
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/20 backdrop-blur-sm rounded-full border border-amber-500/30 mb-4">
          <Sparkles className="h-4 w-4 text-amber-400" />
          <span className="text-amber-300 text-sm font-medium">Vue d'ensemble</span>
        </div>
        <h1 className="text-3xl font-bold text-white mb-1">
          Dashboard
        </h1>
        <p className="text-white/60">
          Bienvenue dans votre espace de gestion
        </p>
      </div>

      {/* Prochain RDV - En haut */}
      <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 backdrop-blur-sm border border-amber-500/30 rounded-2xl p-6 mb-4">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Calendar className="h-5 w-5 text-amber-400" />
          Prochain rendez-vous
        </h2>
        {stats.prochainRdv ? (
          <div className="flex flex-col md:flex-row md:items-center gap-4">
            {/* Image de la prestation */}
            <div className="relative w-24 h-24 rounded-xl overflow-hidden flex-shrink-0 shadow-lg">
              <img
                src={getServiceImage(stats.prochainRdv.service_nom)}
                alt={stats.prochainRdv.service_nom}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            </div>
            <div className="flex items-center gap-3 flex-1">
              <div className="w-12 h-12 bg-gradient-to-br from-amber-500 to-orange-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-amber-500/30">
                {stats.prochainRdv.clients?.prenom?.[0] || stats.prochainRdv.clients?.nom?.[0] || '?'}
              </div>
              <div>
                <p className="font-semibold text-white text-lg">
                  {stats.prochainRdv.clients?.prenom || ''} {stats.prochainRdv.clients?.nom || 'Client'}
                </p>
                <p className="text-amber-400 text-sm font-medium">{stats.prochainRdv.service_nom}</p>
                <p className="text-white/50 text-sm">{stats.prochainRdv.clients?.telephone || ''}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <div className="px-4 py-2 bg-white/10 rounded-xl border border-white/10">
                <div className="flex items-center gap-2 text-amber-400">
                  <Calendar size={16} />
                  <span className="text-white font-medium">
                    {new Date(stats.prochainRdv.date).toLocaleDateString('fr-FR', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short'
                    })}
                  </span>
                </div>
              </div>
              <div className="px-4 py-2 bg-white/10 rounded-xl border border-white/10">
                <div className="flex items-center gap-2 text-amber-400">
                  <Clock size={16} />
                  <span className="text-white font-medium">{stats.prochainRdv.heure}</span>
                </div>
              </div>
              <div className="px-4 py-2 bg-white/10 rounded-xl border border-white/10">
                <div className="flex items-center gap-2 text-amber-400">
                  <MapPin size={16} />
                  <span className="text-white/80 text-sm">
                    {stats.prochainRdv.adresse_client ? 'Domicile' : 'Salon'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-4">
            <p className="text-white/50">Aucun rendez-vous à venir</p>
          </div>
        )}
      </div>

      {/* Liens rapides - Juste sous Prochain RDV */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Link href="/admin/reservations">
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-3 hover:border-amber-500/30 hover:bg-white/10 transition-all cursor-pointer group">
            <div className="flex items-center gap-2">
              <CalendarCheck className="h-4 w-4 text-amber-400" />
              <span className="text-white text-sm font-medium">Réservations</span>
              <ArrowRight className="h-3 w-3 text-white/30 group-hover:text-amber-400 transition-colors ml-auto" />
            </div>
          </div>
        </Link>
        <Link href="/admin/services">
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-3 hover:border-amber-500/30 hover:bg-white/10 transition-all cursor-pointer group">
            <div className="flex items-center gap-2">
              <Scissors className="h-4 w-4 text-amber-400" />
              <span className="text-white text-sm font-medium">Services</span>
              <ArrowRight className="h-3 w-3 text-white/30 group-hover:text-amber-400 transition-colors ml-auto" />
            </div>
          </div>
        </Link>
        <Link href="/admin/clients">
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-3 hover:border-amber-500/30 hover:bg-white/10 transition-all cursor-pointer group">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-amber-400" />
              <span className="text-white text-sm font-medium">Clients</span>
              <ArrowRight className="h-3 w-3 text-white/30 group-hover:text-amber-400 transition-colors ml-auto" />
            </div>
          </div>
        </Link>
        <Link href="/admin/parametres">
          <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-3 hover:border-amber-500/30 hover:bg-white/10 transition-all cursor-pointer group">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-amber-400" />
              <span className="text-white text-sm font-medium">Paramètres</span>
              <ArrowRight className="h-3 w-3 text-white/30 group-hover:text-amber-400 transition-colors ml-auto" />
            </div>
          </div>
        </Link>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard
          icon={Euro}
          label="CA du jour"
          value={`${stats.ca.jour.toFixed(2)}€`}
          gradient="from-emerald-500 to-green-600"
        />
        <StatCard
          icon={TrendingUp}
          label="CA du mois"
          value={`${stats.ca.mois.toFixed(2)}€`}
          gradient="from-amber-500 to-orange-600"
        />
        <StatCard
          icon={Calendar}
          label="RDV confirmés"
          value={stats.rdv.confirmes.toString()}
          gradient="from-violet-500 to-purple-600"
        />
        <StatCard
          icon={Users}
          label="Total clients"
          value={stats.nbClients.toString()}
          gradient="from-pink-500 to-rose-600"
        />
      </div>

      {/* Widget Quotas - Usage du plan */}
      <div className="mb-6">
        <QuotasWidget />
      </div>

      {/* Liens externes / Réseaux sociaux */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4 mb-6">
        <p className="text-white/50 text-xs mb-3 uppercase tracking-wider">Liens externes</p>
        <div className="flex flex-wrap gap-2">
          <a href="https://www.fatshairafro.com" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 bg-amber-500/20 border border-amber-500/30 rounded-lg hover:bg-amber-500/30 transition-all text-amber-400">
            <GlobeIcon />
            <span className="text-sm">Site web</span>
          </a>
          <a href="https://www.instagram.com/fats_hair_afro" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 bg-pink-500/20 border border-pink-500/30 rounded-lg hover:bg-pink-500/30 transition-all text-pink-400">
            <InstagramIcon />
            <span className="text-sm">Instagram</span>
          </a>
          <a href="https://www.tiktok.com/@fats_hair_afro" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 bg-white/10 border border-white/20 rounded-lg hover:bg-white/20 transition-all text-white">
            <TikTokIcon />
            <span className="text-sm">TikTok</span>
          </a>
          <a href="https://www.facebook.com/fatshairafro" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 bg-blue-500/20 border border-blue-500/30 rounded-lg hover:bg-blue-500/30 transition-all text-blue-400">
            <FacebookIcon />
            <span className="text-sm">Facebook</span>
          </a>
          <a href="https://wa.me/33782235020" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 bg-green-500/20 border border-green-500/30 rounded-lg hover:bg-green-500/30 transition-all text-green-400">
            <WhatsAppIcon />
            <span className="text-sm">WhatsApp</span>
          </a>
          <a href="https://www.linkedin.com/company/fatshairafro" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 bg-sky-500/20 border border-sky-500/30 rounded-lg hover:bg-sky-500/30 transition-all text-sky-400">
            <LinkedInIcon />
            <span className="text-sm">LinkedIn</span>
          </a>
          <a href="https://www.snapchat.com/add/fatshairafro" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 bg-yellow-500/20 border border-yellow-500/30 rounded-lg hover:bg-yellow-500/30 transition-all text-yellow-400">
            <SnapchatIcon />
            <span className="text-sm">Snapchat</span>
          </a>
          <a href="https://x.com/fatshairafro" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-3 py-2 bg-white/10 border border-white/20 rounded-lg hover:bg-white/20 transition-all text-white">
            <XIcon />
            <span className="text-sm">X</span>
          </a>
        </div>
      </div>

      {/* Graphique CA */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 mb-8">
        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-amber-400" />
          Chiffre d'affaires des 7 derniers jours
        </h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={stats.graphiqueCa}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
            <XAxis dataKey="jour" stroke="rgba(255,255,255,0.5)" fontSize={12} />
            <YAxis stroke="rgba(255,255,255,0.5)" fontSize={12} />
            <Tooltip
              formatter={(value) => `${value}€`}
              labelFormatter={(label) => `Jour: ${label}`}
              contentStyle={{
                backgroundColor: 'rgba(24, 24, 27, 0.95)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '12px',
                color: '#fff'
              }}
            />
            <Line
              type="monotone"
              dataKey="ca"
              stroke="#f59e0b"
              strokeWidth={3}
              dot={{ fill: '#f59e0b', strokeWidth: 2, stroke: '#000' }}
              activeDot={{ r: 6, fill: '#f59e0b', stroke: '#fff', strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Services populaires */}
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 mb-6">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-amber-400" />
          Services populaires
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {stats.servicesPopulaires.length > 0 ? (
            stats.servicesPopulaires.map((service, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/10"
              >
                <span className="text-white/80">{service.service}</span>
                <span className="px-3 py-1 bg-amber-500/20 text-amber-400 rounded-full text-sm font-medium">
                  {service.count} RDV
                </span>
              </div>
            ))
          ) : (
            <p className="text-white/50 text-center py-4 col-span-full">Aucun service encore réservé</p>
          )}
        </div>
      </div>

      {/* RDV Stats Summary */}
      <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-emerald-400">{stats.rdv.confirmes}</p>
          <p className="text-white/50 text-sm">Confirmés</p>
        </div>
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-amber-400">{stats.rdv.en_attente}</p>
          <p className="text-white/50 text-sm">En attente</p>
        </div>
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-white">{stats.rdv.termines}</p>
          <p className="text-white/50 text-sm">Terminés</p>
        </div>
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 text-center">
          <p className="text-2xl font-bold text-red-400">{stats.rdv.annules}</p>
          <p className="text-white/50 text-sm">Annulés</p>
        </div>
      </div>
    </AdminLayout>
  );
}

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  gradient: string;
}

function StatCard({ icon: Icon, label, value, gradient }: StatCardProps) {
  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5 hover:border-amber-500/30 transition-all">
      <div className="flex items-center justify-between mb-4">
        <div className={`bg-gradient-to-br ${gradient} w-12 h-12 rounded-xl flex items-center justify-center shadow-lg`}>
          <Icon className="text-white" size={22} />
        </div>
      </div>
      <p className="text-white/50 text-sm mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
    </div>
  );
}
