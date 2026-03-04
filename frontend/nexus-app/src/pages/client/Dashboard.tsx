import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Navigation } from "@/components/navigation";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Calendar,
  Gift,
  User,
  LogOut,
  Star,
  Clock,
  Award,
  History,
  CreditCard,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";

interface ClientProfile {
  id: number;
  nom: string;
  prenom: string;
  email: string;
  telephone: string;
  emailVerified: boolean;
  loyaltyPoints: number;
  totalSpent: number;
  memberSince: string;
}

interface Reservation {
  id: number;
  service: string;
  date: string;
  heure: string;
  statut: string;
  prixTotal: number;
  pointsEarned: number;
}


export default function ClientDashboard() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"rdv" | "fidelite" | "profil">("rdv");
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [upcomingRdv, setUpcomingRdv] = useState<Reservation[]>([]);
  const [historyRdv, setHistoryRdv] = useState<Reservation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const token = localStorage.getItem("client_token");

  useEffect(() => {
    if (!token) {
      setLocation("/mon-compte/connexion");
      return;
    }
    loadData();
  }, [token]);

  const loadData = async () => {
    try {
      const headers = { Authorization: `Bearer ${token}` };

      // Charger le profil
      const profileRes = await fetch("/api/client/profile", { headers });
      if (profileRes.ok) {
        const data = await profileRes.json();
        setProfile(data.client);
      }

      // Charger les RDV à venir
      const upcomingRes = await fetch("/api/client/reservations/upcoming", { headers });
      if (upcomingRes.ok) {
        const data = await upcomingRes.json();
        setUpcomingRdv(data.reservations || []);
      }

      // Charger l'historique
      const historyRes = await fetch("/api/client/reservations/history", { headers });
      if (historyRes.ok) {
        const data = await historyRes.json();
        setHistoryRdv(data.reservations || []);
      }
    } catch (error) {
      console.error("Erreur chargement données:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("client_token");
    localStorage.removeItem("client_refresh_token");
    localStorage.removeItem("client_user");
    toast({ title: "Déconnexion réussie" });
    setLocation("/");
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  };

  const getStatutBadge = (statut: string) => {
    switch (statut) {
      case "confirme":
        return (
          <span className="flex items-center gap-1 text-emerald-400 text-xs">
            <CheckCircle2 className="h-3 w-3" /> Confirmé
          </span>
        );
      case "demande":
        return (
          <span className="flex items-center gap-1 text-amber-400 text-xs">
            <AlertCircle className="h-3 w-3" /> En attente
          </span>
        );
      case "termine":
        return (
          <span className="flex items-center gap-1 text-white/60 text-xs">
            <CheckCircle2 className="h-3 w-3" /> Terminé
          </span>
        );
      case "annule":
        return (
          <span className="flex items-center gap-1 text-red-400 text-xs">
            <XCircle className="h-3 w-3" /> Annulé
          </span>
        );
      default:
        return null;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      <Navigation />

      {/* Background effects */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 african-pattern opacity-5" />
        <div className="absolute top-1/4 right-0 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-0 w-80 h-80 bg-orange-500/10 rounded-full blur-3xl" />
      </div>

      {/* Letterbox bars */}
      <div className="fixed top-0 left-0 right-0 h-4 bg-black z-30" />
      <div className="fixed bottom-0 left-0 right-0 h-4 bg-black z-30" />

      {/* Corner frames */}
      <div className="fixed top-8 left-6 w-12 h-12 border-l-2 border-t-2 border-amber-500/30 z-20 pointer-events-none" />
      <div className="fixed top-8 right-6 w-12 h-12 border-r-2 border-t-2 border-amber-500/30 z-20 pointer-events-none" />
      <div className="fixed bottom-8 left-6 w-12 h-12 border-l-2 border-b-2 border-amber-500/30 z-20 pointer-events-none" />
      <div className="fixed bottom-8 right-6 w-12 h-12 border-r-2 border-b-2 border-amber-500/30 z-20 pointer-events-none" />

      <main className="relative z-10 max-w-4xl mx-auto px-4 pt-24 pb-16">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/20 backdrop-blur-sm rounded-full border border-amber-500/30 mb-4">
              <CreditCard className="h-4 w-4 text-amber-400" />
              <span className="text-amber-300 text-sm font-medium">Espace Fidélité</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold mb-1">
              <span className="text-white">Bonjour, </span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
                {profile?.prenom || profile?.nom}
              </span>
              <span className="text-white"> !</span>
            </h1>
            <p className="text-white/60">Gérez vos rendez-vous et vos avantages fidélité</p>
          </div>
          <Button
            variant="outline"
            onClick={handleLogout}
            className="border-amber-500/30 bg-white/5 text-white hover:bg-amber-500/20 hover:border-amber-500/50 transition-all"
          >
            <LogOut className="h-4 w-4 mr-2" />
            Déconnexion
          </Button>
        </div>

        {/* Loyalty Card */}
        <div className="relative bg-gradient-to-br from-amber-500 via-amber-600 to-orange-600 rounded-3xl p-6 md:p-8 mb-8 overflow-hidden shadow-2xl shadow-amber-500/20">
          {/* Decorative elements */}
          <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/10 rounded-full translate-y-1/2 -translate-x-1/2" />
          <div className="absolute inset-0 african-pattern opacity-10" />

          {/* Corner accents */}
          <div className="absolute top-4 left-4 w-8 h-8 border-l-2 border-t-2 border-white/30 rounded-tl-lg" />
          <div className="absolute top-4 right-4 w-8 h-8 border-r-2 border-t-2 border-white/30 rounded-tr-lg" />
          <div className="absolute bottom-4 left-4 w-8 h-8 border-l-2 border-b-2 border-white/30 rounded-bl-lg" />
          <div className="absolute bottom-4 right-4 w-8 h-8 border-r-2 border-b-2 border-white/30 rounded-br-lg" />

          <div className="relative">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-white/20 rounded-lg">
                  <CreditCard className="h-5 w-5 text-white" />
                </div>
                <span className="text-white font-semibold">Carte Fidélité</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xl">👩🏾‍🦱</span>
                <span className="text-white/80 text-sm font-medium">Fat's Hair-Afro</span>
              </div>
            </div>

            <div className="flex items-end justify-between">
              <div>
                <p className="text-6xl md:text-7xl font-bold text-white mb-2 drop-shadow-lg">
                  {profile?.loyaltyPoints || 0}
                </p>
                <p className="text-white/90 text-sm font-medium">points disponibles</p>
              </div>
              <div className="text-right">
                <p className="text-white/70 text-xs uppercase tracking-wider mb-1">Membre depuis</p>
                <p className="text-white font-semibold text-lg">
                  {profile?.memberSince
                    ? new Date(profile.memberSince).toLocaleDateString("fr-FR", {
                        month: "long",
                        year: "numeric",
                      })
                    : "-"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2 scrollbar-hide">
          {[
            { id: "rdv", label: "Mes RDV", icon: Calendar },
            { id: "fidelite", label: "Fidélité", icon: Gift },
            { id: "profil", label: "Mon Profil", icon: User },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-5 py-3 rounded-xl font-medium transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/30"
                  : "bg-white/5 text-white/60 hover:bg-white/10 hover:text-white border border-white/10"
              }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
          {/* RDV Tab */}
          {activeTab === "rdv" && (
            <div className="space-y-6">
              {/* Upcoming */}
              <div>
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <Clock className="h-5 w-5 text-amber-400" />
                  À venir
                </h3>
                {upcomingRdv.length === 0 ? (
                  <p className="text-white/50 text-center py-8">
                    Aucun rendez-vous à venir
                  </p>
                ) : (
                  <div className="space-y-3">
                    {upcomingRdv.map((rdv) => (
                      <div
                        key={rdv.id}
                        className="bg-white/5 rounded-xl p-4 border border-white/10"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-white font-medium">{rdv.service}</span>
                          {getStatutBadge(rdv.statut)}
                        </div>
                        <div className="flex items-center gap-4 text-white/60 text-sm">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            {formatDate(rdv.date)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            {rdv.heure}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* History */}
              <div>
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <History className="h-5 w-5 text-amber-400" />
                  Historique
                </h3>
                {historyRdv.length === 0 ? (
                  <p className="text-white/50 text-center py-8">
                    Aucun rendez-vous passé
                  </p>
                ) : (
                  <div className="space-y-3">
                    {historyRdv.slice(0, 5).map((rdv) => (
                      <div
                        key={rdv.id}
                        className="bg-white/5 rounded-xl p-4 border border-white/10"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-white font-medium">{rdv.service}</span>
                          {rdv.pointsEarned > 0 && (
                            <span className="text-amber-400 text-xs flex items-center gap-1">
                              <Star className="h-3 w-3 fill-amber-400" />
                              +{rdv.pointsEarned} pts
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between text-white/60 text-sm">
                          <span>{formatDate(rdv.date)}</span>
                          {getStatutBadge(rdv.statut)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Fidelite Tab */}
          {activeTab === "fidelite" && (
            <div className="space-y-6">
              {/* Avantages cumulés */}
              <div>
                <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <Award className="h-5 w-5 text-amber-400" />
                  Vos avantages cumulés
                </h3>
                <div className="bg-gradient-to-br from-amber-500/20 to-orange-500/20 rounded-2xl p-6 border border-amber-500/30">
                  <div className="grid grid-cols-2 gap-6">
                    <div className="text-center">
                      <p className="text-4xl font-bold text-white">
                        {Math.floor((profile?.loyaltyPoints || 0) / 400) * 10}€
                      </p>
                      <p className="text-white/60 text-sm mt-1">de réduction</p>
                      <p className="text-amber-400/80 text-xs mt-2">
                        ({Math.floor((profile?.loyaltyPoints || 0) / 400)} x 10€)
                      </p>
                    </div>
                    <div className="text-center border-l border-white/10 pl-6">
                      <p className="text-4xl font-bold text-white">
                        {Math.floor((profile?.loyaltyPoints || 0) / 1000) * 10}%
                      </p>
                      <p className="text-white/60 text-sm mt-1">de réduction</p>
                      <p className="text-amber-400/80 text-xs mt-2">
                        ({Math.floor((profile?.loyaltyPoints || 0) / 1000)} x 10%)
                      </p>
                    </div>
                  </div>
                  <p className="text-center text-white/50 text-sm mt-4 pt-4 border-t border-white/10">
                    Utilisables sur votre prochaine prestation
                  </p>
                </div>
              </div>

              {/* Progression */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <p className="text-white/50 text-sm mb-2">Prochain 10€</p>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-2">
                    <div
                      className="h-full bg-amber-500 rounded-full transition-all"
                      style={{ width: `${((profile?.loyaltyPoints || 0) % 400) / 400 * 100}%` }}
                    />
                  </div>
                  <p className="text-amber-400 text-xs">
                    {(profile?.loyaltyPoints || 0) % 400} / 400 pts
                  </p>
                </div>
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <p className="text-white/50 text-sm mb-2">Prochain 10%</p>
                  <div className="h-2 bg-white/10 rounded-full overflow-hidden mb-2">
                    <div
                      className="h-full bg-orange-500 rounded-full transition-all"
                      style={{ width: `${((profile?.loyaltyPoints || 0) % 1000) / 1000 * 100}%` }}
                    />
                  </div>
                  <p className="text-orange-400 text-xs">
                    {(profile?.loyaltyPoints || 0) % 1000} / 1000 pts
                  </p>
                </div>
              </div>

              {/* Explication */}
              <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                <h4 className="text-white font-medium mb-3">Comment ça marche ?</h4>
                <ul className="space-y-2 text-white/60 text-sm">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-amber-400 shrink-0" />
                    1 point gagné pour chaque euro dépensé
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-amber-400 shrink-0" />
                    +10€ de réduction tous les 400 points (cumulables)
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-amber-400 shrink-0" />
                    +10% de réduction tous les 1000 points (cumulables)
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-amber-400 shrink-0" />
                    50 points offerts à l'inscription
                  </li>
                </ul>
              </div>
            </div>
          )}

          {/* Profil Tab */}
          {activeTab === "profil" && (
            <div className="space-y-4">
              <div className="grid gap-4">
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <p className="text-white/50 text-sm mb-1">Nom complet</p>
                  <p className="text-white font-medium">
                    {profile?.prenom} {profile?.nom}
                  </p>
                </div>
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <p className="text-white/50 text-sm mb-1">Email</p>
                  <p className="text-white font-medium">{profile?.email}</p>
                  {!profile?.emailVerified && (
                    <p className="text-amber-400 text-xs mt-1">Email non vérifié</p>
                  )}
                </div>
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <p className="text-white/50 text-sm mb-1">Téléphone</p>
                  <p className="text-white font-medium">{profile?.telephone}</p>
                </div>
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <p className="text-white/50 text-sm mb-1">Total dépensé</p>
                  <p className="text-white font-medium">
                    {((profile?.totalSpent || 0) / 100).toFixed(2)} €
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
