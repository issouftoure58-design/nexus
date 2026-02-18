import { Navigation } from "@/components/navigation";
import { Link } from "wouter";
import { ArrowLeft, Clock, Ban, CreditCard, Heart, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ChartePage() {
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

      <main className="relative z-10 max-w-4xl mx-auto px-4 pt-24 pb-12">
        {/* Back link */}
        <Link href="/">
          <Button
            variant="ghost"
            className="mb-6 text-white/60 hover:text-white hover:bg-white/5"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour à l'accueil
          </Button>
        </Link>

        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500/20 backdrop-blur-sm rounded-full border border-amber-500/30 mb-6">
            <Shield className="h-4 w-4 text-amber-400" />
            <span className="text-amber-300 text-sm font-medium">Charte & Conditions</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            <span className="text-white">Charte de </span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
              Fat's Hair-Afro
            </span>
          </h1>
          <p className="text-white/60 max-w-2xl mx-auto">
            Pour que chaque rendez-vous soit une expérience agréable, que ce soit chez vous ou chez Fatou, nous vous invitons à prendre connaissance de notre charte.
          </p>
        </div>

        {/* Content */}
        <div className="space-y-8">
          {/* Ponctualité */}
          <section className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-500/20 rounded-xl">
                <Clock className="h-5 w-5 text-amber-400" />
              </div>
              <h2 className="text-xl font-semibold text-white">Ponctualité</h2>
            </div>
            <div className="text-white/70 space-y-3">
              <p>
                Nous vous demandons de respecter l'heure de votre rendez-vous. La ponctualité est essentielle pour garantir la qualité de nos prestations et respecter le planning des autres clients.
              </p>
              <ul className="list-disc list-inside space-y-2 text-white/60">
                <li>Un retard de plus de <strong className="text-amber-400">15 minutes</strong> peut entraîner l'annulation de votre rendez-vous</li>
                <li>En cas de retard important, la prestation pourra être écourtée ou reportée</li>
                <li>Merci de nous prévenir en cas de retard au 07 82 23 50 20</li>
              </ul>
            </div>
          </section>

          {/* Annulation */}
          <section className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-500/20 rounded-xl">
                <Ban className="h-5 w-5 text-amber-400" />
              </div>
              <h2 className="text-xl font-semibold text-white">Annulation et Report</h2>
            </div>
            <div className="text-white/70 space-y-3">
              <p>
                Nous comprenons que des imprévus peuvent survenir. Cependant, pour permettre à d'autres clients de bénéficier de ce créneau :
              </p>
              <ul className="list-disc list-inside space-y-2 text-white/60">
                <li>Toute annulation doit être faite <strong className="text-amber-400">au moins 24 heures à l'avance</strong></li>
                <li>Une annulation tardive ou un rendez-vous non honoré (no-show) peut entraîner une pénalité</li>
                <li>Après 2 rendez-vous non honorés, une avance pourra être demandée pour les futures réservations</li>
              </ul>
            </div>
          </section>

          {/* Acompte */}
          <section className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-500/20 rounded-xl">
                <CreditCard className="h-5 w-5 text-amber-400" />
              </div>
              <h2 className="text-xl font-semibold text-white">Acompte pour prestations longues</h2>
            </div>
            <div className="text-white/70 space-y-3">
              <p>
                Pour les prestations de longue durée (tresses, locks, etc.), un acompte peut être demandé :
              </p>
              <ul className="list-disc list-inside space-y-2 text-white/60">
                <li>L'acompte représente <strong className="text-amber-400">30% du montant total</strong> de la prestation</li>
                <li>Il est encaissé à la confirmation du rendez-vous</li>
                <li>En cas d'annulation moins de 24h avant, l'acompte n'est pas remboursé</li>
                <li>L'acompte est déduit du montant final le jour du rendez-vous</li>
              </ul>
            </div>
          </section>

          {/* Hygiène et Respect */}
          <section className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-500/20 rounded-xl">
                <Heart className="h-5 w-5 text-amber-400" />
              </div>
              <h2 className="text-xl font-semibold text-white">Hygiène et Respect</h2>
            </div>
            <div className="text-white/70 space-y-3">
              <p>
                Pour le confort de tous et le bon déroulement des prestations :
              </p>
              <ul className="list-disc list-inside space-y-2 text-white/60">
                <li>Nous vous demandons de venir avec les <strong className="text-amber-400">cheveux propres et démêlés</strong></li>
                <li>Le respect mutuel entre les clients et le personnel est primordial</li>
                <li>Les enfants doivent être accompagnés et surveillés</li>
                <li>Tout comportement inapproprié entraînera l'interruption de la prestation</li>
              </ul>
            </div>
          </section>

          {/* Services non proposés */}
          <section className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-red-500/20 rounded-xl">
                <Ban className="h-5 w-5 text-red-400" />
              </div>
              <h2 className="text-xl font-semibold text-white">Services non proposés</h2>
            </div>
            <div className="text-white/70">
              <p>
                Fat's Hair-Afro est spécialisé dans la coiffure afro naturelle. Nous ne proposons <strong className="text-red-400">pas de défrisage</strong> car nous privilégions la santé et la beauté naturelle de vos cheveux.
              </p>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-white/40 text-sm">
          <p>Dernière mise à jour : Janvier 2025</p>
          <p className="mt-2">
            Fat's Hair-Afro - 8 rue des Monts Rouges, 95130 Franconville
          </p>
        </div>
      </main>
    </div>
  );
}
