import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Calendar, Check, Lock, Mail, MapPin, Shield, Sparkles, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch, apiGetJson, apiRequest, API_BASE_URL, queryClient } from "@/lib/queryClient";
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

const accountTypeOptions: Array<{
  value: FormData["accountType"];
  title: string;
  description: string;
}> = [
  {
    value: "profile",
    title: "Profil personnel",
    description: "Annonces, rencontres et espace privé.",
  },
  {
    value: "residence",
    title: "Résidence meublée",
    description: "Appartements ou chambres pour accueillir les rendez-vous.",
  },
  {
    value: "salon",
    title: "Salon / SPA / massages",
    description: "Établissement de massages privés ou SPA.",
  },
  {
    value: "adult_shop",
    title: "Vente produits adultes",
    description: "Boutique pour préservatifs, lubrifiants, sextoys et accessoires.",
  },
];

export default function Signup() {
  const [, setLocation] = useLocation();
  const [emailLocked, setEmailLocked] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileRequired, setTurnstileRequired] = useState(false);
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
  const [termsConfirmed, setTermsConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);
  const siteKey = (import.meta as any).env?.VITE_TURNSTILE_SITE_KEY as string | undefined;
  const hasSiteKey = Boolean(siteKey && String(siteKey).trim().length > 0);
  const oauthFromUrl = useMemo(() => {
    try {
      const url = new URL(window.location.href);
      return url.searchParams.get("oauth");
    } catch {
      return null;
    }
  }, []);
  const showGoogleSignup = !emailLocked && formData.email.trim().length === 0 && oauthFromUrl !== "google";

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
  const emailTrimmed = formData.email.trim();
  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed);

  const canSubmit =
    formData.gender !== null &&
    ageConfirmed &&
    Number(formData.age) >= 18 &&
    formData.ville.trim().length > 0 &&
    formData.username.trim().length >= 4 &&
    formData.pseudo.trim().length >= 2 &&
    formData.username.trim() !== formData.pseudo.trim() &&
    formData.password.length >= 8 &&
    emailLooksValid &&
    termsConfirmed;

  const handleBack = () => {
    setLocation("/start");
  };

  useEffect(() => {
    if (getProfileId()) setLocation("/dashboard");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiGetJson<{ turnstileRequired?: boolean }>("/api/support");
        if (!cancelled) setTurnstileRequired(Boolean(data.turnstileRequired));
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
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
    if (turnstileRequired && !hasSiteKey) {
      setSubmitError("Turnstile est activé côté serveur, mais VITE_TURNSTILE_SITE_KEY manque côté Cloudflare.");
      return;
    }
    if (turnstileRequired && !turnstileToken) {
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
        acceptTerms: termsConfirmed,
        ...(turnstileToken ? { turnstileToken } : {}),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.message ?? "Erreur lors de l'inscription");
      }
      queryClient.clear();
      setSessionIds(
        { userId: json.userId, profileId: json.profile.id },
        json.csrfToken ?? null,
        json.sessionToken ?? null,
      );

      if (json?.verificationEmailSent === true) {
        toast({
          title: "Email de confirmation envoyé",
          description: "Vérifie ta boîte mail puis valide ton adresse avant de continuer.",
        });
      } else if (json?.verificationEmailSent === false) {
        toast({
          title: "Validation email à terminer",
          description:
            json?.verificationEmailError ??
            "L’envoi initial a échoué. Tu pourras relancer l’envoi depuis l’écran de vérification.",
        });
      }
      if (emailLocked) {
        setLocation("/post-intent");
      } else {
        setLocation("/email/verify");
      }
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

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-3 sm:px-6">
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

      <main className="px-4 pb-10 pt-4">
        <form
          className="mx-auto max-w-2xl space-y-8"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
        >
          <section className="space-y-2 border-b border-border/70 pb-6 text-center sm:text-left">
            <h1 className="font-display text-3xl font-semibold text-foreground">
              Créer un compte
            </h1>
            <p className="text-sm text-muted-foreground sm:text-base">
              Inscription directe, sans étapes inutiles. Les mêmes données sont envoyées, mais en une seule vue.
            </p>
          </section>

          <section className="space-y-5 border-b border-border/70 pb-7">
            <div className="mb-4 space-y-1">
              <h2 className="text-base font-semibold text-foreground">Profil</h2>
              <p className="text-sm text-muted-foreground">
                Choisis le type de profil, confirme ton âge et indique les bases de ton annonce.
              </p>
            </div>

            <div className="space-y-5">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  Genre
                </Label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, gender: "femme" }))}
                    className={`rounded-2xl border px-4 py-4 text-sm font-medium transition-colors ${
                      formData.gender === "femme"
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-background text-muted-foreground"
                    }`}
                    data-testid="button-gender-femme"
                  >
                    Femme
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, gender: "homme" }))}
                    className={`rounded-2xl border px-4 py-4 text-sm font-medium transition-colors ${
                      formData.gender === "homme"
                        ? "border-primary bg-primary/10 text-foreground"
                        : "border-border bg-background text-muted-foreground"
                    }`}
                    data-testid="button-gender-homme"
                  >
                    Homme
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setAgeConfirmed((prev) => !prev)}
                className={`flex w-full items-center gap-3 rounded-2xl border px-4 py-4 text-left transition-colors ${
                  ageConfirmed
                    ? "border-primary bg-primary/10"
                    : "border-border bg-background"
                }`}
                data-testid="button-age-confirm"
              >
                <div
                  className={`flex h-6 w-6 items-center justify-center rounded-md border ${
                    ageConfirmed ? "border-primary bg-primary" : "border-muted-foreground"
                  }`}
                >
                  {ageConfirmed && <Check className="h-4 w-4 text-white" />}
                </div>
                <div className="flex-1">
                  <div className="font-medium text-foreground">Je confirme avoir 18 ans ou plus</div>
                  <div className="text-xs text-muted-foreground">Plateforme réservée aux adultes.</div>
                </div>
                <Shield className="h-5 w-5 text-primary" />
              </button>

              <div className="space-y-2">
                <Label>Type de compte</Label>
                <div className="grid gap-3 sm:grid-cols-2">
                  {accountTypeOptions.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() =>
                        setFormData((prev) => ({ ...prev, accountType: option.value }))
                      }
                      className={`rounded-2xl border p-4 text-left transition-colors ${
                        formData.accountType === option.value
                          ? "border-primary bg-primary/10"
                          : "border-border bg-background"
                      }`}
                    >
                      <div className="text-sm font-medium text-foreground">{option.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{option.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="age" className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    Âge
                  </Label>
                  <Input
                    id="age"
                    type="number"
                    min="18"
                    max="99"
                    placeholder="18+"
                    value={formData.age}
                    onChange={(e) => setFormData((prev) => ({ ...prev, age: e.target.value }))}
                    className="h-12"
                    data-testid="input-age"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="ville" className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    Ville
                  </Label>
                  <Select
                    value={formData.villePreset}
                    onValueChange={(value) => {
                      if (value === "__other__") {
                        setFormData((prev) => ({ ...prev, villePreset: value, ville: "" }));
                        return;
                      }
                      setFormData((prev) => ({ ...prev, villePreset: value, ville: value }));
                    }}
                  >
                    <SelectTrigger className="h-12" data-testid="select-ville">
                      <SelectValue placeholder="Sélectionner une ville" />
                    </SelectTrigger>
                    <SelectContent>
                      {cityOptions.map((city) => (
                        <SelectItem key={city} value={city}>
                          {city}
                        </SelectItem>
                      ))}
                      <SelectItem value="__other__">Autre…</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {formData.villePreset === "__other__" && (
                <div className="space-y-2">
                  <Label htmlFor="ville-custom">Ville personnalisée</Label>
                  <Input
                    id="ville-custom"
                    type="text"
                    placeholder="Votre ville"
                    value={formData.ville}
                    onChange={(e) => setFormData((prev) => ({ ...prev, ville: e.target.value }))}
                    className="h-12"
                    data-testid="input-ville"
                  />
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="quartier" className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    Quartier / commune
                  </Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-8 px-3 text-xs"
                    disabled={geoLoading}
                    onClick={() => {
                      if (!navigator.geolocation) {
                        setSubmitError("La géolocalisation n'est pas disponible sur ce navigateur.");
                        return;
                      }
                      setGeoLoading(true);
                      navigator.geolocation.getCurrentPosition(
                        async (pos) => {
                          try {
                            const lat = pos.coords.latitude;
                            const lng = pos.coords.longitude;
                            const response = await apiFetch(
                              `/api/geo/reverse?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`,
                            );
                            if (!response.ok) {
                              throw new Error();
                            }
                            const data = (await response.json()) as {
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
                                city && cityOptions.includes(city as (typeof cityOptions)[number])
                                  ? city
                                  : "__other__",
                              ville: city || prev.ville,
                              quartier: [district, road].filter(Boolean).join(" • ") || prev.quartier,
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
                    {geoLoading ? "Localisation..." : "Utiliser ma position"}
                  </Button>
                </div>
                <Input
                  id="quartier"
                  type="text"
                  placeholder="Ex: Bonapriso, Angré, Cocody..."
                  value={formData.quartier}
                  onChange={(e) => setFormData((prev) => ({ ...prev, quartier: e.target.value }))}
                  className="h-12"
                  data-testid="input-quartier"
                />
              </div>
            </div>
          </section>

          <section className="space-y-5 border-b border-border/70 pb-7">
            <div className="mb-4 space-y-1">
              <h2 className="text-base font-semibold text-foreground">Accès au compte</h2>
              <p className="text-sm text-muted-foreground">
                Crée ton accès et confirme ton email juste après l’inscription pour poursuivre.
              </p>
            </div>

            <div className="space-y-5">
              {showGoogleSignup && (
                <div className="space-y-3">
                  <Button
                    type="button"
                    variant="outline"
                    className="h-12 w-full gap-2 rounded-2xl"
                    onClick={handleGoogleSignup}
                  >
                    <Sparkles className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Continuer avec Google</span>
                  </Button>
                  <p className="text-center text-xs text-muted-foreground">
                    Ou remplis directement le formulaire ci-dessous.
                  </p>
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="username" className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    Identifiant de connexion
                  </Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="Non visible publiquement"
                    value={formData.username}
                    onChange={(e) => setFormData((prev) => ({ ...prev, username: e.target.value }))}
                    className="h-12"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="pseudo" className="flex items-center gap-2">
                    <User className="h-4 w-4 text-muted-foreground" />
                    {publicNameLabel}
                  </Label>
                  <Input
                    id="pseudo"
                    type="text"
                    placeholder={publicNamePlaceholder}
                    value={formData.pseudo}
                    onChange={(e) => setFormData((prev) => ({ ...prev, pseudo: e.target.value }))}
                    className="h-12"
                    data-testid="input-pseudo"
                  />
                </div>
              </div>

              <p className="text-xs text-muted-foreground">{publicNameHelper}</p>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    Email {emailLocked ? "(Google vérifié)" : "(obligatoire)"}
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="email@exemple.com"
                    value={formData.email}
                    onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
                    className="h-12"
                    disabled={emailLocked}
                  />
                  {!emailLocked && emailTrimmed.length > 0 && !emailLooksValid ? (
                    <p className="text-xs text-destructive">Entre une adresse email valide.</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="flex items-center gap-2">
                    <Lock className="h-4 w-4 text-muted-foreground" />
                    Mot de passe
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Minimum 8 caractères"
                    value={formData.password}
                    onChange={(e) => setFormData((prev) => ({ ...prev, password: e.target.value }))}
                    className="h-12"
                    data-testid="input-password"
                  />
                  {formData.password.length > 0 && formData.password.length < 8 ? (
                    <p className="text-xs text-destructive">Le mot de passe doit contenir au moins 8 caractères.</p>
                  ) : null}
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                L’identifiant sert uniquement à la connexion. L’email est requis pour confirmer ton compte et récupérer ton mot de passe.
              </p>

              <button
                type="button"
                onClick={() => setTermsConfirmed((prev) => !prev)}
                className={`flex w-full items-start gap-3 rounded-2xl border px-4 py-4 text-left transition-colors ${
                  termsConfirmed ? "border-primary bg-primary/10" : "border-border bg-background"
                }`}
              >
                <div
                  className={`mt-0.5 flex h-6 w-6 items-center justify-center rounded-md border ${
                    termsConfirmed ? "border-primary bg-primary" : "border-muted-foreground"
                  }`}
                >
                  {termsConfirmed && <Check className="h-4 w-4 text-white" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-foreground">
                    Je certifie avoir lu, relu, accepté et respecter les conditions d’utilisation ainsi que les règles d’inscription.
                  </div>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                    <button
                      type="button"
                      className="underline underline-offset-2"
                      onClick={(event) => {
                        event.stopPropagation();
                        setLocation("/conditions");
                      }}
                    >
                      Conditions d’utilisation
                    </button>
                    <button
                      type="button"
                      className="underline underline-offset-2"
                      onClick={(event) => {
                        event.stopPropagation();
                        setLocation("/privacy");
                      }}
                    >
                      Confidentialité
                    </button>
                  </div>
                </div>
                <Shield className="mt-0.5 h-5 w-5 text-primary" />
              </button>

              {turnstileRequired && (
                <>
                  {!hasSiteKey ? (
                    <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-xs text-destructive">
                      Turnstile est requis mais VITE_TURNSTILE_SITE_KEY n’est pas défini côté build Cloudflare.
                    </div>
                  ) : (
                    <Turnstile
                      action="signup"
                      className="flex justify-center pt-1"
                      onToken={(token) => setTurnstileToken(token)}
                    />
                  )}
                </>
              )}
            </div>
          </section>

          {submitError && (
            <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
              {submitError}
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button type="button" variant="outline" className="h-12 flex-1" onClick={handleBack}>
              Retour
            </Button>
            <Button
              type="submit"
              disabled={!canSubmit || submitting}
              className="h-12 flex-1 text-base font-medium"
              data-testid="button-next"
            >
              {submitting ? "Création..." : "Créer mon profil"}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}