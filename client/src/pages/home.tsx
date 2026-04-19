import { useEffect } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Cookie, Shield } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useConsent } from "@/lib/consent";
import { useI18n } from "@/lib/i18n";

function AgeVerificationModal(props: { onAccept: () => void; onRefuse: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-6"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        className="w-full max-w-sm rounded-3xl border border-border bg-card p-6 shadow-2xl"
      >
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/12">
            <AlertTriangle className="h-8 w-8 text-primary" />
          </div>
          <h2 className="mt-4 text-xl font-semibold text-foreground">Accès réservé aux adultes</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            En continuant, vous confirmez avoir 18 ans ou plus et utiliser la plateforme dans un cadre légal.
          </p>
        </div>

        <div className="mt-6 space-y-3">
          <Button className="h-12 w-full" onClick={props.onAccept} data-testid="button-age-accept">
            <Shield className="mr-2 h-4 w-4" />
            J'ai 18 ans ou plus
          </Button>
          <Button variant="outline" className="h-11 w-full" onClick={props.onRefuse} data-testid="button-age-refuse">
            Quitter le site
          </Button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function Home() {
  const [, setLocation] = useLocation();
  const [consent, setConsent] = useConsent();
  const { lang, t } = useI18n();

  useEffect(() => {
    if (consent.ageOk && consent.cookiesOk) {
      setLocation("/start");
    }
  }, [consent.ageOk, consent.cookiesOk, setLocation]);

  if (!consent.ageOk) {
    return (
      <AgeVerificationModal
        onAccept={() => setConsent((prev) => ({ ...prev, ageOk: true }))}
        onRefuse={() => {
          window.location.href = "https://www.google.com";
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-xl items-center justify-center">
        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full rounded-3xl border border-border bg-card p-6 shadow-sm"
        >
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/12">
              <Cookie className="h-6 w-6 text-primary" />
            </div>
            <div>
              <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                NIXYAH
              </div>
              <h1 className="mt-1 text-2xl font-semibold text-foreground">
                {lang === "en" ? "Before entering" : "Avant d'entrer"}
              </h1>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {t("cookiesText")} {lang === "en" ? "After acceptance, you will be redirected directly to the app." : "Après acceptation, vous serez redirigé directement vers l'application."}
              </p>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-border bg-background/50 p-4 text-sm leading-relaxed text-muted-foreground">
            <p>
              {lang === "en"
                ? "NIXYAH prioritizes user listings and visibility tools. The platform does not endorse or guarantee the intent, content, conduct, or actions of its users."
                : "NIXYAH met en avant les annonces et outils de visibilité des utilisateurs. La plateforme ne cautionne ni ne garantit leurs intentions, contenus, comportements ou actes."}
            </p>
          </div>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Button className="h-12 flex-1" onClick={() => setConsent((prev) => ({ ...prev, cookiesOk: true }))} data-testid="button-accept-cookies">
              {t("accept")}
            </Button>
            <Button variant="outline" className="h-12 flex-1" onClick={() => setLocation("/cookies")}>
              {lang === "en" ? "Cookie details" : "Détails cookies"}
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
