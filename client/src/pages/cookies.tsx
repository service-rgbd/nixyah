import { motion } from "framer-motion";
import { Cookie, HardDrive, LockKeyhole, Settings2 } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { LegalShell } from "@/components/legal-shell";

const cookieSections = [
  {
    id: "session",
    title: "Cookie de session",
    content:
      "L'application utilise un cookie de session technique pour maintenir la connexion, protéger certaines requêtes et garder l'utilisateur authentifié entre les pages. Sans ce cookie, le compte ne peut pas fonctionner correctement.",
  },
  {
    id: "local-storage",
    title: "Stockage local dans le navigateur",
    content:
      "Le navigateur peut aussi conserver des données locales pour rendre l'expérience plus fluide: consentement, préférences d'interface, langue, thème, réglages de recherche et identifiants de session utiles au front. Ce stockage reste sur l'appareil de l'utilisateur jusqu'à suppression manuelle ou réinitialisation du navigateur.",
  },
  {
    id: "ui-state",
    title: "Cookies ou états d'interface",
    content:
      "Certains éléments d'interface peuvent mémoriser un état simple, comme l'ouverture d'un panneau latéral. Il s'agit d'un usage purement fonctionnel, destiné à améliorer le confort de navigation.",
  },
  {
    id: "third-party",
    title: "Services externes pendant un paiement",
    content:
      "Lors d'une redirection vers un prestataire de paiement, ce prestataire peut appliquer ses propres cookies techniques sur ses pages. Ces cookies relèvent de sa propre politique et ne sont pas utilisés par NIXYAH pour du ciblage publicitaire.",
  },
  {
    id: "management",
    title: "Comment gérer ou supprimer ces données",
    content:
      "Vous pouvez effacer les cookies et le stockage local depuis les réglages de votre navigateur. En revanche, supprimer ces données peut déconnecter le compte, réinitialiser le consentement, effacer des préférences d'affichage et rendre certaines fonctions moins fluides jusqu'à reconfiguration.",
  },
];

const storageItems = [
  { label: "Cookie de session", text: "Connexion, sécurité, maintien de la session." },
  { label: "djantrah.consent.v1", text: "Âge, cookies et acceptation des conditions." },
  { label: "djantrah.settings.v4", text: "Langue, thème, filtres, préférences d'interface." },
  { label: "djantrah.profileId / djantrah.userId", text: "Restauration de l'espace utilisateur côté front." },
  { label: "sidebar_state", text: "État d'ouverture de certains panneaux d'interface." },
];

export default function Cookies() {
  return (
    <LegalShell
      active="cookies"
      icon={Cookie}
      eyebrow="Cookies et stockage"
      title="Gestion des cookies"
      description="L'application utilise surtout des cookies et stockages techniques: session, consentement, préférences et confort d'interface. Aucun usage publicitaire interne n'est prévu par défaut."
    >
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid gap-3 md:grid-cols-3">
        <div className="rounded-2xl border border-border bg-card p-4">
          <LockKeyhole className="h-5 w-5 text-primary" />
          <div className="mt-3 text-sm font-semibold text-foreground">Essentiels au service</div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Connexion, consentement, sécurité et continuité de navigation.</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <Settings2 className="h-5 w-5 text-primary" />
          <div className="mt-3 text-sm font-semibold text-foreground">Préférences locales</div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Langue, thème, filtres et quelques états d'interface sont mémorisés côté navigateur.</p>
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <HardDrive className="h-5 w-5 text-primary" />
          <div className="mt-3 text-sm font-semibold text-foreground">Pas de promesse publicitaire</div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">La logique actuelle ne repose pas sur du ciblage publicitaire interne ni sur la revente du stockage navigateur.</p>
        </div>
      </motion.section>

      <section className="rounded-3xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold text-foreground">Ce qui peut être stocké</h2>
        <div className="mt-4 space-y-3">
          {storageItems.map((item) => (
            <div key={item.label} className="rounded-2xl border border-border bg-background/50 p-4">
              <div className="text-sm font-semibold text-foreground">{item.label}</div>
              <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-card p-5">
        <h2 className="text-lg font-semibold text-foreground">Détail</h2>
        <Accordion type="single" collapsible className="mt-4">
          {cookieSections.map((section) => (
            <AccordionItem key={section.id} value={section.id} className="border-border">
              <AccordionTrigger className="text-base text-foreground hover:no-underline">{section.title}</AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                {section.content}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>
    </LegalShell>
  );
}