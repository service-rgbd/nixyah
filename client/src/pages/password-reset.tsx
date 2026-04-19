import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

export default function PasswordReset() {
  const [, setLocation] = useLocation();
  const { lang } = useI18n();
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setToken(getTokenFromUrl());
  }, []);

  const handleSubmit = async () => {
    if (!token) {
      setError(
        lang === "en" ? "Invalid or missing link" : "Lien invalide ou manquant. Clique à nouveau depuis ton email.",
      );
      return;
    }
    if (password.length < 6) {
      setError(
        lang === "en"
          ? "Password must be at least 6 characters."
          : "Le mot de passe doit contenir au moins 6 caractères.",
      );
      return;
    }
    if (password !== confirm) {
      setError(lang === "en" ? "Passwords do not match." : "Les mots de passe ne correspondent pas.");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      await apiRequest("POST", "/api/password/reset", { token, password });
      setDone(true);
    } catch (e: any) {
      setError(
        e?.message ??
          (lang === "en" ? "Unable to reset password" : "Impossible de réinitialiser le mot de passe"),
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
        <div className="text-sm font-medium text-foreground">{lang === "en" ? "Reset" : "Réinitialisation"}</div>
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
              {lang === "en" ? "Choose a new password" : "Choisis un nouveau mot de passe"}
            </h1>
            <p className="text-sm text-muted-foreground">
              {lang === "en" ? "Enter your new password below." : "Entre ton nouveau mot de passe ci-dessous."}
            </p>
          </section>

          <div className="space-y-5 pt-6">
            {error && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-xs text-muted-foreground flex items-center gap-2">
                {lang === "en" ? "New password" : "Nouveau mot de passe"}
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={
                  lang === "en" ? "At least 6 characters" : "Au moins 6 caractères (garde-le secret)"
                }
                className="h-11 rounded-full"
              />
            </div>

            <div className="space-y-2 border-b border-border/70 pb-6">
              <label className="text-xs text-muted-foreground flex items-center gap-2">
                {lang === "en" ? "Confirm password" : "Confirme le mot de passe"}
              </label>
              <Input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="h-11 rounded-full"
              />
            </div>

            <Button
              className="w-full h-11 rounded-full"
              disabled={loading || done}
              onClick={handleSubmit}
            >
              {done
                ? lang === "en"
                  ? "Password updated"
                  : "Mot de passe mis à jour"
                : loading
                  ? lang === "en"
                    ? "Saving…"
                    : "Enregistrement…"
                  : lang === "en"
                    ? "Save new password"
                    : "Enregistrer le nouveau mot de passe"}
            </Button>

            {done && (
              <Button
                variant="outline"
                className="w-full h-10 rounded-full"
                onClick={() => setLocation("/login")}
              >
                {lang === "en" ? "Back to login" : "Retour à la connexion"}
              </Button>
            )}
          </div>
        </motion.div>
      </main>
    </div>
  );
}


