import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useLocation } from "wouter";
import {
  AlertTriangle,
  BadgeCheck,
  CheckCircle2,
  ChevronRight,
  Lock,
  Menu,
  MapPin,
  MessageCircle,
  Shield,
  Sparkles,
  Store,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { useAppSettings } from "@/lib/appSettings";
import { getConsent, useConsent } from "@/lib/consent";
import { useI18n } from "@/lib/i18n";
import SiteFooter from "@/components/site-footer";
import { maleProducts } from "@/lib/maleProducts";
import avatarUrl from "@assets/avatar.png";
import spaPhoto from "@assets/photo_2026-01-09_17-36-41.jpg";
import resiPhoto from "@assets/resi-meublmee.jpg";
import img1 from "@assets/c57a31df-9f73-42e9-bfe8-8181654b6932_1767904353125.png";
import img2 from "@assets/1e504b33-1c82-480a-b5ee-310fc690a3e2_1767904894440.png";
import splashVideo from "@assets/IMG_1323.webm";
import logoTitle from "@assets/logo-titre.png";

function FadeInSection({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

function AgeVerificationModal({ onAccept, onRefuse }: { onAccept: () => void; onRefuse: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-6"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="w-full max-w-xs bg-card/95 rounded-3xl p-6 border border-border shadow-2xl"
      >
        <div className="text-center space-y-4">
          <div className="w-16 h-16 mx-auto rounded-full bg-primary/15 flex items-center justify-center">
            <AlertTriangle className="w-10 h-10 text-primary" />
          </div>
          
          <div className="space-y-2">
            <h2 className="text-lg font-semibold text-foreground">
              +18 uniquement
            </h2>
            <p className="text-xs text-muted-foreground">
              En continuant, vous certifiez être majeur(e).
            </p>
          </div>

          <div className="space-y-2 pt-2">
            <Button
              onClick={onAccept}
              className="w-full h-11 text-sm font-semibold"
              data-testid="button-age-accept"
            >
              <Shield className="w-5 h-5 mr-2" />
              J'ai 18 ans ou plus
            </Button>
            
            <Button
              onClick={onRefuse}
              variant="outline"
              className="w-full h-10 text-xs"
              data-testid="button-age-refuse"
            >
              Je suis mineur(e) - Quitter
            </Button>
          </div>

          <p className="text-xs text-muted-foreground pt-2">
            En continuant, vous acceptez nos conditions d'utilisation
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

function LandingPage() {
  const [, setLocation] = useLocation();
  const [settings, setSettings] = useAppSettings();
  const [consent, setConsent] = useConsent();
  const { lang, t } = useI18n();
  const [showAgeModal, setShowAgeModal] = useState(!consent.ageOk);
  const [loadingExplore, setLoadingExplore] = useState(false);
  const [heroIndex, setHeroIndex] = useState(0);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const canPlayWebm = useMemo(() => {
    try {
      const v = document.createElement("video");
      // iOS Safari may return "" for webm.
      return Boolean(v.canPlayType?.('video/webm; codecs="vp8, vorbis"'));
    } catch {
      return false;
    }
  }, []);

  const heroMedia = useMemo(
    () =>
      [
        { type: "video" as const, src: splashVideo, durationMs: 7000 },
        { type: "image" as const, src: img1, durationMs: 4000 },
        { type: "image" as const, src: img2, durationMs: 4000 },
      ] as const,
    [],
  );

  useEffect(() => {
    if (showAgeModal) return;
    if (settings.reduceMotion) return;
    const current = heroMedia[heroIndex % heroMedia.length];
    const durationMs =
      current.type === "video" && !canPlayWebm ? 300 : current.durationMs;
    const timer = window.setTimeout(() => {
      setHeroIndex((prev) => (prev + 1) % heroMedia.length);
    }, durationMs);
    return () => window.clearTimeout(timer);
  }, [showAgeModal, settings.reduceMotion, heroIndex, heroMedia, canPlayWebm]);

  const handleAgeRefuse = () => {
    window.location.href = "https://www.google.com";
  };

  const handleCreateProfile = () => {
    const hasProfile = Boolean(window.localStorage.getItem("djantrah.profileId"));
    if (hasProfile) {
      setLocation("/dashboard");
      return;
    }
    const c = getConsent();
    // Si les conditions ne sont pas encore acceptées, on les montre d'abord.
    setLocation(c.conditionsOk ? "/signup" : "/conditions?next=/signup");
  };

  const handleExplore = async () => {
    setLoadingExplore(true);
    // Pré-demande de géolocalisation pour que Start ait déjà la position.
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => {},
        () => {},
        { enableHighAccuracy: false, timeout: 4000 },
      );
    }
    const c = getConsent();
    setLocation(c.conditionsOk ? "/start" : "/conditions?next=/start");
  };

  const scrollToId = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const goTo = (id: string) => {
    setMobileNavOpen(false);
    // Give the sheet time to close before scrolling.
    window.setTimeout(() => scrollToId(id), 60);
  };

  const toggleTheme = () => {
    setSettings({
      ...settings,
      theme: settings.theme === "dark" ? "light" : "dark",
    });
  };

  const demoProfiles = useMemo(
    () => [
      {
        id: "demo-1",
        name: lang === "en" ? "Anonymous • 23" : "Anonyme • 23",
        city: lang === "en" ? "Near you" : "À proximité",
        verified: true,
        photoUrl: spaPhoto,
        tags: lang === "en" ? ["Private massage", "VIP", "Discreet"] : ["Massage privé", "VIP", "Discret"],
      },
      {
        id: "demo-2",
        name: lang === "en" ? "Anonymous • 28" : "Anonyme • 28",
        city: lang === "en" ? "City center" : "Centre-ville",
        verified: false,
        photoUrl: resiPhoto,
        tags: lang === "en" ? ["Residence", "Verified media", "Comfort"] : ["Résidence", "Médias vérifiés", "Confort"],
      },
      {
        id: "demo-3",
        name: lang === "en" ? "Anonymous • 25" : "Anonyme • 25",
        city: lang === "en" ? "Tonight" : "Ce soir",
        verified: true,
        photoUrl: img1,
        tags: lang === "en" ? ["Photos", "Video", "Availability"] : ["Photos", "Vidéo", "Disponibilité"],
      },
    ],
    [lang],
  );

  const services = useMemo(
    () => [
      {
        icon: Users,
        title: lang === "en" ? "Profiles & listings" : "Profils & annonces",
        description:
          lang === "en"
            ? "Present your profile clearly: photos, video, availability, price range and services. Visitors understand fast, without friction."
            : "Présente ton profil clairement : photos, vidéo, disponibilités, tarifs et services. Les visiteurs comprennent vite, sans friction.",
      },
      {
        icon: BadgeCheck,
        title: lang === "en" ? "Verification & trust" : "Vérification & confiance",
        description:
          lang === "en"
            ? "Verification badges and moderation help highlight serious profiles and reduce low-quality content."
            : "Badges de vérification et modération pour mettre en avant les profils sérieux et limiter le contenu faible qualité.",
      },
      {
        icon: MapPin,
        title: lang === "en" ? "Controlled location" : "Localisation maîtrisée",
        description:
          lang === "en"
            ? "Explore nearby without exposing your exact position. Filters stay under your control."
            : "Explore autour de toi sans exposer ta position exacte. Les filtres restent sous ton contrôle.",
      },
      {
        icon: MessageCircle,
        title: lang === "en" ? "Direct contact" : "Contact direct",
        description:
          lang === "en"
            ? "A simple flow to reach profiles: clear call-to-action, quick access to key info, and privacy-first contact preferences."
            : "Un parcours simple pour contacter : call-to-action clair, infos clés accessibles, et préférences de contact orientées discrétion.",
      },
      {
        icon: Store,
        title: lang === "en" ? "Adult products" : "Produits adultes",
        description:
          lang === "en"
            ? "A dedicated area for selected products, with clean presentation and detailed descriptions."
            : "Un espace dédié aux produits sélectionnés, avec une présentation propre et des descriptions détaillées.",
      },
      {
        icon: Lock,
        title: lang === "en" ? "Privacy by design" : "Confidentialité par design",
        description:
          lang === "en"
            ? "Minimal exposure of personal data, visibility controls, and a responsible approach to content."
            : "Exposition minimale des données, contrôles de visibilité, et approche responsable du contenu.",
      },
    ],
    [lang],
  );

  return (
    <div className="min-h-screen bg-background">
      {showAgeModal && (
        <AgeVerificationModal 
          onAccept={() => {
            setConsent((prev) => ({ ...prev, ageOk: true }));
            setShowAgeModal(false);
          }} 
          onRefuse={handleAgeRefuse} 
        />
      )}

      {!showAgeModal && (
        <div className="relative">
          {/* HERO (mobile-first, full screen, background slideshow) */}
          <section id="top" className="relative isolate min-h-[100svh] overflow-hidden bg-background">
            {/* Background media layer */}
            <div className="absolute inset-0 z-0">
              <AnimatePresence mode="sync" initial={false}>
        <motion.div
                  key={`hero-${heroIndex}`}
                  initial={{
                    opacity: 0,
                    scale: 1.02,
                    filter: "blur(12px) saturate(1.12)",
                  }}
                  animate={{
                    opacity: 1,
                    scale: 1,
                    filter: "blur(0px) saturate(1.05)",
                  }}
                  exit={{
                    opacity: 0,
                    scale: 1.01,
                    filter: "blur(14px) saturate(1.1)",
                  }}
                  transition={{ duration: 2.2, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute inset-0"
                >
                  {heroMedia[heroIndex].type === "video" ? (
            <video
                      src={heroMedia[heroIndex].src}
              autoPlay
              muted
              loop
              playsInline
                      preload="auto"
                      className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <img
                      src={heroMedia[heroIndex].src}
              alt="NIXYAH"
                      className="absolute inset-0 w-full h-full object-cover"
                      draggable={false}
            />
          )}
        </motion.div>
      </AnimatePresence>
            </div>

            {/* Overlays for readability + premium look */}
            <div className="absolute inset-0 z-10 pointer-events-none">
              {/* Minimal overlay: rely on the glass card + shadows for readability */}
              <div className="absolute inset-0 bg-black/4" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/16 via-black/4 to-background" />
              <div className="absolute inset-0 opacity-6 [background:radial-gradient(circle_at_20%_10%,hsl(var(--primary))_0%,transparent_62%),radial-gradient(circle_at_90%_25%,hsl(var(--primary))_0%,transparent_66%)]" />
            </div>

            {/* Header (in hero, readable on mobile) */}
            <header className="relative z-20 mx-auto max-w-6xl px-4 sm:px-6 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-4 flex items-center justify-between gap-3 text-white">
              <button
                type="button"
                onClick={() => scrollToId("top")}
                className="flex items-center gap-2 drop-shadow-[0_18px_60px_rgba(0,0,0,0.85)]"
              >
                <img
                  src={logoTitle}
                  alt="NIXYAH"
                  className="h-8 sm:h-9 w-auto object-contain"
                  draggable={false}
                />
              </button>

              <div className="flex items-center gap-2">
                {/* Mobile menu */}
                <button
                  type="button"
                  onClick={() => setMobileNavOpen(true)}
                  className="md:hidden w-10 h-10 rounded-2xl bg-black/20 border border-white/15 backdrop-blur-sm flex items-center justify-center"
                  aria-label={lang === "en" ? "Open menu" : "Ouvrir le menu"}
                >
                  <Menu className="w-5 h-5" />
                </button>

                <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
                  <SheetContent side="bottom" className="rounded-t-3xl">
                    <SheetHeader className="text-left">
                      <SheetTitle>{lang === "en" ? "Menu" : "Menu"}</SheetTitle>
                    </SheetHeader>
                    <div className="mt-4 grid gap-2">
                      <Button variant="secondary" className="justify-between rounded-2xl" onClick={() => goTo("services")}>
                        {lang === "en" ? "Services" : "Services"}
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                      <Button variant="secondary" className="justify-between rounded-2xl" onClick={() => goTo("how")}>
                        {lang === "en" ? "How it works" : "Comment ça marche"}
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                      <Button variant="secondary" className="justify-between rounded-2xl" onClick={() => goTo("faq")}>
                        FAQ
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                      <Separator className="my-2" />
                      <Button className="rounded-2xl" onClick={() => { setMobileNavOpen(false); handleCreateProfile(); }}>
                        {lang === "en" ? "Create my space" : "Créer mon espace"}
                      </Button>
                      <Button
                        variant="outline"
                        className="rounded-2xl"
                        onClick={() => {
                          setMobileNavOpen(false);
                          setLocation("/login");
                        }}
                      >
                        {t("signIn")}
                      </Button>
                    </div>
                  </SheetContent>
                </Sheet>

                <div className="hidden md:flex items-center gap-1 text-xs text-white/75">
                  <button
                    type="button"
                    onClick={() => scrollToId("services")}
                    className="px-3 py-2 rounded-full hover:bg-white/10"
                  >
                    {lang === "en" ? "Services" : "Services"}
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollToId("how")}
                    className="px-3 py-2 rounded-full hover:bg-white/10"
                  >
                    {lang === "en" ? "How it works" : "Comment ça marche"}
                  </button>
                  <button
                    type="button"
                    onClick={() => scrollToId("faq")}
                    className="px-3 py-2 rounded-full hover:bg-white/10"
                  >
                    FAQ
                  </button>
                </div>

                <div className="flex items-center text-[10px] rounded-full border border-white/20 px-2 py-1 gap-1 bg-black/35 backdrop-blur-sm">
            <button
              type="button"
                    className={`px-1.5 py-0.5 rounded-full ${settings.language === "fr" ? "bg-white text-black" : "text-white/70"}`}
              onClick={() => setSettings({ ...settings, language: "fr" as any })}
            >
              FR
            </button>
            <button
              type="button"
                    className={`px-1.5 py-0.5 rounded-full ${settings.language === "en" ? "bg-white text-black" : "text-white/70"}`}
              onClick={() => setSettings({ ...settings, language: "en" as any })}
            >
              EN
            </button>
          </div>

                {/* Dark/Light toggle (ON/OFF) */}
                <button
                  type="button"
                  onClick={toggleTheme}
                  className="h-10 px-3 rounded-2xl bg-black/20 border border-white/15 backdrop-blur-sm flex items-center gap-2"
                  aria-label={lang === "en" ? "Toggle theme" : "Changer le thème"}
                >
                  <span className="text-[10px] text-white/70">
                    {settings.theme === "light" ? "ON" : "OFF"}
                  </span>
                  <Switch
                    checked={settings.theme === "light"}
                    onCheckedChange={toggleTheme}
                  />
                </button>

                <Button
                  variant="ghost"
                  className="hidden md:inline-flex rounded-2xl text-white hover:bg-white/10 hover:text-white"
                  onClick={() => setLocation("/login")}
                >
                  {t("signIn")}
                </Button>
              </div>
            </header>

            {/* Hero content (mobile-first) */}
            <main className="relative z-20 mx-auto max-w-6xl px-4 sm:px-6 pb-[calc(env(safe-area-inset-bottom)+2.5rem)]">
              <div className="min-h-[calc(100svh-6rem)] flex items-center">
                <motion.div
                  initial={{ opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.65, ease: [0.22, 1, 0.36, 1] }}
                  className="w-full max-w-2xl"
                >
                  <div className="rounded-3xl border border-white/12 bg-black/10 backdrop-blur-sm shadow-2xl p-5 sm:p-7">
                    <div className="inline-flex items-center gap-2 rounded-full bg-white/10 border border-white/15 px-3 py-1.5 text-xs text-white">
                      <AlertTriangle className="w-4 h-4 text-primary" />
                      <span>{lang === "en" ? "18+ only • Responsible platform" : "+18 uniquement • Plateforme responsable"}</span>
            </div>

                    <h1 className="mt-4 text-3xl sm:text-4xl lg:text-5xl font-black tracking-tight text-white drop-shadow-[0_14px_45px_rgba(0,0,0,0.85)]">
                      {lang === "en"
                        ? "A clean, modern presentation — built for discretion."
                        : "Une présentation clean & moderne — pensée pour la discrétion."}
                    </h1>

                    <p className="mt-3 text-sm sm:text-base text-white/85 leading-relaxed max-w-prose drop-shadow-[0_10px_30px_rgba(0,0,0,0.75)]">
                      {lang === "en"
                        ? "Profiles, private spaces and selected products — in one interface."
                        : "Profils, espaces privés et produits sélectionnés — dans une seule interface."}
                    </p>

                    <div className="mt-5 flex flex-col sm:flex-row gap-3">
                      <Button onClick={handleCreateProfile} className="w-full sm:w-auto rounded-2xl h-12">
                        <Shield className="w-4 h-4 mr-2" />
                        {lang === "en" ? "Create my space" : "Créer mon espace"}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleExplore}
                        className="w-full sm:w-auto rounded-2xl h-12 bg-white/5 border-white/20 text-white hover:bg-white/10 hover:text-white"
                        disabled={loadingExplore}
                      >
                        <MapPin className="w-4 h-4 mr-2" />
                        {loadingExplore
                          ? lang === "en"
                            ? "Opening…"
                            : "Ouverture…"
                          : t("explore")}
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-center gap-2">
                    {heroMedia.map((_, idx) => (
                <div
                  key={idx}
                  className={`h-1 rounded-full transition-all duration-500 ${
                          idx === heroIndex ? "w-8 bg-primary" : "w-2 bg-white/30"
                  }`}
                />
              ))}
            </div>
                </motion.div>
              </div>
            </main>
          </section>

          <Separator />

          {/* 3 cards below the hero (vertical scroll) */}
          <section className="relative py-12">
            <div className="absolute inset-0 -z-10 opacity-60 [background:radial-gradient(circle_at_20%_0%,hsl(var(--primary))_0%,transparent_40%),radial-gradient(circle_at_90%_20%,hsl(var(--primary))_0%,transparent_45%)]" />
            <div className="mx-auto max-w-6xl px-4 sm:px-6">
              <div className="max-w-2xl space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs text-foreground">
                  <BadgeCheck className="w-4 h-4 text-primary" />
                  {lang === "en" ? "Trust & safety" : "Confiance & sécurité"}
              </div>
                <h2 className="text-xl md:text-2xl font-bold tracking-tight">
                  {lang === "en"
                    ? "Why NIXYAH inspires trust"
                    : "Pourquoi NIXYAH inspire confiance"}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {lang === "en"
                    ? "Clear positioning, privacy-first features, and responsible design — explained transparently."
                    : "Positionnement clair, fonctionnalités orientées discrétion, et design responsable — expliqué en toute transparence."}
                </p>
              </div>

              <div className="mt-6 grid grid-cols-1 gap-3">
                <div className="rounded-3xl border border-border bg-gradient-to-br from-card via-card to-primary/5 p-5 shadow-sm hover:shadow-lg transition-shadow">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <BadgeCheck className="w-4 h-4 text-primary" />
                    {lang === "en" ? "Verified profiles" : "Profils vérifiés"}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {lang === "en"
                      ? "Verification badges and moderation highlight serious spaces. Better signal, less noise, more confidence."
                      : "Badges + modération pour mettre en avant les espaces sérieux. Plus de signal, moins de bruit, plus de confiance."}
                  </p>
                </div>

                <div className="rounded-3xl border border-border bg-gradient-to-br from-card via-card to-primary/5 p-5 shadow-sm hover:shadow-lg transition-shadow">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Lock className="w-4 h-4 text-primary" />
                    {lang === "en" ? "Confidentiality" : "Confidentialité"}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {lang === "en"
                      ? "Privacy-first UX: control visibility, keep location discreet, and reduce exposure of personal details."
                      : "UX orientée discrétion : contrôle de la visibilité, localisation discrète, exposition minimale des infos personnelles."}
                  </p>
                </div>

                <div className="rounded-3xl border border-border bg-gradient-to-br from-card via-card to-primary/5 p-5 shadow-sm hover:shadow-lg transition-shadow">
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    <Sparkles className="w-4 h-4 text-primary" />
                    {lang === "en" ? "Modern UX" : "UX moderne"}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {lang === "en"
                      ? "Fast, readable and consistent across mobile/desktop. Clear CTAs, structured sections, premium look."
                      : "Rapide, lisible et cohérente mobile/desktop. CTA clairs, sections structurées, rendu premium."}
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Demo: profiles preview (anonymous) */}
          <section id="profiles" className="relative py-14">
            <div className="absolute inset-0 -z-10 opacity-50 [background:radial-gradient(circle_at_15%_20%,hsl(var(--primary))_0%,transparent_45%),radial-gradient(circle_at_95%_65%,hsl(var(--primary))_0%,transparent_55%)]" />
            <div className="mx-auto max-w-6xl px-6">
              <FadeInSection>
                <div className="max-w-2xl space-y-3">
                  <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs text-foreground">
                    <Users className="w-4 h-4 text-primary" />
                    {lang === "en" ? "Anonymous profiles preview" : "Aperçu profils anonymes"}
                  </div>
                  <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
                    {lang === "en"
                      ? "Show how it works — without exposing real profiles"
                      : "Montrer comment ça marche — sans exposer de vrais profils"}
                  </h2>
                  <p className="text-muted-foreground">
                    {lang === "en"
                      ? "A clean, vertical flow with anonymous cards. Just a demonstration of the experience."
                      : "Un flow vertical propre avec des cartes anonymes. Juste une démonstration de l’expérience."}
                  </p>
                </div>
              </FadeInSection>

              <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                {demoProfiles.map((p) => (
                  <FadeInSection key={p.id}>
                    <div className="rounded-3xl border border-border bg-gradient-to-br from-card via-card to-primary/5 overflow-hidden shadow-sm hover:shadow-lg transition-shadow">
                      <div className="relative aspect-[16/10] md:aspect-[4/5]">
                        <img src={p.photoUrl} alt={p.name} className="absolute inset-0 w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                        <div className="absolute top-4 left-4 right-4 flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-black/35 border border-white/15 backdrop-blur-sm text-xs text-white">
                            <MapPin className="w-3.5 h-3.5" />
                            {p.city}
                          </div>
                          {p.verified && (
                            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-black/35 border border-white/15 backdrop-blur-sm text-xs text-white">
                              <BadgeCheck className="w-3.5 h-3.5 text-primary" />
                              {lang === "en" ? "Verified" : "Vérifié"}
                            </div>
                          )}
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 p-5">
                          <div className="flex items-center gap-3">
                            <img
                              src={avatarUrl}
                              alt="avatar"
                              className="w-10 h-10 rounded-2xl border border-white/15 bg-black/30"
                            />
                            <div className="text-white">
                              <div className="text-lg font-bold tracking-tight">{p.name}</div>
                              <div className="text-xs text-white/70">
                                {lang === "en" ? "Demo profile (anonymous)" : "Profil démo (anonyme)"}
                              </div>
                            </div>
                          </div>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {p.tags.slice(0, 3).map((tag) => (
                              <span
                                key={tag}
                                className="px-3 py-1 rounded-full text-[11px] font-medium bg-white/10 text-white/85 border border-white/10"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </FadeInSection>
                ))}
              </div>
            </div>
          </section>

          {/* Services */}
          <section id="services" className="relative py-14">
            <div className="absolute inset-0 -z-10 opacity-50 [background:radial-gradient(circle_at_10%_10%,hsl(var(--primary))_0%,transparent_45%),radial-gradient(circle_at_95%_60%,hsl(var(--primary))_0%,transparent_55%)]" />
            <div className="mx-auto max-w-6xl px-6">
              <div className="max-w-2xl space-y-3">
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
                {lang === "en" ? "Services — explained clearly" : "Services — expliqués clairement"}
              </h2>
              <p className="text-muted-foreground">
                {lang === "en"
                  ? "A home page should sell the experience in seconds. Here are the core pillars, with clear benefits."
                  : "Une home doit “vendre” l’expérience en quelques secondes. Voici les piliers, avec des bénéfices clairs."}
              </p>
                </div>

              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {services.map((s) => (
                  <div
                    key={s.title}
                    className="group rounded-3xl border border-border bg-gradient-to-br from-card via-card to-primary/5 p-6 shadow-sm hover:shadow-lg transition-shadow"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
                        <s.icon className="w-5 h-5 text-primary" />
                      </div>
                      <div className="font-semibold text-foreground">{s.title}</div>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{s.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <Separator />

          {/* Demo: search experience (illustration) */}
          <section id="search" className="relative py-14">
            <div className="absolute inset-0 -z-10 opacity-45 [background:radial-gradient(circle_at_20%_10%,hsl(var(--primary))_0%,transparent_45%),radial-gradient(circle_at_90%_70%,hsl(var(--primary))_0%,transparent_55%)]" />
            <div className="mx-auto max-w-6xl px-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                <FadeInSection className="lg:col-span-5 space-y-3">
                  <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs text-foreground">
                    <MapPin className="w-4 h-4 text-primary" />
                    {lang === "en" ? "Search & filters" : "Recherche & filtres"}
                  </div>
                  <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
                    {lang === "en"
                      ? "Guide the search in seconds"
                      : "Conduire la recherche en quelques secondes"}
                  </h2>
                  <p className="text-muted-foreground">
                    {lang === "en"
                      ? "A clear panel: distance, verification, VIP, and service choices — all under control."
                      : "Un panneau clair : distance, vérification, VIP, et choix de services — tout sous contrôle."}
                  </p>
                  <Button className="rounded-2xl" onClick={() => setLocation("/start")}>
                    {lang === "en" ? "Open search" : "Ouvrir la recherche"}
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </FadeInSection>

                <FadeInSection className="lg:col-span-7">
                  <div className="rounded-3xl border border-border bg-gradient-to-br from-card via-card to-primary/5 p-5 shadow-sm">
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-foreground">
                        {lang === "en" ? "Illustration" : "Illustration"}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {lang === "en" ? "Mobile-first" : "Mobile-first"}
                      </span>
                    </div>

                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="rounded-2xl border border-border bg-background/50 p-4">
                        <div className="text-xs font-semibold text-foreground">
                          {lang === "en" ? "Quick filters" : "Filtres rapides"}
                        </div>
                        <div className="mt-3 space-y-2 text-sm">
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">
                              {lang === "en" ? "Verified only" : "Profils vérifiés"}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-primary/10 border border-primary/20 text-foreground">
                              {lang === "en" ? "Optional" : "Optionnel"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">
                              {lang === "en" ? "VIP lounge" : "Salon VIP"}
                            </span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-primary/10 border border-primary/20 text-foreground">
                              {lang === "en" ? "Mixed" : "Mixte"}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-muted-foreground">
                              {lang === "en" ? "Distance" : "Distance"}
                            </span>
                            <span className="text-xs font-semibold text-foreground">
                              {settings.maxDistanceKm} km
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-border bg-background/50 p-4 overflow-hidden">
                        <div className="text-xs font-semibold text-foreground">
                          {lang === "en" ? "Result card" : "Carte résultat"}
                        </div>
                        <div className="mt-3 rounded-2xl overflow-hidden border border-border">
                          <div className="relative h-32">
                            <img src={img2} alt="result" className="absolute inset-0 w-full h-full object-cover" />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
                            <div className="absolute bottom-3 left-3 right-3">
                              <div className="text-white text-sm font-semibold">
                                {lang === "en" ? "Anonymous profile" : "Profil anonyme"}
                              </div>
                              <div className="text-white/70 text-xs">
                                {lang === "en" ? "Nearby • Verified media" : "À proximité • Médias vérifiés"}
                              </div>
                            </div>
                          </div>
                          <div className="p-3 flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">
                              {lang === "en" ? "Open details" : "Voir la fiche"}
                            </span>
                            <ChevronRight className="w-4 h-4 text-muted-foreground" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </FadeInSection>
              </div>
            </div>
          </section>

          <Separator />

          {/* Demo: adult products preview */}
          <section id="products" className="relative py-14">
            <div className="absolute inset-0 -z-10 opacity-45 [background:radial-gradient(circle_at_15%_20%,hsl(var(--primary))_0%,transparent_48%),radial-gradient(circle_at_90%_10%,hsl(var(--primary))_0%,transparent_55%)]" />
            <div className="mx-auto max-w-6xl px-6">
              <FadeInSection>
                <div className="max-w-2xl space-y-3">
                  <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 border border-primary/20 px-3 py-1 text-xs text-foreground">
                    <Store className="w-4 h-4 text-primary" />
                    {lang === "en" ? "Adult products preview" : "Aperçu produits adultes"}
                  </div>
                  <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
                    {lang === "en" ? "Premium product presentation" : "Présentation produit premium"}
                  </h2>
                  <p className="text-muted-foreground">
                    {lang === "en"
                      ? "Clean cards: image, tag, short description and price — without vulgarity."
                      : "Cartes propres : image, tag, description courte et prix — sans vulgarité."}
                  </p>
                </div>
              </FadeInSection>

              <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {maleProducts.slice(0, 3).map((p) => (
                  <FadeInSection key={p.id}>
                    <div className="rounded-3xl border border-border bg-gradient-to-br from-card via-card to-primary/5 overflow-hidden shadow-sm hover:shadow-lg transition-shadow">
                      <div className="relative h-44">
                        <img src={p.imageUrl} alt={p.name} className="absolute inset-0 w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                        <div className="absolute bottom-3 left-3 right-3">
                          <div className="text-white text-sm font-semibold">{p.name}</div>
                          <div className="text-white/75 text-xs">{p.tag}</div>
                        </div>
                      </div>
                      <div className="p-5 space-y-2">
                        <div className="text-xs text-muted-foreground">{p.subtitle}</div>
                        <div className="text-sm text-muted-foreground line-clamp-2">{p.description}</div>
                        <div className="pt-2 flex items-center justify-between">
                          <span className="text-sm font-semibold text-foreground">{p.price}</span>
                          <Button
                            variant="outline"
                            className="rounded-2xl"
                            onClick={() => setLocation("/adult-products")}
                          >
                            {lang === "en" ? "View" : "Voir"}
                            <ChevronRight className="w-4 h-4 ml-1" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </FadeInSection>
                ))}
              </div>
            </div>
          </section>

          {/* How it works */}
          <section id="how" className="relative py-14">
            <div className="absolute inset-0 -z-10 opacity-50 [background:radial-gradient(circle_at_15%_30%,hsl(var(--primary))_0%,transparent_45%),radial-gradient(circle_at_95%_10%,hsl(var(--primary))_0%,transparent_55%)]" />
            <div className="mx-auto max-w-6xl px-6">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
                <div className="lg:col-span-5 space-y-3">
                  <h2 className="text-2xl md:text-3xl font-bold tracking-tight">
                    {lang === "en" ? "How it works" : "Comment ça marche"}
                  </h2>
                  <p className="text-muted-foreground">
                    {lang === "en"
                      ? "A simple flow: you enter, you understand, you act. No messy layout."
                      : "Un flow simple : tu arrives, tu comprends, tu agis. Sans mise en page brouillonne."}
                  </p>
                </div>
                <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="rounded-3xl border border-border bg-gradient-to-br from-card via-card to-primary/5 p-6 shadow-sm hover:shadow-lg transition-shadow">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                      {lang === "en" ? "1) Create your space" : "1) Crée ton espace"}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {lang === "en"
                        ? "Pick your account type, add media, and set visibility in minutes."
                        : "Choisis ton type de compte, ajoute tes médias, et règle ta visibilité en quelques minutes."}
                    </p>
                  </div>
                  <div className="rounded-3xl border border-border bg-gradient-to-br from-card via-card to-primary/5 p-6 shadow-sm hover:shadow-lg transition-shadow">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                      {lang === "en" ? "2) Describe services" : "2) Décris tes services"}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {lang === "en"
                        ? "Clear titles, details, availability and pricing give visitors confidence."
                        : "Titres clairs, détails, disponibilités et tarifs donnent confiance aux visiteurs."}
                    </p>
                  </div>
                  <div className="rounded-3xl border border-border bg-gradient-to-br from-card via-card to-primary/5 p-6 shadow-sm hover:shadow-lg transition-shadow">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                      {lang === "en" ? "3) Get discovered nearby" : "3) Sois découvert à proximité"}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {lang === "en"
                        ? "Location filters are discreet, the experience stays smooth."
                        : "Les filtres de localisation restent discrets, l’expérience reste fluide."}
                    </p>
                  </div>
                  <div className="rounded-3xl border border-border bg-gradient-to-br from-card via-card to-primary/5 p-6 shadow-sm hover:shadow-lg transition-shadow">
                    <div className="flex items-center gap-2 text-sm font-semibold">
                      <CheckCircle2 className="w-4 h-4 text-primary" />
                      {lang === "en" ? "4) Keep control" : "4) Garde le contrôle"}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      {lang === "en"
                        ? "Update your content anytime. Visibility and contact preferences are yours."
                        : "Mets à jour quand tu veux. Visibilité et préférences de contact t’appartiennent."}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <Separator />

          {/* FAQ */}
          <section id="faq" className="mx-auto max-w-6xl px-6 py-14">
            <div className="max-w-2xl space-y-3">
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight">FAQ</h2>
              <p className="text-muted-foreground">
                {lang === "en"
                  ? "A few clear answers, to reduce hesitation."
                  : "Quelques réponses claires, pour lever les hésitations."}
              </p>
            </div>

            <div className="mt-8 rounded-3xl border border-border bg-card p-2 md:p-4">
              <Accordion type="single" collapsible>
                <AccordionItem value="item-1">
                  <AccordionTrigger>
                    {lang === "en" ? "Do I need an account to explore?" : "Faut-il un compte pour explorer ?"}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {lang === "en"
                      ? "You can explore without creating a space. Some actions may require accepting conditions first."
                      : "Tu peux explorer sans créer d’espace. Certaines actions demandent d’accepter les conditions au préalable."}
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-2">
                  <AccordionTrigger>
                    {lang === "en" ? "How is privacy handled?" : "Comment la confidentialité est gérée ?"}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {lang === "en"
                      ? "The platform is designed to minimize exposure of personal data and keep location discreet."
                      : "La plateforme est conçue pour limiter l’exposition des données et garder la localisation discrète."}
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="item-3">
                  <AccordionTrigger>
                    {lang === "en" ? "Can I edit my content later?" : "Puis-je modifier mon contenu plus tard ?"}
                  </AccordionTrigger>
                  <AccordionContent className="text-muted-foreground">
                    {lang === "en"
                      ? "Yes. You can update your media, services, visibility and announcements at any time."
                      : "Oui. Tu peux modifier tes médias, services, visibilité et annonces à tout moment."}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </section>

          <SiteFooter />
        </div>
      )}

      {!showAgeModal && !consent.cookiesOk && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-card/95 border-t border-border backdrop-blur z-[60]">
          <div className="max-w-xl mx-auto flex items-center justify-between gap-4">
            <div className="text-sm">
              <p className="font-medium text-foreground">{t("cookiesTitle")}</p>
              <p className="text-muted-foreground">{t("cookiesText")}</p>
            </div>
            <Button
              className="shrink-0"
              onClick={() => setConsent((prev) => ({ ...prev, cookiesOk: true }))}
              data-testid="button-accept-cookies"
            >
              {t("accept")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
export default function Home() {
  return <LandingPage />;
}