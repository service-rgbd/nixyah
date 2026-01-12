import type { ReactNode } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, BadgeCheck, SlidersHorizontal, RotateCcw, Globe, Palette, MapPin, Sparkles, Crown, LogIn, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { defaultAppSettings, useAppSettings } from "@/lib/appSettings";
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
          <div className="rounded-2xl border border-border bg-card/80 backdrop-blur px-4 py-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                {hasSession ? (t("settings") as string) : "Bienvenue sur NIXYAH"}
              </div>
              <div className="text-sm text-foreground leading-snug">
                {hasSession
                  ? "Personnalise l’affichage, la langue et la distance pour explorer plus confortablement."
                  : "Connecte-toi ou crée un compte pour profiter des salons, escorts-girls et produits adultes filtrés à proximité."}
              </div>
            </div>
            {!hasSession ? (
              <div className="flex flex-col gap-2 shrink-0">
                <Button
                  size="sm"
                  className="h-8 gap-1"
                  onClick={() => setLocation("/login")}
                >
                  <LogIn className="w-3 h-3" />
                  Login
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1"
                  onClick={() => setLocation("/signup")}
                >
                  <UserPlus className="w-3 h-3" />
                  Register
                </Button>
              </div>
            ) : (
              <div className="flex flex-col gap-1 shrink-0 items-end">
                <span className="text-[11px] text-muted-foreground">
                  {t("settings") as string}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1"
                  onClick={() => setLocation("/dashboard")}
                >
                  <LogIn className="w-3 h-3" />
                  {t("dashboard") ?? "Mon espace"}
                </Button>
              </div>
            )}
          </div>

          {/* Discovery */}
          <div className="rounded-2xl border border-border bg-card/70 backdrop-blur overflow-hidden">
            <div className="px-4 pt-4 pb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Sparkles className="w-4 h-4 text-primary" />
              {t("explore")}
            </div>
            <SettingsRow
              label={t("proOnly")}
              description={t("proOnlyDescription")}
              leftIcon={<Sparkles className="w-4 h-4 text-primary" />}
              right={
                <Switch
                  checked={settings.proOnly}
                  onCheckedChange={(checked) => setSettings({ ...settings, proOnly: Boolean(checked) })}
                  data-testid="switch-pro-only"
                />
              }
              onClick={() => setSettings({ ...settings, proOnly: !settings.proOnly })}
            />
            <Separator />
            <SettingsRow
              label={t("verifiedOnly")}
              description={t("verifiedOnlyDescription")}
              leftIcon={<BadgeCheck className="w-4 h-4 text-primary" />}
              right={
                <Switch
                  checked={settings.verifiedOnly}
                  onCheckedChange={(checked) => setSettings({ ...settings, verifiedOnly: Boolean(checked) })}
                  data-testid="switch-verified-only"
                />
              }
              onClick={() => setSettings({ ...settings, verifiedOnly: !settings.verifiedOnly })}
            />
            <Separator />
            <SettingsRow
              label={t("vipOnly")}
              description={t("vipOnlyDescription")}
              leftIcon={<Crown className="w-4 h-4 text-amber-400" />}
              right={
                <Switch
                  checked={settings.vipOnly}
                  onCheckedChange={(checked) => setSettings({ ...settings, vipOnly: Boolean(checked) })}
                  data-testid="switch-vip-only"
                />
              }
              onClick={() => setSettings({ ...settings, vipOnly: !settings.vipOnly })}
            />
            <Separator />
            <div className="px-4 py-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-muted/60 flex items-center justify-center shrink-0">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <Label className="text-sm text-foreground">
                    Distance max{" "}
                    <span className="text-primary font-medium">• {settings.maxDistanceKm} km</span>
                  </Label>
                  <div className="mt-3">
                    <Slider
                      value={[settings.maxDistanceKm]}
                      min={1}
                      max={50}
                      step={1}
                      onValueChange={(v) =>
                        setSettings({ ...settings, maxDistanceKm: v[0] ?? settings.maxDistanceKm })
                      }
                      data-testid="slider-distance"
                    />
                  </div>
                </div>
              </div>
            </div>
            <Separator />
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

          {/* Language */}
          <div className="rounded-2xl border border-border bg-card/70 backdrop-blur overflow-hidden">
            <div className="px-4 pt-4 pb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Globe className="w-4 h-4 text-primary" />
              {t("language")}
            </div>
            <div className="px-4 pb-4 grid grid-cols-2 gap-3">
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

          {/* Theme */}
          <div className="rounded-2xl border border-border bg-card/70 backdrop-blur overflow-hidden">
            <div className="px-4 pt-4 pb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Palette className="w-4 h-4 text-primary" />
              {t("theme")}
            </div>
            <div className="px-4 pb-4 grid grid-cols-2 gap-3">
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
            className="w-full h-12 gap-2"
            onClick={() => {
              setSettings(defaultAppSettings);
              setTheme(defaultAppSettings.theme);
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



