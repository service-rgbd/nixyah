import { motion } from "framer-motion";
import { Database, Eye, Shield, Users } from "lucide-react";
import { LegalShell } from "@/components/legal-shell";

const sections = [
  {
    id: "app-purpose",
    title: "Ce que fait l'application",
    content:
      "NIXYAH est une application de visibilité et de découverte. Elle met en premier plan des profils, annonces de services, salons de massage, résidences, produits et évènements publiés par ses utilisateurs. La plateforme sert à présenter du contenu, à gérer sa mise en avant et à permettre des prises de contact pour des rendez-vous, réservations ou rencontres organisées, mais elle n'est pas responsable du fond des annonces, des comportements, des intentions ou des actes des utilisateurs.",
  },
  {
    id: "data-used",
    title: "Données utilisées",
    content:
      "Selon l'usage, l'application peut traiter: identifiants de compte, email, pseudo, profil, photos, vidéos, annonces, descriptions de services, informations d'évènement, ville, zone approximative, informations de lieu pour un salon ou une résidence, préférences, jetons, historiques de paiement, journaux techniques de connexion et messages de support. Les données visibles publiquement dépendent des réglages du profil et du contenu publié par l'utilisateur.",
  },
  {
    id: "why",
    title: "Pourquoi ces données sont utilisées",
    content:
      "Les données servent à faire fonctionner l'application: créer un compte, maintenir la session, afficher les annonces, présenter des profils ou évènements proches, faciliter la découverte de salons et résidences, gérer la visibilité, modérer les contenus, sécuriser la plateforme, traiter les achats de jetons, répondre au support et respecter les obligations légales. Elles ne sont pas utilisées pour revendre des profils à des régies publicitaires.",
  },
  {
    id: "sharing",
    title: "Partage limité avec des prestataires",
    content:
      "Certaines données peuvent être traitées par des prestataires techniques strictement nécessaires au service: hébergement et base de données, stockage des médias, paiement, envoi d'emails et éventuellement authentification externe si l'utilisateur choisit cette option. Lorsqu'un utilisateur publie des photos, un évènement ou un lieu, les éléments nécessaires à l'affichage et à la conservation technique peuvent être traités par ces prestataires. Ce partage reste limité à ce qui est nécessaire pour faire fonctionner la plateforme ou sécuriser le service.",
  },
  {
    id: "rights",
    title: "Vos droits et durée de conservation",
    content:
      "Vous pouvez demander l'accès, la correction ou la suppression de vos informations. Les données de compte et de contenu restent généralement liées au service tant que le compte est actif, tandis que certains historiques de sécurité, session, publication ou paiement peuvent être conservés plus longtemps pour la prévention des abus, la preuve comptable ou les obligations légales.",
  },
  {
    id: "public-content",
    title: "Contenus publics et visibilité en ligne",
    content:
      "Certaines pages de la plateforme, comme les pages légales, certaines annonces ou présentations publiques, peuvent être accessibles sans compte et consultables par les moteurs de recherche. Lorsqu'un utilisateur choisit de publier un profil, une annonce, un évènement ou un lieu avec visibilité publique, il comprend que certains éléments pourront être vus plus largement sur le web selon les réglages choisis.",
  },
];

export default function Privacy() {
  return (
    <LegalShell
      active="privacy"
      icon={Shield}
      eyebrow="Confidentialité"
      title="Politique de confidentialité"
      description="L'application privilégie la visibilité des annonces, profils, lieux et évènements, mais la gestion des données reste encadrée: usage technique, modération, sécurité, support et paiement, sans revendre les données personnelles."
    >
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid gap-5 border-t border-border/70 pt-5 md:grid-cols-3">
        <div className="space-y-2">
          <Eye className="h-5 w-5 text-primary" />
          <div className="mt-3 text-sm font-semibold text-foreground">Visibilité maîtrisée</div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Le contenu affiché dépend de ce que l'utilisateur publie et des options de visibilité activées pour les profils, lieux et évènements.</p>
        </div>
        <div className="space-y-2">
          <Database className="h-5 w-5 text-primary" />
          <div className="mt-3 text-sm font-semibold text-foreground">Usage fonctionnel</div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Les données servent d'abord au compte, aux annonces, aux évènements, à la proximité, à la sécurité, aux jetons et au support.</p>
        </div>
        <div className="space-y-2">
          <Users className="h-5 w-5 text-primary" />
          <div className="mt-3 text-sm font-semibold text-foreground">Pas de caution sur les annonces</div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Le fait qu'un contenu soit visible sur NIXYAH ne signifie pas que la plateforme le garantit, l'organise ou l'endosse.</p>
        </div>
      </motion.section>

      <section className="border-t border-border/70 pt-5">
        <h2 className="text-lg font-semibold text-foreground">Lecture détaillée</h2>
        <p className="mt-1 text-sm text-muted-foreground">Version claire des traitements réellement nécessaires à l'application.</p>
        <div className="mt-4 space-y-3">
          {sections.map((section, index) => (
            <div key={section.id} className="border-t border-border/70 pt-4 first:border-t-0 first:pt-0">
              <div className="flex items-start gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center text-xs font-semibold text-primary">
                  {index + 1}
                </span>
                <div>
                  <div className="text-sm font-semibold text-foreground">{section.title}</div>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{section.content}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t border-border/70 pt-5">
        <h2 className="text-lg font-semibold text-foreground">En pratique</h2>
        <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
          <p>Les annonces, profils, évènements, salons ou résidences publiés sur la plateforme restent sous la responsabilité de leurs auteurs. NIXYAH peut les afficher, les modérer, les limiter ou les retirer, sans devenir responsable de leur but, de leur contenu réel, ni des suites données par les utilisateurs.</p>
          <p>Lorsqu'un paiement de jetons est proposé, un prestataire externe peut traiter les informations nécessaires à la transaction. Lorsqu'un email de vérification ou de support est envoyé, un prestataire email peut être sollicité. Lorsqu'un média, un lieu ou un évènement est publié, un service de stockage ou d'hébergement peut être utilisé.</p>
          <p>La plateforme rappelle à ses utilisateurs de rester prudents, de vérifier les informations reçues avant un rendez-vous ou un déplacement, et de signaler toute publication trompeuse ou tout comportement à risque.</p>
          <p>Pour toute demande de suppression ou de rectification, le canal support de la plateforme reste le point de contact à privilégier.</p>
        </div>
      </section>
    </LegalShell>
  );
}