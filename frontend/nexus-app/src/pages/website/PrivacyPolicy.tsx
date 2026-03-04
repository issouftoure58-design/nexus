import WebsiteLayout from "@/components/website/WebsiteLayout";
import { Link } from "wouter";

export default function PrivacyPolicyPage() {
  return (
    <WebsiteLayout>
      <div className="max-w-4xl mx-auto px-4 py-16">
        <h1 className="text-4xl font-bold mb-8 text-center">
          Politique de Confidentialité
        </h1>
        <p className="text-center text-gray-600 mb-12">
          Dernière mise à jour : Février 2026
        </p>

        <div className="prose prose-lg max-w-none">
          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
            <p>
              Nexus.AI ("NEXUS", "nous") s'engage à protéger la vie privée de ses
              utilisateurs. Cette Politique de Confidentialité explique comment nous
              collectons, utilisons et protégeons vos données personnelles conformément
              au Règlement Général sur la Protection des Données (RGPD).
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4">2. Responsable du Traitement</h2>
            <div className="bg-gray-50 p-6 rounded-lg">
              <p className="font-semibold">Nexus.AI</p>
              <p>Issouf TOURE - Entrepreneur individuel</p>
              <p>SIREN : 947 570 362</p>
              <p>SIRET : 947 570 362 00022</p>
              <p className="mt-2">8 rue des Monts Rouges</p>
              <p>95130 Franconville, France</p>
              <p className="mt-2">Email : privacy@nexus.app</p>
              <p>DPO : dpo@nexus.app</p>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4">3. Données Collectées</h2>
            <h3 className="text-xl font-medium mb-3">3.1 Données d'Identification</h3>
            <ul>
              <li>Nom, prénom</li>
              <li>Adresse email professionnelle</li>
              <li>Numéro de téléphone</li>
              <li>Nom de l'entreprise</li>
            </ul>

            <h3 className="text-xl font-medium mb-3">3.2 Données de Facturation</h3>
            <ul>
              <li>Adresse de facturation</li>
              <li>Informations de paiement (via Stripe, non stockées par NEXUS)</li>
              <li>Historique des transactions</li>
            </ul>

            <h3 className="text-xl font-medium mb-3">3.3 Données d'Utilisation</h3>
            <ul>
              <li>Logs de connexion et d'activité</li>
              <li>Fonctionnalités utilisées</li>
              <li>Préférences de configuration</li>
            </ul>

            <h3 className="text-xl font-medium mb-3">3.4 Données des Clients Finaux</h3>
            <p>
              Les données des clients de nos Tenants (clients finaux) sont traitées
              conformément aux instructions du Tenant, NEXUS agissant en tant que
              sous-traitant (Data Processor).
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4">4. Finalités du Traitement</h2>
            <table className="w-full border-collapse border border-gray-300">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 p-3 text-left">Finalité</th>
                  <th className="border border-gray-300 p-3 text-left">Base Légale</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="border border-gray-300 p-3">Fourniture du Service</td>
                  <td className="border border-gray-300 p-3">Exécution du contrat</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 p-3">Facturation et paiements</td>
                  <td className="border border-gray-300 p-3">Exécution du contrat</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 p-3">Support client</td>
                  <td className="border border-gray-300 p-3">Exécution du contrat</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 p-3">Communications marketing</td>
                  <td className="border border-gray-300 p-3">Consentement</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 p-3">Amélioration du Service</td>
                  <td className="border border-gray-300 p-3">Intérêt légitime</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 p-3">Sécurité et prévention fraude</td>
                  <td className="border border-gray-300 p-3">Intérêt légitime</td>
                </tr>
                <tr>
                  <td className="border border-gray-300 p-3">Obligations légales</td>
                  <td className="border border-gray-300 p-3">Obligation légale</td>
                </tr>
              </tbody>
            </table>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4">5. Durée de Conservation</h2>
            <ul>
              <li><strong>Données de compte actif</strong> : Durée de l'abonnement + 3 ans</li>
              <li><strong>Données de facturation</strong> : 10 ans (obligation légale)</li>
              <li><strong>Logs techniques</strong> : 1 an</li>
              <li><strong>Données marketing</strong> : 3 ans après dernier contact</li>
              <li><strong>Données clients finaux</strong> : Selon instructions du Tenant, max 3 ans après inactivité</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4">6. Partage des Données</h2>
            <h3 className="text-xl font-medium mb-3">6.1 Sous-traitants</h3>
            <p>Nous partageons vos données avec :</p>
            <ul>
              <li><strong>Supabase</strong> (hébergement base de données) - UE</li>
              <li><strong>Stripe</strong> (paiements) - Certifié Privacy Shield</li>
              <li><strong>Twilio</strong> (SMS/WhatsApp) - Certifié Privacy Shield</li>
              <li><strong>OpenAI</strong> (IA) - Accord DPA signé</li>
              <li><strong>Resend</strong> (emails transactionnels) - UE</li>
            </ul>

            <h3 className="text-xl font-medium mb-3">6.2 Transferts Internationaux</h3>
            <p>
              Certains sous-traitants sont situés hors UE. Les transferts sont encadrés
              par des Clauses Contractuelles Types (CCT) approuvées par la Commission
              Européenne.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4">7. Vos Droits RGPD</h2>
            <p>Conformément au RGPD, vous disposez des droits suivants :</p>
            <ul>
              <li><strong>Droit d'accès</strong> : Obtenir une copie de vos données</li>
              <li><strong>Droit de rectification</strong> : Corriger vos données</li>
              <li><strong>Droit à l'effacement</strong> : Demander la suppression de vos données</li>
              <li><strong>Droit à la portabilité</strong> : Recevoir vos données dans un format structuré</li>
              <li><strong>Droit d'opposition</strong> : Vous opposer au traitement</li>
              <li><strong>Droit de limitation</strong> : Limiter le traitement</li>
              <li><strong>Droit de retrait du consentement</strong> : À tout moment pour les traitements basés sur le consentement</li>
            </ul>

            <div className="bg-blue-50 p-6 rounded-lg mt-6">
              <h4 className="font-semibold mb-2">Comment exercer vos droits ?</h4>
              <p>
                Via votre espace admin : <strong>Paramètres → Données personnelles → Export/Suppression</strong>
              </p>
              <p>Ou par email : <strong>privacy@nexus.app</strong></p>
              <p className="text-sm text-gray-600 mt-2">
                Délai de réponse : 30 jours maximum
              </p>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4">8. Sécurité des Données</h2>
            <p>Nous mettons en œuvre les mesures suivantes :</p>
            <ul>
              <li>Chiffrement des données en transit (TLS 1.3) et au repos (AES-256)</li>
              <li>Isolation des données par tenant (architecture multi-tenant sécurisée)</li>
              <li>Authentification forte (JWT, sessions sécurisées)</li>
              <li>Audits de sécurité réguliers</li>
              <li>Sauvegardes quotidiennes chiffrées</li>
              <li>Monitoring 24/7 des accès</li>
            </ul>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4">9. Cookies</h2>
            <h3 className="text-xl font-medium mb-3">9.1 Cookies Essentiels</h3>
            <p>Nécessaires au fonctionnement (session, authentification). Durée : session.</p>

            <h3 className="text-xl font-medium mb-3">9.2 Cookies Analytiques</h3>
            <p>
              Pour comprendre l'utilisation du service (anonymisés). Durée : 13 mois.
              Désactivables via les paramètres.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4">10. IA et Données</h2>
            <p>
              Les conversations avec nos agents IA peuvent être utilisées pour améliorer
              le service. Vos données ne sont PAS utilisées pour entraîner des modèles
              tiers. Vous pouvez demander la suppression de l'historique IA à tout moment.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4">11. Réclamation</h2>
            <p>
              Si vous estimez que vos droits ne sont pas respectés, vous pouvez déposer
              une réclamation auprès de la CNIL :
            </p>
            <div className="bg-gray-50 p-6 rounded-lg mt-4">
              <p className="font-semibold">Commission Nationale de l'Informatique et des Libertés</p>
              <p>3 Place de Fontenoy - TSA 80715</p>
              <p>75334 PARIS CEDEX 07</p>
              <p className="text-blue-600">www.cnil.fr</p>
            </div>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4">12. Modifications</h2>
            <p>
              Cette politique peut être modifiée. Les changements significatifs seront
              notifiés par email. La version en vigueur est toujours disponible sur
              cette page.
            </p>
          </section>

          <section className="mb-12">
            <h2 className="text-2xl font-semibold mb-4">13. Contact</h2>
            <div className="bg-gray-50 p-6 rounded-lg">
              <p className="font-semibold">Nexus.AI</p>
              <p>Issouf TOURE - Entrepreneur individuel</p>
              <p>SIREN : 947 570 362</p>
              <p>SIRET : 947 570 362 00022</p>
              <p className="mt-2">8 rue des Monts Rouges</p>
              <p>95130 Franconville, France</p>
              <p className="mt-2">Email général : contact@nexus.app</p>
              <p>Protection des données : privacy@nexus.app</p>
              <p>Téléphone : +33 7 60 53 76 94</p>
            </div>
          </section>
        </div>
      </div>
    </WebsiteLayout>
  );
}
