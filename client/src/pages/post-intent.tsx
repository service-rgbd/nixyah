import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { Megaphone, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

export default function PostIntent() {
  const [, setLocation] = useLocation();
  const { lang, t } = useI18n();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center justify-between px-6 py-4">
        <h1 className="text-2xl font-bold text-gradient">NIXYAH</h1>
        <div className="w-10" />
      </header>

      <main className="flex-1 px-6 pb-10">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto max-w-xl space-y-6"
        >
          <div className="space-y-2">
            <h2 className="text-2xl font-semibold text-foreground">
              {lang === "en" ? "Would you like to post an ad?" : "Souhaitez-vous poster une annonce ?"}
            </h2>
            <p className="text-sm text-muted-foreground">
              {lang === "en"
                ? "An ad highlights your profile (price, services, availability, media)."
                : "Une annonce met votre profil en avant (tarif, services, disponibilité, média)."}
            </p>
          </div>

          <section className="space-y-4 border-b border-border/70 pb-5">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
                <Megaphone className="w-6 h-6 text-primary" />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="text-lg font-semibold text-foreground">Oui, je poste maintenant</div>
                <p className="text-sm text-muted-foreground">
                  Remplissez votre fiche (infos + photos/vidéos) pour attirer plus de visites.
                </p>
              </div>
            </div>
            <div className="pl-16">
              <Button
                className="h-12 w-full rounded-2xl gap-2"
                onClick={() => setLocation("/annonce/new")}
                data-testid="button-go-annonce-new"
              >
                {lang === "en" ? "Post an ad" : "Poster une annonce"}
                <ArrowRight className="w-5 h-5" />
              </Button>
            </div>
          </section>

          <section className="space-y-4 pb-1">
            <div className="flex items-start gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10">
                <Sparkles className="w-6 h-6 text-emerald-500" />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <div className="text-lg font-semibold text-foreground">Plus tard</div>
                <p className="text-sm text-muted-foreground">
                  Vous pourrez poster une annonce à tout moment depuis votre profil.
                </p>
              </div>
            </div>
            <div className="pl-16">
              <Button
                variant="secondary"
                className="h-12 w-full rounded-2xl"
                onClick={() => setLocation("/dashboard")}
                data-testid="button-skip-annonce"
              >
                {t("mySpace")}
              </Button>
            </div>
          </section>
        </motion.div>
      </main>
    </div>
  );
}


