import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  Crown,
  MapPin,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useAppSettings } from "@/lib/appSettings";
import { useI18n } from "@/lib/i18n";
import { annonceServiceOptions } from "@/lib/serviceOptions";
import { getStoredBrowserCoords, requestBrowserCoords } from "@/lib/browserLocation";
import { getDefaultProfilePhoto, getProfilePhoto } from "@/lib/profile-photo";
import { rememberProfileBook } from "@/lib/profile-book";

function dedupeMedia(urls: Array<string | null | undefined>) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const url of urls) {
    if (!url) continue;
    const stable = url.split("#")[0]?.split("?")[0] ?? url;
    if (seen.has(stable)) continue;
    seen.add(stable);
    out.push(url);
  }
  return out;
}

type ApiProfile = {
  id: string;
  pseudo: string;
  age: number;
  ville: string;
  lieu: string | null; // utilisé comme "quartier" / lieu approx
  verified: boolean;
  isPro?: boolean | null;
  isVip?: boolean;
  photoUrl: string | null;
  photos?: string[] | null;
  description: string | null;
  services?: string[] | null;
  tarif?: string | null;
  disponibilite?: { date: string; heureDebut: string; duree: string } | null;
  distanceKm?: number | null;
  accountType?: "profile" | "residence" | "salon" | "adult_shop" | null;
  latestAnnonce?: { id: string; title: string; createdAt: string; badges?: string[] } | null;
};

function getAccountTypeLabel(accountType: ApiProfile["accountType"], lang: "fr" | "en") {
  if (accountType === "residence") return lang === "en" ? "Residence" : "Résidence";
  if (accountType === "salon") return "Salon / SPA";
  if (accountType === "adult_shop") return lang === "en" ? "Adult shop" : "Boutique adulte";
  return lang === "en" ? "Profile" : "Profil";
}

function formatRelativeTime(iso: string, lang: "fr" | "en") {
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return "";
  const diffSec = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (diffSec < 60) return lang === "en" ? `${diffSec}s ago` : `il y a ${diffSec}s`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return lang === "en" ? `${diffMin}min ago` : `il y a ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return lang === "en" ? `${diffH}h ago` : `il y a ${diffH}h`;
  const diffD = Math.round(diffH / 24);
  return lang === "en" ? `${diffD}d ago` : `il y a ${diffD}j`;
}

function ProfileRow({
  p,
  onClick,
  lang,
}: {
  p: ApiProfile;
  onClick: () => void;
  lang: "fr" | "en";
}) {
  const badges = p.latestAnnonce?.badges ?? [];
  const urgent = badges.includes("URGENT");
  const premium = badges.includes("PREMIUM");
  const top = badges.includes("TOP");
  const previewPhotos = dedupeMedia([p.photoUrl, ...(p.photos ?? [])]).slice(0, 3);
  const title = p.latestAnnonce?.title?.trim()
    ? p.latestAnnonce?.title
    : `${p.pseudo} • ${p.age}`;
  const accountLabel = getAccountTypeLabel(p.accountType, lang);
  const primaryPhoto = previewPhotos[0] || getProfilePhoto(p.photoUrl, p.accountType);

  return (
    <button
      type="button"
      onClick={onClick}
      className="group w-full border-b border-border/60 py-3 text-left transition last:border-b-0"
    >
      <div className="grid grid-cols-[40%_minmax(0,1fr)] items-start gap-3 sm:gap-4">
        <div className="relative h-[172px] overflow-hidden rounded-[26px] bg-muted/20 sm:h-[214px]">
          <img
            src={primaryPhoto}
            alt={p.pseudo}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => {
              const img = e.currentTarget;
              img.onerror = null;
              img.src = getDefaultProfilePhoto(p.accountType);
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/5 to-transparent" />

          <div className="absolute left-3 top-3 flex flex-wrap gap-2">
            {p.isVip && (
              <span className="flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-[10px] text-white">
                <Crown className="w-3.5 h-3.5 text-amber-300" />
                VIP
              </span>
            )}
            <span className="rounded-full bg-black/55 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-white">
              {accountLabel}
            </span>
          </div>

          <div className="absolute bottom-3 left-3 right-3 flex items-end justify-end gap-2">
            {urgent ? (
              <span className="rounded-full bg-red-500/85 px-2.5 py-1 text-[10px] text-white">
                {lang === "en" ? "Urgent" : "Urgent"}
              </span>
            ) : null}
          </div>
        </div>

        <div className="min-w-0">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[15px] font-semibold leading-tight text-foreground line-clamp-2 sm:text-lg md:text-[1.35rem]">
                {title}
              </div>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground sm:text-[11px]">
                <span>
                  {p.pseudo}
                </span>
                {p.isPro ? (
                  <span className="uppercase tracking-wide text-primary">
                    pro
                  </span>
                ) : null}
                {p.verified ? (
                  <span className="inline-flex items-center gap-1 text-emerald-400">
                    <BadgeCheck className="w-3.5 h-3.5" />
                    {lang === "en" ? "Certified" : "Certifié"}
                  </span>
                ) : null}
                {p.tarif ? (
                  <span className="font-medium text-foreground">
                    {p.tarif}
                  </span>
                ) : null}
              </div>
            </div>
            <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
          </div>

          <div className="mt-2.5">
            <div className="flex items-center gap-2 text-[11px] text-muted-foreground sm:text-sm">
                <MapPin className="w-4 h-4" />
                <span className="truncate">
                  {p.ville}
                  {p.lieu ? ` • ${p.lieu}` : ""}
                  {typeof p.distanceKm === "number" ? ` • ${Math.round(p.distanceKm)} km` : ""}
                </span>
            </div>
            <div className="mt-2.5 text-[12px] leading-5 text-muted-foreground line-clamp-4 sm:text-sm sm:leading-6">
              {p.description ?? "—"}
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
            {premium ? (
              <span className="text-[10px] text-emerald-400">
                PREMIUM
              </span>
            ) : null}
            {top ? (
              <span className="text-[10px] text-sky-400">
                TOP
              </span>
            ) : null}
            {(p.services ?? []).slice(0, 3).map((s) => (
              <span
                key={s}
                className="text-[10px] text-muted-foreground"
              >
                {s}
              </span>
            ))}
            <div className="ml-auto text-[10px] text-muted-foreground sm:text-[11px]">
              {p.latestAnnonce?.createdAt ? formatRelativeTime(p.latestAnnonce.createdAt, lang) : ""}
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}

export default function Explore() {
  const [, setLocation] = useLocation();
  const [settings, setSettings] = useAppSettings();
  const { lang } = useI18n();

  // Structured filters (presentation + client-side filtering)
  const [viewMode, setViewMode] = useState<"list" | "immersive">("list");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [scope, setScope] = useState<"nearby" | "anywhere">("nearby");
  const [ageRange, setAgeRange] = useState<[number, number]>([18, 40]);
  const [zone, setZone] = useState<string>("__all__");
  const [quartier, setQuartier] = useState("");
  const [accountType, setAccountType] = useState<
    "__all__" | "profile" | "residence" | "salon" | "adult_shop"
  >("__all__");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [page, setPage] = useState(0);
  const [immersiveIndex, setImmersiveIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  useEffect(() => {
    setCoords(getStoredBrowserCoords());
  }, []);

  const requestLocation = async () => {
    const nextCoords = await requestBrowserCoords();
    if (nextCoords) setCoords(nextCoords);
  };

  const baseParams = useMemo(() => {
    return new URLSearchParams({
      proOnly: settings.proOnly ? "1" : "0",
      verifiedOnly: settings.verifiedOnly ? "1" : "0",
      vipOnly: settings.vipOnly ? "1" : "0",
      includeLatestAnnonce: "1",
      ...(settings.selectedServices?.length ? { services: settings.selectedServices.join(",") } : {}),
      ...(scope === "nearby" && coords
        ? {
            lat: String(coords.lat),
            lng: String(coords.lng),
            maxDistanceKm: String(settings.maxDistanceKm),
          }
        : {}),
      limit: "120",
    });
  }, [
    settings.proOnly,
    settings.verifiedOnly,
    settings.vipOnly,
    settings.selectedServices,
    settings.maxDistanceKm,
    scope,
    coords,
  ]);

  const query = `/api/profiles?${baseParams.toString()}`;
  const vipQuery = `/api/profiles?${new URLSearchParams({
    ...Object.fromEntries(baseParams.entries()),
    vipOnly: "1",
    verifiedOnly: "0",
    limit: "40",
  }).toString()}`;

  const { data, isLoading, error } = useQuery<ApiProfile[]>({ queryKey: [query] });
  const { data: vipData, isLoading: vipLoading } = useQuery<ApiProfile[]>({
    queryKey: [vipQuery],
    retry: false,
  });

  const cityOptions = useMemo(() => {
    const villes = Array.from(new Set((data ?? []).map((p) => p.ville).filter(Boolean))).sort();
    return villes;
  }, [data]);

  const normalize = (s: string) => s.trim().toLowerCase();

  const applyClientFilters = (arr: ApiProfile[]) => {
    const qQuartier = normalize(quartier);
    return arr.filter((p) => {
      if (p.age < ageRange[0] || p.age > ageRange[1]) return false;
      if (zone !== "__all__" && normalize(p.ville) !== normalize(zone)) return false;
      if (accountType !== "__all__" && (p.accountType ?? "profile") !== accountType) return false;
      if (qQuartier) {
        const locationText = normalize([p.ville, p.lieu].filter(Boolean).join(" • "));
        if (!locationText.includes(qQuartier)) return false;
      }
      return true;
    });
  };

  const filtered = useMemo(
    () => applyClientFilters(data ?? []),
    [data, ageRange, zone, quartier, accountType],
  );
  const vipFiltered = useMemo(
    () => applyClientFilters(vipData ?? []),
    [vipData, ageRange, zone, quartier, accountType],
  );

  const openProfile = (id: string) => {
    rememberProfileBook(filtered.map((profile) => profile.id), viewMode === "immersive" ? "explore-immersive" : "explore-list");
    setLocation(`/profile/${id}`);
  };

  const immersiveProfile = filtered[immersiveIndex] ?? null;
  const canGoPreviousImmersive = immersiveIndex > 0;
  const canGoNextImmersive = immersiveIndex < filtered.length - 1;

  const goToPreviousImmersive = () => {
    setImmersiveIndex((current) => Math.max(0, current - 1));
  };

  const goToNextImmersive = () => {
    setImmersiveIndex((current) => Math.min(filtered.length - 1, current + 1));
  };

  const pageSize = 10;
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageSafe = Math.min(Math.max(0, page), pageCount - 1);
  const paged = useMemo(() => {
    const start = pageSafe * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, pageSafe]);

  // Reset/clamp pagination when filters change
  useEffect(() => {
    setPage(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, ageRange, zone, quartier, accountType, settings.proOnly, settings.verifiedOnly, settings.vipOnly, settings.selectedServices, settings.maxDistanceKm]);
  useEffect(() => {
    if (page !== pageSafe) setPage(pageSafe);
  }, [page, pageSafe]);
  useEffect(() => {
    setImmersiveIndex((current) => {
      if (!filtered.length) return 0;
      return Math.min(current, filtered.length - 1);
    });
  }, [filtered.length]);

  if (viewMode === "immersive") {
    return (
      <div className="h-[100svh] bg-background">
        <div className="fixed top-0 left-0 right-0 z-30 px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pointer-events-none">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 pointer-events-auto">
            <Button
              variant="secondary"
              size="icon"
              className="rounded-full"
              onClick={() => setLocation("/start")}
              aria-label={lang === "en" ? "Back" : "Retour"}
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div className="inline-flex items-center rounded-full border border-border bg-card/70 p-1">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className="px-3 py-1 rounded-full text-xs text-muted-foreground"
              >
                {lang === "en" ? "List" : "Liste"}
              </button>
              <button
                type="button"
                className="px-3 py-1 rounded-full text-xs bg-primary text-primary-foreground"
              >
                {lang === "en" ? "Immersive" : "Immersif"}
              </button>
            </div>

            <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
              <SheetTrigger asChild>
                <Button variant="secondary" className="rounded-full" size="icon" aria-label="Filters">
                  <SlidersHorizontal className="w-4 h-4" />
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[100svh] rounded-none overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>{lang === "en" ? "Search filters" : "Filtres de recherche"}</SheetTitle>
                </SheetHeader>
                <div className="mt-6 space-y-4">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setScope("nearby")}
                      className={`rounded-2xl border px-3 py-2 text-xs ${
                        scope === "nearby"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-muted/30 text-muted-foreground"
                      }`}
                    >
                      {lang === "en" ? "Nearby search" : "Recherche autour de moi"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setScope("anywhere")}
                      className={`rounded-2xl border px-3 py-2 text-xs ${
                        scope === "anywhere"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-muted/30 text-muted-foreground"
                      }`}
                    >
                      {lang === "en" ? "Anywhere search" : "Recherche partout"}
                    </button>
                  </div>

                  <div className="rounded-2xl border border-border bg-background/50 p-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{lang === "en" ? "Age" : "Âge"}</span>
                      <span className="font-semibold text-foreground">
                        {ageRange[0]}–{ageRange[1]}
                      </span>
                    </div>
                    <div className="mt-3">
                      <Slider
                        value={ageRange}
                        min={18}
                        max={60}
                        step={1}
                        onValueChange={(v) => setAgeRange(v as [number, number])}
                      />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border bg-background/50 p-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{lang === "en" ? "Max distance" : "Distance max"}</span>
                      <span className="font-semibold text-foreground">{settings.maxDistanceKm} km</span>
                    </div>
                    <div className="mt-3">
                      <Slider
                        value={[settings.maxDistanceKm]}
                        min={1}
                        max={50}
                        step={1}
                        onValueChange={(v) => setSettings({ ...settings, maxDistanceKm: Number(v?.[0] ?? settings.maxDistanceKm) })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-2xl border border-border bg-background/50 p-3">
                      <div className="text-xs text-muted-foreground">{lang === "en" ? "Zone" : "Zone"}</div>
                      <select
                        className="mt-2 w-full bg-transparent text-sm outline-none"
                        value={zone}
                        onChange={(e) => setZone(e.target.value)}
                      >
                        <option value="__all__">{lang === "en" ? "All" : "Toutes"}</option>
                        {cityOptions.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="rounded-2xl border border-border bg-background/50 p-3">
                      <div className="text-xs text-muted-foreground">{lang === "en" ? "District" : "Quartier"}</div>
                      <Input
                        value={quartier}
                        onChange={(e) => setQuartier(e.target.value)}
                        placeholder={lang === "en" ? "e.g. Bonapriso" : "ex: Bonapriso"}
                        className="mt-2 h-9 rounded-xl"
                      />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-border bg-background/50 p-3">
                    <div className="text-xs text-muted-foreground">{lang === "en" ? "Profile type" : "Type de profil"}</div>
                    <select
                      className="mt-2 w-full bg-transparent text-sm outline-none"
                      value={accountType}
                      onChange={(e) => setAccountType(e.target.value as any)}
                    >
                      <option value="__all__">{lang === "en" ? "All types" : "Tous types"}</option>
                      <option value="profile">{lang === "en" ? "Escort / profile" : "Escort / profil"}</option>
                      <option value="residence">{lang === "en" ? "Residence" : "Résidence"}</option>
                      <option value="salon">{lang === "en" ? "Salon / SPA" : "Salon / SPA"}</option>
                      <option value="adult_shop">{lang === "en" ? "Adult shop" : "Boutique adulte"}</option>
                    </select>
                  </div>

                  <Separator />

                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, proOnly: !settings.proOnly })}
                      className={`rounded-2xl border px-3 py-2 text-xs ${
                        settings.proOnly
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-muted/30 text-muted-foreground"
                      }`}
                    >
                      {lang === "en" ? "Pros" : "Pros"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, verifiedOnly: !settings.verifiedOnly })}
                      className={`rounded-2xl border px-3 py-2 text-xs ${
                        settings.verifiedOnly
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-muted/30 text-muted-foreground"
                      }`}
                    >
                      {lang === "en" ? "Verified" : "Vérifiés"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setSettings({ ...settings, vipOnly: !settings.vipOnly })}
                      className={`rounded-2xl border px-3 py-2 text-xs ${
                        settings.vipOnly
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-muted/30 text-muted-foreground"
                      }`}
                    >
                      VIP
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowAdvanced((v) => !v)}
                    className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showAdvanced ? (lang === "en" ? "Reduce" : "Réduire") : (lang === "en" ? "Advanced practices" : "Pratiques avancées")}
                  </button>

                  {showAdvanced && (
                    <div className="rounded-2xl border border-border bg-background/50 p-3">
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-muted-foreground">{lang === "en" ? "Practices" : "Pratiques"}</div>
                        <button
                          type="button"
                          className="text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => setSettings({ ...settings, selectedServices: [] })}
                        >
                          {lang === "en" ? "Clear" : "Effacer"}
                        </button>
                      </div>
                      <div className="mt-2 text-xs text-muted-foreground">
                        {(settings.selectedServices ?? []).length
                          ? lang === "en"
                            ? `${(settings.selectedServices ?? []).length} selected`
                            : `${(settings.selectedServices ?? []).length} sélectionnées`
                          : lang === "en"
                            ? "All practices"
                            : "Toutes les pratiques"}
                      </div>
                      <ScrollArea className="mt-3 h-56 rounded-2xl border border-border bg-muted/20">
                        <div className="p-3 space-y-2">
                          {annonceServiceOptions.map((s) => {
                            const checked = (settings.selectedServices ?? []).includes(s);
                            return (
                              <label key={s} className="flex items-center gap-3 py-2">
                                <Checkbox
                                  checked={checked}
                                  onCheckedChange={(v) => {
                                    const on = Boolean(v);
                                    const prev = settings.selectedServices ?? [];
                                    const next = on ? Array.from(new Set([...prev, s])) : prev.filter((x) => x !== s);
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
                  )}
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </div>

        <main className="h-[100svh] overflow-hidden overscroll-contain">
          {isLoading ? (
            <div className="h-[100svh] flex items-center justify-center text-sm text-muted-foreground">
              {lang === "en" ? "Loading…" : "Chargement…"}
            </div>
          ) : error ? (
            <div className="h-[100svh] flex items-center justify-center px-6 text-center text-sm text-muted-foreground">
              {lang === "en"
                ? "Server error: unable to load profiles right now."
                : "Erreur serveur : impossible de charger les profils pour le moment."}
            </div>
          ) : filtered.length === 0 ? (
            <div className="h-[100svh] flex items-center justify-center px-6 text-center text-sm text-muted-foreground">
              {lang === "en"
                ? "No profiles for current filters."
                : "Aucun profil avec les filtres actuels."}
            </div>
          ) : immersiveProfile ? (
            <section
              className="relative h-[100svh]"
              onTouchStart={(event) => setTouchStartX(event.changedTouches[0]?.clientX ?? null)}
              onTouchEnd={(event) => {
                const endX = event.changedTouches[0]?.clientX ?? null;
                if (touchStartX === null || endX === null) return;
                const delta = endX - touchStartX;
                setTouchStartX(null);
                if (Math.abs(delta) < 45) return;
                if (delta < 0) goToNextImmersive();
                if (delta > 0) goToPreviousImmersive();
              }}
            >
              <img
                src={getProfilePhoto(immersiveProfile.photoUrl, immersiveProfile.accountType)}
                alt={immersiveProfile.pseudo}
                className="absolute inset-0 h-full w-full object-cover bg-muted"
                onError={(e) => {
                  const img = e.currentTarget;
                  img.onerror = null;
                  img.src = getDefaultProfilePhoto(immersiveProfile.accountType);
                }}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/58 via-black/10 to-transparent pointer-events-none" />

              <div className="absolute inset-x-4 top-[calc(env(safe-area-inset-top)+4.5rem)] z-20 flex items-center justify-between">
                <Button
                  variant="secondary"
                  size="icon"
                  className="rounded-full border border-white/12 bg-black/28 text-white backdrop-blur-md hover:bg-black/36"
                  disabled={!canGoPreviousImmersive}
                  onClick={goToPreviousImmersive}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <div className="rounded-full border border-white/12 bg-black/24 px-3 py-1 text-[11px] text-white/82 backdrop-blur-md">
                  {immersiveIndex + 1} / {filtered.length}
                </div>
                <Button
                  variant="secondary"
                  size="icon"
                  className="rounded-full border border-white/12 bg-black/28 text-white backdrop-blur-md hover:bg-black/36"
                  disabled={!canGoNextImmersive}
                  onClick={goToNextImmersive}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <div className="absolute bottom-0 left-0 right-0 p-4 sm:p-5">
                <div className="mx-auto max-w-2xl rounded-[28px] border border-white/10 bg-black/22 px-4 py-4 backdrop-blur-md">
                  <div className="flex items-end justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 text-[10px] text-white/74">
                        <span className="rounded-full border border-white/12 px-2.5 py-1 uppercase tracking-[0.16em]">
                          {getAccountTypeLabel(immersiveProfile.accountType, lang)}
                        </span>
                        {immersiveProfile.isVip ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-400/14 px-2.5 py-1 text-amber-100/90">
                            <Crown className="h-3 w-3" />
                            VIP
                          </span>
                        ) : null}
                        {immersiveProfile.verified ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/14 px-2.5 py-1 text-emerald-100/90">
                            <BadgeCheck className="h-3 w-3" />
                            {lang === "en" ? "Certified" : "Certifie"}
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-3 flex flex-wrap items-end gap-2">
                        <div className="truncate text-2xl font-semibold tracking-tight text-white sm:text-3xl">
                          {immersiveProfile.pseudo}
                        </div>
                        <div className="pb-1 text-sm font-light text-white/74 sm:text-base">
                          {immersiveProfile.age}
                        </div>
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-sm text-white/70">
                        <MapPin className="h-4 w-4 shrink-0" />
                        <span className="truncate">
                          {immersiveProfile.ville}
                          {immersiveProfile.lieu ? ` • ${immersiveProfile.lieu}` : ""}
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 space-y-2 text-right">
                      {immersiveProfile.tarif ? (
                        <div className="rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-black">
                          {immersiveProfile.tarif}
                        </div>
                      ) : null}
                      <Button className="rounded-full bg-white text-black hover:bg-white/90" onClick={() => openProfile(immersiveProfile.id)}>
                        {lang === "en" ? "Open" : "Voir"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          ) : (
            <div className="h-[100svh] flex items-center justify-center px-6 text-center text-sm text-muted-foreground">
              {lang === "en" ? "No immersive profile available." : "Aucun profil immersif disponible."}
            </div>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-[100svh] bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] sm:px-6 lg:px-8">
          <Button
            variant="secondary"
            size="icon"
            className="rounded-full"
            onClick={() => setLocation("/start")}
            aria-label={lang === "en" ? "Back" : "Retour"}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="text-sm font-semibold text-foreground sm:text-base">
            {lang === "en" ? "Explore" : "Explorer"}
          </div>
          <div className="w-9" />
        </div>
      </header>

      <main className="mx-auto max-w-[980px] px-4 pb-12 pt-4 space-y-5 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="text-sm font-semibold text-foreground">
              {lang === "en" ? "Explore" : "Explorer"}
            </span>
            <span className="rounded-full bg-muted/40 px-2.5 py-1">
              {filtered.length} {lang === "en" ? "profiles" : "profils"}
            </span>
            <span className="rounded-full bg-muted/40 px-2.5 py-1">
              {zone === "__all__" ? (lang === "en" ? "All zones" : "Toutes zones") : zone}
            </span>
          </div>
          <div className="inline-flex items-center rounded-full border border-border bg-card/40 p-1">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className="px-3 py-1 rounded-full text-xs bg-primary text-primary-foreground"
            >
              {lang === "en" ? "List" : "Liste"}
            </button>
            <button
              type="button"
              onClick={() => setViewMode("immersive")}
              className="px-3 py-1 rounded-full text-xs text-muted-foreground"
            >
              {lang === "en" ? "Immersive" : "Immersif"}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-4 pb-1 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-foreground">
              {lang === "en"
                ? `Age ${ageRange[0]}–${ageRange[1]} • ${zone === "__all__" ? "All zones" : zone}`
                : `Âge ${ageRange[0]}–${ageRange[1]} • ${zone === "__all__" ? "Toutes zones" : zone}`}
              {accountType !== "__all__" ? (lang === "en" ? ` • Type ${accountType}` : ` • Type ${accountType}`) : ""}
              {quartier ? ` • ${quartier}` : ""}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {vipFiltered.length > 0 ? (
              <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs text-amber-500">
                {vipFiltered.length} VIP
              </span>
            ) : null}
            {scope === "nearby" && !coords && (
              <Button variant="outline" size="sm" className="rounded-full" onClick={requestLocation}>
                {lang === "en" ? "Use my location" : "Utiliser ma position"}
              </Button>
            )}
          </div>
          <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-full">
                <SlidersHorizontal className="w-4 h-4 mr-2" />
                {lang === "en" ? "Filters" : "Filtres"}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[100svh] rounded-none overflow-y-auto">
              <SheetHeader>
                <SheetTitle>{lang === "en" ? "Search filters" : "Filtres de recherche"}</SheetTitle>
              </SheetHeader>

              <div className="mt-6 space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setScope("nearby")}
                    className={`rounded-2xl border px-3 py-2 text-xs ${
                      scope === "nearby"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-muted/30 text-muted-foreground"
                    }`}
                  >
                    {lang === "en" ? "Nearby search" : "Recherche autour de moi"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setScope("anywhere")}
                    className={`rounded-2xl border px-3 py-2 text-xs ${
                      scope === "anywhere"
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-muted/30 text-muted-foreground"
                    }`}
                  >
                    {lang === "en" ? "Anywhere search" : "Recherche partout"}
                  </button>
                </div>

                {scope === "nearby" && !coords && (
                  <Button variant="outline" className="w-full rounded-2xl" onClick={requestLocation}>
                    {lang === "en" ? "Use my location" : "Utiliser ma position"}
                  </Button>
                )}

                <div className="rounded-2xl border border-border bg-background/50 p-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{lang === "en" ? "Age" : "Âge"}</span>
                    <span className="font-semibold text-foreground">
                      {ageRange[0]}–{ageRange[1]}
                    </span>
                  </div>
                  <div className="mt-3">
                    <Slider value={ageRange} min={18} max={60} step={1} onValueChange={(v) => setAgeRange(v as [number, number])} />
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-background/50 p-3">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">{lang === "en" ? "Max distance" : "Distance max"}</span>
                    <span className="font-semibold text-foreground">{settings.maxDistanceKm} km</span>
                  </div>
                  <div className="mt-3">
                    <Slider
                      value={[settings.maxDistanceKm]}
                      min={1}
                      max={50}
                      step={1}
                      onValueChange={(v) => setSettings({ ...settings, maxDistanceKm: Number(v?.[0] ?? settings.maxDistanceKm) })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-2xl border border-border bg-background/50 p-3">
                    <div className="text-xs text-muted-foreground">{lang === "en" ? "Zone" : "Zone"}</div>
                    <select className="mt-2 w-full bg-transparent text-sm outline-none" value={zone} onChange={(e) => setZone(e.target.value)}>
                      <option value="__all__">{lang === "en" ? "All" : "Toutes"}</option>
                      {cityOptions.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="rounded-2xl border border-border bg-background/50 p-3">
                    <div className="text-xs text-muted-foreground">{lang === "en" ? "District" : "Quartier"}</div>
                    <Input value={quartier} onChange={(e) => setQuartier(e.target.value)} placeholder={lang === "en" ? "e.g. Bonapriso" : "ex: Bonapriso"} className="mt-2 h-9 rounded-xl" />
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-background/50 p-3">
                  <div className="text-xs text-muted-foreground">{lang === "en" ? "Profile type" : "Type de profil"}</div>
                  <select className="mt-2 w-full bg-transparent text-sm outline-none" value={accountType} onChange={(e) => setAccountType(e.target.value as any)}>
                    <option value="__all__">{lang === "en" ? "All types" : "Tous types"}</option>
                    <option value="profile">{lang === "en" ? "Escort / profile" : "Escort / profil"}</option>
                    <option value="residence">{lang === "en" ? "Residence" : "Résidence"}</option>
                    <option value="salon">{lang === "en" ? "Salon / SPA" : "Salon / SPA"}</option>
                    <option value="adult_shop">{lang === "en" ? "Adult shop" : "Boutique adulte"}</option>
                  </select>
                </div>

                <Separator />

                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, proOnly: !settings.proOnly })}
                    className={`rounded-2xl border px-3 py-2 text-xs ${
                      settings.proOnly
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-muted/30 text-muted-foreground"
                    }`}
                  >
                    {lang === "en" ? "Pros" : "Pros"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, verifiedOnly: !settings.verifiedOnly })}
                    className={`rounded-2xl border px-3 py-2 text-xs ${
                      settings.verifiedOnly
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-muted/30 text-muted-foreground"
                    }`}
                  >
                    {lang === "en" ? "Verified" : "Vérifiés"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSettings({ ...settings, vipOnly: !settings.vipOnly })}
                    className={`rounded-2xl border px-3 py-2 text-xs ${
                      settings.vipOnly
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-muted/30 text-muted-foreground"
                    }`}
                  >
                    VIP
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAdvanced((v) => !v)}
                  className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showAdvanced ? (lang === "en" ? "Reduce" : "Réduire") : (lang === "en" ? "Advanced practices" : "Pratiques avancées")}
                </button>

                {showAdvanced && (
                  <div className="rounded-2xl border border-border bg-background/50 p-3">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-muted-foreground">{lang === "en" ? "Practices" : "Pratiques"}</div>
                      <button type="button" className="text-xs text-muted-foreground hover:text-foreground" onClick={() => setSettings({ ...settings, selectedServices: [] })}>
                        {lang === "en" ? "Clear" : "Effacer"}
                      </button>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      {settings.selectedServices?.length
                        ? lang === "en"
                          ? `${settings.selectedServices.length} selected`
                          : `${settings.selectedServices.length} sélectionnées`
                        : lang === "en"
                          ? "All practices"
                          : "Toutes les pratiques"}
                    </div>
                    <ScrollArea className="mt-3 h-56 rounded-2xl border border-border bg-muted/20">
                      <div className="p-3 space-y-2">
                        {annonceServiceOptions.map((s) => {
                          const checked = (settings.selectedServices ?? []).includes(s);
                          return (
                            <label key={s} className="flex items-center gap-3 py-2">
                              <Checkbox
                                checked={checked}
                                onCheckedChange={(v) => {
                                  const on = Boolean(v);
                                  const prev = settings.selectedServices ?? [];
                                  const next = on ? Array.from(new Set([...prev, s])) : prev.filter((x) => x !== s);
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
                )}

                <Separator />
                <Button
                  variant="outline"
                  className="rounded-2xl justify-between"
                  onClick={() => {
                    setAgeRange([18, 40]);
                    setZone("__all__");
                    setQuartier("");
                    setAccountType("__all__");
                    setScope("nearby");
                    setShowAdvanced(false);
                  }}
                >
                  {lang === "en" ? "Reset filters" : "Réinitialiser les filtres"}
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        <div className="space-y-4">
          {viewMode === "list" ? (
            <div className="space-y-1">
              {isLoading ? (
                <>
                  <div className="h-52 rounded-[24px] bg-muted/40" />
                  <div className="h-52 rounded-[24px] bg-muted/40" />
                  <div className="h-52 rounded-[24px] bg-muted/40" />
                </>
              ) : filtered.length === 0 ? (
                <div className="rounded-[24px] bg-muted/30 p-5 text-sm text-muted-foreground">
                  {lang === "en"
                    ? "No profiles found. Try widening filters."
                    : "Aucun profil trouvé. Essaie d’élargir les filtres."}
                </div>
              ) : (
                paged.map((p) => (
                  <ProfileRow key={p.id} p={p} onClick={() => openProfile(p.id)} lang={lang} />
                ))
              )}
            </div>
          ) : null}

          {/* Pagination (10 per page) */}
          {!isLoading && filtered.length > pageSize && viewMode === "list" && (
            <div className="flex items-center justify-between pt-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-2xl"
                disabled={pageSafe === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                {lang === "en" ? "Prev" : "Préc."}
              </Button>
              <div className="text-xs text-muted-foreground">
                {lang === "en"
                  ? `Page ${pageSafe + 1} / ${pageCount}`
                  : `Page ${pageSafe + 1} / ${pageCount}`}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="rounded-2xl"
                disabled={pageSafe >= pageCount - 1}
                onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              >
                {lang === "en" ? "Next" : "Suiv."}
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}


