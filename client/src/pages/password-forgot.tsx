import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Mail, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useI18n } from "@/lib/i18n";
import { apiGetJson, apiRequest } from "@/lib/queryClient";
import { Turnstile } from "@/components/turnstile";

export default function PasswordForgot() {
  const [, setLocation] = useLocation();
  const { lang } = useI18n();
  const [identifier, setIdentifier] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [turnstileRequired, setTurnstileRequired] = useState(false);
  const siteKey = (import.meta as any).env?.VITE_TURNSTILE_SITE_KEY as string | undefined;
  const hasSiteKey = Boolean(siteKey && String(siteKey).trim().length > 0);

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

  const handleSubmit = async () => {
    setError(null);
    if (turnstileRequired && !hasSiteKey) {
      setError(
        lang === "en"
          ? "Security check is enabled on the server, but the frontend Turnstile site key is missing."
          : "Turnstile est activé côté serveur, mais VITE_TURNSTILE_SITE_KEY manque côté Cloudflare.",
      );
      return;
    }
    if (turnstileRequired && !turnstileToken) {
      setError(lang === "en" ? "Please complete the anti-bot check." : "Valide le contrôle anti-bot (Turnstile).");
      return;
    }
    setLoading(true);
    try {
      await apiRequest("POST", "/api/password/forgot", {
        identifier,
        ...(turnstileToken ? { turnstileToken } : {}),
      });
      setDone(true);
    } catch (e: any) {
      setError(
        e?.message ??
          (lang === "en" ? "Unable to send reset email" : "Impossible d’envoyer l’email de réinitialisation"),
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] flex items-center justify-between sm:px-6">
        <button
          onClick={() => setLocation("/login")}
          className="w-9 h-9 rounded-full bg-card flex items-center justify-center border border-border"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="text-sm font-medium text-foreground">{lang === "en" ? "Password" : "Mot de passe"}</div>
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
              {lang === "en" ? "Forgot your password?" : "Mot de passe oublié ?"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {lang === "en"
                ? "Enter your username or email. If an account exists, you will receive a reset link."
                : "Entre ton identifiant ou ton email. Si un compte existe, tu recevras un lien de réinitialisation."}
            </p>
          </section>

          <div className="space-y-5 pt-6">
            {error && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-2 border-b border-border/70 pb-6">
              <label className="text-xs text-muted-foreground flex items-center gap-2">
                <Mail className="w-4 h-4" />
                {lang === "en" ? "Username or email" : "Identifiant ou email"}
              </label>
              <Input
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder={
                  lang === "en" ? "Your username or email" : "Ton identifiant de connexion ou ton email"
                }
                className="h-11 rounded-full"
              />
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
                    action="password_forgot"
                    className="pt-1 flex justify-center"
                    onToken={(tok) => setTurnstileToken(tok)}
                  />
                )}
              </>
            )}

            <Button
              className="w-full h-11 rounded-full"
              disabled={loading || identifier.trim().length === 0 || done}
              onClick={handleSubmit}
            >
              {done
                ? lang === "en"
                  ? "Email sent (if account exists)"
                  : "Email envoyé (si le compte existe)"
                : loading
                  ? lang === "en"
                    ? "Sending…"
                    : "Envoi…"
                  : lang === "en"
                    ? "Send reset link"
                    : "Envoyer le lien"}
            </Button>

            {done && (
              <p className="text-[11px] text-muted-foreground text-center pt-1">
                {lang === "en"
                  ? "Check your inbox and follow the link. Also look in your spam folder."
                  : "Vérifie ta boîte mail et clique sur le lien. Pense aussi au dossier spam / courrier indésirable."}
              </p>
            )}
          </div>
        </motion.div>
      </main>
    </div>
  );
}


