import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { CheckCircle2, XCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n";
import { apiRequest } from "@/lib/queryClient";

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
  const [status, setStatus] = useState<"idle" | "loading" | "ok" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const token = getTokenFromUrl();
    if (!token) {
      setStatus("error");
      setMessage(
        lang === "en"
          ? "Invalid or missing verification link."
          : "Lien de vérification invalide ou manquant.",
      );
      return;
    }

    (async () => {
      setStatus("loading");
      try {
        const res = await apiRequest("POST", "/api/email/verify", { token });
        const json = await res.json();
        if (!res.ok || !json?.ok) {
          throw new Error(json?.message || "Verification failed");
        }
        setStatus("ok");
        setMessage(
          lang === "en"
            ? "Your email is now verified. You can post ads and manage your visibility."
            : "Ton email est maintenant vérifié. Tu peux publier des annonces et gérer ta visibilité.",
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
            <Card className="rounded-3xl shadow-lg border-border bg-card/95 text-center">
              <CardHeader className="space-y-2">
                <CardTitle className="text-lg font-semibold">
                  {lang === "en" ? "Email verification" : "Vérification d’email"}
                </CardTitle>
                <CardDescription className="text-xs">
                  {lang === "en"
                    ? "We are validating your email address…"
                    : "Nous validons ton adresse email…"}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4 pt-2">
                {status === "loading" && (
                  <p className="text-sm text-muted-foreground">
                    {lang === "en" ? "Please wait a moment…" : "Merci de patienter quelques instants…"}
                  </p>
                )}

                {status === "ok" && (
                  <div className="space-y-3">
                    <div className="flex justify-center">
                      <CheckCircle2 className="w-10 h-10 text-emerald-500" />
                    </div>
                    <p className="text-sm text-foreground">{message}</p>
                    <Button
                      className="w-full h-11 mt-2"
                      onClick={() => setLocation("/dashboard")}
                    >
                      {lang === "en" ? "Go to my space" : "Aller à mon espace"}
                    </Button>
                  </div>
                )}

                {status === "error" && (
                  <div className="space-y-3">
                    <div className="flex justify-center">
                      <XCircle className="w-10 h-10 text-destructive" />
                    </div>
                    <p className="text-sm text-foreground">{message}</p>
                    <p className="text-xs text-muted-foreground">
                      {lang === "en"
                        ? "If needed, request a new email verification from your dashboard after adding an email."
                        : "Si besoin, demande un nouvel email de vérification depuis ton tableau de bord après avoir ajouté un email."}
                    </p>
                    <Button
                      variant="outline"
                      className="w-full h-11 mt-2"
                      onClick={() => setLocation("/dashboard")}
                    >
                      {lang === "en" ? "Back to my space" : "Retour à mon espace"}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </motion.div>
      </main>
    </div>
  );
}


