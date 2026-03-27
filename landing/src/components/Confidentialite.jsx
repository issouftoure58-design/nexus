export default function Confidentialite() {
  return (
    <div className="space-y-6 text-gray-300 text-sm leading-relaxed">
      <h2 className="text-2xl font-bold text-white">Politique de Confidentialite</h2>

      <section>
        <h3 className="text-lg font-semibold text-white mb-2">1. Responsable du traitement</h3>
        <p>
          NEXUS AI — SASU au capital de 1€<br />
          SIRET : 947 570 362 00022<br />
          8 Rue des Monts Rouges, 95130 Franconville<br />
          Email : <a href="mailto:nexussentinelai@yahoo.com" className="text-neon-cyan hover:underline">nexussentinelai@yahoo.com</a>
        </p>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-white mb-2">2. Donnees collectees</h3>
        <p>Dans le cadre de l'utilisation de NEXUS, nous collectons :</p>
        <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
          <li>Donnees d'identification : nom, prenom, email, telephone</li>
          <li>Donnees de facturation : adresse, informations de paiement (traitees par Stripe)</li>
          <li>Donnees d'utilisation : logs de connexion, actions dans la plateforme</li>
          <li>Donnees metier : clients, rendez-vous, factures (propres a chaque tenant)</li>
        </ul>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-white mb-2">3. Finalites du traitement</h3>
        <ul className="list-disc list-inside space-y-1 text-gray-400">
          <li>Fourniture et gestion du service SaaS</li>
          <li>Facturation et gestion des abonnements</li>
          <li>Support client et communication</li>
          <li>Amelioration du service et analyses statistiques anonymisees</li>
          <li>Respect des obligations legales</li>
        </ul>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-white mb-2">4. Base legale</h3>
        <p>
          Le traitement des donnees repose sur : l'execution du contrat (CGV),
          le consentement de l'utilisateur, les obligations legales applicables,
          et l'interet legitime de NEXUS AI (amelioration du service, securite).
        </p>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-white mb-2">5. Duree de conservation</h3>
        <ul className="list-disc list-inside space-y-1 text-gray-400">
          <li>Donnees de compte : duree de l'abonnement + 30 jours apres resiliation</li>
          <li>Donnees de facturation : 10 ans (obligation legale comptable)</li>
          <li>Logs de connexion : 12 mois</li>
          <li>Cookies : voir notre banniere de gestion des cookies</li>
        </ul>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-white mb-2">6. Partage des donnees</h3>
        <p>Vos donnees peuvent etre partagees avec :</p>
        <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
          <li>Stripe (paiements) — certifie PCI-DSS</li>
          <li>Supabase (hebergement base de donnees) — datacenters europeens</li>
          <li>Twilio/SendGrid (SMS et emails transactionnels)</li>
          <li>Render (hebergement applicatif)</li>
        </ul>
        <p className="mt-2">
          Vos donnees ne sont jamais revendues a des tiers. Aucun transfert hors UE sans
          garanties appropriees (clauses contractuelles types).
        </p>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-white mb-2">7. Vos droits (RGPD)</h3>
        <p>Conformement au RGPD, vous disposez des droits suivants :</p>
        <ul className="list-disc list-inside mt-2 space-y-1 text-gray-400">
          <li>Droit d'acces a vos donnees personnelles</li>
          <li>Droit de rectification</li>
          <li>Droit a l'effacement (« droit a l'oubli »)</li>
          <li>Droit a la portabilite</li>
          <li>Droit d'opposition et de limitation du traitement</li>
          <li>Droit de retirer votre consentement a tout moment</li>
        </ul>
        <p className="mt-2">
          Pour exercer ces droits, envoyez un email a{' '}
          <a href="mailto:nexussentinelai@yahoo.com" className="text-neon-cyan hover:underline">nexussentinelai@yahoo.com</a>.
          Vous pouvez egalement introduire une reclamation aupres de la CNIL (
          <a href="https://www.cnil.fr" target="_blank" rel="noopener noreferrer" className="text-neon-cyan hover:underline">www.cnil.fr</a>).
        </p>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-white mb-2">8. Securite</h3>
        <p>
          NEXUS AI met en oeuvre des mesures techniques et organisationnelles appropriees
          pour proteger vos donnees : chiffrement en transit (TLS), isolation des donnees
          par tenant (Tenant Shield), sauvegardes regulieres, controle d'acces strict.
        </p>
      </section>

      <p className="text-gray-500 text-xs pt-4 border-t border-white/10">
        Derniere mise a jour : mars 2026
      </p>
    </div>
  )
}
