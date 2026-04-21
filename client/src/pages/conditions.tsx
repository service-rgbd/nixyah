import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { AlertTriangle, BadgeCheck, FileText, Shield, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { LegalShell } from "@/components/legal-shell";
import { useConsent } from "@/lib/consent";

const keyPoints = [
  {
    title: "Annonces, profils et rendez-vous",
    text: "NIXYAH met en avant des profils, annonces de services, salons de massage, résidences et évènements publiés par ses utilisateurs, notamment des fêtes privées, soirées, anniversaires ou rendez-vous organisés.",
  },
  {
    title: "Plateforme de découverte",
    text: "La plateforme aide à découvrir des profils, des lieux et des évènements à proximité, mais elle n'est ni l'auteur, ni le mandataire, ni l'exécutant des annonces publiées.",
  },
  {
    title: "Responsabilité individuelle",
    text: "Chaque utilisateur reste seul responsable de ses annonces, de ses échanges, de ses actes, de ses objectifs réels et du respect de la loi. NIXYAH rappelle les précautions à prendre, sans garantir les publications.",
  },
];

const detailSections = [
  {
    id: "role",
    title: "Rôle exact de la plateforme",
    content:
      "NIXYAH fournit un service de présentation, de visibilité et de découverte. Les utilisateurs peuvent y publier des profils, des annonces de compagnie ou de bien-être, des propositions de rendez-vous, des résidences, des salons de massage, des évènements et différentes options de mise en avant. La plateforme aide à consulter ces publications et à repérer ce qui se trouve à proximité, mais elle ne valide pas la réalité, la qualité, l'intention, le sérieux ni l'exécution des propositions mentionnées.",
  },
  {
    id: "liability",
    title: "Responsabilité des annonces et des comportements",
    content:
      "Les utilisateurs assument seuls la rédaction, la légalité, l'exactitude et les conséquences de leurs annonces. Cela vaut pour les annonces de services, les profils présentés, les évènements organisés, les salons ou résidences proposés, les échanges privés, les rencontres, les paiements externes et les promesses faites entre personnes. NIXYAH n'est pas responsable du comportement des membres, de leurs intentions réelles, ni des suites données à un contact pris via la plateforme.",
  },
  {
    id: "moderation",
    title: "Modération et retrait",
    content:
      "La plateforme peut modérer, masquer, refuser ou supprimer un contenu, un compte ou une annonce si elle estime qu'il existe un risque juridique, un abus, un contenu trompeur, violent, illicite ou contraire au fonctionnement du service. Elle peut aussi afficher des avertissements, limiter la visibilité ou demander des vérifications supplémentaires. Cette modération n'implique pas une garantie générale sur tout le contenu publié.",
  },
  {
    id: "safety",
    title: "Âge, sécurité et légalité",
    content:
      "L'accès est réservé aux adultes. Chaque utilisateur doit respecter les lois applicables dans son pays et prendre ses propres précautions avant tout échange, paiement ou rencontre. Avant un rendez-vous, une réservation, un déplacement vers un salon, une résidence ou un évènement, la plateforme recommande de vérifier l'identité de son interlocuteur, le lieu, les conditions d'accès, d'éviter les situations à risque et de signaler tout comportement problématique.",
  },
  {
    id: "payments",
    title: "Paiements, jetons et services externes",
    content:
      "Les jetons servent à certaines fonctions internes de visibilité, comme certaines mises en avant ou publications spécifiques. Les paiements sont traités par des prestataires externes lorsque cette option est proposée. NIXYAH n'est pas responsable d'un accord conclu hors plateforme, d'une prestation externe, d'un litige entre utilisateurs, d'un évènement privé organisé par un tiers, ni d'un service promis dans une annonce.",
  },
  {
    id: "events-places",
    title: "Évènements, salons et résidences",
    content:
      "La plateforme peut référencer ou mettre en avant des soirées, fêtes privées, anniversaires, rendez-vous organisés, salons de massage et résidences disponibles à proximité. Ces publications sont créées par des utilisateurs ou des gestionnaires d'espaces. NIXYAH ne garantit ni la tenue effective de l'évènement, ni la disponibilité réelle d'un lieu, ni l'exactitude des conditions annoncées.",
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
    label: "Je comprends que NIXYAH met des annonces, profils, lieux et évènements en avant sans en être l'auteur ni le garant.",
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
      description="Version simple et lisible: la plateforme référence des profils, annonces, salons, résidences et évènements, tout en rappelant que chaque utilisateur reste responsable de son contenu, de ses actes et de ses intentions."
    >
      <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="grid gap-5 border-t border-border/70 pt-5 md:grid-cols-3">
        {keyPoints.map((point) => (
          <div key={point.title} className="space-y-2">
            <div className="text-sm font-semibold text-foreground">{point.title}</div>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{point.text}</p>
          </div>
        ))}
      </motion.section>

      <section className="border-t border-border/70 pt-5">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
          </div>
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">Ce que cela veut dire concrètement</h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              NIXYAH est un service de visibilité et de découverte. La plateforme permet de consulter des profils, des propositions de service, des salons de massage, des résidences et des évènements privés ou organisés à proximité. Elle n'endosse pas les annonces, ne garantit pas les profils, ne contrôle pas les objectifs réels des utilisateurs et n'est pas responsable des actes, rencontres, paiements, réservations ou litiges nés des publications.
            </p>
          </div>
        </div>
      </section>

      <section className="border-t border-border/70 pt-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Détail des règles</h2>
            <p className="mt-1 text-sm text-muted-foreground">Les points essentiels sont regroupés ici pour éviter une page trop longue.</p>
          </div>
          <div className="text-xs font-medium text-primary">Lecture rapide</div>
        </div>

        <div className="mt-4 space-y-3">
          {detailSections.map((section, index) => (
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

      <section className="grid gap-4 border-t border-border/70 pt-5 md:grid-cols-2">
        <button
          type="button"
          onClick={() => setLocation("/privacy")}
          className="min-w-0 border-b border-border/70 pb-3 text-left transition-colors hover:text-primary"
        >
          <div className="flex items-center gap-3">
            <Shield className="h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0 text-base font-semibold text-foreground">Confidentialité</div>
          </div>
          <p className="mt-2 break-words text-sm leading-relaxed text-muted-foreground">
            Quelles données sont utilisées, pourquoi, avec quels prestataires et quels sont vos droits.
          </p>
        </button>

        <button
          type="button"
          onClick={() => setLocation("/cookies")}
          className="min-w-0 border-b border-border/70 pb-3 text-left transition-colors hover:text-primary"
        >
          <div className="flex items-center gap-3">
            <Users className="h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0 text-base font-semibold text-foreground">Cookies et stockage</div>
          </div>
          <p className="mt-2 break-words text-sm leading-relaxed text-muted-foreground">
            Détail du cookie de session, du stockage local des préférences et de l'usage technique du navigateur.
          </p>
        </button>
      </section>

      <section className="border-t border-border/70 pt-5">
        <div className="flex items-center gap-3">
          <BadgeCheck className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Accord simple</h2>
        </div>

        {consent.conditionsOk && (
          <div className="mt-4 text-sm text-emerald-600">
            Ces conditions ont déjà été acceptées sur cet appareil. Vous pouvez les relire et continuer à utiliser la plateforme.
          </div>
        )}

        <div className="mt-4 space-y-3">
          {acceptanceItems.map((item) => (
            <label key={item.id} className="flex items-start gap-3 border-t border-border/70 py-3 first:border-t-0 first:pt-0">
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
