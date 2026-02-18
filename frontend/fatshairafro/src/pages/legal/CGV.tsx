import { Navigation } from "@/components/navigation";
import { Link } from "wouter";
import { ArrowLeft, FileText, CreditCard, Scale, AlertTriangle, Phone } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function CGVPage() {
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
            <FileText className="h-4 w-4 text-amber-400" />
            <span className="text-amber-300 text-sm font-medium">Conditions générales</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            <span className="text-white">Conditions Générales de </span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
              Vente
            </span>
          </h1>
          <p className="text-white/60 max-w-2xl mx-auto">
            Conditions applicables aux prestations de coiffure proposées par Fat's Hair-Afro.
          </p>
        </div>

        {/* Content */}
        <div className="space-y-8 text-white/70">
          {/* Article 1 */}
          <section className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Article 1 - Objet</h2>
            <p>
              Les présentes conditions générales de vente (CGV) régissent les relations contractuelles entre Fat's Hair-Afro et ses clients pour toutes les prestations de coiffure réalisées à domicile (chez le client) ou chez Fatou à Franconville.
            </p>
          </section>

          {/* Article 2 */}
          <section className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-500/20 rounded-xl">
                <FileText className="h-5 w-5 text-amber-400" />
              </div>
              <h2 className="text-xl font-semibold text-white">Article 2 - Services proposés</h2>
            </div>
            <p className="mb-4">Fat's Hair-Afro propose les services suivants :</p>
            <ul className="list-disc list-inside space-y-2 text-white/60">
              <li>Tresses (diverses techniques : box braids, cornrows, twists, etc.)</li>
              <li>Locks (création, entretien, réparation)</li>
              <li>Soins hydratants et traitements capillaires</li>
              <li>Brushing afro</li>
              <li>Shampoing et soins</li>
            </ul>
            <p className="mt-4 text-amber-400/80">
              Note : Nous ne proposons pas de défrisage.
            </p>
          </section>

          {/* Article 3 */}
          <section className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-500/20 rounded-xl">
                <CreditCard className="h-5 w-5 text-amber-400" />
              </div>
              <h2 className="text-xl font-semibold text-white">Article 3 - Tarifs et Paiement</h2>
            </div>
            <div className="space-y-4">
              <p>
                Les tarifs sont disponibles sur notre site internet et communiqués avant toute prestation. Les prix indiqués sont en euros TTC.
              </p>
              <p><strong className="text-white">Moyens de paiement acceptés :</strong></p>
              <ul className="list-disc list-inside space-y-2 text-white/60">
                <li>Espèces</li>
                <li>Carte bancaire (à partir de 15€)</li>
                <li>Virement bancaire (pour les acomptes)</li>
              </ul>
              <p>
                Le paiement est exigible à la fin de la prestation, sauf accord préalable pour les prestations longues nécessitant un acompte.
              </p>
            </div>
          </section>

          {/* Article 4 */}
          <section className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Article 4 - Rendez-vous et Annulation</h2>
            <div className="space-y-4">
              <p>
                <strong className="text-white">Prise de rendez-vous :</strong> Les rendez-vous peuvent être pris par téléphone, via notre site internet ou via notre assistante virtuelle Halimah.
              </p>
              <p>
                <strong className="text-white">Annulation :</strong> Toute annulation doit être effectuée au moins 24 heures avant le rendez-vous. Au-delà de ce délai :
              </p>
              <ul className="list-disc list-inside space-y-2 text-white/60">
                <li>L'acompte versé (le cas échéant) ne sera pas remboursé</li>
                <li>Après 2 absences non excusées, un acompte sera exigé pour toute nouvelle réservation</li>
              </ul>
            </div>
          </section>

          {/* Article 5 */}
          <section className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-500/20 rounded-xl">
                <AlertTriangle className="h-5 w-5 text-amber-400" />
              </div>
              <h2 className="text-xl font-semibold text-white">Article 5 - Responsabilité</h2>
            </div>
            <div className="space-y-4">
              <p>
                Fat's Hair-Afro s'engage à réaliser les prestations avec le plus grand soin et professionnalisme. Toutefois :
              </p>
              <ul className="list-disc list-inside space-y-2 text-white/60">
                <li>Le client doit informer le coiffeur de toute allergie, traitement médical ou sensibilité particulière</li>
                <li>Fat's Hair-Afro ne pourra être tenu responsable des dommages résultant d'informations non communiquées par le client</li>
                <li>En cas d'insatisfaction, le client dispose de 48h pour signaler tout problème</li>
              </ul>
            </div>
          </section>

          {/* Article 6 */}
          <section className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Article 6 - Programme de Fidélité</h2>
            <div className="space-y-4">
              <p>
                Fat's Hair-Afro propose un programme de fidélité permettant de cumuler des points :
              </p>
              <ul className="list-disc list-inside space-y-2 text-white/60">
                <li>1 point est crédité pour chaque euro dépensé</li>
                <li>50 points sont offerts à l'inscription</li>
                <li>Les points peuvent être échangés contre des services gratuits ou des réductions</li>
                <li>Les points sont valables 2 ans à compter de leur acquisition</li>
                <li>Les points ne sont pas transférables et ne peuvent être convertis en espèces</li>
              </ul>
            </div>
          </section>

          {/* Article 7 */}
          <section className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-500/20 rounded-xl">
                <Scale className="h-5 w-5 text-amber-400" />
              </div>
              <h2 className="text-xl font-semibold text-white">Article 7 - Litiges et Médiation</h2>
            </div>
            <div className="space-y-4">
              <p>
                En cas de litige, le client peut :
              </p>
              <ol className="list-decimal list-inside space-y-2 text-white/60">
                <li>Contacter directement Fat's Hair-Afro pour trouver une solution amiable</li>
                <li>Recourir gratuitement au médiateur de la consommation :
                  <br /><span className="text-amber-400">CM2C - 14 rue Saint Jean - 75017 Paris</span>
                  <br /><span className="text-amber-400">www.cm2c.net</span>
                </li>
              </ol>
              <p className="mt-4">
                Les présentes CGV sont soumises au droit français. En cas de litige, les tribunaux français seront seuls compétents.
              </p>
            </div>
          </section>

          {/* Article 8 */}
          <section className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-500/20 rounded-xl">
                <Phone className="h-5 w-5 text-amber-400" />
              </div>
              <h2 className="text-xl font-semibold text-white">Article 8 - Contact</h2>
            </div>
            <div className="space-y-2 text-white/60">
              <p><strong className="text-white">Fat's Hair-Afro</strong></p>
              <p>8 rue des Monts Rouges</p>
              <p>95130 Franconville</p>
              <p>Téléphone : 07 82 23 50 20</p>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-white/40 text-sm">
          <p>Dernière mise à jour : Janvier 2025</p>
          <p className="mt-2">
            En réservant chez Fat's Hair-Afro, vous acceptez les présentes conditions générales de vente.
          </p>
        </div>
      </main>
    </div>
  );
}
