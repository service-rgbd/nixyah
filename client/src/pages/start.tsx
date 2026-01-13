import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { Compass, Settings2, UserPlus, LogIn, Sparkles, MapPin, SlidersHorizontal, BadgeCheck, Crown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useQuery } from "@tanstack/react-query";
import { useAppSettings } from "@/lib/appSettings";
import { getProfileId } from "@/lib/session";
import { useI18n } from "@/lib/i18n";
import avatarUrl from "@assets/avatar.png";
import spaPhoto from "@assets/photo_2026-01-09_17-36-41.jpg";
import resiPhoto from "@assets/resi-meublmee.jpg";
import { annonceServiceOptions } from "@/lib/serviceOptions";
import { maleProducts } from "@/lib/maleProducts";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { Salon } from "@shared/schema";

export default function Start() {
  const [, setLocation] = useLocation();
  const [settings, setSettings] = useAppSettings();
  const profileId = getProfileId();
  const hasSession = Boolean(profileId);
  const { lang, t } = useI18n();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geoDenied, setGeoDenied] = useState(false);
  const [spaFilter, setSpaFilter] = useState<"all" | "private" | "spa" | "residence">("all");
  const [zoneFilter, setZoneFilter] = useState<string>("__all__");
  const [quartierFilter, setQuartierFilter] = useState("");
  const [ageRange, setAgeRange] = useState<[number, number]>([18, 40]);
  const [accountTypeFilter, setAccountTypeFilter] = useState<
    "__all__" | "profile" | "residence" | "salon" | "adult_shop"
  >("__all__");
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [rsvpName, setRsvpName] = useState("");
  const [rsvpContact, setRsvpContact] = useState("");
  const [rsvpMessage, setRsvpMessage] = useState("");
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [rsvpDone, setRsvpDone] = useState(false);

  // Geolocation is opt-in (user chooses to enable it).

  type StartProfile = {
    id: string;
    pseudo: string;
    age: number;
    ville: string;
    verified: boolean;
    photoUrl: string | null;
    photos: string[];
    videoUrl: string | null;
    tarif: string | null;
    lieu: string | null;
    services: string[] | null;
    description: string | null;
    distanceKm?: number | null;
    isPro?: boolean;
    isVip?: boolean;
    accountType?: "profile" | "residence" | "salon" | "adult_shop" | null;
  };

  const commonParams = useMemo(
    () => ({
      proOnly: settings.proOnly ? "1" : "0",
      limit: "12",
    }),
    [settings.proOnly],
  );

  const selectedServices = settings.selectedServices ?? [];

  const baseParams = useMemo(() => {
    const sp = new URLSearchParams(commonParams);
    if (selectedServices.length) sp.set("services", selectedServices.join(","));
    return sp;
  }, [commonParams, selectedServices]);

  // Actualités: annonces (tri par createdAt)
  const newsQuery = `/api/annonces?${baseParams.toString()}`;

  // À proximité: annonces (tri par distance)
  const nearbyQuery =
    coords
      ? `/api/annonces?${new URLSearchParams({
          ...Object.fromEntries(baseParams.entries()),
          lat: String(coords.lat),
          lng: String(coords.lng),
          maxDistanceKm: String(settings.maxDistanceKm),
        }).toString()}`
      : null;

  type StartAnnonce = {
    id: string;
    title: string;
    body: string | null;
    active: boolean;
    createdAt: string;
    distanceKm?: number | null;
    promotion?: any;
    promotionMeta?: {
      badges?: string[];
      expiresAt?: string | null;
      remainingDays?: number | null;
    };
    profile: StartProfile;
  };

  const timeAgo = (iso: string) => {
    const t = new Date(iso).getTime();
    if (!Number.isFinite(t)) return "";
    const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
    if (s < 60) return `il y a ${s} secondes`;
    const m = Math.floor(s / 60);
    if (m < 60) return `il y a ${m} mins`;
    const h = Math.floor(m / 60);
    if (h < 24) return `il y a ${h} h`;
    const d = Math.floor(h / 24);
    return `il y a ${d} j`;
  };

  const { data: news, isLoading: newsLoading } = useQuery<StartAnnonce[]>({
    queryKey: [newsQuery],
  });

  const { data: nearby, isLoading: nearbyLoading } = useQuery<StartAnnonce[]>({
    queryKey: nearbyQuery ? [nearbyQuery] : ["__no_nearby__"],
    enabled: Boolean(nearbyQuery),
  });

  const { data: meProfile } = useQuery<StartProfile | null>({
    queryKey: profileId ? [`/api/profiles/${profileId}`] : ["__no_me__"],
    enabled: Boolean(profileId),
  });

  // Profiles list (single, filtered client-side)
  const profilesAllQuery = `/api/profiles?${new URLSearchParams({
    ...(settings.proOnly ? { proOnly: "1" } : {}),
    ...(selectedServices.length ? { services: selectedServices.join(",") } : {}),
    limit: "24",
  }).toString()}`;

  const { data: profilesAll, isLoading: profilesAllLoading } = useQuery<StartProfile[]>({
    queryKey: [profilesAllQuery],
  });

  // VIP (small hook for navigation; the dedicated VIP page does the premium rendering)
  const vipCount = useMemo(() => (profilesAll ?? []).filter((p) => Boolean(p.isVip)).length, [profilesAll]);

  const normalize = (s: string) => s.trim().toLowerCase();
  const applyProfileFilters = (arr: StartProfile[]) => {
    const qQuartier = normalize(quartierFilter);
    return (arr ?? []).filter((p) => {
      if (p.age < ageRange[0] || p.age > ageRange[1]) return false;
      if (zoneFilter !== "__all__" && p.ville !== zoneFilter) return false;
      if (accountTypeFilter !== "__all__" && (p.accountType ?? "profile") !== accountTypeFilter) return false;
      if (qQuartier) {
        const lieu = normalize(p.lieu ?? "");
        if (!lieu.includes(qQuartier)) return false;
      }
      return true;
    });
  };

  const profilesFiltered = useMemo(
    () => applyProfileFilters(profilesAll ?? []),
    [profilesAll, zoneFilter, quartierFilter, ageRange, accountTypeFilter],
  );

  const events = useMemo(
    () => [
      {
        id: "masked-velvet-night",
        title: "Soirée Masquée — Velvet Night",
        date: new Date("2026-01-18T20:00:00"),
        city: "Abidjan",
        tag: "Club privé",
        description: "Masques, élégance, accès sur invitation. Places limitées.",
      },
      {
        id: "z-party-jan",
        title: "Rencontre Z‑Party — Édition Janvier",
        date: new Date("2026-01-31T21:00:00"),
        city: "Abidjan",
        tag: "Z‑Party",
        description: "Rencontres + ambiance premium. Confirmation avant l’accès.",
      },
      {
        id: "private-villa-march",
        title: "Soirée Privée — Villa Sessions",
        date: new Date("2026-03-07T20:30:00"),
        city: "Bonapriso",
        tag: "Privé",
        description: "Villa, sécurité, dress code. Respect & discrétion.",
      },
      {
        id: "masked-march",
        title: "Soirée Masquée — Midnight Rendez‑vous",
        date: new Date("2026-03-14T21:00:00"),
        city: "Cocody",
        tag: "Masquée",
        description: "Évènement à venir. Inscription pour recevoir l’accès.",
      },
      {
        id: "club-march",
        title: "Club Privé — After Hours",
        date: new Date("2026-03-28T22:00:00"),
        city: "Abidjan",
        tag: "After",
        description: "Évènement à venir. Places limitées, validation manuelle.",
      },
    ],
    [],
  );

  const selectedEvent = useMemo(
    () => events.find((e) => e.id === selectedEventId) ?? null,
    [events, selectedEventId],
  );

  const formatEventDate = (d: Date) =>
    new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "fr-FR", {
      weekday: "short",
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(d);

  const submitRsvp = async () => {
    if (!selectedEvent) return;
    setRsvpLoading(true);
    try {
      await apiRequest("POST", "/api/event-rsvp", {
        eventId: selectedEvent.id,
        eventTitle: selectedEvent.title,
        eventDate: formatEventDate(selectedEvent.date),
        name: rsvpName,
        contact: rsvpContact,
        message: rsvpMessage,
      });
      setRsvpDone(true);
    } finally {
      setRsvpLoading(false);
    }
  };

  const topNews = (news ?? []).slice(0, 8);
  const topNearby = (nearby ?? []).slice(0, 8);

  const { data: salonsData, isLoading: salonsLoading } = useQuery<Salon[]>({
    queryKey: ["/api/salons?types=spa,private_massage,residence&limit=12"],
  });

  const openProfile = (id: string) => setLocation(`/profile/${id}`);

  return (
    <div className="min-h-screen bg-background">
      <header className="px-6 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xl md:text-2xl font-semibold text-foreground tracking-tight">
            <MapPin className="w-5 h-5" />
            <span>{lang === "en" ? "Nearby news" : "Actualités à proximité"}</span>
          </div>
          <div className="flex items-center gap-2">
            {!hasSession && (
              <Button
                variant="ghost"
                size="icon"
                className="rounded-full text-muted-foreground hover:text-foreground"
                onClick={() => setLocation("/login")}
                data-testid="button-login-start"
              >
                <LogIn className="w-4 h-4" />
              </Button>
            )}
            <div className="flex items-center text-[10px] rounded-full border border-border px-2 py-1 gap-1 bg-card/70">
              <button
                type="button"
                className={`px-1.5 py-0.5 rounded-full ${
                  lang === "fr" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
                onClick={() => setSettings({ ...settings, language: "fr" as any })}
              >
                FR
              </button>
              <button
                type="button"
                className={`px-1.5 py-0.5 rounded-full ${
                  lang === "en" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
                onClick={() => setSettings({ ...settings, language: "en" as any })}
              >
                EN
              </button>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground rounded-full"
              onClick={() => setLocation("/settings")}
              data-testid="button-open-settings"
            >
              <Settings2 className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="px-6 pb-10">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          {/* Aperçu compact de l'utilisateur (si connecté) */}
          {hasSession && (
            <div className="rounded-3xl border border-border bg-gradient-to-br from-card via-card to-primary/5 p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={meProfile?.photoUrl || avatarUrl}
                    alt="Moi"
                    className="w-11 h-11 rounded-2xl object-cover border border-border"
                    onError={(e) => {
                      const img = e.currentTarget;
                      img.onerror = null;
                      img.src = avatarUrl;
                    }}
                  />
                  <div className="min-w-0">
                    <div className="text-sm font-semibold text-foreground truncate">
                      {lang === "en" ? "Your space" : "Ton espace"}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {meProfile?.pseudo ? `${meProfile.pseudo} • ${meProfile.ville}` : (lang === "en" ? "Manage your profile and visibility" : "Gère ton profil et ta visibilité")}
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="rounded-2xl"
                  onClick={() => setLocation("/dashboard")}
                >
                  {lang === "en" ? "Open" : "Ouvrir"}
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </div>
            </div>
          )}

          {/* Bandeau info défilant (style bannière) */}
          <div className="overflow-hidden rounded-2xl bg-card/80 border border-border px-4 py-3 backdrop-blur shadow-sm">
            <div className="flex items-center gap-3">
              <div className="shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <div className="relative flex-1 overflow-hidden">
                <motion.div
                  key={lang}
                  className="flex gap-8"
                  animate={{ x: ["0%", "-50%"] }}
                  transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
                >
                  {[0, 1].map((i) => (
                    <p
                      key={i}
                      className="whitespace-nowrap text-[11px] leading-relaxed text-muted-foreground"
                    >
                      {lang === "en"
                        ? "NIXYAH • Escorts & VIP nearby • Private massages & SPA • Adult products in discretion • Create your profile anonymously."
                        : "NIXYAH • Escorts-girls & VIP près de toi • Massages privés & salons SPA • Produits adultes en toute discrétion • Crée ton profil anonymement."}
                    </p>
                  ))}
                </motion.div>
              </div>
            </div>
          </div>

          {/* Quick actions (compacts) */}
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant="secondary"
              className="h-10 gap-1 text-xs"
              onClick={() => setLocation("/annonces")}
              data-testid="button-go-ads"
            >
              <Compass className="w-4 h-4" />
              {lang === "en" ? "Ads" : "Annonces"}
            </Button>
            <Button
              variant="outline"
              className="h-10 gap-1 text-xs"
              onClick={() => setLocation("/explore")}
              data-testid="button-go-profiles"
            >
              <Compass className="w-4 h-4" />
              {lang === "en" ? "Escorts" : "Escorts girls"}
            </Button>
            <Button
              variant="outline"
              className="h-10 gap-1 text-xs"
              onClick={() => setLocation(hasSession ? "/dashboard" : "/signup")}
              data-testid="button-go-profile"
            >
              <UserPlus className="w-4 h-4" />
              {hasSession ? t("mySpace") : (lang === "en" ? "Profile" : "Profil")}
            </Button>
          </div>

          {/* VIP shortcut (premium, without breaking existing navigation) */}
          <button
            type="button"
            onClick={() => setLocation("/vip")}
            className="w-full rounded-3xl border border-amber-500/20 bg-gradient-to-r from-amber-500/10 via-card/70 to-card px-4 py-4 shadow-[0_18px_60px_-45px_rgba(245,158,11,0.55)]"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-black/25 border border-white/10 flex items-center justify-center">
                  <Crown className="w-5 h-5 text-amber-300" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-semibold text-foreground">
                    {lang === "en" ? "VIP Escorts & VIP Masseuses" : "Escortes VIP & Masseuses VIP"}
                  </div>
                  <div className="text-[11px] text-muted-foreground">
                    {lang === "en"
                      ? "Premium profiles pinned on top."
                      : "Profils premium épinglés en premier."}
                  </div>
                </div>
              </div>
              <div className="inline-flex items-center gap-2">
                {vipCount ? (
                  <span className="px-2 py-0.5 rounded-full text-[10px] bg-black/25 border border-white/10 text-foreground/90">
                    {vipCount} VIP
                  </span>
                ) : null}
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </div>
            </div>
          </button>

          {/* Filtres principaux (pour salons, annonces, escorts-girls, produits) */}
          <div>
            <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
              <SheetTrigger asChild>
                <Button
                  variant="outline"
                  className="w-full justify-between rounded-2xl text-xs px-4 py-3 border-dashed"
                  data-testid="button-open-filters"
                >
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <SlidersHorizontal className="w-4 h-4" />
                    <Sparkles className="w-4 h-4 text-yellow-400 drop-shadow-[0_0_14px_rgba(250,204,21,0.85)] animate-pulse" />
                    {lang === "en" ? "Search filters" : "Filtres de recherche"}
                  </span>
                  <span className="text-[10px] text-muted-foreground truncate max-w-[55%] text-right">
                    {lang === "en"
                      ? "Salons, ads, escorts & products"
                      : "Salons, annonces, escorts & produits"}
                  </span>
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[100svh] rounded-none overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>{lang === "en" ? "Search filters" : "Filtres de recherche"}</SheetTitle>
                  <SheetDescription>
                    {lang === "en"
                      ? "These settings apply to salons & SPA, nearby news, escorts profiles and adult products suggestions."
                      : "Ces réglages s'appliquent aux salons & SPA, actualités, profils (escorts-girls) et suggestions de produits adultes."}
                  </SheetDescription>
                </SheetHeader>

                <div className="mt-6 space-y-6">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {lang === "en" ? "0) Profile search" : "0) Recherche profils"}
                  </div>

                  <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{lang === "en" ? "Age" : "Âge"}</span>
                      <span className="font-semibold text-foreground">
                        {ageRange[0]}–{ageRange[1]}
                      </span>
                    </div>
                    <Slider
                      value={ageRange}
                      min={18}
                      max={60}
                      step={1}
                      onValueChange={(v) => setAgeRange(v as [number, number])}
                    />

                    <div className="grid grid-cols-2 gap-2 pt-2">
                      <div className="rounded-2xl border border-border bg-background/50 p-3">
                        <div className="text-xs text-muted-foreground">{lang === "en" ? "Zone" : "Zone"}</div>
                        <select
                          className="mt-2 w-full bg-transparent text-sm outline-none"
                          value={zoneFilter}
                          onChange={(e) => setZoneFilter(e.target.value)}
                        >
                          <option value="__all__">{lang === "en" ? "All" : "Toutes"}</option>
                          {Array.from(new Set((profilesAll ?? []).map((p) => p.ville).filter(Boolean)))
                            .sort()
                            .map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                        </select>
                      </div>
                      <div className="rounded-2xl border border-border bg-background/50 p-3">
                        <div className="text-xs text-muted-foreground">{lang === "en" ? "District" : "Quartier"}</div>
                        <Input
                          value={quartierFilter}
                          onChange={(e) => setQuartierFilter(e.target.value)}
                          placeholder={lang === "en" ? "e.g. Bonapriso" : "ex: Bonapriso"}
                          className="mt-2 h-9 rounded-xl"
                        />
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border bg-background/50 p-3">
                      <div className="text-xs text-muted-foreground">{lang === "en" ? "Profile type" : "Type de profil"}</div>
                      <select
                        className="mt-2 w-full bg-transparent text-sm outline-none"
                        value={accountTypeFilter}
                        onChange={(e) => setAccountTypeFilter(e.target.value as any)}
                      >
                        <option value="__all__">{lang === "en" ? "All types" : "Tous types"}</option>
                        <option value="profile">{lang === "en" ? "Escort / profile" : "Escort / profil"}</option>
                        <option value="residence">{lang === "en" ? "Residence" : "Résidence"}</option>
                        <option value="salon">{lang === "en" ? "Salon / SPA" : "Salon / SPA"}</option>
                        <option value="adult_shop">{lang === "en" ? "Adult shop" : "Boutique adulte"}</option>
                      </select>
                    </div>
                  </div>

                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {lang === "en" ? "1) Visibility" : "1) Visibilité"}
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <Label className="text-sm text-foreground">{t("proOnly")}</Label>
                    <Switch
                      checked={settings.proOnly}
                      onCheckedChange={(checked) => setSettings({ ...settings, proOnly: Boolean(checked) })}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                      {lang === "en" ? "2) Distance" : "2) Distance"}
                    </div>
                    <Label className="text-sm text-foreground">
                      {lang === "en" ? "Max distance" : "Distance max"}{" "}
                      <span className="text-primary font-medium">• {settings.maxDistanceKm} km</span>
                    </Label>
                    <Slider
                      value={[settings.maxDistanceKm]}
                      min={1}
                      max={50}
                      step={1}
                      onValueChange={(v) =>
                        setSettings({ ...settings, maxDistanceKm: v[0] ?? settings.maxDistanceKm })
                      }
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        {lang === "en" ? "3) Practices" : "3) Pratiques"}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground"
                        onClick={() => setSettings({ ...settings, selectedServices: [] })}
                      >
                        {lang === "en" ? "Clear" : "Effacer"}
                      </Button>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {selectedServices.length
                        ? lang === "en"
                          ? `${selectedServices.length} selected`
                          : `${selectedServices.length} sélectionnées`
                        : lang === "en"
                          ? "All practices"
                          : "Toutes les pratiques"}
                    </div>
                    <ScrollArea className="h-56 rounded-2xl border border-border bg-muted/20">
                      <div className="p-3 space-y-2">
                        {annonceServiceOptions.map((s) => {
                          const checked = selectedServices.includes(s);
                          return (
                            <label key={s} className="flex items-center gap-3 py-2">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(v) => {
                                  const on = Boolean(v);
                                  const next = on
                                    ? Array.from(new Set([...selectedServices, s]))
                                    : selectedServices.filter((x) => x !== s);
                                  setSettings({ ...settings, selectedServices: next });
                                }}
                              />
                              <span className="text-sm text-foreground">{s}</span>
                            </label>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </div>
                </div>
              </SheetContent>
            </Sheet>
          </div>

          {/* Produits masculins / adultes (juste sous le filtre) */}
          <div className="space-y-3">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-sm font-semibold text-foreground">
                  {lang === "en" ? "Energy & men’s care" : "Énergie & produits masculins"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {lang === "en"
                    ? "Selection of endurance and comfort products."
                    : "Sélection de produits pour l’endurance et le confort."}
                </div>
              </div>
            </div>
            <Carousel opts={{ align: "start", dragFree: true }} className="w-full">
              <CarouselContent>
                {maleProducts.slice(0, 5).map((p) => (
                  <CarouselItem key={p.id} className="basis-[86%] sm:basis-[60%] md:basis-[38%] lg:basis-[30%]">
                    <button
                      type="button"
                      onClick={() => setLocation(`/adult-products/${p.id}`)}
                      className="w-full rounded-3xl bg-card border border-border overflow-hidden shadow-sm text-left"
                    >
                      <div className="relative h-44">
                        <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] text-white/90">
                          <span className="px-2 py-0.5 rounded-full bg-black/50 border border-white/10">
                            {p.tag}
                          </span>
                          <span className="font-semibold bg-primary/90 text-xs px-2 py-1 rounded-full">
                            {p.price}
                          </span>
                        </div>
                      </div>
                      <div className="p-3 space-y-1">
                        <div className="text-sm font-semibold text-foreground line-clamp-2">{p.name}</div>
                        <div className="text-[11px] text-muted-foreground">{p.size}</div>
                        <p className="text-[11px] text-muted-foreground line-clamp-3">{p.description}</p>
                      </div>
                    </button>
                  </CarouselItem>
                ))}
                {maleProducts.length > 5 && (
                  <CarouselItem className="basis-[60%] sm:basis-[40%] md:basis-[28%] lg:basis-[22%]">
                    <button
                      type="button"
                      onClick={() => setLocation("/adult-products")}
                      className="w-full h-full min-h-[220px] rounded-3xl border border-dashed border-border/70 bg-card/60 flex flex-col items-center justify-center gap-2 text-xs text-muted-foreground"
                    >
                      <span className="text-2xl">➜</span>
                      <span className="font-medium">{lang === "en" ? "See more" : "Voir plus"}</span>
                      <span>{maleProducts.length} {lang === "en" ? "products" : "produits"}</span>
                    </button>
                  </CarouselItem>
                )}
              </CarouselContent>
            </Carousel>
          </div>

          {/* Événements / espaces publicitaires (à venir) */}
          <div className="space-y-3">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-sm font-semibold text-foreground">
                  {lang === "en" ? "Upcoming events" : "Événements à venir"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {lang === "en"
                    ? "Masked nights, private clubs, Z‑party meetings. Participate if you want — we’ll contact you before the date."
                    : "Soirées masquées, clubs privés, rencontres Z‑party. Tu peux participer si tu veux — on te contacte avant la date."}
                </div>
              </div>
            </div>

            <Carousel opts={{ align: "start", dragFree: true }} className="w-full">
              <CarouselContent>
                {events.map((ev) => (
                  <CarouselItem key={ev.id} className="basis-[92%] sm:basis-[60%] md:basis-[45%] lg:basis-[34%]">
                    <div className="w-full rounded-3xl bg-card border border-border overflow-hidden shadow-sm">
                      <div className="p-4 space-y-2">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-foreground line-clamp-2">{ev.title}</div>
                            <div className="text-[11px] text-muted-foreground mt-1">
                              {formatEventDate(ev.date)} • {ev.city}
                            </div>
                          </div>
                          <span className="shrink-0 px-3 py-1 rounded-full text-[11px] bg-primary/10 border border-primary/20 text-primary">
                            {ev.tag}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground line-clamp-3">{ev.description}</p>
                        <Button
                          className="w-full rounded-2xl"
                          onClick={() => {
                            setSelectedEventId(ev.id);
                            setEventDialogOpen(true);
                            setRsvpDone(false);
                            setRsvpName("");
                            setRsvpContact("");
                            setRsvpMessage("");
                          }}
                        >
                          {lang === "en" ? "Participate" : "Participer"}
                        </Button>
                      </div>
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
            </Carousel>
          </div>

          {/* Profils (liste verticale par catégories) */}
          <div className="space-y-3">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-lg font-semibold text-foreground">
                  {lang === "en" ? "Profiles" : "Profils"}
                </div>
                <div className="text-sm text-muted-foreground">
                  {lang === "en"
                    ? "A clean list preview — no swipe."
                    : "Aperçu propre en liste — sans swipe."}
                </div>
              </div>
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setLocation("/explore")}>
                {lang === "en" ? "Open" : "Voir"}
              </Button>
            </div>

            <div>
              <Button
                variant="outline"
                className="min-h-9 w-full justify-between rounded-2xl text-xs px-4 py-3 border-dashed"
                data-testid="button-open-filters-profiles"
                onClick={() => setFiltersOpen(true)}
              >
                <span className="flex items-center gap-2 text-muted-foreground">
                  <SlidersHorizontal className="w-4 h-4" />
                  {lang === "en" ? "Search filters" : "Filtres de recherche"}
                </span>
                <span className="text-[10px] text-muted-foreground truncate max-w-[55%] text-right">
                  {lang === "en" ? "Salons, ads, escorts & products" : "Salons, annonces, escorts & produits"}
                </span>
              </Button>
            </div>

            <div className="grid gap-2">
              {profilesAllLoading ? (
                <>
                  <div className="h-20 rounded-2xl bg-muted/40 border border-border" />
                  <div className="h-20 rounded-2xl bg-muted/40 border border-border" />
                  <div className="h-20 rounded-2xl bg-muted/40 border border-border" />
                </>
              ) : profilesFiltered.length === 0 ? (
                <div className="rounded-2xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                  {lang === "en" ? "No profiles for current filters." : "Aucun profil avec les filtres actuels."}
                </div>
              ) : (
                <>
                  {profilesFiltered.slice(0, 4).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => openProfile(p.id)}
                      className="w-full text-left rounded-2xl border border-border bg-card/80 hover:bg-card transition-colors overflow-hidden"
                    >
                      <div className="flex items-center gap-3 p-3">
                        <img
                          src={p.photoUrl || avatarUrl}
                          alt={p.pseudo}
                          className="w-14 h-14 rounded-2xl object-cover border border-border"
                          onError={(e) => {
                            const img = e.currentTarget;
                            img.onerror = null;
                            img.src = avatarUrl;
                          }}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-semibold text-foreground truncate">
                            {p.pseudo} • {p.age}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {p.ville} {p.lieu ? `• ${p.lieu}` : ""}
                          </div>
                          <div className="mt-1 text-[11px] text-muted-foreground line-clamp-1">
                            {p.description ?? (lang === "en" ? "Tap to view details." : "Appuie pour voir la fiche.")}
                          </div>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
                      </div>
                    </button>
                  ))}

                  {(profilesFiltered.length ?? 0) > 4 && (
                    <button
                      type="button"
                      onClick={() => setLocation("/explore")}
                      className="w-full rounded-2xl border border-dashed border-border/70 bg-card/60 px-4 py-4 text-sm text-muted-foreground hover:bg-card/80 transition-colors"
                      data-testid="button-see-all-profiles"
                    >
                      {lang === "en" ? "Tap to see all profiles" : "Toucher pour voir tous les profils"}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
          {/* Salon massages privés / SPA */}
          <div className="space-y-3">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-sm font-semibold text-foreground">
                  {lang === "en" ? "Private massages & spa" : "Massages privés & SPA"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {lang === "en"
                    ? "Relax lounge: private massages, spa & residences."
                    : "Espace détente : massages privés, SPA & résidences meublées."}
                </div>
              </div>
            </div>
            <div className="flex gap-2 text-[11px]">
              {[
                { id: "all", labelFr: "Tout", labelEn: "All" },
                { id: "private", labelFr: "Massages privés", labelEn: "Private massages" },
                { id: "spa", labelFr: "SPA", labelEn: "SPA" },
                { id: "residence", labelFr: "Résidences", labelEn: "Residences" },
              ].map((opt) => {
                const active = spaFilter === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSpaFilter(opt.id as any)}
                    className={`px-3 py-1.5 rounded-full border text-xs ${
                      active
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-muted/40 text-muted-foreground"
                    }`}
                  >
                    {lang === "en" ? opt.labelEn : opt.labelFr}
                  </button>
                );
              })}
            </div>
            <div className="flex gap-3 overflow-x-auto no-scrollbar pb-1">
              {salonsLoading && (
                <div className="min-w-[220px] h-40 rounded-3xl bg-muted/40 border border-border" />
              )}
              {!salonsLoading &&
                (salonsData ?? [])
                  .filter((s) => {
                    if (spaFilter === "all") return true;
                    if (spaFilter === "spa") return s.type === "spa";
                    if (spaFilter === "private") return s.type === "private_massage";
                    if (spaFilter === "residence") return s.type === "residence";
                    return true;
                  })
                  .map((s) => {
                    const image =
                      (s.mediaUrls && s.mediaUrls[0]) ||
                      (s.type === "residence" ? resiPhoto : spaPhoto);
                    const hours = s.openingHours;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setLocation("/annonces")}
                        className="min-w-[220px] max-w-[240px] rounded-3xl bg-card border border-border overflow-hidden shadow-sm text-left"
                      >
                        <div className="relative h-40">
                          <img
                            src={image}
                            alt={s.name}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] text-white/90">
                            <span className="px-2 py-0.5 rounded-full bg-black/50 border border-white/10">
                              {s.type === "spa"
                                ? "SPA"
                                : s.type === "private_massage"
                                  ? "Massage privé"
                                  : "Résidence"}
                            </span>
                            {hours && (
                              <span className="font-semibold bg-white/10 text-xs px-2 py-1 rounded-full flex items-center gap-1">
                                <Sparkles className="w-3 h-3" />
                                {hours}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="p-3 space-y-1">
                          <div className="text-sm font-semibold text-foreground line-clamp-2">
                            {s.name}
                          </div>
                          <p className="text-[11px] text-muted-foreground line-clamp-3">
                            {s.description ??
                              (s.type === "spa"
                                ? "Ambiance spa, huiles chaudes et détente complète."
                                : s.type === "private_massage"
                                  ? "Sélection de praticiennes pour un massage discret à domicile."
                                  : "Appartements meublés discrets pour vos séjours et rendez-vous.")}
                          </p>
                        </div>
                      </button>
                    );
                  })}
              {!salonsLoading && (salonsData?.length ?? 0) === 0 && (
                <div className="min-w-[220px] rounded-3xl border border-border bg-muted/30 px-4 py-3 text-[12px] text-muted-foreground">
                  {lang === "en"
                    ? "No spa, massage room or residence available yet."
                    : "Aucun SPA, salon privé ou résidence disponible pour le moment."}
                </div>
              )}
            </div>
          </div>

          {/* Actualités */}
          <div className="space-y-3">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-lg font-semibold text-foreground">
                  {lang === "en" ? "News" : "Actualités"}
                </div>
                <div className="text-sm text-muted-foreground">
                  {lang === "en" ? "Latest ads" : "Dernières annonces"}
                </div>
              </div>
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setLocation("/annonces")}>
                {lang === "en" ? "See all" : "Tout voir"}
              </Button>
            </div>
            <div className="space-y-2">
              {(newsLoading ? Array.from({ length: 6 }) : topNews.slice(0, 8)).map((a: any, idx: number) =>
                newsLoading ? (
                  <div key={idx} className="h-24 rounded-2xl bg-muted/40 border border-border" />
                ) : (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => openProfile(a.profile.id)}
                    className="w-full text-left rounded-2xl border border-border bg-card/70 hover:bg-card/90 transition-colors overflow-hidden"
                  >
                    <div className="flex">
                      <div className="relative w-28 h-24 shrink-0 bg-muted overflow-hidden">
                        <img
                          src={a.profile.photoUrl || avatarUrl}
                          alt={a.profile.pseudo}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const img = e.currentTarget;
                            img.onerror = null;
                            img.src = avatarUrl;
                          }}
                        />
                        <div className="absolute top-2 left-2 flex flex-col gap-1">
                          {a.profile.isVip ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/90 text-white font-semibold">
                              VIP
                            </span>
                          ) : null}
                          {(a.promotionMeta?.badges ?? []).includes("URGENT") ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] bg-red-500/90 text-white font-semibold">
                              Urgent
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className="flex-1 p-3 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-sm font-semibold text-foreground line-clamp-2">
                              {a.title}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1 truncate">
                              Publié par{" "}
                              <span className="text-foreground/90 font-medium">{a.profile.pseudo}</span>{" "}
                              {a.profile.isPro ? <span className="text-muted-foreground">(pro)</span> : null}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                              <MapPin className="w-3.5 h-3.5" />
                              <span className="truncate">{a.profile.ville}</span>
                            </div>
                          </div>

                          <div className="shrink-0 text-[11px] text-muted-foreground">
                            {timeAgo(a.createdAt)}
                          </div>
                        </div>

                        <div className="mt-2 flex items-center justify-between gap-3">
                          <div className="text-[11px] text-muted-foreground">
                            {(a.profile.photos?.length ?? 0) > 0 ? `${a.profile.photos.length} photos` : "—"}
                          </div>
                          <div className="flex gap-1.5 flex-wrap justify-end">
                            {(a.promotionMeta?.badges ?? [])
                              .filter((b: string) => b !== "URGENT")
                              .slice(0, 3)
                              .map((b: string) => (
                                <span
                                  key={b}
                                  className="px-2 py-0.5 rounded-full text-[10px] bg-muted/40 border border-border text-foreground/80"
                                >
                                  {b === "PROLONGATION" ? "Prolong." : b}
                                </span>
                              ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </button>
                ),
              )}
            </div>
          </div>

          <Separator />

          {/* À proximité */}
          <div className="space-y-3">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-lg font-semibold text-foreground">
                  {lang === "en" ? "Nearby" : "À proximité"}
                </div>
                <div className="text-sm text-muted-foreground">
                  {coords
                    ? lang === "en"
                      ? `Within ${settings.maxDistanceKm} km`
                      : `Dans un rayon de ${settings.maxDistanceKm} km`
                    : lang === "en"
                      ? "Enable location to see nearby"
                      : "Active la position pour voir près de toi"}
                </div>
              </div>
              {!coords ? (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => {
                    if (!navigator.geolocation) return;
                    navigator.geolocation.getCurrentPosition(
                      (pos) => {
                        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
                        setGeoDenied(false);
                      },
                      () => setGeoDenied(true),
                      { enableHighAccuracy: false, timeout: 8000 },
                    );
                  }}
                >
                  {lang === "en" ? "Use my location" : "Utiliser ma position"}
                </Button>
              ) : (
                <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setLocation("/annonces")}>
                  {lang === "en" ? "Open feed" : "Ouvrir le feed"}
                </Button>
              )}
            </div>

            {geoDenied && !coords ? (
              <div className="rounded-2xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                {lang === "en"
                  ? "Location permission was denied. You can still browse profiles from Explore."
                  : "Permission de localisation refusée. Tu peux quand même explorer les profils."}
              </div>
            ) : null}

            <div className="grid gap-3">
              {(!coords ? [] : topNearby.slice(0, 3)).map((a) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => openProfile(a.profile.id)}
                  className="w-full text-left rounded-3xl border border-border bg-card/80 backdrop-blur overflow-hidden hover:bg-card/95 transition-colors"
                >
                    <div className="flex">
                      <div className="w-24 h-24 bg-muted shrink-0 rounded-3xl overflow-hidden">
                      <img
                        src={a.profile.photoUrl || avatarUrl}
                        alt={a.profile.pseudo}
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const img = e.currentTarget;
                          img.onerror = null;
                          img.src = avatarUrl;
                        }}
                      />
                    </div>
                    <div className="flex-1 px-4 py-3 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="font-semibold text-foreground truncate">{a.title}</div>
                          </div>
                          <div className="text-sm text-muted-foreground mt-1 truncate">
                            {a.profile.pseudo} • {a.profile.age}
                          </div>
                          <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                            <MapPin className="w-3.5 h-3.5" />
                            <span className="truncate">{a.profile.ville}</span>
                          </div>
                        </div>
                        {typeof a.distanceKm === "number" ? (
                          <div className="shrink-0 px-2.5 py-1 rounded-full text-xs bg-muted/60 text-foreground/80 border border-border">
                            {a.distanceKm.toFixed(1)} km
                          </div>
                        ) : null}
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {(a.profile.services ?? []).slice(0, 3).map((s: string) => (
                          <span key={s} className="px-2.5 py-1 rounded-full text-[11px] bg-muted/60 text-foreground/80 border border-border">
                            {s}
                          </span>
                        ))}
                        {a.profile.tarif ? (
                          <span className="px-2.5 py-1 rounded-full text-[11px] bg-primary text-white font-semibold">
                            {a.profile.tarif}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </button>
              ))}

              {coords && nearbyLoading ? (
                <div className="h-24 rounded-2xl bg-muted/40 border border-border" />
              ) : null}

              {coords && !nearbyLoading && topNearby.length === 0 ? (
                <div className="rounded-2xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                  {lang === "en"
                    ? "No profiles found nearby with your current filters."
                    : "Aucun profil proche trouvé avec tes filtres actuels."}
                </div>
              ) : null}
            </div>
          </div>
        </motion.div>

        <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
          <DialogContent className="rounded-3xl">
            <DialogHeader>
              <DialogTitle>{selectedEvent?.title ?? (lang === "en" ? "Event" : "Évènement")}</DialogTitle>
              <DialogDescription>
                {selectedEvent
                  ? `${formatEventDate(selectedEvent.date)} • ${selectedEvent.city}`
                  : (lang === "en" ? "Fill the form to participate." : "Remplis le formulaire pour participer.")}
              </DialogDescription>
            </DialogHeader>

            {rsvpDone ? (
              <div className="rounded-2xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                {lang === "en"
                  ? "Your request is recorded. We’ll contact you before the event date."
                  : "Ta demande est enregistrée. On te contactera avant la date de l’évènement."}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{lang === "en" ? "Name" : "Nom"}</Label>
                  <Input value={rsvpName} onChange={(e) => setRsvpName(e.target.value)} placeholder={lang === "en" ? "Your name" : "Ton nom"} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{lang === "en" ? "Contact (phone or email)" : "Contact (téléphone ou email)"}</Label>
                  <Input value={rsvpContact} onChange={(e) => setRsvpContact(e.target.value)} placeholder={lang === "en" ? "Phone / Email" : "Téléphone / Email"} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{lang === "en" ? "Message (optional)" : "Message (optionnel)"}</Label>
                  <Textarea value={rsvpMessage} onChange={(e) => setRsvpMessage(e.target.value)} placeholder={lang === "en" ? "Notes…" : "Notes…"} className="rounded-2xl" />
                </div>
                <Button
                  className="w-full rounded-2xl"
                  disabled={rsvpLoading || !rsvpName.trim() || !rsvpContact.trim() || !selectedEvent}
                  onClick={submitRsvp}
                >
                  {rsvpLoading ? (lang === "en" ? "Sending…" : "Envoi…") : (lang === "en" ? "Confirm participation" : "Confirmer la participation")}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}



