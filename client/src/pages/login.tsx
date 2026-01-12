import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Lock, Mail, Sparkles, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest } from "@/lib/queryClient";
import { setSessionIds } from "@/lib/session";
import { useI18n } from "@/lib/i18n";
import logoTitle from "@assets/logo-titre.png";

export default function Login() {
  const [, setLocation] = useLocation();
  const { lang, t } = useI18n();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetEmail, setResetEmail] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/support");
        if (!res.ok) return;
        const data = (await res.json()) as { resetEmail?: string | null };
        if (!cancelled) setResetEmail(data.resetEmail ?? null);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogin = async () => {
    setError(null);
    setLoading(true);
    try {
      const res = await apiRequest("POST", "/api/login", { username, password });
      const json = await res.json();
      setSessionIds({ userId: json.userId, profileId: json.profileId });
      setLocation("/dashboard");
    } catch (e: any) {
      setError(e?.message ?? (lang === "en" ? "Login failed" : "Connexion impossible"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/60 via-primary/40 to-background flex flex-col">
      <header className="px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] flex items-center justify-between text-white">
        <button
          onClick={() => setLocation("/start")}
          className="w-9 h-9 rounded-full bg-white/15 flex items-center justify-center border border-white/20 backdrop-blur"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="text-sm font-medium">
          {lang === "en" ? "Back" : "Retour"}
        </div>
        <div className="w-9" />
      </header>

      <main className="flex-1 flex flex-col">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex-1 flex flex-col"
        >
          <div className="px-4 pt-2">
            <div className="mx-auto max-w-md rounded-3xl overflow-hidden shadow-lg">
              <img
                src={logoTitle}
                alt="NIXYAH"
                className="w-full h-48 object-contain bg-white/10 p-6"
              />
            </div>
          </div>

          <div className="mt-4 px-4 pb-8 flex-1">
            <div className="mx-auto max-w-md">
              <Card className="rounded-3xl shadow-xl border-border bg-background">
                <CardHeader className="pb-2 text-center">
                  <CardTitle className="text-xl font-semibold">
                    {lang === "en" ? "Sign in" : "Connexion"}
                  </CardTitle>
                  <div className="flex items-center justify-center gap-1 mt-2">
                    <span className="h-1 w-10 rounded-full bg-primary" />
                  </div>
                  <p className="mt-3 text-xs text-muted-foreground">
                    {lang === "en"
                      ? "Access your secure space."
                      : "Accède à ton compte en toute sécurité."}
                  </p>
                </CardHeader>
                <CardContent className="space-y-4 pt-2">
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

                  <div className="space-y-1">
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

                  <Button
                    className="w-full h-12 rounded-full mt-2"
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

                  <div className="pt-2 text-center text-xs text-muted-foreground">
                    {lang === "en" ? "New on NIXYAH?" : "Nouveau sur NIXYAH ?"}{" "}
                    <button
                      type="button"
                      className="text-primary font-medium underline-offset-2 hover:underline"
                      onClick={() => setLocation("/signup")}
                    >
                      {lang === "en" ? "Create an account" : "Créer un compte"}
                    </button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}


