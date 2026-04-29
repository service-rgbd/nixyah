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
import { toast } from "@/hooks/use-toast";
import logoTitle from "@assets/logo-titre.png";

export default function Login() {
  const [, setLocation] = useLocation();
  const { lang, t } = useI18n();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [resetEmail, setResetEmail] = useState<string | null>(null);
  const [turnstileRequired, setTurnstileRequired] = useState(false);
  const [emailLoginEnabled, setEmailLoginEnabled] = useState(false);
  const [magicLoading, setMagicLoading] = useState(false);
  const [magicDone, setMagicDone] = useState(false);
  const siteKey = (import.meta as any).env?.VITE_TURNSTILE_SITE_KEY as string | undefined;
  const hasSiteKey = Boolean(siteKey && String(siteKey).trim().length > 0);
  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(username.trim());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await apiGetJson<{ resetEmail?: string | null; turnstileRequired?: boolean; emailLoginEnabled?: boolean }>(
          "/api/support",
        );
        if (cancelled) return;
        setResetEmail(data.resetEmail ?? null);
        setTurnstileRequired(Boolean(data.turnstileRequired));
        setEmailLoginEnabled(Boolean(data.emailLoginEnabled));
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
      const magic = url.searchParams.get("magic");
      const account = url.searchParams.get("account");
      if (account === "deletion_requested") {
        setNotice(
          lang === "en"
            ? "Account deletion is scheduled in 24 hours. Sign in again before the deadline to cancel it automatically."
            : "La suppression du compte est programmée dans 24h. Reconnecte-toi avant l’échéance pour l’annuler automatiquement.",
        );
      } else if (account === "deleted") {
        setNotice(
          lang === "en"
            ? "The deletion delay expired and the account has been removed."
            : "Le délai a expiré et le compte a été supprimé.",
        );
      }
      const map: Record<string, { fr: string; en: string }> = {
        google_error: { fr: "Connexion Google refusée.", en: "Google sign-in was canceled." },
        missing_code: { fr: "Code Google manquant. Réessaie.", en: "Missing Google code. Please retry." },
        token_error: { fr: "Erreur échange token Google. Vérifie la config Google.", en: "Google token exchange failed." },
        token_missing: { fr: "Token Google manquant. Réessaie.", en: "Missing Google access token." },
        userinfo_error: { fr: "Impossible de lire ton profil Google.", en: "Unable to fetch Google profile." },
        email_unverified: { fr: "Email Google non vérifié.", en: "Google email is not verified." },
        email_column_missing: { fr: "Email indisponible côté serveur (DB).", en: "Email column missing on server." },
        invalid: { fr: "Lien de connexion invalide.", en: "Invalid sign-in link." },
        expired: { fr: "Lien de connexion expiré. Demande-en un nouveau.", en: "Sign-in link expired. Request a new one." },
        unavailable: { fr: "Connexion rapide indisponible pour le moment.", en: "Quick sign-in is unavailable right now." },
        not_linked: { fr: "Aucun compte trouvé. Inscris-toi avec Google.", en: "No account found. Sign up with Google." },
        no_profile: { fr: "Compte sans profil. Contacte l’admin.", en: "Account has no profile." },
        server_error: { fr: "Erreur serveur OAuth. Réessaie.", en: "OAuth server error. Please retry." },
      };
      const key = oauth || magic;
      const msg = key ? map[key] : undefined;
      if (!msg) return;
      setError(lang === "en" ? msg.en : msg.fr);
    } catch {
      // ignore
    }
  }, [lang]);

  const handleLogin = async () => {
    setError(null);
    setNotice(null);
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
      if (json?.deletionCancelled) {
        toast({
          title: lang === "en" ? "Deletion canceled" : "Suppression annulée",
          description:
            lang === "en"
              ? "Your account was restored because you signed in within 24 hours."
              : "Ton compte a été conservé car tu t’es reconnecté dans le délai de 24h.",
        });
      }
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

  const handleMagicLogin = async () => {
    setError(null);
    setNotice(null);
    setMagicDone(false);
    if (!emailLooksValid) {
      setError(lang === "en" ? "Enter a valid email address first." : "Entre d'abord une adresse email valide.");
      return;
    }
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

    setMagicLoading(true);
    try {
      await apiRequest("POST", "/api/login/email-link", {
        email: username.trim(),
        ...(turnstileToken ? { turnstileToken } : {}),
      });
      setMagicDone(true);
    } catch (e: any) {
      setError(
        e?.message ??
          (lang === "en" ? "Unable to send the sign-in link right now." : "Impossible d'envoyer le lien de connexion pour le moment."),
      );
    } finally {
      setMagicLoading(false);
    }
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
            {notice && (
              <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-sm text-foreground">
                {notice}
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

            {emailLoginEnabled ? (
              <div className="space-y-3 border-b border-border/70 pb-6">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-11 rounded-full gap-2"
                  onClick={handleMagicLogin}
                  disabled={magicLoading || !emailLooksValid}
                >
                  <Mail className="w-4 h-4" />
                  <span className="text-xs font-medium">
                    {magicLoading
                      ? lang === "en"
                        ? "Sending sign-in link…"
                        : "Envoi du lien…"
                      : lang === "en"
                        ? "Send quick sign-in link"
                        : "Recevoir un lien de connexion rapide"}
                  </span>
                </Button>
                <p className="text-center text-[11px] text-muted-foreground">
                  {lang === "en"
                    ? "Enter your email above to open your session directly from your phone."
                    : "Entre ton email ci-dessus pour ouvrir ta session directement depuis ton téléphone."}
                </p>
                {magicDone ? (
                  <p className="text-center text-[11px] text-muted-foreground">
                    {lang === "en"
                      ? "If the account exists, a sign-in link has been sent to your inbox."
                      : "Si le compte existe, un lien de connexion a été envoyé dans ta boîte mail."}
                  </p>
                ) : null}
              </div>
            ) : null}

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


