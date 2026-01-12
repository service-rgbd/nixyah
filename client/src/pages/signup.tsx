import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { ArrowLeft, ArrowRight, User, Calendar, MapPin, Lock, Check, Shield, Mail, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { apiRequest, API_BASE_URL } from "@/lib/queryClient";
import { setSessionIds } from "@/lib/session";
import { getProfileId } from "@/lib/session";
import { cityOptions } from "@/lib/cities";
import { toast } from "@/hooks/use-toast";
import { Turnstile } from "@/components/turnstile";
import logoTitle from "@assets/logo-titre.png";

type Gender = "homme" | "femme" | null;

interface FormData {
  gender: Gender;
  age: string;
  ville: string;
  villePreset: string;
  quartier: string;
  accountType: "profile" | "residence" | "salon" | "adult_shop";
  username: string;
  pseudo: string;
  password: string;
  email: string;
}

const steps = [
  { id: 1, title: "Genre", icon: User },
  { id: 2, title: "Profil", icon: Calendar },
  { id: 3, title: "Compte", icon: Lock },
];

export default function Signup() {
  const [, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState(1);
  const [emailLocked, setEmailLocked] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    gender: null,
    age: "",
    ville: "",
    villePreset: "",
    quartier: "",
    accountType: "profile",
    username: "",
    pseudo: "",
    password: "",
    email: "",
  });
  const [ageConfirmed, setAgeConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const turnstileEnabled = Boolean((import.meta as any).env?.VITE_TURNSTILE_SITE_KEY);

  const progress = (currentStep / steps.length) * 100;

  const publicNameLabel =
    formData.accountType === "residence"
      ? "Nom de Résidence"
      : formData.accountType === "salon"
      ? "Nom du SPA / salon"
      : formData.accountType === "adult_shop"
      ? "Nom de la boutique"
      : "Pseudo";

  const publicNamePlaceholder =
    formData.accountType === "residence"
      ? "Ex: Résidence Eden"
      : formData.accountType === "salon"
      ? "Ex: Spa Lumière"
      : formData.accountType === "adult_shop"
      ? "Ex: Boutique Intime"
      : "Choisissez un pseudo";

  const publicNameHelper =
    formData.accountType === "profile"
      ? "Ce nom est visible publiquement. Ne mettez pas votre identifiant de connexion ici."
      : "Ce nom est visible publiquement (il remplace le pseudo).";

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return formData.gender !== null && ageConfirmed;
      case 2:
        return formData.age && formData.ville;
      case 3:
        return (
          formData.username.trim().length >= 4 &&
          formData.pseudo.trim().length >= 2 &&
          formData.username.trim() !== formData.pseudo.trim() &&
          formData.password.length >= 6
        );
      default:
        return false;
    }
  };

  const handleNext = () => {
    if (currentStep < 3) {
      setCurrentStep(currentStep + 1);
    } else {
      void handleSubmit();
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    } else {
      setLocation("/start");
    }
  };

  useEffect(() => {
    if (getProfileId()) setLocation("/dashboard");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Prefill email after Google OAuth if needed (user didn't exist yet).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const url = new URL(window.location.href);
        const oauth = url.searchParams.get("oauth");
        if (oauth !== "google") return;

        const res = await apiRequest("GET", "/api/auth/pending");
        const json = await res.json();
        const email = typeof json?.email === "string" ? json.email : "";
        if (!email) return;
        if (cancelled) return;

        setFormData((prev) => ({ ...prev, email }));
        setEmailLocked(true);
        toast({
          title: "Email Google récupéré",
          description: "Ton email a été vérifié par Google. Termine l’inscription pour créer ton profil.",
        });
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleSubmit = async () => {
    setSubmitError(null);
    if (turnstileEnabled && !turnstileToken) {
      setSubmitError("Valide le contrôle anti-bot (Turnstile) avant de créer ton compte.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await apiRequest("POST", "/api/signup", {
        gender: formData.gender,
        age: formData.age,
        ville: formData.ville,
        lieu: formData.quartier || undefined,
        accountType: formData.accountType,
        username: formData.username.trim(),
        pseudo: formData.pseudo.trim(),
        password: formData.password,
        email: formData.email || undefined,
        turnstileToken,
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.message ?? "Erreur lors de l'inscription");
      }
      setSessionIds({ userId: json.userId, profileId: json.profile.id });

      const providedEmail = formData.email.trim().length > 0;
      if (providedEmail) {
        if (json?.verificationEmailSent === true) {
          toast({
            title: "Email de confirmation envoyé",
            description: "Vérifie ta boîte mail (et les spams) puis clique sur le lien.",
          });
        } else if (json?.verificationEmailSent === false) {
          toast({
            title: "Email de confirmation non envoyé",
            description:
              json?.verificationEmailError ??
              "Impossible d’envoyer l’email pour le moment. Tu pourras réessayer depuis ton dashboard.",
          });
        }
      }
      setLocation("/post-intent");
    } catch (e: any) {
      setSubmitError(e?.message ?? "Erreur lors de l'inscription");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignup = () => {
    const state = encodeURIComponent("/signup?oauth=google");
    window.location.href = `${API_BASE_URL}/api/auth/google?state=${state}`;
  };

  const slideVariants = {
    enter: (direction: number) => ({
      x: direction > 0 ? 300 : -300,
      opacity: 0,
    }),
    center: {
      x: 0,
      opacity: 1,
    },
    exit: (direction: number) => ({
      x: direction < 0 ? 300 : -300,
      opacity: 0,
    }),
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="flex items-center justify-between px-6 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-3">
        <button 
          onClick={handleBack}
          className="w-10 h-10 rounded-full bg-card flex items-center justify-center"
          data-testid="button-back-signup"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <img
          src={logoTitle}
          alt="NIXYAH"
          className="h-10 sm:h-12 w-auto object-contain"
          draggable={false}
        />
        <div className="w-10" />
      </header>

      <div className="px-6 py-2">
        <Progress value={progress} className="h-1" />
        <div className="flex justify-between mt-3">
          {steps.map((step) => (
            <div 
              key={step.id}
              className={`flex items-center gap-1.5 ${
                currentStep >= step.id ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <step.icon className="w-4 h-4" />
              <span className="text-xs hidden sm:inline">{step.title}</span>
            </div>
          ))}
        </div>
      </div>

      <main className="flex-1 px-4 py-6 overflow-hidden">
        <div className="max-w-md mx-auto rounded-3xl border border-border bg-card/70 backdrop-blur p-5 shadow-lg">
        <AnimatePresence mode="wait" custom={1}>
          {currentStep === 1 && (
            <motion.div
              key="step1"
              custom={1}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="space-y-8"
            >
              <div className="text-center space-y-2">
                <h2 className="font-display text-3xl font-semibold text-foreground">
                  Bienvenue
                </h2>
                <p className="text-muted-foreground">
                  Choisissez votre profil pour commencer
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setFormData({ ...formData, gender: "femme" })}
                  className={`p-6 rounded-2xl border-2 transition-all ${
                    formData.gender === "femme"
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card hover:border-primary/50"
                  }`}
                  data-testid="button-gender-femme"
                >
                  <div className="text-4xl mb-2">👩</div>
                  <span className="font-medium text-foreground">Femme</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setFormData({ ...formData, gender: "homme" })}
                  className={`p-6 rounded-2xl border-2 transition-all ${
                    formData.gender === "homme"
                      ? "border-primary bg-primary/10"
                      : "border-border bg-card hover:border-primary/50"
                  }`}
                  data-testid="button-gender-homme"
                >
                  <div className="text-4xl mb-2">👨</div>
                  <span className="font-medium text-foreground">Homme</span>
                </motion.button>
              </div>

              <motion.button
                whileTap={{ scale: 0.98 }}
                onClick={() => setAgeConfirmed(!ageConfirmed)}
                className={`w-full p-4 rounded-2xl border-2 flex items-center gap-3 transition-all ${
                  ageConfirmed
                    ? "border-primary bg-primary/10"
                    : "border-border bg-card"
                }`}
                data-testid="button-age-confirm"
              >
                <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center ${
                  ageConfirmed ? "border-primary bg-primary" : "border-muted-foreground"
                }`}>
                  {ageConfirmed && <Check className="w-4 h-4 text-white" />}
                </div>
                <div className="flex-1 text-left">
                  <span className="text-foreground font-medium">Je confirme avoir +18 ans</span>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Plateforme réservée aux adultes
                  </p>
                </div>
                <Shield className="w-5 h-5 text-primary" />
              </motion.button>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-foreground">
                  Type de compte
                </h3>
                <p className="text-xs text-muted-foreground">
                  Tu peux créer un profil personnel pour poster des annonces, ou déclarer un
                  établissement (résidence meublée, SPA, boutique produits adultes).
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() =>
                      setFormData((prev) => ({ ...prev, accountType: "profile" }))
                    }
                    className={`p-4 rounded-2xl border-2 text-left text-xs space-y-1 ${
                      formData.accountType === "profile"
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card hover:border-primary/40"
                    }`}
                  >
                    <span className="text-[11px] font-semibold text-foreground">
                      Profil personnel
                    </span>
                    <p className="text-[11px] text-muted-foreground">
                      Annonces, rencontres et espace privé.
                    </p>
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() =>
                      setFormData((prev) => ({ ...prev, accountType: "residence" }))
                    }
                    className={`p-4 rounded-2xl border-2 text-left text-xs space-y-1 ${
                      formData.accountType === "residence"
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card hover:border-primary/40"
                    }`}
                  >
                    <span className="text-[11px] font-semibold text-foreground">
                      Résidence meublée
                    </span>
                    <p className="text-[11px] text-muted-foreground">
                      Appartements / chambres pour accueillir les rendez-vous.
                    </p>
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() =>
                      setFormData((prev) => ({ ...prev, accountType: "salon" }))
                    }
                    className={`p-4 rounded-2xl border-2 text-left text-xs space-y-1 ${
                      formData.accountType === "salon"
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card hover:border-primary/40"
                    }`}
                  >
                    <span className="text-[11px] font-semibold text-foreground">
                      Salon / SPA / massages
                    </span>
                    <p className="text-[11px] text-muted-foreground">
                      Établissement de massages privés ou SPA.
                    </p>
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() =>
                      setFormData((prev) => ({ ...prev, accountType: "adult_shop" }))
                    }
                    className={`p-4 rounded-2xl border-2 text-left text-xs space-y-1 ${
                      formData.accountType === "adult_shop"
                        ? "border-primary bg-primary/10"
                        : "border-border bg-card hover:border-primary/40"
                    }`}
                  >
                    <span className="text-[11px] font-semibold text-foreground">
                      Vente produits adultes
                    </span>
                    <p className="text-[11px] text-muted-foreground">
                      Boutique pour préservatifs, lubrifiants, sextoys, etc.
                    </p>
                  </motion.button>
                </div>
              </div>
            </motion.div>
          )}

          {currentStep === 2 && (
            <motion.div
              key="step2"
              custom={1}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="space-y-8"
            >
              <div className="text-center space-y-2">
                <h2 className="font-display text-3xl font-semibold text-foreground">
                  Votre profil
                </h2>
                <p className="text-muted-foreground">
                  Quelques informations de base
                </p>
              </div>

              <div className="space-y-6">
                <div className="space-y-2">
                  <Label htmlFor="age" className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    Âge
                  </Label>
                  <Input
                    id="age"
                    type="number"
                    min="18"
                    max="99"
                    placeholder="Votre âge"
                    value={formData.age}
                    onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                    className="h-14 text-lg"
                    data-testid="input-age"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ville" className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    Ville
                  </Label>
                  <Select
                    value={formData.villePreset}
                    onValueChange={(v) => {
                      if (v === "__other__") {
                        setFormData({ ...formData, villePreset: v, ville: "" });
                      } else {
                        setFormData({ ...formData, villePreset: v, ville: v });
                      }
                    }}
                  >
                    <SelectTrigger className="h-14 text-lg" data-testid="select-ville">
                      <SelectValue placeholder="Sélectionner une ville" />
                    </SelectTrigger>
                    <SelectContent>
                      {cityOptions.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                      <SelectItem value="__other__">Autre…</SelectItem>
                    </SelectContent>
                  </Select>

                  {formData.villePreset === "__other__" && (
                    <Input
                      id="ville"
                      type="text"
                      placeholder="Votre ville"
                      value={formData.ville}
                      onChange={(e) => setFormData({ ...formData, ville: e.target.value })}
                      className="h-14 text-lg"
                      data-testid="input-ville"
                    />
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="quartier" className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-muted-foreground" />
                    Quartier / commune
                  </Label>
                  <Input
                    id="quartier"
                    type="text"
                    placeholder="Votre quartier (ex: Bonapriso, Angré, etc.)"
                    value={formData.quartier}
                    onChange={(e) => setFormData({ ...formData, quartier: e.target.value })}
                    className="h-14 text-lg"
                    data-testid="input-quartier"
                  />
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[11px] text-muted-foreground">
                      Utiliser ma localisation précise (GPS)
                    </span>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 px-3 text-[11px]"
                      disabled={geoLoading}
                      onClick={() => {
                        if (!navigator.geolocation) {
                          setSubmitError(
                            "La géolocalisation n'est pas disponible sur ce navigateur.",
                          );
                          return;
                        }
                        setGeoLoading(true);
                        navigator.geolocation.getCurrentPosition(
                          async (pos) => {
                            try {
                              const lat = pos.coords.latitude;
                              const lng = pos.coords.longitude;
                              const r = await fetch(
                                `${API_BASE_URL}/api/geo/reverse?lat=${encodeURIComponent(
                                  lat,
                                )}&lng=${encodeURIComponent(lng)}`,
                              );
                              if (!r.ok) {
                                throw new Error();
                              }
                              const data = (await r.json()) as {
                                country?: string | null;
                                city?: string | null;
                                district?: string | null;
                                road?: string | null;
                              };
                              const city = data.city ?? "";
                              const district = data.district ?? "";
                              const road = data.road ?? "";

                              setFormData((prev) => ({
                                ...prev,
                                villePreset:
                                  city &&
                                  cityOptions.includes(
                                    city as (typeof cityOptions)[number],
                                  )
                                    ? city
                                    : "__other__",
                                ville: city || prev.ville,
                                quartier:
                                  [district, road].filter(Boolean).join(" • ") ||
                                  prev.quartier,
                              }));
                            } catch {
                              setSubmitError(
                                "Impossible de déterminer automatiquement ta ville. Tu peux remplir la ville et le quartier manuellement.",
                              );
                            } finally {
                              setGeoLoading(false);
                            }
                          },
                          () => {
                            setGeoLoading(false);
                            setSubmitError(
                              "Permission de localisation refusée. Tu peux remplir la ville et le quartier manuellement.",
                            );
                          },
                          { enableHighAccuracy: false, timeout: 8000 },
                        );
                      }}
                    >
                      {geoLoading ? "Localisation..." : "Autoriser"}
                    </Button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {currentStep === 3 && (
            <motion.div
              key="step3"
              custom={1}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="space-y-8"
            >
              <div className="text-center space-y-2">
                <h2 className="font-display text-3xl font-semibold text-foreground">
                  Votre compte
                </h2>
                <p className="text-muted-foreground">
                  Créez votre identité anonyme
                </p>
              </div>

              <div className="space-y-6">
                <div className="space-y-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full h-12 rounded-2xl gap-2"
                    onClick={handleGoogleSignup}
                  >
                    <Sparkles className="w-4 h-4 text-primary" />
                    <span className="text-sm font-medium">S’inscrire avec Google</span>
                  </Button>
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-[11px]">
                      <span className="bg-card/70 px-2 text-muted-foreground">
                        ou créer un compte manuellement
                      </span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="username" className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    Identifiant de connexion
                  </Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="Identifiant (non visible publiquement)"
                    value={formData.username}
                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                    className="h-14 text-lg"
                  />
                  <p className="text-xs text-muted-foreground">
                    Utilisé uniquement pour te connecter. Ne sera jamais affiché publiquement.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pseudo" className="flex items-center gap-2">
                    <User className="w-4 h-4 text-muted-foreground" />
                    {publicNameLabel}
                  </Label>
                  <Input
                    id="pseudo"
                    type="text"
                    placeholder={publicNamePlaceholder}
                    value={formData.pseudo}
                    onChange={(e) => setFormData({ ...formData, pseudo: e.target.value })}
                    className="h-14 text-lg"
                    data-testid="input-pseudo"
                  />
                  <p className="text-xs text-muted-foreground">
                    {publicNameHelper}
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    Email {emailLocked ? "(Google vérifié)" : "(optionnel)"}
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="Ton email pour récupérer ton mot de passe"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="h-14 text-lg"
                    disabled={emailLocked}
                  />
                  <p className="text-xs text-muted-foreground">
                    Non affiché sur ton profil. Utilisé pour récupérer ton mot de passe et confirmer ta publication.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="flex items-center gap-2">
                    <Lock className="w-4 h-4 text-muted-foreground" />
                    Mot de passe
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Minimum 6 caractères"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="h-14 text-lg"
                    data-testid="input-password"
                  />
                </div>

                <Turnstile
                  action="signup"
                  className="pt-1 flex justify-center"
                  onToken={(tok) => setTurnstileToken(tok)}
                />
              </div>
            </motion.div>
          )}

          {submitError && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-sm text-destructive">
              {submitError}
            </div>
          )}
        </AnimatePresence>
        </div>
      </main>

      <div className="px-6 pb-8 pt-4">
        <Button
          onClick={handleNext}
          disabled={!canProceed() || submitting}
          className="w-full h-14 text-base font-medium gap-2"
          data-testid="button-next"
        >
          {currentStep === 3 ? (submitting ? "Création..." : "Créer mon profil") : "Continuer"}
          <ArrowRight className="w-5 h-5" />
        </Button>
      </div>
    </div>
  );
}