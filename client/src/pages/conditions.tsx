import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { AlertTriangle, BadgeCheck, FileText, Shield, Users } from "lucide-react";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { LegalShell } from "@/components/legal-shell";
import { useConsent } from "@/lib/consent";

const keyPoints = [
  {
    title: "Annonces en premier plan",
    text: "NIXYAH est conçu pour mettre en avant les annonces, profils et espaces publiés par ses utilisateurs.",
  },
  {
    title: "Plateforme de mise en relation",
    text: "NIXYAH n'est ni l'auteur, ni le mandataire, ni l'organisateur des annonces publiées sur la plateforme.",
  },
  {
    title: "Responsabilité individuelle",
    text: "Chaque utilisateur reste seul responsable de ses annonces, de ses propos, de ses actes, de ses objectifs et du respect de la loi.",
  },
];

const detailSections = [
  {
    id: "role",
    title: "Rôle exact de la plateforme",
    content:
      "NIXYAH fournit un service de présentation et de visibilité: profils, annonces, salons, produits adultes et options de mise en avant. La plateforme facilite l'affichage et la découverte de contenus publiés par les utilisateurs, mais elle ne valide pas la réalité, la qualité, l'intention ni l'exécution des services ou propositions mentionnés.",
  },
  {
    id: "liability",
    title: "Responsabilité des annonces et des comportements",
    content:
      "Les utilisateurs assument seuls la rédaction, la légalité, l'exactitude et les conséquences de leurs annonces. NIXYAH n'est pas responsable des contenus publiés, des rendez-vous, des échanges privés, des paiements externes, des promesses faites entre utilisateurs, ni des actes ou buts poursuivis par les membres.",
  },
  {
    id: "moderation",
    title: "Modération et retrait",
    content:
      "La plateforme peut modérer, masquer, refuser ou supprimer un contenu, un compte ou une annonce si elle estime qu'il existe un risque juridique, un abus, un contenu trompeur, violent, illicite ou contraire au fonctionnement du service. Cette modération n'implique pas une garantie générale sur tout le contenu publié.",
  },
  {
    id: "safety",
    title: "Âge, sécurité et légalité",
    content:
      "L'accès est réservé aux adultes. Chaque utilisateur doit respecter les lois applicables dans son pays et prendre ses propres précautions avant tout échange, paiement ou rencontre. La plateforme recommande de vérifier l'identité de son interlocuteur, d'éviter les situations à risque et de signaler tout comportement problématique.",
  },
  {
    id: "payments",
    title: "Paiements, jetons et services externes",
    content:
      "Les jetons servent à certaines fonctions internes de visibilité. Les paiements sont traités par des prestataires externes lorsque cette option est proposée. NIXYAH n'est pas responsable d'un accord conclu hors plateforme, d'une prestation externe, d'un litige entre utilisateurs ou d'un service promis dans une annonce.",
  },
];

const acceptanceItems = [
  {
    id: "adult",
    label: "Je confirme être majeur et utiliser la plateforme dans un cadre légal.",
  },
  {
    id: "responsibility",
    label: "Je comprends que chaque utilisateur est responsable de ses annonces, actes, paiements et objectifs.",
  },
  {
    id: "platform-role",
    label: "Je comprends que NIXYAH met des annonces en avant mais n'en est ni l'auteur ni le garant.",
  },
  {
    id: "content-rights",
    label: "Je m'engage à publier uniquement du contenu légal et dont je détiens les droits.",
  },
];

export default function Conditions() {
  const [, setLocation] = useLocation();
  const [consent, setConsent] = useConsent();
  const requiredIds = useMemo(() => acceptanceItems.map((item) => item.id), []);
  const [acceptedItems, setAcceptedItems] = useState<Set<string>>(
    new Set(consent.conditionsOk ? requiredIds : []),
  );

  useEffect(() => {
    if (consent.conditionsOk) {
      setAcceptedItems(new Set(requiredIds));
    }
  }, [consent.conditionsOk, requiredIds]);

  const allAccepted = requiredIds.every((id) => acceptedItems.has(id));

  const toggleItem = (id: string) => {
    setAcceptedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleAccept = () => {
    if (!allAccepted) return;

    setConsent((prev) => ({ ...prev, conditionsOk: true }));

    try {
      const params = new URLSearchParams(window.location.search);
      const next = params.get("next");
      if (next) {
        setLocation(next);
        return;
      }
    } catch {
      // ignore
    }

    const hasProfile = Boolean(window.localStorage.getItem("djantrah.profileId"));
    setLocation(hasProfile ? "/start" : "/signup");
  };

  return (
    <LegalShell
      active="conditions"
      icon={FileText}
      eyebrow="Centre légal"
      title="Conditions d'utilisation"
      description="Version simple et lisible: la plateforme met les annonces en avant, mais chaque utilisateur reste responsable de son contenu, de ses actes et de ses intentions."
    >
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid gap-3 md:grid-cols-3">
        {keyPoints.map((point) => (
          <div key={point.title} className="rounded-2xl border border-border bg-card p-4">
            <div className="text-sm font-semibold text-foreground">{point.title}</div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{point.text}</p>
          </div>
        ))}
      </motion.section>

      <section className="rounded-3xl border border-border bg-card p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-amber-500/12">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">Ce que cela veut dire concrètement</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              NIXYAH est un service de visibilité et de découverte. La plateforme n'endosse pas les annonces, ne garantit pas les profils, ne contrôle pas les objectifs réels des utilisateurs et n'est pas responsable des actes, rencontres, paiements ou litiges nés des publications.
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-card p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Détail des règles</h2>
            <p className="mt-1 text-sm text-muted-foreground">Les points essentiels sont regroupés ici pour éviter une page trop longue.</p>
          </div>
          <div className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">Lecture rapide</div>
        </div>

        <Accordion type="single" collapsible className="mt-4">
          {detailSections.map((section) => (
            <AccordionItem key={section.id} value={section.id} className="border-border">
              <AccordionTrigger className="text-base text-foreground hover:no-underline">{section.title}</AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                {section.content}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <button
          type="button"
          onClick={() => setLocation("/privacy")}
          className="rounded-3xl border border-border bg-card p-5 text-left transition-colors hover:bg-card/80"
        >
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-primary" />
            <div className="text-base font-semibold text-foreground">Confidentialité</div>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Quelles données sont utilisées, pourquoi, avec quels prestataires et quels sont vos droits.
          </p>
        </button>

        <button
          type="button"
          onClick={() => setLocation("/cookies")}
          className="rounded-3xl border border-border bg-card p-5 text-left transition-colors hover:bg-card/80"
        >
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 text-primary" />
            <div className="text-base font-semibold text-foreground">Cookies et stockage</div>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Détail du cookie de session, du stockage local des préférences et de l'usage technique du navigateur.
          </p>
        </button>
      </section>

      <section className="rounded-3xl border border-border bg-card p-5">
        <div className="flex items-center gap-3">
          <BadgeCheck className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Accord simple</h2>
        </div>

        {consent.conditionsOk && (
          <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-600">
            Ces conditions ont déjà été acceptées sur cet appareil. Vous pouvez les relire et continuer à utiliser la plateforme.
          </div>
        )}

        <div className="mt-4 space-y-3">
          {acceptanceItems.map((item) => (
            <label key={item.id} className="flex items-start gap-3 rounded-2xl border border-border bg-background/50 p-4">
              <Checkbox checked={acceptedItems.has(item.id)} onCheckedChange={() => toggleItem(item.id)} />
              <span className="text-sm leading-relaxed text-foreground">{item.label}</span>
            </label>
          ))}
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Button className="h-12 flex-1 gap-2" disabled={!allAccepted} onClick={handleAccept}>
            <BadgeCheck className="h-4 w-4" />
            Accepter et continuer
          </Button>
          <Button variant="outline" className="h-12 flex-1" onClick={() => setLocation("/")}>
            Revenir à l'accueil
          </Button>
        </div>
      </section>
    </LegalShell>
  );
}
