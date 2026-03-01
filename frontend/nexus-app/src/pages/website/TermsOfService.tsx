import { WebsiteLayout } from "@/components/website/WebsiteLayout";
import { Link } from "wouter";

export default function TermsOfServicePage() {
  return (
    <WebsiteLayout>
      <div className="max-w-4xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold mb-8 text-center">
          Conditions Générales d'Utilisation
        </h1>
        <p className="text-center text-gray-600 mb-12">
          Dernière mise à jour : Février 2026
        </p>

        <div className="prose prose-lg max-w-none">
          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4">1. Objet</h2>
            <p>
              Les présentes Conditions Générales d'Utilisation (CGU) régissent l'accès et
              l'utilisation de la plateforme NEXUS, un service SaaS (Software as a Service)
              édité par NEXUS SAS.
            </p>
            <p>
              NEXUS est une plateforme de gestion tout-en-un destinée aux professionnels
              du service, intégrant des fonctionnalités de CRM, réservation, facturation,
              et intelligence artificielle.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4">2. Définitions</h2>
            <ul>
              <li><strong>Plateforme</strong> : Le service NEXUS accessible via nexus.app</li>
              <li><strong>Utilisateur</strong> : Toute personne utilisant la Plateforme</li>
              <li><strong>Tenant</strong> : Entreprise cliente ayant souscrit un abonnement</li>
              <li><strong>Client Final</strong> : Client du Tenant utilisant l'interface publique</li>
              <li><strong>Services</strong> : L'ensemble des fonctionnalités proposées par NEXUS</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4">3. Accès au Service</h2>
            <h3 className="text-xl font-medium mb-3">3.1 Inscription</h3>
            <p>
              L'accès à NEXUS nécessite la création d'un compte. L'Utilisateur s'engage à
              fournir des informations exactes et à maintenir ses identifiants confidentiels.
            </p>
            <h3 className="text-xl font-medium mb-3">3.2 Période d'Essai</h3>
            <p>
              Une période d'essai gratuite de 14 jours est proposée. À son terme, un
              abonnement payant est requis pour continuer à utiliser le Service.
            </p>
            <h3 className="text-xl font-medium mb-3">3.3 Conditions d'Accès</h3>
            <p>
              L'Utilisateur doit être une personne morale ou physique exerçant une activité
              professionnelle. L'usage personnel est interdit.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4">4. Abonnements et Tarifs</h2>
            <h3 className="text-xl font-medium mb-3">4.1 Plans Disponibles</h3>
            <ul>
              <li><strong>Starter (99€/mois)</strong> : Fonctionnalités de base</li>
              <li><strong>Pro (249€/mois)</strong> : + WhatsApp IA, Téléphone IA, Marketing</li>
              <li><strong>Business (499€/mois)</strong> : + RH, SEO, API, SENTINEL</li>
            </ul>
            <h3 className="text-xl font-medium mb-3">4.2 Facturation</h3>
            <p>
              Les abonnements sont facturés mensuellement ou annuellement (avec 20% de
              réduction). Le paiement s'effectue par carte bancaire via Stripe.
            </p>
            <h3 className="text-xl font-medium mb-3">4.3 Résiliation</h3>
            <p>
              L'abonnement peut être résilié à tout moment. L'accès reste actif jusqu'à
              la fin de la période facturée. Aucun remboursement partiel n'est effectué.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4">5. Utilisation du Service</h2>
            <h3 className="text-xl font-medium mb-3">5.1 Obligations de l'Utilisateur</h3>
            <p>L'Utilisateur s'engage à :</p>
            <ul>
              <li>Utiliser le Service conformément à sa destination</li>
              <li>Ne pas tenter de compromettre la sécurité du Service</li>
              <li>Ne pas utiliser le Service pour des activités illégales</li>
              <li>Respecter les droits de propriété intellectuelle</li>
              <li>Maintenir la confidentialité de ses identifiants</li>
            </ul>
            <h3 className="text-xl font-medium mb-3">5.2 Usage Interdit</h3>
            <p>Sont notamment interdits :</p>
            <ul>
              <li>L'envoi de spam ou messages non sollicités via les canaux IA</li>
              <li>Le stockage de données illicites</li>
              <li>L'usurpation d'identité</li>
              <li>Le reverse engineering du Service</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4">6. Propriété Intellectuelle</h2>
            <p>
              NEXUS conserve l'intégralité des droits de propriété intellectuelle sur la
              Plateforme, son code source, sa documentation et ses marques.
            </p>
            <p>
              L'Utilisateur conserve la propriété de ses données. Il accorde à NEXUS une
              licence limitée pour traiter ces données dans le cadre du Service.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4">7. Données et Confidentialité</h2>
            <p>
              Le traitement des données personnelles est régi par notre{" "}
              <Link href="/privacy" className="text-blue-600 hover:underline">
                Politique de Confidentialité
              </Link>.
            </p>
            <p>
              NEXUS s'engage à protéger les données de ses clients conformément au RGPD
              et aux réglementations applicables.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4">8. Disponibilité et Support</h2>
            <h3 className="text-xl font-medium mb-3">8.1 Disponibilité</h3>
            <p>
              NEXUS s'efforce de maintenir une disponibilité de 99.9%. Des interruptions
              pour maintenance peuvent survenir, avec notification préalable si possible.
            </p>
            <h3 className="text-xl font-medium mb-3">8.2 Support</h3>
            <ul>
              <li><strong>Starter</strong> : Support email (48h)</li>
              <li><strong>Pro</strong> : Support prioritaire (24h)</li>
              <li><strong>Business</strong> : Support 24/7 + Account Manager dédié</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4">9. Responsabilité</h2>
            <h3 className="text-xl font-medium mb-3">9.1 Limitation</h3>
            <p>
              NEXUS ne pourra être tenu responsable des dommages indirects, perte de
              données, manque à gagner ou interruption d'activité résultant de
              l'utilisation du Service.
            </p>
            <h3 className="text-xl font-medium mb-3">9.2 Exclusions</h3>
            <p>NEXUS n'est pas responsable :</p>
            <ul>
              <li>Des contenus créés ou envoyés par les Utilisateurs</li>
              <li>Des réponses générées par l'IA</li>
              <li>Des problèmes liés aux services tiers (Stripe, Twilio, etc.)</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4">10. Modifications</h2>
            <p>
              NEXUS se réserve le droit de modifier les présentes CGU. Les modifications
              seront notifiées par email 30 jours avant leur entrée en vigueur.
              L'utilisation continue du Service vaut acceptation.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4">11. Droit Applicable</h2>
            <p>
              Les présentes CGU sont régies par le droit français. Tout litige relèvera
              de la compétence exclusive des tribunaux de Paris.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4">12. Contact</h2>
            <div className="bg-gray-50 p-6 rounded-lg">
              <p className="font-semibold">Nexus.AI</p>
              <p>Issouf TOURE - Entrepreneur individuel</p>
              <p>SIREN : 947 570 362</p>
              <p>SIRET : 947 570 362 00022</p>
              <p className="mt-2">8 rue des Monts Rouges</p>
              <p>95130 Franconville, France</p>
              <p className="mt-2">Email : contact@nexus.app</p>
              <p>Téléphone : +33 7 60 53 76 94</p>
            </div>
          </section>
        </div>
      </div>
    </WebsiteLayout>
  );
}
