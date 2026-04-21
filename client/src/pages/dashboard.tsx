import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Settings2, Megaphone, UserCircle2, Compass, Menu, LogOut, Phone, MapPin, AlertCircle, HelpCircle, Info, Mail, Coins, Rocket, Eye, Plus, Clapperboard, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clearSession, getProfileId } from "@/lib/session";
import { useI18n } from "@/lib/i18n";
import logoTitle from "@assets/logo-titre.png";
import { apiFetch, apiGetJson, apiRequest } from "@/lib/queryClient";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { STORY_PUBLIC_MAX_SECONDS } from "@shared/story-config";
import { setStoredBrowserCoords } from "@/lib/browserLocation";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getProfilePhoto } from "@/lib/profile-photo";

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

type DashboardAnnonce = {
  id: string;
  title: string;
  body: string | null;
  active: boolean;
  createdAt?: string;
  promotion?: any;
};

type DashboardStory = {
  id: string;
  visibility: "public" | "private";
  mediaUrl: string | null;
  durationSeconds: number;
  caption: string | null;
  saleKind?: "none" | "video" | "product";
  saleTitle?: string | null;
  salePrice?: string | null;
  active: boolean;
  expiresAt?: string | null;
  createdAt?: string;
};

type DashboardEvent = {
  id: string;
  title: string;
  city: string;
  startsAt: string;
  visibility: "public" | "private";
  priceType: "free" | "paid";
  priceAmount?: number | null;
  priceCurrency: string;
  status: "draft" | "published" | "cancelled";
  registrationsCount: number;
  publicationCreditsCharged: number;
};

type TokenPackagesResponse = {
  packages: Array<{ id: string; label: string; tokens: number; currency: string; amount: number }>;
  providers?: Array<"paystack" | "mobile_money">;
  defaultProvider?: "paystack" | "mobile_money";
};

function pickCheckoutProvider(config: TokenPackagesResponse | null | undefined): "paystack" | "mobile_money" {
  if (config?.providers?.includes("paystack")) return "paystack";
  return config?.defaultProvider ?? "paystack";
}

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
  const [showTokensDialog, setShowTokensDialog] = useState(false);
  const [pendingStoryToggle, setPendingStoryToggle] = useState<DashboardStory | null>(null);
  const [tokenPackages, setTokenPackages] = useState<Array<{ id: string; label: string; tokens: number; currency: string; amount: number }> | null>(null);
  const [buyingTokens, setBuyingTokens] = useState(false);

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

  const { data: myAnnonces } = useQuery<DashboardAnnonce[]>({
    queryKey: ["/api/me/annonces"],
    enabled: Boolean(profileId),
  });

  const { data: myStories } = useQuery<DashboardStory[]>({
    queryKey: ["/api/me/stories"],
    enabled: Boolean(profileId),
  });

  const canManageEvents = data?.accountType === "salon" || data?.accountType === "residence";

  const { data: myEvents } = useQuery<DashboardEvent[]>({
    queryKey: ["/api/me/events"],
    enabled: Boolean(profileId && canManageEvents),
  });

  const { data: publishingConfig } = useQuery<any>({
    queryKey: ["/api/publishing/config"],
    retry: false,
  });

  const { data: tokenPackagesRes } = useQuery<TokenPackagesResponse>({
    queryKey: ["/api/tokens/packages"],
    retry: false,
  });

  useEffect(() => {
    if (tokenPackagesRes?.packages) setTokenPackages(tokenPackagesRes.packages);
  }, [tokenPackagesRes]);

  const { data: support } = useQuery<{ resetEmail: string | null; telegramUrl: string | null }>({
    queryKey: ["/api/support"],
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

  const persistBrowserLocation = async () => {
    if (!navigator.geolocation) {
      toast({ title: lang === "en" ? "Geolocation unavailable" : "Géolocalisation indisponible" });
      return false;
    }

    return await new Promise<boolean>((resolve) => {
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setStoredBrowserCoords({ lat, lng });
          setCoords({ lat, lng });
          let ville: string | undefined;
          let lieu: string | undefined;

          try {
            const response = await apiFetch(
              `/api/geo/reverse?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`,
            );
            if (response.ok) {
              const geo = (await response.json()) as {
                city?: string | null;
                district?: string | null;
                road?: string | null;
              };
              ville = geo.city?.trim() || undefined;
              lieu = [geo.district, geo.road]
                .map((value) => value?.trim())
                .filter(Boolean)
                .join(" • ") || undefined;
            }
          } catch {
            // keep coords even if reverse lookup fails
          }

          await apiRequest("PATCH", "/api/me/profile", {
            lat,
            lng,
            ...(ville ? { ville } : {}),
            ...(lieu ? { lieu } : {}),
          });
          await queryClient.invalidateQueries({ queryKey: [`/api/profiles/${profileId}`] });
          toast({
            title: lang === "en" ? "Location saved" : "Position enregistrée",
            description:
              ville || lieu
                ? [ville, lieu].filter(Boolean).join(" • ")
                : lang === "en"
                  ? "GPS coordinates saved."
                  : "Coordonnées GPS enregistrées.",
          });
          resolve(true);
        },
        () => {
          toast({
            title: lang === "en" ? "Permission denied" : "Permission refusée",
          });
          resolve(false);
        },
        { enableHighAccuracy: false, timeout: 8000 },
      );
    });
  };

  const getAnnonceBadges = (promotion: any) => {
    const promo = promotion ?? null;
    const badges: Array<{ label: string; tone: "green" | "red" | "blue" | "neutral" }> = [];
    if (promo?.featured?.optionId) badges.push({ label: "PREMIUM", tone: "green" });
    if (promo?.autorenew?.optionId) badges.push({ label: "TOP", tone: "blue" });
    if (promo?.urgent?.optionId) badges.push({ label: "URGENT", tone: "red" });
    if (promo?.extended?.optionId) badges.push({ label: "PROLONGATION", tone: "neutral" });
    return badges;
  };

  const getAnnonceExpiry = (annonce: { createdAt?: string; promotion?: any } | null | undefined) => {
    if (!annonce?.createdAt) return null;
    if (!publishingConfig?.promote) return null;
    const start = new Date(annonce.createdAt);
    if (Number.isNaN(start.getTime())) return null;

    const promo = annonce.promotion ?? {};
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
  };

  const annoncesList = useMemo(
    () => (myAnnonces?.length ? myAnnonces : data?.annonce ? [{ ...data.annonce, active: true }] : []),
    [myAnnonces, data?.annonce],
  );
  const activeAnnoncesCount = annoncesList.filter((annonce) => annonce.active).length;
  const storyList = myStories ?? [];
  const activeStoriesCount = storyList.filter((story) => story.active).length;
  const eventList = myEvents ?? [];

  const tokenBalance = Number(account?.tokensBalance ?? 0);
  const applyStoryToggle = async (story: DashboardStory, nextActive: boolean) => {
    await apiRequest("PATCH", `/api/me/stories/${story.id}`, { active: nextActive });
    await queryClient.invalidateQueries({ queryKey: ["/api/me/stories"] });
    await queryClient.invalidateQueries({ queryKey: ["/api/stories"] });
    await queryClient.invalidateQueries({ queryKey: [`/api/profiles/${profileId}`] });
  };

  const handleStoryToggle = async (story: DashboardStory) => {
    if (story.active && story.visibility === "public" && story.durationSeconds <= STORY_PUBLIC_MAX_SECONDS) {
      setPendingStoryToggle(story);
      return;
    }
    await applyStoryToggle(story, !story.active);
  };

  const ensureEmailVerifiedForPublishing = (): boolean => {
    if (!account?.email) {
      toast({
        title: "Email requis",
        description: "L’adresse email doit être définie et validée dès l’inscription.",
      });
      setLocation("/email/verify");
      return false;
    }
    if (account?.emailVerified === false) {
      toast({
        title: "Confirme ton email avant de publier",
        description: "Ouvre l’écran de vérification email puis confirme ton adresse.",
      });
      setLocation("/email/verify");
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
      <Dialog open={showTokensDialog} onOpenChange={setShowTokensDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">{lang === "en" ? "Buy tokens" : "Acheter des jetons"}</DialogTitle>
            <DialogDescription className="text-xs">
              {lang === "en"
                ? "Secure online payment. Mobile Money will be added next."
                : "Paiement sécurisé en ligne. Mobile Money arrive ensuite."}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 pt-2">
            {(tokenPackages ?? []).length ? (
              (tokenPackages ?? []).map((p) => (
                <Button
                  key={p.id}
                  variant="outline"
                  className="w-full h-12 justify-between"
                  disabled={buyingTokens}
                  onClick={async () => {
                    if (buyingTokens) return;
                    setBuyingTokens(true);
                    try {
                      const freshTokenConfig = await apiGetJson<TokenPackagesResponse>("/api/tokens/packages")
                        .catch(() => tokenPackagesRes ?? null);
                      const selectedProvider = pickCheckoutProvider(freshTokenConfig);

                      let r;
                      try {
                        r = await apiRequest("POST", "/api/tokens/checkout", {
                          packageId: p.id,
                          provider: selectedProvider,
                        });
                      } catch (e: any) {
                        if (e?.status === 501 && selectedProvider !== "paystack") {
                          r = await apiRequest("POST", "/api/tokens/checkout", {
                            packageId: p.id,
                            provider: "paystack",
                          });
                        } else {
                          throw e;
                        }
                      }

                      const json = await r.json();
                      const url = String(json?.checkoutUrl ?? "");
                      if (!url) throw new Error("Checkout URL missing");
                      window.location.href = url;
                    } catch (e: any) {
                      toast({
                        title: lang === "en" ? "Payment unavailable" : "Paiement indisponible",
                        description: e?.message ?? undefined,
                      });
                      setBuyingTokens(false);
                    }
                  }}
                >
                  <span className="text-sm font-semibold">{p.label}</span>
                  <span className="text-xs text-muted-foreground">
                    {p.amount} {p.currency}
                  </span>
                </Button>
              ))
            ) : (
              <div className="text-sm text-muted-foreground">{lang === "en" ? "Loading…" : "Chargement…"}</div>
            )}

            <Button
              variant="ghost"
              className="w-full justify-start"
              onClick={() =>
                toast({
                  title: "Mobile Money",
                  description: lang === "en" ? "Coming soon." : "Bientôt disponible.",
                })
              }
            >
              {lang === "en" ? "Mobile Money (soon)" : "Mobile Money (bientôt)"}
            </Button>
          </div>

          <DialogFooter className="pt-2">
            <Button variant="ghost" type="button" onClick={() => setShowTokensDialog(false)} disabled={buyingTokens}>
              {lang === "en" ? "Close" : "Fermer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(pendingStoryToggle)} onOpenChange={(open) => !open && setPendingStoryToggle(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Masquer cette story ?</DialogTitle>
            <DialogDescription className="text-xs">
              Si cette publication correspond a ta story gratuite, la republier ensuite pourra demander des jetons.
            </DialogDescription>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">
            Avant de continuer, l'utilisateur doit savoir qu'il pourra avoir besoin de recharger ses jetons avant de publier a nouveau.
          </div>
          <DialogFooter className="pt-2">
            <Button variant="ghost" type="button" onClick={() => setPendingStoryToggle(null)}>
              Annuler
            </Button>
            <Button
              type="button"
              onClick={async () => {
                if (!pendingStoryToggle) return;
                const story = pendingStoryToggle;
                setPendingStoryToggle(null);
                await applyStoryToggle(story, false);
              }}
            >
              Masquer quand meme
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <main className="px-4 pb-10 space-y-5 pt-4">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-md space-y-5">
          <div className="flex items-center justify-between border-b border-border/70 pb-4">
            <div className="space-y-1 leading-tight">
              <img src={logoTitle} alt="NIXYAH" className="h-10 w-auto object-contain" draggable={false} />
              <div className="text-xs text-muted-foreground">{lang === "en" ? "Dashboard" : "Dashboard"}</div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-full px-3 h-9 gap-2"
                  data-testid="button-dashboard-menu"
                >
                  <Menu className="w-4 h-4" />
                  <span className="text-xs font-medium">{lang === "en" ? "Menu" : "Menu"}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="w-64 border border-border bg-background"
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

          <section className="space-y-4 border-b border-border/70 pb-5">
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Chargement…</p>
            ) : data ? (
              <>
                <div className="flex items-center gap-4">
                  <img
                    src={getProfilePhoto(data.photoUrl, data.accountType)}
                    alt={data.pseudo}
                    className="w-16 h-16 rounded-2xl object-cover border border-border"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="text-base font-semibold text-foreground">{data.pseudo}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px]">
                      {account?.email && account?.emailVerified ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/20 px-2 py-0.5 text-emerald-400">
                          <Mail className="w-3.5 h-3.5" />
                          {lang === "en" ? "Email verified" : "Email vérifié"}
                        </span>
                      ) : account?.email ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 px-2 py-0.5 text-amber-400">
                          <Mail className="w-3.5 h-3.5" />
                          {lang === "en" ? "Email pending" : "Email à confirmer"}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-muted-foreground">
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

                <div className="flex flex-wrap gap-2">
                  <div className="rounded-full bg-muted/30 px-3 py-2">
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <Coins className="w-4 h-4" /> {lang === "en" ? "Tokens" : "Jetons"}
                    </div>
                    <div className="mt-1 text-base font-semibold text-foreground">{tokenBalance}</div>
                  </div>
                  <div className="rounded-full bg-muted/30 px-3 py-2">
                    <div className="text-xs text-muted-foreground flex items-center gap-2">
                      <Megaphone className="w-4 h-4" /> {lang === "en" ? "Ad" : "Annonce"}
                    </div>
                    <div className="mt-1 text-sm font-semibold text-foreground">
                      {annoncesList.length
                        ? `${activeAnnoncesCount} ${lang === "en" ? "active" : "active"}${activeAnnoncesCount > 1 ? "s" : ""}`
                        : (lang === "en" ? "None" : "Aucune")}
                    </div>
                  </div>
                </div>

                <Button
                  className="w-full h-12 gap-2 rounded-2xl"
                  onClick={() => {
                    if (!ensureEmailVerifiedForPublishing()) return;
                    setLocation("/annonce/new?mode=new");
                  }}
                  data-testid="button-dashboard-primary-annonce"
                >
                  <Plus className="w-5 h-5" />
                  {data.annonce ? (lang === "en" ? "Post another ad" : "Publier une autre annonce") : (lang === "en" ? "New ad" : "Nouvelle annonce")}
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Profil introuvable.</p>
            )}
          </section>

          <section className="space-y-3 border-b border-border/70 pb-5">
            <div>
              <div className="text-base font-semibold text-foreground">{lang === "en" ? "My ads" : "Mes annonces"}</div>
              <div className="text-sm text-muted-foreground">
                {lang === "en" ? "Visibility & boosters" : "Visibilité & boosters"}
              </div>
            </div>
              {annoncesList.length ? (
                <div className="space-y-1">
                  {annoncesList.map((annonce) => {
                    const badges = getAnnonceBadges(annonce.promotion);
                    const expiry = getAnnonceExpiry(annonce);
                    const isVisibleOnProfile = data?.annonce?.id === annonce.id;

                    return (
                      <div key={annonce.id} className="space-y-3 border-b border-border/70 py-4 last:border-b-0">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <div className="text-sm font-semibold text-foreground">{annonce.title}</div>
                              <span className={`rounded-full border px-2 py-0.5 text-[10px] ${annonce.active ? "border-emerald-500/20 text-emerald-400" : "border-border text-muted-foreground"}`}>
                                {annonce.active ? (lang === "en" ? "Active" : "Active") : (lang === "en" ? "Hidden" : "Masquée")}
                              </span>
                              {isVisibleOnProfile ? (
                                <span className="rounded-full border border-primary/20 px-2 py-0.5 text-[10px] text-primary">
                                  {lang === "en" ? "Shown on profile" : "Visible sur le profil"}
                                </span>
                              ) : null}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {expiry?.remainingDays !== null && expiry?.remainingDays !== undefined
                                ? expiry.remainingDays > 0
                                  ? `Expire dans ${expiry.remainingDays} jour(s)`
                                  : "Expirée (estimation)"
                                : annonce.createdAt
                                ? new Date(annonce.createdAt).toLocaleDateString(lang === "en" ? "en-GB" : "fr-FR")
                                : "—"}
                            </div>
                            {annonce.body ? (
                              <div className="mt-2 text-[11px] text-muted-foreground line-clamp-2">{annonce.body}</div>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap justify-end gap-2">
                            {badges.map((b) => (
                              <span
                                key={`${annonce.id}-${b.label}`}
                                className={
                                  "px-2 py-1 rounded-full text-[11px] font-semibold border " +
                                  (b.tone === "green"
                                    ? "text-emerald-400 border-emerald-500/20"
                                    : b.tone === "red"
                                    ? "text-red-400 border-red-500/20"
                                    : b.tone === "blue"
                                    ? "text-sky-400 border-sky-500/20"
                                    : "text-muted-foreground border-border")
                                }
                              >
                                {b.label}
                              </span>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                          {isVisibleOnProfile ? (
                            <Button
                              variant="outline"
                              className="h-11 rounded-2xl border-border/70 bg-muted/10 hover:bg-muted/20"
                              onClick={() => {
                                if (!ensureEmailVerifiedForPublishing()) return;
                                setLocation("/annonce/new?mode=edit");
                              }}
                            >
                              {lang === "en" ? "Manage current ad" : "Gérer l’annonce visible"}
                            </Button>
                          ) : (
                            <div className="hidden sm:block" />
                          )}
                          <Button
                            variant={annonce.active ? "outline" : "default"}
                            className={annonce.active ? "h-11 rounded-2xl border-border/70 bg-muted/10 hover:bg-muted/20" : "h-11 rounded-2xl"}
                            onClick={async () => {
                              await apiRequest("PATCH", `/api/annonces/${annonce.id}`, { active: !annonce.active });
                              await queryClient.invalidateQueries({ queryKey: ["/api/me/annonces"] });
                              await queryClient.invalidateQueries({ queryKey: [`/api/profiles/${profileId}`] });
                            }}
                          >
                            {annonce.active ? (lang === "en" ? "Unpublish" : "Dépublier") : (lang === "en" ? "Republish" : "Republier")}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl bg-muted/20 p-4 space-y-3">
                  <div className="text-sm font-semibold text-foreground">
                    {lang === "en" ? "No active ad" : "Aucune annonce active"}
                  </div>
                  <Button
                    className="h-11 w-full rounded-2xl"
                    onClick={() => {
                      if (!ensureEmailVerifiedForPublishing()) return;
                      setLocation("/annonce/new?mode=new");
                    }}
                  >
                    {lang === "en" ? "Publish now" : "Publier maintenant"}
                  </Button>
                </div>
              )}
          </section>

          <section className="space-y-3 border-b border-border/70 pb-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold text-foreground">{lang === "en" ? "Stories & private videos" : "Stories & vidéos privées"}</div>
                <div className="text-sm text-muted-foreground">
                  {storyList.length
                    ? `${activeStoriesCount} ${lang === "en" ? "active publication(s)" : "publication(s) active(s)"}`
                    : (lang === "en" ? "Publish short stories or private videos" : "Publie des stories courtes ou des vidéos privées")}
                </div>
              </div>
              <Button className="rounded-2xl" onClick={() => setLocation("/stories/new")}>
                <Clapperboard className="mr-2 h-4 w-4" />
                {lang === "en" ? "Publish" : "Publier"}
              </Button>
            </div>

            {storyList.length ? (
              <div className="space-y-1">
                {storyList.slice(0, 5).map((story) => (
                  <div key={story.id} className="space-y-3 border-b border-border/70 py-4 last:border-b-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] ${story.visibility === "public" ? "border-primary/20 text-primary" : "border-amber-500/20 text-amber-400"}`}>
                            {story.visibility === "public" ? "Story 24h" : "Privée"}
                          </span>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] ${story.active ? "border-emerald-500/20 text-emerald-400" : "border-border text-muted-foreground"}`}>
                            {story.active ? (lang === "en" ? "Active" : "Active") : (lang === "en" ? "Hidden" : "Masquée")}
                          </span>
                          <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                            {story.durationSeconds}s
                          </span>
                        </div>
                        <div className="mt-2 text-sm font-semibold text-foreground">
                          {story.saleTitle || story.caption || (story.visibility === "public" ? "Story publiée" : "Vidéo privée")}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          {story.visibility === "public"
                            ? story.expiresAt
                              ? `Expire le ${new Date(story.expiresAt).toLocaleDateString(lang === "en" ? "en-GB" : "fr-FR")}`
                              : "Visible pendant 24h"
                            : story.salePrice
                              ? `${story.salePrice}${story.saleKind === "product" ? " • Produit" : " • Vidéo"}`
                              : "Vidéo privée simple"}
                        </div>
                      </div>
                      <Button
                        variant={story.active ? "outline" : "default"}
                        className={story.active ? "h-10 rounded-2xl border-border/70 bg-muted/10 hover:bg-muted/20" : "h-10 rounded-2xl"}
                        onClick={() => handleStoryToggle(story)}
                      >
                        {story.active ? (lang === "en" ? "Hide" : "Masquer") : (lang === "en" ? "Republish" : "Réactiver")}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl bg-muted/20 p-4 space-y-3">
                <div className="text-sm font-semibold text-foreground">
                  {lang === "en" ? "No story yet" : "Aucune story pour le moment"}
                </div>
                <div className="text-sm text-muted-foreground">
                  {lang === "en"
                    ? "Short clips stay public for 24h. Longer videos become private offers."
                    : "Les clips courts restent publics 24h. Les vidéos plus longues deviennent des offres privées."}
                </div>
                <div className="text-xs text-emerald-600">
                  {lang === "en"
                    ? "Your first public story up to 10 seconds is free."
                    : "Ta première story publique jusqu'à 10 secondes est offerte."}
                </div>
                <Button className="h-11 w-full rounded-2xl" onClick={() => setLocation("/stories/new")}>
                  {lang === "en" ? "Create my first story" : "Créer ma première story"}
                </Button>
              </div>
            )}
          </section>

          {canManageEvents ? (
            <section className="space-y-3 border-b border-border/70 pb-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-base font-semibold text-foreground">Mes évènements</div>
                  <div className="text-sm text-muted-foreground">
                    Publication à 15 crédits. Suivi des inscrits et rappels email.
                  </div>
                </div>
                <Button className="rounded-2xl" onClick={() => setLocation("/events/new")}>
                  <CalendarDays className="mr-2 h-4 w-4" />
                  Créer
                </Button>
              </div>

              {eventList.length ? (
                <div className="space-y-1">
                  {eventList.map((event) => (
                    <div key={event.id} className="space-y-3 border-b border-border/70 py-4 last:border-b-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-sm font-semibold text-foreground">{event.title}</div>
                            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                              {event.visibility === "private" ? "Privé" : "Public"}
                            </span>
                            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
                              {event.status}
                            </span>
                          </div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {new Date(event.startsAt).toLocaleString("fr-FR")} • {event.city}
                          </div>
                          <div className="mt-2 text-[11px] text-muted-foreground">
                            {event.priceType === "paid" ? `${event.priceAmount ?? 0} ${event.priceCurrency}` : "Gratuit"} •{" "}
                            {event.registrationsCount} inscrit(s)
                          </div>
                        </div>
                        <div className="rounded-full bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                          {event.publicationCreditsCharged} crédits
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <Button
                          variant="outline"
                          className="h-11 rounded-2xl border-border/70 bg-muted/10 hover:bg-muted/20"
                          onClick={() => setLocation(`/events/new?eventId=${event.id}`)}
                        >
                          Modifier
                        </Button>
                        <Button
                          className="h-11 rounded-2xl"
                          onClick={() => setLocation(`/dashboard/events/${event.id}/registrations`)}
                        >
                          Voir les inscrits
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl bg-muted/20 p-4 space-y-3">
                  <div className="text-sm font-semibold text-foreground">Aucun évènement publié</div>
                  <div className="text-sm text-muted-foreground">
                    Les salons et résidences peuvent publier des évènements publics ou privés.
                  </div>
                  <Button className="h-11 w-full rounded-2xl" onClick={() => setLocation("/events/new")}>
                    Créer mon premier évènement
                  </Button>
                </div>
              )}
            </section>
          ) : null}

          <section className="space-y-3 border-b border-border/70 pb-5">
            <div>
              <div className="text-base font-semibold text-foreground">{lang === "en" ? "Quick actions" : "Actions rapides"}</div>
              <div className="text-sm text-muted-foreground">{lang === "en" ? "Do the essentials fast" : "L’essentiel, en 1 clic"}</div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                className="h-14 justify-start gap-2 rounded-2xl border-border/70 bg-muted/10 hover:bg-muted/20"
                onClick={() => {
                  setShowTokensDialog(true);
                }}
              >
                <Coins className="w-4 h-4" />
                {lang === "en" ? "Buy tokens" : "Acheter des jetons"}
              </Button>
              <Button
                variant="outline"
                className="h-14 justify-start gap-2 rounded-2xl border-border/70 bg-muted/10 hover:bg-muted/20"
                onClick={() => {
                  if (!ensureEmailVerifiedForPublishing()) return;
                  setLocation("/annonce/new?mode=edit");
                }}
              >
                <Rocket className="w-4 h-4" />
                {lang === "en" ? "Boost an ad" : "Booster une annonce"}
              </Button>
              <Button
                variant="outline"
                className="h-14 justify-start gap-2 rounded-2xl border-border/70 bg-muted/10 hover:bg-muted/20"
                onClick={() => setLocation("/stories/new")}
              >
                <Clapperboard className="w-4 h-4" />
                {lang === "en" ? "Post a story" : "Poster une story"}
              </Button>
              {canManageEvents ? (
                <Button
                  variant="outline"
                  className="h-14 justify-start gap-2 rounded-2xl border-border/70 bg-muted/10 hover:bg-muted/20"
                  onClick={() => setLocation("/events/new")}
                >
                  <CalendarDays className="w-4 h-4" />
                  Créer un évènement
                </Button>
              ) : null}
              <Button
                variant="outline"
                className="h-14 justify-start gap-2 rounded-2xl border-border/70 bg-muted/10 hover:bg-muted/20"
                onClick={() => scrollToId("section-advanced")}
              >
                <Eye className="w-4 h-4" />
                {lang === "en" ? "Visibility" : "Visibilité"}
              </Button>
              <Button
                variant="outline"
                className="h-14 justify-start gap-2 rounded-2xl border-border/70 bg-muted/10 hover:bg-muted/20"
                onClick={() => setLocation("/settings")}
              >
                <Settings2 className="w-4 h-4" />
                {lang === "en" ? "Settings" : "Paramètres"}
              </Button>
            </div>
          </section>

          <details id="section-advanced" className="border-b border-border/70 pb-4">
            <summary className="cursor-pointer select-none py-4">
              <div className="flex items-center justify-between">
                <div className="text-sm font-semibold text-foreground">
                  {lang === "en" ? "Advanced" : "Avancé"}
                </div>
                <span className="text-xs text-muted-foreground">{lang === "en" ? "Open" : "Ouvrir"}</span>
              </div>
            </summary>
            <div className="space-y-4 pb-4">
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

              <details id="section-contact" className="border-b border-border/70 pb-4">
                <summary className="cursor-pointer select-none py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                      <span>{lang === "en" ? "Contact" : "Contact"}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{lang === "en" ? "Open" : "Ouvrir"}</span>
                  </div>
                </summary>
                <div className="space-y-4 pb-1">
                  <div className="space-y-2">
                    <Label>{lang === "en" ? "Preferred method" : "Méthode mise en avant"}</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        variant={contactPreference === "whatsapp" ? "default" : "outline"}
                        onClick={() => setContactPreference("whatsapp")}
                        type="button"
                        className={contactPreference === "whatsapp" ? "rounded-2xl" : "rounded-2xl border-border/70 bg-muted/10 hover:bg-muted/20"}
                      >
                        WhatsApp
                      </Button>
                      <Button
                        variant={contactPreference === "telegram" ? "default" : "outline"}
                        onClick={() => setContactPreference("telegram")}
                        type="button"
                        className={contactPreference === "telegram" ? "rounded-2xl" : "rounded-2xl border-border/70 bg-muted/10 hover:bg-muted/20"}
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
                    className="w-full h-12 rounded-2xl border-border/70 bg-muted/10 hover:bg-muted/20"
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

              <details id="section-location" className="pb-1">
                <summary className="cursor-pointer select-none py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                      <span>{lang === "en" ? "Location" : "Localisation"}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{lang === "en" ? "Open" : "Ouvrir"}</span>
                  </div>
                </summary>
                <div className="space-y-3 pb-1">
                  <Button
                    variant="secondary"
                    className="h-12 w-full rounded-2xl"
                    onClick={persistBrowserLocation}
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
                  <p className="text-xs text-muted-foreground">
                    {lang === "en"
                      ? "When the address is detected, your city and district are saved automatically."
                      : "Quand l’adresse est détectée, la ville et le quartier sont enregistrés automatiquement."}
                  </p>
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
                        if (value && !coords) {
                          const saved = await persistBrowserLocation();
                          if (!saved) {
                            setShowLocation(false);
                            return;
                          }
                        }
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
          <section className="space-y-3 border-b border-border/70 pb-5">
              <div className="text-base font-semibold text-foreground flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-primary" />
                {lang === "en" ? "Help & support" : "Aide & support"}
              </div>
              <div className="text-sm text-muted-foreground">
                {lang === "en"
                  ? "Find answers, report an issue or reach the NIXYAH team."
                  : "Trouve des réponses, signale un bug ou contacte l’équipe NIXYAH."}
              </div>
            <div className="space-y-3">
              <Button
                variant="outline"
                className="h-11 w-full justify-between rounded-2xl border-border/70 bg-muted/10 hover:bg-muted/20"
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
                className="h-11 w-full justify-between rounded-2xl border-border/70 bg-muted/10 hover:bg-muted/20"
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
                <Button variant="outline" className="h-10 justify-start gap-2 rounded-2xl border-border/70 bg-muted/10 hover:bg-muted/20" onClick={() => setLocation("/conditions")}>
                  <HelpCircle className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs">{lang === "en" ? "Terms of use" : "Conditions d'utilisation"}</span>
                </Button>
                <Button variant="outline" className="h-10 justify-start gap-2 rounded-2xl border-border/70 bg-muted/10 hover:bg-muted/20" onClick={() => setLocation("/privacy")}>
                  <Info className="w-4 h-4 text-muted-foreground" />
                  <span className="text-xs">{lang === "en" ? "Privacy & cookies" : "Confidentialité & cookies"}</span>
                </Button>
              </div>
            </div>
          </section>
        </motion.div>

        <div className="mx-auto max-w-md">
              <details id="section-account-email" className="border-b border-border/70 pb-4">
                <summary className="cursor-pointer select-none py-4">
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
                <div className="space-y-3 pb-4">
                  <div className="rounded-2xl bg-muted/20 p-3">
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
                            ? "text-emerald-400 border-emerald-500/20"
                            : account?.email
                              ? "text-amber-400 border-amber-500/20"
                              : "text-muted-foreground border-border")
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
                  <div className="rounded-2xl border border-border/70 bg-background px-4 py-3 text-sm text-foreground">
                    {account?.email ?? (lang === "en" ? "Email missing on this account" : "Email absent sur ce compte")}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {lang === "en"
                      ? "Email setup now happens during registration. If confirmation is still pending, continue from the dedicated verification screen."
                      : "L’email est désormais saisi à l’inscription. Si la confirmation est encore en attente, poursuis depuis l’écran dédié à la vérification."}
                  </p>
                  <Button
                    variant="outline"
                    className="h-11 w-full rounded-2xl border-border/70 bg-muted/10 hover:bg-muted/20"
                    onClick={() => setLocation("/email/verify")}
                  >
                    {lang === "en" ? "Open email verification" : "Ouvrir la vérification email"}
                  </Button>
                </div>
              </details>
        </div>
      </main>
    </div>
  );
}


