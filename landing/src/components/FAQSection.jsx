import { ChevronRight } from 'lucide-react'

const FAQS = [
  {
    q: "Qu'est-ce que NEXUS exactement ?",
    a: "NEXUS est une plateforme SaaS tout-en-un propulsee par l'intelligence artificielle, concue pour les PME francophones. Elle regroupe un assistant telephone IA, un chatbot WhatsApp, un systeme de reservations en ligne, un CRM client, la comptabilite automatisee et des outils marketing — le tout dans une seule interface. NEXUS remplace jusqu'a 6 logiciels differents pour un seul abonnement."
  },
  {
    q: 'Pour quels types de business NEXUS est-il adapte ?',
    a: "NEXUS s'adapte a 7 types de business : salons de coiffure et instituts beaute, restaurants et bars, hotels et hebergements, commerces et restauration rapide, entreprises de securite, services a domicile, et services de conseil ou formation. Chaque type beneficie de fonctionnalites specifiques adaptees a son metier, comme la gestion de tables pour les restaurants ou l'inventaire de chambres pour les hotels."
  },
  {
    q: 'Puis-je essayer NEXUS gratuitement ?',
    a: "Oui, NEXUS propose un essai gratuit de 14 jours sans carte bancaire requise. Vous avez acces a toutes les fonctionnalites de votre plan pour tester la plateforme en conditions reelles. A la fin de l'essai, vous pouvez choisir le plan qui vous convient ou simplement arreter sans engagement."
  },
  {
    q: "Comment fonctionne l'assistant telephone IA ?",
    a: "L'assistant telephone IA de NEXUS repond automatiquement a 100% de vos appels, 24h/24 et 7j/7. Il comprend le francais naturellement, prend les reservations, repond aux questions frequentes sur vos services et horaires, et peut meme gerer les modifications de rendez-vous. Vos clients parlent a un assistant vocal intelligent qui connait parfaitement votre activite."
  },
  {
    q: "Comment fonctionne l'integration WhatsApp Business ?",
    a: "NEXUS se connecte a votre numero WhatsApp Business pour repondre automatiquement a vos clients. L'IA conversationnelle gere les demandes de rendez-vous, les questions sur vos tarifs, les confirmations et rappels automatiques. Vos clients interagissent sur leur application preferee sans que vous ayez a intervenir manuellement."
  },
  {
    q: 'Combien coute NEXUS ?',
    a: "NEXUS propose 3 plans adaptes a chaque taille d'entreprise : Starter a 99 euros par mois (ideal pour les independants), Pro a 249 euros par mois (pour les equipes en croissance avec WhatsApp IA et telephone IA inclus), et Business a 499 euros par mois (pour les multi-sites avec support dedie et fonctionnalites avancees). Des tarifs annuels avec reduction sont disponibles."
  },
  {
    q: 'Quelle est la difference entre les plans Starter, Pro et Business ?',
    a: "Le plan Starter inclut le chatbot web IA, les reservations en ligne et le CRM de base. Le plan Pro ajoute l'assistant WhatsApp IA, le telephone IA, la comptabilite automatisee et les outils marketing. Le plan Business offre tout le Pro plus le support dedie, les integrations avancees, la gestion multi-sites et un account manager personnel."
  },
  {
    q: "L'assistant IA comprend-il le francais ?",
    a: "Parfaitement. Tous les assistants NEXUS — WhatsApp, telephone et chat web — communiquent naturellement en francais. L'IA comprend le langage courant, les expressions, les accents et s'adapte au vocabulaire de votre metier. Elle peut aussi repondre en anglais si vos clients sont internationaux."
  },
  {
    q: 'Mes donnees sont-elles securisees ?',
    a: "La securite est au coeur de NEXUS. Vos donnees sont hebergees en Europe avec chiffrement SSL de bout en bout. Chaque entreprise dispose d'un espace completement isole (architecture multi-tenant). NEXUS est conforme au RGPD avec suppression des donnees sur demande, consentement explicite et exports complets. Aucune donnee client n'est utilisee pour entrainer l'IA."
  },
  {
    q: 'Comment fonctionne le CRM integre ?',
    a: "Le CRM de NEXUS centralise automatiquement toutes les interactions avec vos clients : reservations, appels, messages WhatsApp, historique des visites et preferences. Vous pouvez segmenter vos clients, envoyer des campagnes ciblees et suivre la valeur de chaque client dans le temps. Tout est automatise — plus besoin de saisie manuelle."
  },
  {
    q: 'Puis-je changer de plan a tout moment ?',
    a: "Oui, vous pouvez upgrader ou downgrader votre plan a tout moment depuis votre tableau de bord. La facturation est ajustee au prorata, sans frais caches. Si vous passez a un plan superieur, vous beneficiez immediatement des nouvelles fonctionnalites."
  },
  {
    q: "Est-ce que NEXUS remplace mon logiciel de reservation actuel ?",
    a: "Oui, NEXUS integre un systeme complet de reservations en ligne adapte a votre metier. Vos clients reservent 24h/24 via votre site, WhatsApp ou par telephone IA. Le systeme gere la disponibilite en temps reel, les confirmations automatiques, les rappels SMS et email, et la prevention des no-shows avec acomptes optionnels."
  },
  {
    q: 'Comment migrer vers NEXUS depuis un autre logiciel ?',
    a: "L'equipe NEXUS vous accompagne gratuitement dans la migration de vos donnees. Nous importons votre fichier clients, votre historique de reservations et vos services. La mise en route prend generalement moins de 48 heures. Un guide interactif dans l'application vous aide a configurer votre activite pas a pas."
  },
  {
    q: 'NEXUS propose-t-il une application mobile ?',
    a: "NEXUS est une application web responsive qui fonctionne parfaitement sur smartphone, tablette et ordinateur. Vous pouvez l'ajouter a votre ecran d'accueil comme une application native. Vous gerez votre business ou que vous soyez, avec les memes fonctionnalites que sur desktop."
  },
  {
    q: 'Comment fonctionne le support client NEXUS ?',
    a: "Tous les plans incluent le support par email avec reponse sous 24 heures. Le plan Pro ajoute le support prioritaire avec un temps de reponse reduit. Le plan Business beneficie d'un account manager dedie, de sessions de formation personnalisees et d'un support telephonique direct. Notre equipe est basee en France."
  },
]

export default function FAQSection() {
  return (
    <section className="py-20 px-4" id="faq">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Questions{' '}
            <span className="bg-gradient-to-r from-neon-cyan to-primary-400 bg-clip-text text-transparent">
              frequentes
            </span>
          </h2>
          <p className="text-gray-400 max-w-2xl mx-auto">
            Retrouvez les reponses aux questions les plus posees sur NEXUS, le logiciel de gestion IA tout-en-un pour les PME. Tarifs, fonctionnalites, securite des donnees, integration WhatsApp Business et telephone IA — tout est explique ici.
          </p>
        </div>
        <div className="space-y-4">
          {FAQS.map((faq, i) => (
            <details key={i} className="group bg-dark-800/50 border border-white/10 rounded-xl overflow-hidden">
              <summary className="flex items-center justify-between px-6 py-4 cursor-pointer hover:bg-white/5 transition-colors">
                <span className="font-medium text-sm">{faq.q}</span>
                <ChevronRight className="w-4 h-4 text-gray-500 group-open:rotate-90 transition-transform flex-shrink-0 ml-2" />
              </summary>
              <div className="px-6 pb-4 text-sm text-gray-400 leading-relaxed">
                {faq.a}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  )
}
