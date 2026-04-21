import { motion } from "framer-motion";
import { Database, Eye, Shield, Users } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { LegalShell } from "@/components/legal-shell";

const sections = [
  {
    id: "app-purpose",
    title: "Ce que fait l'application",
    content:
      "NIXYAH est une application de visibilité et de découverte. Elle met en premier plan les annonces, profils, salons et produits publiés par ses utilisateurs. La plateforme sert à présenter du contenu, à gérer sa mise en avant et à permettre des prises de contact, mais elle n'est pas responsable du fond des annonces, des comportements, des intentions ou des actes des utilisateurs.",
  },
  {
    id: "data-used",
    title: "Données utilisées",
    content:
      "Selon l'usage, l'application peut traiter: identifiants de compte, email, pseudo, profil, photos, vidéos, annonces, préférences, jetons, historiques de paiement, ville, zone approximative, journaux techniques de connexion, et messages de support. Les données visibles publiquement dépendent des réglages du profil et du contenu publié par l'utilisateur.",
  },
  {
    id: "why",
    title: "Pourquoi ces données sont utilisées",
    content:
      "Les données servent à faire fonctionner l'application: créer un compte, maintenir la session, afficher les annonces, gérer la visibilité, modérer les contenus, sécuriser la plateforme, traiter les achats de jetons, répondre au support et respecter les obligations légales. Elles ne sont pas utilisées pour revendre des profils à des régies publicitaires.",
  },
  {
    id: "sharing",
    title: "Partage limité avec des prestataires",
    content:
      "Certaines données peuvent être traitées par des prestataires techniques strictement nécessaires au service: hébergement et base de données, stockage des médias, paiement, envoi d'emails et éventuellement authentification externe si l'utilisateur choisit cette option. Ce partage est limité à ce qui est nécessaire pour faire fonctionner la plateforme ou sécuriser le service.",
  },
  {
    id: "rights",
    title: "Vos droits et durée de conservation",
    content:
      "Vous pouvez demander l'accès, la correction ou la suppression de vos informations. Les données de compte et de contenu restent généralement liées au service tant que le compte est actif, tandis que certains historiques de sécurité, session ou paiement peuvent être conservés plus longtemps pour la prévention des abus, la preuve comptable ou les obligations légales.",
  },
];

export default function Privacy() {
  return (
    <LegalShell
      active="privacy"
      icon={Shield}
      eyebrow="Confidentialité"
      title="Politique de confidentialité"
      description="L'application privilégie la visibilité des annonces, mais la gestion des données reste encadrée: usage technique, modération, sécurité, support et paiement, sans revendre les données personnelles."
    >
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <Eye className="h-5 w-5 text-primary" />
          <div className="mt-3 text-sm font-semibold text-foreground">Visibilité maîtrisée</div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Le contenu affiché dépend de ce que l'utilisateur publie et des options de visibilité activées.</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <Database className="h-5 w-5 text-primary" />
          <div className="mt-3 text-sm font-semibold text-foreground">Usage fonctionnel</div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Les données servent d'abord au compte, aux annonces, à la sécurité, aux jetons et au support.</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <Users className="h-5 w-5 text-primary" />
          <div className="mt-3 text-sm font-semibold text-foreground">Pas de caution sur les annonces</div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Le fait qu'un contenu soit visible sur NIXYAH ne signifie pas que la plateforme le garantit ni l'endosse.</p>
        </div>
      </motion.section>

      <section className="rounded-3xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold text-foreground">Lecture détaillée</h2>
        <p className="mt-1 text-sm text-muted-foreground">Version claire des traitements réellement nécessaires à l'application.</p>

        <Accordion type="single" collapsible className="mt-4">
          {sections.map((section) => (
            <AccordionItem key={section.id} value={section.id} className="border-border">
              <AccordionTrigger className="text-base text-foreground hover:no-underline">{section.title}</AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                {section.content}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <section className="rounded-3xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold text-foreground">En pratique</h2>
        <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted-foreground">
          <p>Les annonces restent sous la responsabilité de leurs auteurs. La plateforme peut les afficher, les modérer ou les retirer, sans devenir responsable de leur but, de leur contenu réel, ni des suites données par les utilisateurs.</p>
          <p>Lorsqu'un paiement de jetons est proposé, un prestataire externe peut traiter les informations nécessaires à la transaction. Lorsqu'un email de vérification ou de support est envoyé, un prestataire email peut être sollicité. Lorsqu'un média est publié, un service de stockage peut être utilisé.</p>
          <p>Pour toute demande de suppression ou de rectification, le canal support de la plateforme reste le point de contact à privilégier.</p>
        </div>
      </section>
    </LegalShell>
  );
}