import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, CheckCircle2, Mail, RefreshCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { apiGetJson, apiRequest } from "@/lib/queryClient";
import { toast } from "@/hooks/use-toast";

function getTokenFromUrl(): string | null {
  try {
    const url = new URL(window.location.href);
    return url.searchParams.get("token");
  } catch {
    return null;
  }
}

export default function EmailVerify() {
  const [, setLocation] = useLocation();
  const { lang } = useI18n();
  const [status, setStatus] = useState<"idle" | "loading" | "pending" | "ok" | "already" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [accountEmail, setAccountEmail] = useState<string | null>(null);
  const [resendConfigured, setResendConfigured] = useState(true);
  const [resending, setResending] = useState(false);

  useEffect(() => {
    const token = getTokenFromUrl();

    (async () => {
      setStatus("loading");
      try {
        if (token) {
          const res = await apiRequest("POST", "/api/email/verify", { token });
          const json = await res.json();
          if (!res.ok || !json?.ok) {
            throw new Error(json?.message || "Verification failed");
          }
          setStatus("ok");
          setAccountEmail(json?.email ?? null);
          setMessage(
            lang === "en"
              ? "Your email is now confirmed. You can continue."
              : "Ton adresse email est maintenant confirmée. Tu peux continuer.",
          );
          return;
        }

        const account = await apiGetJson<{
          email: string | null;
          emailVerified?: boolean;
          resendConfigured?: boolean;
        }>("/api/me/account");
        setAccountEmail(account.email ?? null);
        setResendConfigured(account.resendConfigured !== false);

        if (account.emailVerified) {
          setStatus("already");
          setMessage(
            lang === "en"
              ? "Your email is already confirmed."
              : "Ton adresse email est déjà confirmée.",
          );
          return;
        }

        if (!account.email) {
          setStatus("error");
          setMessage(
            lang === "en"
              ? "No email is linked to this account."
              : "Aucune adresse email n'est liée à ce compte.",
          );
          return;
        }

        setStatus("pending");
        setMessage(
          lang === "en"
            ? "Open your inbox and click the confirmation link to continue."
            : "Ouvre ta boîte mail puis clique sur le lien de confirmation pour continuer.",
        );
      } catch (e: any) {
        setStatus("error");
        setMessage(
          e?.message ??
            (lang === "en"
              ? "The verification link is invalid or has expired."
              : "Le lien de vérification est invalide ou expiré."),
        );
      }
    })();
  }, [lang]);

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] flex items-center justify-between">
        <button
          onClick={() => setLocation("/start")}
          className="w-9 h-9 rounded-full bg-card flex items-center justify-center border border-border"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-display text-xl font-semibold text-gradient tracking-tight">NIXYAH</h1>
        <div className="w-9" />
      </header>

      <main className="flex-1 flex flex-col px-4 pb-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-1 flex items-center justify-center"
        >
          <div className="w-full max-w-md">
            <section className="space-y-5 rounded-[28px] border border-border bg-card/80 p-6 text-center">
              <div className="space-y-2">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted/40">
                  {status === "ok" || status === "already" ? (
                    <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                  ) : status === "error" ? (
                    <XCircle className="h-6 w-6 text-destructive" />
                  ) : (
                    <Mail className="h-6 w-6 text-foreground" />
                  )}
                </div>
                <h1 className="text-xl font-semibold text-foreground">
                  {lang === "en" ? "Email verification" : "Vérification de l’email"}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {status === "loading"
                    ? lang === "en"
                      ? "Please wait a moment."
                      : "Merci de patienter quelques instants."
                    : message}
                </p>
              </div>

              {accountEmail ? (
                <div className="rounded-2xl border border-border bg-background px-4 py-3 text-sm text-foreground">
                  {accountEmail}
                </div>
              ) : null}

              {status === "pending" ? (
                <div className="space-y-3">
                  {!resendConfigured ? (
                    <div className="rounded-2xl border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                      {lang === "en"
                        ? "Email sending is not configured on the server."
                        : "L’envoi d’email n’est pas configuré sur le serveur."}
                    </div>
                  ) : null}
                  <Button
                    className="h-11 w-full rounded-2xl"
                    disabled={!resendConfigured || resending}
                    onClick={async () => {
                      setResending(true);
                      try {
                        const res = await apiRequest("POST", "/api/email/resend");
                        const json = await res.json().catch(() => ({}));
                        if (!res.ok) {
                          throw new Error(json?.message || "Resend failed");
                        }
                        toast({
                          title: lang === "en" ? "Email sent" : "Email envoyé",
                          description:
                            lang === "en"
                              ? "Check your inbox and spam folder."
                              : "Vérifie ta boîte mail et tes spams.",
                        });
                      } catch (e: any) {
                        toast({
                          title: lang === "en" ? "Unable to resend" : "Impossible de renvoyer",
                          description: e?.message,
                        });
                      } finally {
                        setResending(false);
                      }
                    }}
                  >
                    <RefreshCcw className="mr-2 h-4 w-4" />
                    {resending
                      ? lang === "en"
                        ? "Sending..."
                        : "Envoi..."
                      : lang === "en"
                        ? "Resend email"
                        : "Renvoyer l’email"}
                  </Button>
                  <Button
                    variant="outline"
                    className="h-11 w-full rounded-2xl"
                    onClick={() => window.location.reload()}
                  >
                    {lang === "en" ? "I already clicked the link" : "J’ai déjà cliqué sur le lien"}
                  </Button>
                </div>
              ) : null}

              {status === "ok" || status === "already" ? (
                <div className="space-y-3">
                  <Button className="h-11 w-full rounded-2xl" onClick={() => setLocation("/post-intent")}>
                    {lang === "en" ? "Continue" : "Continuer"}
                  </Button>
                  <Button variant="outline" className="h-11 w-full rounded-2xl" onClick={() => setLocation("/dashboard")}>
                    {lang === "en" ? "My space" : "Mon espace"}
                  </Button>
                </div>
              ) : null}

              {status === "error" ? (
                <div className="space-y-3">
                  <Button variant="outline" className="h-11 w-full rounded-2xl" onClick={() => setLocation("/signup")}>
                    {lang === "en" ? "Back to signup" : "Retour à l’inscription"}
                  </Button>
                </div>
              ) : null}
            </section>
          </div>
        </motion.div>
      </main>
    </div>
  );
}


