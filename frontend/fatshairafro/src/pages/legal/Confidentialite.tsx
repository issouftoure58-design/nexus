import { Navigation } from "@/components/navigation";
import { Link } from "wouter";
import { ArrowLeft, Shield, Database, Clock, UserCheck, Cookie, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ConfidentialitePage() {
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
            <span className="text-amber-300 text-sm font-medium">RGPD</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-4">
            <span className="text-white">Politique de </span>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
              Confidentialité
            </span>
          </h1>
          <p className="text-white/60 max-w-2xl mx-auto">
            Informations sur la collecte et le traitement de vos données personnelles conformément au RGPD.
          </p>
        </div>

        {/* Content */}
        <div className="space-y-8 text-white/70">
          {/* Responsable */}
          <section className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Responsable du traitement</h2>
            <div className="space-y-2 text-white/60">
              <p><strong className="text-white">Fat's Hair-Afro</strong></p>
              <p>8 rue des Monts Rouges</p>
              <p>95130 Franconville</p>
              <p>Téléphone : 07 82 23 50 20</p>
            </div>
          </section>

          {/* Données collectées */}
          <section className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-500/20 rounded-xl">
                <Database className="h-5 w-5 text-amber-400" />
              </div>
              <h2 className="text-xl font-semibold text-white">Données collectées</h2>
            </div>
            <p className="mb-4">Nous collectons les données suivantes :</p>
            <ul className="list-disc list-inside space-y-2 text-white/60">
              <li><strong className="text-white">Données d'identification :</strong> nom, prénom</li>
              <li><strong className="text-white">Coordonnées :</strong> adresse email, numéro de téléphone</li>
              <li><strong className="text-white">Données de rendez-vous :</strong> historique des prestations, dates, préférences</li>
              <li><strong className="text-white">Données de fidélité :</strong> points accumulés, récompenses utilisées</li>
              <li><strong className="text-white">Données techniques :</strong> adresse IP, données de navigation (cookies)</li>
            </ul>
          </section>

          {/* Finalités */}
          <section className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Finalités du traitement</h2>
            <p className="mb-4">Vos données sont utilisées pour :</p>
            <ul className="list-disc list-inside space-y-2 text-white/60">
              <li>Gérer vos rendez-vous et prestations</li>
              <li>Administrer votre compte client et programme de fidélité</li>
              <li>Vous envoyer des rappels de rendez-vous (SMS/email)</li>
              <li>Améliorer nos services et personnaliser votre expérience</li>
              <li>Répondre à vos demandes et réclamations</li>
              <li>Respecter nos obligations légales</li>
            </ul>
          </section>

          {/* Base légale */}
          <section className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Base légale</h2>
            <div className="space-y-4">
              <p>Le traitement de vos données repose sur :</p>
              <ul className="list-disc list-inside space-y-2 text-white/60">
                <li><strong className="text-white">L'exécution du contrat :</strong> pour la gestion de vos rendez-vous et prestations</li>
                <li><strong className="text-white">Votre consentement :</strong> pour l'envoi de communications marketing et la création d'un compte fidélité</li>
                <li><strong className="text-white">L'intérêt légitime :</strong> pour améliorer nos services et assurer la sécurité</li>
                <li><strong className="text-white">L'obligation légale :</strong> pour la conservation des factures et documents comptables</li>
              </ul>
            </div>
          </section>

          {/* Durée de conservation */}
          <section className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-500/20 rounded-xl">
                <Clock className="h-5 w-5 text-amber-400" />
              </div>
              <h2 className="text-xl font-semibold text-white">Durée de conservation</h2>
            </div>
            <div className="space-y-4">
              <ul className="list-disc list-inside space-y-2 text-white/60">
                <li><strong className="text-white">Données clients :</strong> 3 ans après le dernier rendez-vous</li>
                <li><strong className="text-white">Données de facturation :</strong> 10 ans (obligation légale)</li>
                <li><strong className="text-white">Données de prospection :</strong> 3 ans après le dernier contact</li>
                <li><strong className="text-white">Cookies :</strong> 13 mois maximum</li>
              </ul>
            </div>
          </section>

          {/* Vos droits */}
          <section className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-500/20 rounded-xl">
                <UserCheck className="h-5 w-5 text-amber-400" />
              </div>
              <h2 className="text-xl font-semibold text-white">Vos droits (RGPD)</h2>
            </div>
            <p className="mb-4">Conformément au RGPD, vous disposez des droits suivants :</p>
            <ul className="list-disc list-inside space-y-2 text-white/60">
              <li><strong className="text-white">Droit d'accès :</strong> obtenir une copie de vos données</li>
              <li><strong className="text-white">Droit de rectification :</strong> corriger vos données inexactes</li>
              <li><strong className="text-white">Droit à l'effacement :</strong> demander la suppression de vos données</li>
              <li><strong className="text-white">Droit à la portabilité :</strong> recevoir vos données dans un format lisible</li>
              <li><strong className="text-white">Droit d'opposition :</strong> vous opposer au traitement de vos données</li>
              <li><strong className="text-white">Droit de retrait du consentement :</strong> retirer votre consentement à tout moment</li>
            </ul>
            <p className="mt-4">
              Pour exercer vos droits, contactez-nous par téléphone au <strong className="text-amber-400">07 82 23 50 20</strong> ou via notre assistante Halimah.
            </p>
          </section>

          {/* Cookies */}
          <section className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-500/20 rounded-xl">
                <Cookie className="h-5 w-5 text-amber-400" />
              </div>
              <h2 className="text-xl font-semibold text-white">Cookies</h2>
            </div>
            <div className="space-y-4">
              <p>Notre site utilise des cookies pour :</p>
              <ul className="list-disc list-inside space-y-2 text-white/60">
                <li><strong className="text-white">Cookies essentiels :</strong> nécessaires au fonctionnement du site (session, authentification)</li>
                <li><strong className="text-white">Cookies de performance :</strong> pour analyser l'utilisation du site et l'améliorer</li>
              </ul>
              <p className="mt-4">
                Vous pouvez configurer votre navigateur pour refuser les cookies. Cependant, certaines fonctionnalités du site pourraient ne plus fonctionner correctement.
              </p>
            </div>
          </section>

          {/* Sécurité */}
          <section className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <h2 className="text-xl font-semibold text-white mb-4">Sécurité des données</h2>
            <p>
              Nous mettons en œuvre des mesures techniques et organisationnelles appropriées pour protéger vos données contre tout accès non autorisé, modification, divulgation ou destruction. Les mots de passe sont cryptés et les communications sont sécurisées par HTTPS.
            </p>
          </section>

          {/* Réclamation */}
          <section className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-amber-500/20 rounded-xl">
                <Mail className="h-5 w-5 text-amber-400" />
              </div>
              <h2 className="text-xl font-semibold text-white">Réclamation</h2>
            </div>
            <p>
              Si vous estimez que le traitement de vos données n'est pas conforme à la réglementation, vous pouvez introduire une réclamation auprès de la CNIL :
            </p>
            <div className="mt-4 p-4 bg-white/5 rounded-xl">
              <p className="text-white font-medium">Commission Nationale de l'Informatique et des Libertés (CNIL)</p>
              <p className="text-white/60">3 Place de Fontenoy - TSA 80715</p>
              <p className="text-white/60">75334 PARIS CEDEX 07</p>
              <p className="text-amber-400 mt-2">www.cnil.fr</p>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-white/40 text-sm">
          <p>Dernière mise à jour : Janvier 2025</p>
          <p className="mt-2">
            Cette politique de confidentialité peut être modifiée à tout moment. Nous vous invitons à la consulter régulièrement.
          </p>
        </div>
      </main>
    </div>
  );
}
