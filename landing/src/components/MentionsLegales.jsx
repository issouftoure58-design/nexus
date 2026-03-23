export default function MentionsLegales() {
  return (
    <div className="space-y-6 text-gray-300 text-sm leading-relaxed">
      <h2 className="text-2xl font-bold text-white">Mentions Legales</h2>

      <section>
        <h3 className="text-lg font-semibold text-white mb-2">Editeur du site</h3>
        <p>
          NEXUS AI — SASU au capital de 1€ (en cours d'immatriculation)<br />
          SIRET : 947 570 362 00022<br />
          Siege social : 8 Rue des Monts Rouges, 95130 Franconville, France<br />
          Email : <a href="mailto:support@nexus-ai-saas.com" className="text-neon-cyan hover:underline">support@nexus-ai-saas.com</a><br />
          Site web : <a href="https://nexus-ai-saas.com" className="text-neon-cyan hover:underline">https://nexus-ai-saas.com</a>
        </p>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-white mb-2">President / Directeur de la publication</h3>
        <p>Issouf TOURE</p>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-white mb-2">Hebergement</h3>
        <p>
          Application : Render Inc., 525 Brannan St, San Francisco, CA 94107, USA<br />
          Base de donnees : Supabase Inc., San Francisco, CA, USA<br />
          Les donnees sont hebergees dans des datacenters conformes au RGPD.
        </p>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-white mb-2">TVA</h3>
        <p>
          TVA non applicable, article 293B du Code General des Impots.<br />
          Cette mention sera mise a jour apres obtention du numero de TVA intracommunautaire.
        </p>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-white mb-2">Propriete intellectuelle</h3>
        <p>
          L'ensemble du contenu de ce site (textes, images, logos, elements graphiques, logiciels)
          est la propriete exclusive de NEXUS AI ou de ses partenaires. Toute reproduction,
          representation ou diffusion, en tout ou partie, sans autorisation prealable ecrite est interdite.
        </p>
        <p className="mt-2">
          Le logiciel NEXUS, son code source, son architecture technique, ses algorithmes et ses
          modeles d'intelligence artificielle sont proteges par le droit d'auteur francais
          (Code de la propriete intellectuelle, articles L111-1 et suivants) et les conventions
          internationales relatives au droit d'auteur.
        </p>
        <p className="mt-2">
          La marque NEXUS AI fait l'objet d'une procedure de depot aupres de l'INPI
          (Institut National de la Propriete Industrielle).
        </p>
        <p className="mt-2">
          Toute reproduction, representation ou diffusion non autorisee de tout ou partie du
          logiciel constitue une contrefacon sanctionnee par les articles L335-2 et suivants du
          Code de la propriete intellectuelle, passible de 3 ans d'emprisonnement et 300 000 euros d'amende.
        </p>
      </section>

      <section>
        <h3 className="text-lg font-semibold text-white mb-2">Donnees personnelles</h3>
        <p>
          Conformement au Reglement General sur la Protection des Donnees (RGPD), vous disposez
          d'un droit d'acces, de rectification, de suppression et de portabilite de vos donnees.
          Pour exercer ces droits, contactez-nous a{' '}
          <a href="mailto:support@nexus-ai-saas.com" className="text-neon-cyan hover:underline">support@nexus-ai-saas.com</a>.
        </p>
      </section>

      <p className="text-gray-500 text-xs pt-4 border-t border-white/10">
        Derniere mise a jour : mars 2026
      </p>
    </div>
  )
}
