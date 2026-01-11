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
import avatarUrl from "@assets/avatar.png";

type ApiProfile = {
  id: string;
  pseudo: string;
  age: number;
  ville: string;
  lieu: string | null; // utilisé comme "quartier" / lieu approx
  verified: boolean;
  isVip?: boolean;
  photoUrl: string | null;
  description: string | null;
  services?: string[] | null;
  tarif?: string | null;
  disponibilite?: { date: string; heureDebut: string; duree: string } | null;
  distanceKm?: number | null;
  accountType?: "profile" | "residence" | "salon" | "adult_shop" | null;
  latestAnnonce?: { id: string; title: string; createdAt: string } | null;
};

function ProfileRow({
  p,
  onClick,
}: {
  p: ApiProfile;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
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
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold text-foreground truncate">
              {p.pseudo} • {p.age}
            </div>
            {p.verified && <BadgeCheck className="w-4 h-4 text-primary shrink-0" />}
            {p.isVip && (
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-400/20 text-amber-200 border border-amber-400/30 flex items-center gap-1">
                <Crown className="w-3.5 h-3.5" />
                VIP
              </span>
            )}
          </div>
          <div className="text-xs text-muted-foreground truncate">
            {p.ville}
            {p.lieu ? ` • ${p.lieu}` : ""}
            {typeof p.distanceKm === "number" ? ` • ${Math.round(p.distanceKm)} km` : ""}
          </div>
          <div className="mt-1 text-[11px] text-muted-foreground line-clamp-1">
            {p.description ?? "—"}
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
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
  const requestLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: false, timeout: 8000 },
    );
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

  const { data, isLoading } = useQuery<ApiProfile[]>({ queryKey: [query] });
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
      if (zone !== "__all__" && p.ville !== zone) return false;
      if (accountType !== "__all__" && (p.accountType ?? "profile") !== accountType) return false;
      if (qQuartier) {
        const lieu = normalize(p.lieu ?? "");
        if (!lieu.includes(qQuartier)) return false;
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

  const openProfile = (id: string) => setLocation(`/profile/${id}`);

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

  if (viewMode === "immersive") {
    return (
      <div className="h-[100svh] bg-background">
        <div className="fixed top-0 left-0 right-0 z-30 px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pointer-events-none">
          <div className="mx-auto max-w-md flex items-center justify-between gap-2 pointer-events-auto">
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

        <main className="h-[100svh] overflow-y-auto snap-y snap-mandatory overscroll-contain">
          {isLoading ? (
            <div className="h-[100svh] flex items-center justify-center text-sm text-muted-foreground">
              {lang === "en" ? "Loading…" : "Chargement…"}
            </div>
          ) : filtered.length === 0 ? (
            <div className="h-[100svh] flex items-center justify-center px-6 text-center text-sm text-muted-foreground">
              {lang === "en"
                ? "No profiles for current filters."
                : "Aucun profil avec les filtres actuels."}
            </div>
          ) : (
            filtered.map((p) => (
              <section key={p.id} className="snap-start snap-stop-always h-[100svh] relative">
                <img
                  src={p.photoUrl || avatarUrl}
                  alt={p.pseudo}
                  className="absolute inset-0 w-full h-full object-cover bg-muted"
                  onError={(e) => {
                    const img = e.currentTarget;
                    img.onerror = null;
                    img.src = avatarUrl;
                  }}
                />
                <div className="absolute inset-x-0 bottom-0 h-72 bg-gradient-to-t from-black/92 via-black/40 to-transparent pointer-events-none" />
                <div className="absolute bottom-0 left-0 right-0 p-4">
                  <div className="rounded-3xl bg-black/70 border border-white/12 backdrop-blur-xl px-5 py-5 space-y-3">
                    <div className="text-white text-lg font-semibold tracking-tight line-clamp-1">
                      {p.latestAnnonce?.title ?? (lang === "en" ? "Private listing" : "Annonce privée")}
                    </div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-white text-2xl font-semibold tracking-tight truncate">
                          {p.pseudo} <span className="text-white/70 font-light">{p.age}</span>
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-white/75 text-sm">
                          <MapPin className="w-4 h-4" />
                          <span className="truncate">
                            {p.ville}
                            {p.lieu ? ` • ${p.lieu}` : ""}
                          </span>
                        </div>
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-2">
                        {p.tarif ? (
                          <span className="px-3 py-1 rounded-full text-[11px] bg-primary/90 text-white border border-white/10">
                            {p.tarif}
                          </span>
                        ) : null}
                        {p.isVip && (
                          <span className="px-3 py-1 rounded-full text-[11px] bg-amber-400/20 text-amber-200 border border-amber-400/30 flex items-center gap-2">
                            <Crown className="w-4 h-4" />
                            VIP
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-white/70 text-sm line-clamp-2">{p.description ?? "—"}</div>
                    <div className="flex items-center justify-end">
                      <Button className="rounded-2xl" onClick={() => openProfile(p.id)}>
                        {lang === "en" ? "Open" : "Voir"}
                        <ChevronRight className="w-4 h-4 ml-1" />
                      </Button>
                    </div>
                  </div>
                </div>
              </section>
            ))
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-[100svh] bg-background">
      <header className="sticky top-0 z-30 bg-background/90 backdrop-blur border-b border-border">
        <div className="mx-auto max-w-md px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-3 flex items-center justify-between gap-2">
          <Button
            variant="secondary"
            size="icon"
            className="rounded-full"
            onClick={() => setLocation("/start")}
            aria-label={lang === "en" ? "Back" : "Retour"}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="text-sm font-semibold text-foreground">
            {lang === "en" ? "Explore" : "Explorer"}
          </div>
          <div className="w-9" />
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 pb-10 pt-4 space-y-6">
        {/* View mode */}
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-muted-foreground">
            {lang === "en" ? "View" : "Affichage"}
          </div>
          <div className="inline-flex items-center rounded-full border border-border bg-card/60 p-1">
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

        {/* Filters (collapsed bar + full-screen sheet) */}
        <div className="rounded-3xl border border-border bg-card/60 p-4 flex items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground truncate">
            {lang === "en"
              ? `Age ${ageRange[0]}–${ageRange[1]} • ${zone === "__all__" ? "All zones" : zone}`
              : `Âge ${ageRange[0]}–${ageRange[1]} • ${zone === "__all__" ? "Toutes zones" : zone}`}
            {accountType !== "__all__" ? (lang === "en" ? ` • Type ${accountType}` : ` • Type ${accountType}`) : ""}
          </div>
          <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" size="sm" className="rounded-2xl">
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

        {/* Results list */}
        <div className="space-y-2">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-sm font-semibold text-foreground">
                {lang === "en" ? "Results" : "Résultats"}
              </div>
              <div className="text-xs text-muted-foreground">
                {lang === "en" ? "List view (no swipe)." : "Affichage en liste (sans swipe)."}
              </div>
            </div>
            <div className="text-xs text-muted-foreground">
              {isLoading ? "…" : `${filtered.length}`}
            </div>
          </div>
          {viewMode === "list" ? (
            <div className="grid gap-2">
              {isLoading ? (
                <>
                  <div className="h-20 rounded-2xl bg-muted/40 border border-border" />
                  <div className="h-20 rounded-2xl bg-muted/40 border border-border" />
                  <div className="h-20 rounded-2xl bg-muted/40 border border-border" />
                </>
              ) : filtered.length === 0 ? (
                <div className="rounded-2xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                  {lang === "en"
                    ? "No profiles found. Try widening filters."
                    : "Aucun profil trouvé. Essaie d’élargir les filtres."}
                </div>
              ) : (
                paged.map((p) => (
                  <ProfileRow key={p.id} p={p} onClick={() => openProfile(p.id)} />
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


