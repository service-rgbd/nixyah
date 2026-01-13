import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Settings2, Megaphone, UserCircle2, Compass, Menu, LogOut, Phone, MapPin, AlertCircle, HelpCircle, Info, Mail, Coins, Rocket, Eye, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { clearSession, getProfileId } from "@/lib/session";
import { useI18n } from "@/lib/i18n";
import avatarUrl from "@assets/avatar.png";
import { apiRequest } from "@/lib/queryClient";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ApiProfileDetail = {
  id: string;
  pseudo: string;
  age: number;
  ville: string;
  verified: boolean;
  isPro?: boolean | null;
  accountType?: "profile" | "residence" | "salon" | "adult_shop" | null;
  photoUrl: string | null;
  photos: string[];
  videoUrl: string | null;
  tarif: string | null;
  lieu: string | null;
  services: string[] | null;
  description: string | null;
  visible?: boolean | null;
  showLocation?: boolean | null;
  contact?: {
    phone: string | null;
    telegram: string | null;
    showPhone?: boolean;
    showTelegram?: boolean;
    preference?: "whatsapp" | "telegram";
  } | null;
  annonce:
    | {
        id: string;
        title: string;
        body: string | null;
        createdAt?: string;
        promotion?: any;
      }
    | null;
};

export default function Dashboard() {
  const [, setLocation] = useLocation();
  const { lang, t } = useI18n();
  const profileId = getProfileId();
  const queryClient = useQueryClient();
  const [loggingOut, setLoggingOut] = useState(false);
  const [phone, setPhone] = useState("");
  const [showPhone, setShowPhone] = useState(false);
  const [telegram, setTelegram] = useState("");
  const [showTelegram, setShowTelegram] = useState(false);
  const [contactPreference, setContactPreference] = useState<"whatsapp" | "telegram">("whatsapp");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [showLocation, setShowLocation] = useState(false);
  const [accountEmail, setAccountEmail] = useState("");
  const [showEmailDialog, setShowEmailDialog] = useState(false);

  const scrollToId = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await apiRequest("POST", "/api/logout");
    } catch {
      // ignore: still clear local state to avoid a "half logged-in" UI
    } finally {
      clearSession();
      queryClient.clear();
      // Full reload to reset any in-memory state before reconnecting
      window.location.href = "/login";
    }
  };

  const { data, isLoading } = useQuery<ApiProfileDetail | null>({
    queryKey: profileId ? [`/api/profiles/${profileId}`] : ["__no_profile__"],
    enabled: Boolean(profileId),
  });

  const { data: account } = useQuery<{
    username: string;
    email: string | null;
    emailVerified?: boolean;
    tokensBalance?: number;
    emailVerificationAvailable?: boolean;
    resendConfigured?: boolean;
  }>({
    queryKey: ["/api/me/account"],
    enabled: Boolean(profileId),
  });

  const { data: publishingConfig } = useQuery<any>({
    queryKey: ["/api/publishing/config"],
    retry: false,
  });

  const { data: support } = useQuery<{ resetEmail: string | null; telegramUrl: string | null }>({
    queryKey: ["/api/support"],
  });

  const { data: adminMe } = useQuery<{ ok: boolean }>({
    queryKey: ["/api/admin/me"],
    enabled: Boolean(profileId),
    retry: false,
  });

  useEffect(() => {
    if (!data) return;
    setPhone(data.contact?.phone ?? "");
    setTelegram(data.contact?.telegram ?? "");
    setShowPhone(Boolean(data.contact?.showPhone));
    setShowTelegram(Boolean(data.contact?.showTelegram));
    setContactPreference(data.contact?.preference ?? "whatsapp");
    setShowLocation(Boolean(data.showLocation));
  }, [data]);

  useEffect(() => {
    if (!account) return;
    setAccountEmail(account.email ?? "");
    if (!account.email) {
      setShowEmailDialog(true);
    }
  }, [account]);

  const annonceBadges = useMemo(() => {
    const promo = data?.annonce?.promotion ?? null;
    const badges: Array<{ label: string; tone: "green" | "red" | "blue" | "neutral" }> = [];
    if (promo?.featured?.optionId) badges.push({ label: "PREMIUM", tone: "green" });
    if (promo?.autorenew?.optionId) badges.push({ label: "TOP", tone: "blue" });
    if (promo?.urgent?.optionId) badges.push({ label: "URGENT", tone: "red" });
    if (promo?.extended?.optionId) badges.push({ label: "PROLONGATION", tone: "neutral" });
    return badges;
  }, [data?.annonce?.promotion]);

  const annonceExpiry = useMemo(() => {
    if (!data?.annonce?.createdAt) return null;
    if (!publishingConfig?.promote) return null;
    const start = new Date(data.annonce.createdAt);
    if (Number.isNaN(start.getTime())) return null;

    const promo = data.annonce.promotion ?? {};
    const promoteCfg = publishingConfig.promote ?? {};
    const findDays = (arr: any[], id: number) => {
      const o = Array.isArray(arr) ? arr.find((x) => Number(x.id) === Number(id)) : null;
      return o ? Number(o.days ?? 0) : 0;
    };
    const durations = [
      promo.extended?.optionId ? findDays(promoteCfg?.extended?.options, promo.extended.optionId) : 0,
      promo.featured?.optionId ? findDays(promoteCfg?.featured?.options, promo.featured.optionId) : 0,
      promo.autorenew?.optionId ? findDays(promoteCfg?.autorenew?.options, promo.autorenew.optionId) : 0,
      promo.urgent?.optionId ? findDays(promoteCfg?.urgent?.options, promo.urgent.optionId) : 0,
    ].filter((d) => d > 0);

    const maxDays = durations.length ? Math.max(...durations) : null;
    if (!maxDays) return null;
    const end = new Date(start.getTime() + maxDays * 24 * 60 * 60 * 1000);
    const remainingDays = Math.ceil((end.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    return {
      end,
      remainingDays,
    };
  }, [data?.annonce?.createdAt, data?.annonce?.promotion, publishingConfig?.promote]);

  const tokenBalance = Number(account?.tokensBalance ?? 0);
  const ensureEmailVerifiedForPublishing = (): boolean => {
    if (!account?.email) {
      toast({
        title: "Ajoute un email d’abord",
        description: "C’est requis pour publier une annonce (confirmation email).",
      });
      scrollToId("section-account-email");
      return false;
    }
    if (account?.emailVerified === false) {
      toast({
        title: "Confirme ton email avant de publier",
        description: "Va dans “Email du compte” puis renvoie l’email de confirmation.",
      });
      scrollToId("section-account-email");
      return false;
    }
    return true;
  };

  if (!profileId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6">
        <div className="text-center space-y-3">
          <p className="text-foreground font-medium">
            {lang === "en" ? "No session" : "Aucune session"}
          </p>
          <p className="text-muted-foreground text-sm">
            {lang === "en"
              ? "Sign up to access your space."
              : "Inscris-toi pour accéder à ton espace."}
          </p>
          <Button onClick={() => setLocation("/signup")}>{t("signup")}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {loggingOut && (
        <div className="fixed inset-0 z-[100] bg-background/70 backdrop-blur-sm flex items-center justify-center">
          <div className="rounded-2xl border border-border bg-card/95 shadow-xl p-5 w-[min(420px,calc(100%-2rem))]">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
              <div className="flex-1">
                <div className="text-sm font-semibold text-foreground">
                  {lang === "en" ? "Signing out…" : "Déconnexion…"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {lang === "en"
                    ? "Cleaning session data before reconnect."
                    : "Nettoyage de la session et des données avant reconnexion."}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      <Dialog open={showEmailDialog} onOpenChange={setShowEmailDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">
              {lang === "en" ? "Add a recovery email" : "Ajoute un email de récupération"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {lang === "en"
                ? "Optional but recommended. This email will only be used if you lose your password."
                : "Optionnel mais recommandé. Cet email servira uniquement si tu perds ton mot de passe."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Input
              type="email"
              value={accountEmail}
              onChange={(e) => setAccountEmail(e.target.value)}
              placeholder={lang === "en" ? "your@email.com" : "ton.email@example.com"}
              className="h-11"
            />
          </div>
          <DialogFooter className="pt-3">
            <Button
              variant="ghost"
              type="button"
              onClick={() => setShowEmailDialog(false)}
            >
              {lang === "en" ? "Later" : "Plus tard"}
            </Button>
            <Button
              type="button"
              onClick={async () => {
                const trimmed = accountEmail.trim();
                if (!trimmed) {
                  toast({
                    title: lang === "en" ? "Add an email first" : "Ajoute d’abord un email",
                  });
                  return;
                }
                const res = await apiRequest("PATCH", "/api/me/account", { email: trimmed });
                if (!res.ok) {
                  toast({
                    title: lang === "en" ? "Unable to save email" : "Impossible d’enregistrer l’email",
                  });
                  return;
                }
                const json = await res.json().catch(() => null);
                toast({
                  title: lang === "en" ? "Email saved" : "Email enregistré",
                });
                if (json?.verificationEmailSent === true) {
                  toast({
                    title: lang === "en" ? "Verification email sent" : "Email de confirmation envoyé",
                    description:
                      lang === "en"
                        ? "Check your inbox (and spam) then click the link."
                        : "Vérifie ta boîte mail (et les spams) puis clique sur le lien.",
                  });
                } else if (json?.verificationEmailSent === false) {
                  toast({
                    title:
                      lang === "en"
                        ? "Unable to send verification email"
                        : "Impossible d’envoyer l’email de confirmation",
                    description:
                      json?.verificationEmailError ??
                      (lang === "en"
                        ? "You can retry later from your dashboard."
                        : "Tu pourras réessayer plus tard depuis ton dashboard."),
                  });
                }
                setShowEmailDialog(false);
                await queryClient.invalidateQueries({ queryKey: ["/api/me/account"] });
              }}
            >
              {lang === "en" ? "Save" : "Enregistrer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <main className="px-4 pb-10 space-y-4 pt-4">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-md space-y-4">
          {/* Top bar */}
          <div className="flex items-center justify-between">
            <div className="leading-tight">
              <div className="text-2xl font-bold text-gradient tracking-tight">NIXYAH</div>
              <div className="text-xs text-muted-foreground">{lang === "en" ? "Dashboard" : "Dashboard"}</div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full bg-gradient-to-r from-pink-500/90 via-fuchsia-500/90 to-purple-500/90 text-white shadow-lg px-3 h-9 gap-2"
                  data-testid="button-dashboard-menu"
                >
                  <Menu className="w-4 h-4" />
                  <span className="text-xs font-medium">{lang === "en" ? "Menu" : "Menu"}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-64 glass border border-white/10 bg-background/80 backdrop-blur-xl"
              >
                <DropdownMenuLabel className="text-xs uppercase tracking-wide text-muted-foreground">
                  {lang === "en" ? "Navigation" : "Navigation"}
                </DropdownMenuLabel>
                <DropdownMenuItem onClick={() => setLocation("/start")}>
                  <Compass className="w-4 h-4" />
                  {lang === "en" ? "News & feed" : "Actualités"}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLocation(`/profile/${profileId}`)}>
                  <UserCircle2 className="w-4 h-4" />
                  {t("viewProfile")}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLocation("/explore")}>
                  <Compass className="w-4 h-4" />
                  {t("explore")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setLocation("/settings")}
                  data-testid="button-open-settings"
                >
                  <Settings2 className="w-4 h-4" />
                  {t("settings")}
                </DropdownMenuItem>
                {adminMe?.ok ? (
                  <DropdownMenuItem onClick={() => setLocation("/admin")}>
                    <Settings2 className="w-4 h-4" />
                    Admin
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem
                  onClick={handleLogout}
                  disabled={loggingOut}
                  data-testid="button-logout"
                >
                  <LogOut className="w-4 h-4" />
                  {lang === "en" ? "Sign out" : "Se déconnecter"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Hero card */}
          <Card className="border-border overflow-hidden">
            <CardContent className="p-4 space-y-4">
              {isLoading ? (
                <p className="text-sm text-muted-foreground">Chargement…</p>
              ) : data ? (
                <>
                  <div className="flex items-center gap-4">
                    <img
                      src={data.photoUrl || avatarUrl}
                      alt={data.pseudo}
                      className="w-16 h-16 rounded-2xl object-cover border border-border"
                    />
                    <div className="flex-1">
                      <div className="text-base font-semibold text-foreground">{data.pseudo}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                        {account?.email && account?.emailVerified ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <Mail className="w-3.5 h-3.5" />
                            {lang === "en" ? "Email verified" : "Email vérifié"}
                          </span>
                        ) : account?.email ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <Mail className="w-3.5 h-3.5" />
                            {lang === "en" ? "Email pending" : "Email à confirmer"}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 text-muted-foreground border border-border">
                            <Mail className="w-3.5 h-3.5" />
                            {lang === "en" ? "No email" : "Aucun email"}
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {data.ville} • {data.age} ans
                      </div>
                      <div className="text-[11px] text-muted-foreground uppercase tracking-wide mt-1">
                        {Boolean(data.visible ?? true) ? (lang === "en" ? "Visible" : "Visible") : (lang === "en" ? "Hidden" : "Invisible")}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="text-xs text-muted-foreground">{lang === "en" ? "Visibility" : "Visibilité"}</div>
                      <Switch
                        checked={Boolean(data.visible ?? true)}
                        onCheckedChange={async (checked) => {
                          await apiRequest("PATCH", "/api/me/profile", { visible: Boolean(checked) });
                          await queryClient.invalidateQueries({ queryKey: [`/api/profiles/${profileId}`] });
                        }}
                        data-testid="switch-profile-visible"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-2xl border border-border bg-card p-3">
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <Coins className="w-4 h-4" /> {lang === "en" ? "Tokens" : "Jetons"}
                      </div>
                      <div className="text-xl font-bold text-foreground mt-1">{tokenBalance}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {lang === "en" ? "Available balance" : "Solde disponible"}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-border bg-card p-3">
                      <div className="text-xs text-muted-foreground flex items-center gap-2">
                        <Megaphone className="w-4 h-4" /> {lang === "en" ? "Ad" : "Annonce"}
                      </div>
                      <div className="text-sm font-semibold text-foreground mt-1">
                        {data.annonce ? (lang === "en" ? "Active" : "Active") : (lang === "en" ? "None" : "Aucune")}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {data.annonce ? data.annonce.title : (lang === "en" ? "Create your first ad" : "Publie ta première annonce")}
                      </div>
                    </div>
                  </div>

                  <Button
                    className="w-full h-12 gap-2"
                    onClick={() => {
                      if (!ensureEmailVerifiedForPublishing()) return;
                      setLocation("/annonce/new");
                    }}
                    data-testid="button-dashboard-primary-annonce"
                  >
                    <Plus className="w-5 h-5" />
                    {data.annonce ? (lang === "en" ? "Update my ad" : "Mettre à jour mon annonce") : (lang === "en" ? "New ad" : "Nouvelle annonce")}
                  </Button>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Profil introuvable.</p>
              )}
            </CardContent>
          </Card>

          {/* Mes annonces */}
          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{lang === "en" ? "My ads" : "Mes annonces"}</CardTitle>
              <CardDescription>
                {lang === "en" ? "Visibility & boosters" : "Visibilité & boosters"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {data?.annonce ? (
                <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-foreground">{data.annonce.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {annonceExpiry?.remainingDays !== null && annonceExpiry?.remainingDays !== undefined
                          ? annonceExpiry.remainingDays > 0
                            ? `Expire dans ${annonceExpiry.remainingDays} jour(s)`
                            : "Expirée (estimation)"
                          : "—"}
                      </div>
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                      {annonceBadges.map((b) => (
                        <span
                          key={b.label}
                          className={
                            "px-2 py-1 rounded-full text-[11px] font-semibold border " +
                            (b.tone === "green"
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                              : b.tone === "red"
                              ? "bg-red-500/10 text-red-400 border-red-500/20"
                              : b.tone === "blue"
                              ? "bg-sky-500/10 text-sky-400 border-sky-500/20"
                              : "bg-white/5 text-muted-foreground border-white/10")
                          }
                        >
                          {b.label}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      className="h-11"
                      onClick={() => {
                        if (!ensureEmailVerifiedForPublishing()) return;
                        setLocation("/annonce/new");
                      }}
                    >
                      {lang === "en" ? "Manage" : "Gérer"}
                    </Button>
                    <Button
                      className="h-11 gap-2"
                      onClick={() => {
                        if (!ensureEmailVerifiedForPublishing()) return;
                        setLocation("/annonce/new");
                      }}
                    >
                      <Rocket className="w-4 h-4" />
                      {lang === "en" ? "Boost" : "Booster"}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
                  <div className="text-sm font-semibold text-foreground">
                    {lang === "en" ? "No active ad" : "Aucune annonce active"}
                  </div>
                  <Button
                    className="h-11 w-full"
                    onClick={() => {
                      if (!ensureEmailVerifiedForPublishing()) return;
                      setLocation("/annonce/new");
                    }}
                  >
                    {lang === "en" ? "Publish now" : "Publier maintenant"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick actions */}
          <Card className="border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-base">{lang === "en" ? "Quick actions" : "Actions rapides"}</CardTitle>
              <CardDescription>{lang === "en" ? "Do the essentials fast" : "L’essentiel, en 1 clic"}</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="h-14 justify-start gap-2"
                onClick={() => {
                  toast({ title: "Achat de jetons bientôt disponible" });
                }}
              >
                <Coins className="w-4 h-4" />
                {lang === "en" ? "Buy tokens" : "Acheter des jetons"}
              </Button>
              <Button
                variant="outline"
                className="h-14 justify-start gap-2"
                onClick={() => {
                  if (!ensureEmailVerifiedForPublishing()) return;
                  setLocation("/annonce/new");
                }}
              >
                <Rocket className="w-4 h-4" />
                {lang === "en" ? "Boost an ad" : "Booster une annonce"}
              </Button>
              <Button
                variant="outline"
                className="h-14 justify-start gap-2"
                onClick={() => scrollToId("section-advanced")}
              >
                <Eye className="w-4 h-4" />
                {lang === "en" ? "Visibility" : "Visibilité"}
              </Button>
              <Button
                variant="outline"
                className="h-14 justify-start gap-2"
                onClick={() => setLocation("/settings")}
              >
                <Settings2 className="w-4 h-4" />
                {lang === "en" ? "Settings" : "Paramètres"}
              </Button>
            </CardContent>
          </Card>

          {/* Advanced settings (kept, but not the main dashboard feel) */}
          <details id="section-advanced" className="rounded-2xl border border-border bg-card">
            <summary className="px-4 py-4 cursor-pointer select-none">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-foreground">
                  {lang === "en" ? "Advanced" : "Avancé"}
                </div>
                <span className="text-xs text-muted-foreground">{lang === "en" ? "Open" : "Ouvrir"}</span>
              </div>
            </summary>
            <div className="px-4 pb-4 space-y-3">
              <div className="flex items-center justify-between gap-4">
                <Label className="text-sm text-foreground">{t("showProfile")}</Label>
                <Switch
                  checked={Boolean(data?.visible ?? true)}
                  onCheckedChange={async (checked) => {
                    await apiRequest("PATCH", "/api/me/profile", { visible: Boolean(checked) });
                    await queryClient.invalidateQueries({ queryKey: [`/api/profiles/${profileId}`] });
                  }}
                />
              </div>

              <details id="section-contact" className="rounded-2xl border border-border bg-background/40">
                <summary className="px-4 py-4 cursor-pointer select-none">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span>{lang === "en" ? "Contact" : "Contact"}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{lang === "en" ? "Open" : "Ouvrir"}</span>
                  </div>
                </summary>
                <div className="px-4 pb-4 space-y-4">
                  <div className="space-y-2">
                    <Label>{lang === "en" ? "Preferred method" : "Méthode mise en avant"}</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        variant={contactPreference === "whatsapp" ? "default" : "outline"}
                        onClick={() => setContactPreference("whatsapp")}
                        type="button"
                      >
                        WhatsApp
                      </Button>
                      <Button
                        variant={contactPreference === "telegram" ? "default" : "outline"}
                        onClick={() => setContactPreference("telegram")}
                        type="button"
                      >
                        Telegram
                      </Button>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Téléphone (WhatsApp)</Label>
                    <Input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+2250700000000"
                      className="h-12"
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        {lang === "en" ? "Show phone" : "Afficher le téléphone"}
                      </span>
                      <Switch checked={showPhone} onCheckedChange={(v) => setShowPhone(Boolean(v))} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Telegram</Label>
                    <Input
                      value={telegram}
                      onChange={(e) => setTelegram(e.target.value)}
                      placeholder="@username"
                      className="h-12"
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        {lang === "en" ? "Show Telegram" : "Afficher Telegram"}
                      </span>
                      <Switch checked={showTelegram} onCheckedChange={(v) => setShowTelegram(Boolean(v))} />
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full h-12"
                    onClick={async () => {
                      await apiRequest("PATCH", "/api/me/profile", {
                        phone: phone.trim() ? phone.trim() : null,
                        showPhone,
                        telegram: telegram.trim() ? telegram.trim() : null,
                        showTelegram,
                        contactPreference,
                      });
                      await queryClient.invalidateQueries({ queryKey: [`/api/profiles/${profileId}`] });
                    }}
                  >
                    {lang === "en" ? "Save contact" : "Enregistrer le contact"}
                  </Button>
                </div>
              </details>

              <details id="section-location" className="rounded-2xl border border-border bg-background/40">
                <summary className="px-4 py-4 cursor-pointer select-none">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <span>{lang === "en" ? "Location" : "Localisation"}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{lang === "en" ? "Open" : "Ouvrir"}</span>
                  </div>
                </summary>
                <div className="px-4 pb-4 space-y-3">
                  <Button
                    variant="secondary"
                    className="w-full h-12"
                    onClick={async () => {
                      if (!navigator.geolocation) {
                        toast({ title: lang === "en" ? "Geolocation unavailable" : "Géolocalisation indisponible" });
                        return;
                      }
                      navigator.geolocation.getCurrentPosition(
                        async (pos) => {
                          const lat = pos.coords.latitude;
                          const lng = pos.coords.longitude;
                          setCoords({ lat, lng });
                          await apiRequest("PATCH", "/api/me/profile", { lat, lng });
                          toast({ title: lang === "en" ? "Location saved" : "Position enregistrée" });
                        },
                        () => {
                          toast({
                            title: lang === "en" ? "Permission denied" : "Permission refusée",
                          });
                        },
                        { enableHighAccuracy: false, timeout: 8000 },
                      );
                    }}
                  >
                    {lang === "en" ? "Use my location" : "Utiliser ma position"}
                  </Button>
                  {coords && (
                    <p className="text-xs text-muted-foreground">
                      {lang === "en" ? "Saved." : "Enregistré."}{" "}
                      <span className="font-mono">
                        {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
                      </span>
                    </p>
                  )}
                  <div className="flex items-center justify-between pt-2">
                    <div className="text-sm text-muted-foreground">
                      {lang === "en"
                        ? "Show exact location on map"
                        : "Afficher ma localisation précise sur la carte"}
                    </div>
                    <Switch
                      checked={showLocation}
                      onCheckedChange={async (v) => {
                        const value = Boolean(v);
                        setShowLocation(value);
                        await apiRequest("PATCH", "/api/me/profile", { showLocation: value });
                        await queryClient.invalidateQueries({ queryKey: [`/api/profiles/${profileId}`] });
                      }}
                    />
                  </div>
                </div>
              </details>
            </div>
          </details>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mx-auto max-w-md">
          <Card className="border-border">
            <CardHeader className="space-y-1">
              <CardTitle className="text-base flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-primary" />
                {lang === "en" ? "Help & support" : "Aide & support"}
              </CardTitle>
              <CardDescription>
                {lang === "en"
                  ? "Find answers, report an issue or reach the NIXYAH team."
                  : "Trouve des réponses, signale un bug ou contacte l’équipe NIXYAH."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="outline"
                className="w-full h-11 justify-between"
                onClick={() => {
                  const email = support?.resetEmail;
                  if (!email) {
                    toast({ title: lang === "en" ? "No support email configured" : "Aucun email support configuré" });
                    return;
                  }
                  window.location.href = `mailto:${email}?subject=${encodeURIComponent(
                    lang === "en" ? "NIXYAH – Bug report" : "NIXYAH – Signalement de bug",
                  )}`;
                }}
              >
                <span className="flex items-center gap-2 text-sm">
                  <AlertCircle className="w-4 h-4 text-destructive" />
                  {lang === "en" ? "Report a bug" : "Signaler un bug"}
                </span>
                <span className="text-[11px] text-muted-foreground">{lang === "en" ? "via email" : "par email"}</span>
              </Button>

              <Button
                variant="outline"
                className="w-full h-11 justify-between"
                onClick={() => {
                  const telegram = support?.telegramUrl;
                  if (telegram) {
                    window.open(telegram, "_blank", "noopener,noreferrer");
                    return;
                  }
                  const email = support?.resetEmail;
                  if (email) {
                    window.location.href = `mailto:${email}?subject=${encodeURIComponent(
                      lang === "en" ? "NIXYAH – Contact" : "NIXYAH – Contact équipe",
                    )}`;
                  } else {
                    toast({ title: lang === "en" ? "No support channel configured" : "Aucun canal support configuré" });
                  }
                }}
              >
                <span className="flex items-center gap-2 text-sm">
                  <Mail className="w-4 h-4 text-primary" />
                  {lang === "en" ? "Contact the team" : "Contacter l’équipe"}
                </span>
                <span className="text-[11px] text-muted-foreground">
                  {support?.telegramUrl ? (lang === "en" ? "via Telegram" : "via Telegram") : lang === "en" ? "via email" : "par email"}
                </span>
              </Button>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <Button variant="outline" className="h-10 justify-start gap-2" onClick={() => setLocation("/conditions")}>
                  <HelpCircle className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs">{lang === "en" ? "FAQ / Help" : "FAQ / Aide"}</span>
                </Button>
                <Button variant="outline" className="h-10 justify-start gap-2" onClick={() => setLocation("/conditions")}>
                  <Info className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs">{lang === "en" ? "Terms & privacy" : "Conditions & confidentialité"}</span>
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Keep account email editor accessible (optional) */}
        <div className="mx-auto max-w-md">
              <details id="section-account-email" className="rounded-2xl border border-border bg-card">
                <summary className="px-4 py-4 cursor-pointer select-none">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2 text-base font-semibold text-foreground">
                        <Mail className="w-4 h-4 text-muted-foreground" />
                        <span>
                          {lang === "en" ? "Account email" : "Email du compte"}
                        </span>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {lang === "en"
                          ? "Used only for password recovery (optional)"
                          : "Utilisé uniquement pour récupérer ton mot de passe (optionnel)"}
                      </div>
                    </div>
                    <span className="text-xs text-muted-foreground">{lang === "en" ? "Open" : "Ouvrir"}</span>
                  </div>
                </summary>
                <div className="px-4 pb-4 space-y-3">
                  <div className="rounded-2xl border border-border bg-background/40 p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-xs font-semibold text-foreground">
                          {lang === "en" ? "Verification" : "Vérification"}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-1">
                          {lang === "en"
                            ? "Email must be verified to publish an ad."
                            : "Pour publier une annonce, l’email doit être confirmé."}
                        </div>
                      </div>
                      <span
                        className={
                          "px-2 py-1 rounded-full text-[11px] font-semibold border " +
                          (account?.email && account?.emailVerified
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                            : account?.email
                              ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
                              : "bg-white/5 text-muted-foreground border-white/10")
                        }
                      >
                        {account?.email && account?.emailVerified
                          ? lang === "en"
                            ? "Verified"
                            : "Vérifié"
                          : account?.email
                            ? lang === "en"
                              ? "Pending"
                              : "À confirmer"
                            : lang === "en"
                              ? "No email"
                              : "Aucun email"}
                      </span>
                    </div>

                    {account?.email && !account?.emailVerified && account?.resendConfigured === false && (
                      <div className="mt-2 text-[11px] text-destructive">
                        {lang === "en"
                          ? "Email sending is not configured on the server (Resend)."
                          : "L’envoi d’emails n’est pas configuré sur le serveur (Resend)."}
                      </div>
                    )}
                  </div>

                  <Input
                    type="email"
                    value={accountEmail}
                    onChange={(e) => setAccountEmail(e.target.value)}
                    placeholder={lang === "en" ? "your@email.com" : "ton.email@example.com"}
                    className="h-11"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {lang === "en"
                      ? "This email is not shown on your profile. It only helps you reset your password."
                      : "Cet email n’est pas affiché sur ton profil. Il sert uniquement à t’aider à récupérer ton mot de passe."}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      className="h-11"
                      disabled={!account?.email || Boolean(account?.emailVerified)}
                      onClick={async () => {
                        const res = await apiRequest("POST", "/api/email/resend");
                        const json = await res.json().catch(() => ({}));
                        if (!res.ok) {
                          toast({
                            title:
                              lang === "en"
                                ? "Unable to resend verification"
                                : "Impossible de renvoyer l’email",
                            description: json?.message ?? (lang === "en" ? "Try again later." : "Réessaie plus tard."),
                          });
                          return;
                        }
                        toast({
                          title:
                            json?.alreadyVerified
                              ? lang === "en"
                                ? "Already verified"
                                : "Déjà vérifié"
                              : lang === "en"
                                ? "Verification email sent"
                                : "Email de confirmation envoyé",
                          description:
                            lang === "en"
                              ? "Check your inbox (and spam) then click the link."
                              : "Vérifie ta boîte mail (et les spams) puis clique sur le lien.",
                        });
                      }}
                    >
                      {lang === "en" ? "Resend" : "Renvoyer"}
                    </Button>
                    <Button
                      variant="outline"
                      className="h-11"
                      onClick={async () => {
                        const trimmed = accountEmail.trim();
                        const body =
                          trimmed.length === 0
                            ? { email: null as string | null }
                            : { email: trimmed };
                        const res = await apiRequest("PATCH", "/api/me/account", body);
                        if (!res.ok) {
                          toast({
                            title: lang === "en" ? "Unable to save email" : "Impossible d’enregistrer l’email",
                          });
                          return;
                        }
                        const json = await res.json().catch(() => null);
                        toast({
                          title: lang === "en" ? "Email saved" : "Email enregistré",
                        });
                        if (json?.verificationEmailSent === true) {
                          toast({
                            title: lang === "en" ? "Verification email sent" : "Email de confirmation envoyé",
                            description:
                              lang === "en"
                                ? "Check your inbox (and spam) then click the link."
                                : "Vérifie ta boîte mail (et les spams) puis clique sur le lien.",
                          });
                        } else if (json?.verificationEmailSent === false) {
                          toast({
                            title:
                              lang === "en"
                                ? "Unable to send verification email"
                                : "Impossible d’envoyer l’email de confirmation",
                            description:
                              json?.verificationEmailError ??
                              (lang === "en"
                                ? "You can retry later from your dashboard."
                                : "Tu pourras réessayer plus tard depuis ton dashboard."),
                          });
                        }
                        await queryClient.invalidateQueries({ queryKey: ["/api/me/account"] });
                      }}
                    >
                      {lang === "en" ? "Save" : "Enregistrer"}
                    </Button>
                  </div>
                </div>
              </details>
        </div>
      </main>
    </div>
  );
}


