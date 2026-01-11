import { useQuery } from "@tanstack/react-query";
import { Mail, MessageCircle, Shield, ExternalLink } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useI18n } from "@/lib/i18n";

type SupportInfo = { resetEmail: string | null; telegramUrl: string | null };

function FooterLink({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-sm text-muted-foreground hover:text-foreground transition-colors text-left"
    >
      {label}
    </button>
  );
}

export default function SiteFooter() {
  const [, setLocation] = useLocation();
  const { lang } = useI18n();

  const { data: support } = useQuery<SupportInfo>({
    queryKey: ["/api/support"],
  });

  const email = support?.resetEmail ?? null;
  const telegramUrl = support?.telegramUrl ?? null;

  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="rounded-3xl border border-border bg-gradient-to-br from-primary/15 via-card to-card p-6 md:p-8 shadow-lg">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                <p className="text-sm font-semibold text-foreground">
                  {lang === "en" ? "Safe & discreet experience" : "Expérience discrète & maîtrisée"}
                </p>
              </div>
              <p className="text-sm text-muted-foreground max-w-xl">
                {lang === "en"
                  ? "Create your space, manage your visibility, and explore nearby profiles with privacy-first settings."
                  : "Crée ton espace, gère ta visibilité, et explore autour de toi avec des réglages orientés confidentialité."}
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <Button onClick={() => setLocation("/signup")} className="rounded-2xl">
                {lang === "en" ? "Create my space" : "Créer mon espace"}
              </Button>
              <Button
                variant="outline"
                onClick={() => setLocation("/start")}
                className="rounded-2xl"
              >
                {lang === "en" ? "Explore" : "Explorer"}
              </Button>
            </div>
          </div>
        </div>

        <div className="mt-10 grid grid-cols-1 md:grid-cols-12 gap-10">
          <div className="md:col-span-4 space-y-3">
            <div className="text-2xl font-black tracking-tight text-gradient">NIXYAH</div>
            <p className="text-sm text-muted-foreground">
              {lang === "en"
                ? "A modern interface to present profiles, private spaces and adult products — with responsible, privacy-first design."
                : "Une interface moderne pour présenter des profils, des espaces privés et des produits adultes — avec une conception responsable et orientée confidentialité."}
            </p>
            <div className="flex flex-col gap-2 pt-2">
              {email && (
                <a
                  className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  href={`mailto:${email}`}
                >
                  <Mail className="w-4 h-4" />
                  {email}
                </a>
              )}
              {telegramUrl && (
                <a
                  className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  href={telegramUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  <MessageCircle className="w-4 h-4" />
                  Telegram support <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>

          <div className="md:col-span-8 grid grid-cols-2 sm:grid-cols-4 gap-8">
            <div className="space-y-3">
              <div className="text-sm font-semibold text-foreground">
                {lang === "en" ? "Product" : "Produit"}
              </div>
              <div className="flex flex-col gap-2">
                <FooterLink label={lang === "en" ? "Explore" : "Explorer"} onClick={() => setLocation("/start")} />
                <FooterLink label={lang === "en" ? "Dashboard" : "Mon espace"} onClick={() => setLocation("/dashboard")} />
                <FooterLink label={lang === "en" ? "Settings" : "Paramètres"} onClick={() => setLocation("/settings")} />
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-semibold text-foreground">
                {lang === "en" ? "Services" : "Services"}
              </div>
              <div className="flex flex-col gap-2">
                <FooterLink label={lang === "en" ? "Profiles & listings" : "Profils & annonces"} onClick={() => setLocation("/annonces")} />
                <FooterLink label={lang === "en" ? "Adult products" : "Produits adultes"} onClick={() => setLocation("/adult-products")} />
                <FooterLink label={lang === "en" ? "Create a listing" : "Créer une annonce"} onClick={() => setLocation("/annonce/new")} />
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-semibold text-foreground">
                {lang === "en" ? "Resources" : "Ressources"}
              </div>
              <div className="flex flex-col gap-2">
                <FooterLink label={lang === "en" ? "Conditions" : "Conditions"} onClick={() => setLocation("/conditions")} />
                <FooterLink label={lang === "en" ? "Sign up" : "Inscription"} onClick={() => setLocation("/signup")} />
                <FooterLink label={lang === "en" ? "Sign in" : "Connexion"} onClick={() => setLocation("/login")} />
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-sm font-semibold text-foreground">
                {lang === "en" ? "Legal" : "Légal"}
              </div>
              <div className="flex flex-col gap-2">
                <FooterLink label={lang === "en" ? "Terms of use" : "Conditions d'utilisation"} onClick={() => setLocation("/conditions")} />
                <FooterLink label={lang === "en" ? "18+ only" : "+18 uniquement"} onClick={() => setLocation("/conditions")} />
                <span className="text-sm text-muted-foreground">
                  {lang === "en" ? "Privacy-first design" : "Design orienté confidentialité"}
                </span>
              </div>
            </div>
          </div>
        </div>

        <Separator className="my-10" />

        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-xs text-muted-foreground">
          <div>
            © {new Date().getFullYear()} NIXYAH — {lang === "en" ? "All rights reserved." : "Tous droits réservés."}
          </div>
          <div>
            {lang === "en"
              ? "18+ only. Be respectful, responsible, and comply with local laws."
              : "+18 uniquement. Respect, responsabilité et conformité aux lois locales."}
          </div>
        </div>
      </div>
    </footer>
  );
}







