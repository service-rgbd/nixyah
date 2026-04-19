import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Lock, Mail, Sparkles, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiGetJson, apiRequest, API_BASE_URL, queryClient } from "@/lib/queryClient";
import { setSessionIds } from "@/lib/session";
import { useI18n } from "@/lib/i18n";
import { Turnstile } from "@/components/turnstile";
import logoTitle from "@assets/logo-titre.png";

export default function Login() {
  const [, setLocation] = useLocation();
  const { lang, t } = useI18n();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetEmail, setResetEmail] = useState<string | null>(null);
  const [turnstileRequired, setTurnstileRequired] = useState(false);
  const siteKey = (import.meta as any).env?.VITE_TURNSTILE_SITE_KEY as string | undefined;
  const hasSiteKey = Boolean(siteKey && String(siteKey).trim().length > 0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiGetJson<{ resetEmail?: string | null; turnstileRequired?: boolean }>("/api/support");
        if (cancelled) return;
        setResetEmail(data.resetEmail ?? null);
        setTurnstileRequired(Boolean(data.turnstileRequired));
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const oauth = url.searchParams.get("oauth");
      if (!oauth) return;
      const map: Record<string, { fr: string; en: string }> = {
        google_error: { fr: "Connexion Google refusée.", en: "Google sign-in was canceled." },
        missing_code: { fr: "Code Google manquant. Réessaie.", en: "Missing Google code. Please retry." },
        token_error: { fr: "Erreur échange token Google. Vérifie la config Google.", en: "Google token exchange failed." },
        token_missing: { fr: "Token Google manquant. Réessaie.", en: "Missing Google access token." },
        userinfo_error: { fr: "Impossible de lire ton profil Google.", en: "Unable to fetch Google profile." },
        email_unverified: { fr: "Email Google non vérifié.", en: "Google email is not verified." },
        email_column_missing: { fr: "Email indisponible côté serveur (DB).", en: "Email column missing on server." },
        not_linked: { fr: "Aucun compte trouvé. Inscris-toi avec Google.", en: "No account found. Sign up with Google." },
        no_profile: { fr: "Compte sans profil. Contacte l’admin.", en: "Account has no profile." },
        server_error: { fr: "Erreur serveur OAuth. Réessaie.", en: "OAuth server error. Please retry." },
      };
      const msg = map[oauth];
      if (!msg) return;
      setError(lang === "en" ? msg.en : msg.fr);
    } catch {
      // ignore
    }
  }, [lang]);

  const handleLogin = async () => {
    setError(null);
    if (turnstileRequired && !hasSiteKey) {
      setError(
        lang === "en"
          ? "Security check is enabled on the server, but the frontend Turnstile site key is missing."
          : "La sécurité Turnstile est activée sur le serveur, mais la clé VITE_TURNSTILE_SITE_KEY manque côté Cloudflare.",
      );
      return;
    }
    if (turnstileRequired && !turnstileToken) {
      setError(lang === "en" ? "Please complete the anti-bot check." : "Valide le contrôle anti-bot (Turnstile).");
      return;
    }
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/login", {
        username,
        password,
        ...(turnstileToken ? { turnstileToken } : {}),
      });
      const json = await res.json();
      queryClient.clear();
      setSessionIds({ userId: json.userId, profileId: json.profileId }, json.csrfToken ?? null, json.sessionToken ?? null);
      setLocation("/dashboard");
    } catch (e: any) {
      setError(e?.message ?? (lang === "en" ? "Login failed" : "Connexion impossible"));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    const state = encodeURIComponent("/dashboard");
    window.location.href = `${API_BASE_URL}/api/auth/google?state=${state}`;
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] flex items-center justify-between sm:px-6">
        <button
          onClick={() => setLocation("/start")}
          className="w-9 h-9 rounded-full bg-card flex items-center justify-center border border-border"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <img
          src={logoTitle}
          alt="NIXYAH"
          className="h-10 sm:h-12 w-auto object-contain"
          draggable={false}
        />
        <div className="w-9" />
      </header>

      <main className="flex-1 px-4 pb-10 pt-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto flex w-full max-w-md flex-col"
        >
          <section className="space-y-2 border-b border-border/70 pb-6 text-center sm:text-left">
            <h1 className="text-3xl font-semibold text-foreground">
              {lang === "en" ? "Sign in" : "Connexion"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {lang === "en" ? "Access your secure space." : "Accède à ton compte en toute sécurité."}
            </p>
          </section>

          <div className="space-y-5 pt-6">
            {error && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-1">
              <Label htmlFor="username" className="text-xs text-muted-foreground">
                {lang === "en" ? "Login identifier or email" : "Identifiant de connexion ou email"}
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <Mail className="w-4 h-4" />
                </span>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="h-12 pl-10 rounded-full"
                  autoComplete="username"
                  placeholder={lang === "en" ? "Your login identifier or email" : "Ton identifiant de connexion ou email"}
                />
              </div>
            </div>

            <div className="space-y-1 border-b border-border/70 pb-6">
              <Label htmlFor="password" className="text-xs text-muted-foreground">
                {lang === "en" ? "Password" : "Mot de passe"}
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <Lock className="w-4 h-4" />
                </span>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 pl-10 rounded-full"
                  autoComplete="current-password"
                  placeholder={lang === "en" ? "Your password" : "Ton mot de passe"}
                />
              </div>
              <div className="flex items-center justify-between mt-1 text-[11px] text-muted-foreground">
                <span>{lang === "en" ? "Forgot password?" : "Mot de passe oublié ?"}</span>
                <button
                  type="button"
                  className="text-primary underline-offset-2 hover:underline"
                  onClick={() => setLocation("/password/forgot")}
                >
                  {lang === "en" ? "Reset my password" : "Réinitialiser mon mot de passe"}
                </button>
              </div>
            </div>

            {turnstileRequired && (
              <>
                {!hasSiteKey ? (
                  <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-xs text-destructive">
                    {lang === "en"
                      ? "Turnstile is required but VITE_TURNSTILE_SITE_KEY is missing on the frontend build."
                      : "Turnstile est requis mais VITE_TURNSTILE_SITE_KEY n’est pas défini côté build Cloudflare."}
                  </div>
                ) : (
                  <Turnstile
                    action="login"
                    className="pt-1 flex justify-center"
                    onToken={(tok) => setTurnstileToken(tok)}
                  />
                )}
              </>
            )}

            <Button
              className="w-full h-12 rounded-full"
              onClick={handleLogin}
              disabled={loading || username.trim().length === 0 || password.length === 0}
            >
              {loading
                ? lang === "en"
                  ? "Signing in…"
                  : "Connexion…"
                : lang === "en"
                  ? "Sign in"
                  : "Se connecter"}
            </Button>

            <div className="space-y-3 border-t border-border/70 pt-5">
              <Button
                type="button"
                variant="outline"
                className="w-full h-11 rounded-full gap-2"
                onClick={handleGoogleLogin}
              >
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-xs font-medium">
                  {lang === "en" ? "Continue with Google" : "Continuer avec Google"}
                </span>
              </Button>

              <div className="pt-1 text-center text-xs text-muted-foreground">
                {lang === "en" ? "New on NIXYAH?" : "Nouveau sur NIXYAH ?"}{" "}
                <button
                  type="button"
                  className="text-primary font-medium underline-offset-2 hover:underline"
                  onClick={() => setLocation("/signup")}
                >
                  {lang === "en" ? "Create an account" : "Créer un compte"}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}


