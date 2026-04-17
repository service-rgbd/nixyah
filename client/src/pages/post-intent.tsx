import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { Megaphone, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
          className="space-y-6"
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

          <Card className="border-border">
            <CardHeader className="space-y-2">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Megaphone className="w-6 h-6 text-primary" />
              </div>
              <CardTitle className="text-lg">Oui, je poste maintenant</CardTitle>
              <CardDescription>
                Remplissez votre fiche (infos + photos/vidéos) pour attirer plus de visites.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                className="w-full h-12 gap-2"
                onClick={() => setLocation("/annonce/new")}
                data-testid="button-go-annonce-new"
              >
                {lang === "en" ? "Post an ad" : "Poster une annonce"}
                <ArrowRight className="w-5 h-5" />
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border">
            <CardHeader className="space-y-2">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-emerald-500" />
              </div>
              <CardTitle className="text-lg">Plus tard</CardTitle>
              <CardDescription>
                Vous pourrez poster une annonce à tout moment depuis votre profil.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button
                variant="secondary"
                className="w-full h-12"
                onClick={() => setLocation("/dashboard")}
                data-testid="button-skip-annonce"
              >
                {t("mySpace")}
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </main>
    </div>
  );
}


