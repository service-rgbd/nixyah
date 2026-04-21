import type { ReactNode } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, SlidersHorizontal, RotateCcw, Globe, Palette, Sparkles, LogIn, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { defaultAppSettings, resolveThemePreference, useAppSettings } from "@/lib/appSettings";
import { getProfileId } from "@/lib/session";
import { useTheme } from "next-themes";
import { useT } from "@/lib/i18n";
import logoTitle from "@assets/logo-titre.png";

function SettingsRow({
  label,
  description,
  leftIcon,
  right,
  onClick,
}: {
  label: string;
  description?: string;
  leftIcon?: ReactNode;
  right?: ReactNode;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="w-full text-left px-4 py-4 flex items-center justify-between gap-4 hover:bg-muted/40 active:bg-muted/60 transition-colors"
    >
      <div className="min-w-0 flex items-start gap-3">
        {leftIcon ? (
          <div className="mt-0.5 w-9 h-9 rounded-xl bg-muted/60 flex items-center justify-center shrink-0">
            {leftIcon}
          </div>
        ) : null}
        <div className="min-w-0">
          <div className="font-medium text-foreground truncate">{label}</div>
          {description ? <div className="text-sm text-muted-foreground leading-snug">{description}</div> : null}
        </div>
      </div>
      {right ? <div className="shrink-0">{right}</div> : <div className="w-2" />}
    </div>
  );
}

export default function Settings() {
  const [, setLocation] = useLocation();
  const [settings, setSettings] = useAppSettings();
  const { setTheme } = useTheme();
  const t = useT();
  const hasSession = Boolean(getProfileId());

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 px-4 pt-3 pb-3">
        <div className="mx-auto max-w-md flex items-center justify-between">
        <button
          onClick={() => setLocation("/start")}
          className="w-10 h-10 rounded-full bg-card/80 backdrop-blur flex items-center justify-center border border-border"
          data-testid="button-back-settings"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <h1 className="text-xl font-semibold text-foreground flex items-center gap-2">
          <img src={logoTitle} alt="NIXYAH" className="h-6 w-auto object-contain" draggable={false} />
          <SlidersHorizontal className="w-5 h-5 text-muted-foreground" />
          {t("settings")}
        </h1>
        <div className="w-10" />
        </div>
      </header>

      <main className="px-4 pb-10">
        <div className="mx-auto max-w-md space-y-5">
          <div className="space-y-3 border-b border-border/70 pb-5">
            <div className="space-y-1">
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-muted-foreground">
                {hasSession ? (t("settings") as string) : "Bienvenue sur NIXYAH"}
              </div>
              <div className="text-sm leading-7 text-foreground/90">
                {hasSession
                  ? "Préférences d’affichage et options générales. Les filtres restent directement dans les pages de découverte."
                  : "Connecte-toi ou crée un compte pour gérer ton espace et retrouver une expérience plus fluide."}
              </div>
            </div>
            {!hasSession ? (
              <div className="flex gap-3">
                <Button size="sm" className="h-10 flex-1 gap-1" onClick={() => setLocation("/login")}>
                  <LogIn className="w-3 h-3" />
                  Login
                </Button>
                <Button size="sm" variant="outline" className="h-10 flex-1 gap-1" onClick={() => setLocation("/signup")}>
                  <UserPlus className="w-3 h-3" />
                  Register
                </Button>
              </div>
            ) : (
              <Button size="sm" variant="outline" className="h-10 gap-1 rounded-full" onClick={() => setLocation("/dashboard")}>
                <LogIn className="w-3 h-3" />
                {t("dashboard") ?? "Mon espace"}
              </Button>
            )}
          </div>

          <div className="overflow-hidden border-b border-border/70 pb-2">
            <div className="px-1 pb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Sparkles className="w-4 h-4 text-primary" />
              Préférences
            </div>
            <SettingsRow
              label={t("reduceMotion")}
              description={t("reduceMotionDescription")}
              leftIcon={<Sparkles className="w-4 h-4 text-muted-foreground" />}
              right={
                <Switch
                  checked={settings.reduceMotion}
                  onCheckedChange={(checked) => setSettings({ ...settings, reduceMotion: Boolean(checked) })}
                  data-testid="switch-reduce-motion"
                />
              }
              onClick={() => setSettings({ ...settings, reduceMotion: !settings.reduceMotion })}
            />
          </div>

          <div className="border-b border-border/70 pb-5">
            <div className="px-1 pb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Globe className="w-4 h-4 text-primary" />
              {t("language")}
            </div>
            <div className="grid grid-cols-2 gap-3 pt-1">
              <Button
                variant={settings.language === "fr" ? "default" : "outline"}
                onClick={() => setSettings({ ...settings, language: "fr" })}
                className="h-11"
                data-testid="button-lang-fr"
              >
                FR
              </Button>
              <Button
                variant={settings.language === "en" ? "default" : "outline"}
                onClick={() => setSettings({ ...settings, language: "en" })}
                className="h-11"
                data-testid="button-lang-en"
              >
                EN
              </Button>
            </div>
          </div>

          <div className="border-b border-border/70 pb-5">
            <div className="px-1 pb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Palette className="w-4 h-4 text-primary" />
              {t("theme")}
            </div>
            <p className="px-1 text-sm leading-6 text-muted-foreground">
              En mode auto, l'application passe en clair de `06:30` a `18:30`, puis repasse en sombre. Tu peux forcer clair ou sombre a tout moment.
            </p>
            <div className="grid grid-cols-3 gap-3 pt-3">
              <Button
                variant={settings.theme === "auto" ? "default" : "outline"}
                onClick={() => {
                  setSettings({ ...settings, theme: "auto" });
                  setTheme(resolveThemePreference("auto"));
                }}
                className="h-11"
                data-testid="button-theme-auto"
              >
                Auto
              </Button>
              <Button
                variant={settings.theme === "dark" ? "default" : "outline"}
                onClick={() => {
                  setSettings({ ...settings, theme: "dark" });
                  setTheme("dark");
                }}
                className="h-11"
                data-testid="button-theme-dark"
              >
                {t("dark")}
              </Button>
              <Button
                variant={settings.theme === "light" ? "default" : "outline"}
                onClick={() => {
                  setSettings({ ...settings, theme: "light" });
                  setTheme("light");
                }}
                className="h-11"
                data-testid="button-theme-light"
              >
                {t("light")}
              </Button>
            </div>
          </div>

          <Button
            variant="outline"
            className="w-full h-12 gap-2 rounded-full"
            onClick={() => {
              setSettings(defaultAppSettings);
              setTheme(resolveThemePreference(defaultAppSettings.theme));
            }}
            data-testid="button-reset-settings"
          >
            <RotateCcw className="w-4 h-4" />
            {t("resetSettings")}
          </Button>
        </div>
      </main>
    </div>
  );
}



