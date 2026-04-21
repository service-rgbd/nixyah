import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MapPin, SlidersHorizontal, Crown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
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
import { useAppSettings } from "@/lib/appSettings";
import { useI18n } from "@/lib/i18n";
import { annonceServiceOptions } from "@/lib/serviceOptions";
import { getStoredBrowserCoords } from "@/lib/browserLocation";
import { getDefaultProfilePhoto, getProfilePhoto } from "@/lib/profile-photo";
import { rememberProfileBook } from "@/lib/profile-book";

type AnnonceItem = {
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
  profile: {
    id: string;
    pseudo: string;
    age: number;
    ville: string;
    verified: boolean;
    isPro?: boolean;
    isVip?: boolean;
    accountType?: "profile" | "residence" | "salon" | "adult_shop" | null;
    photoUrl: string | null;
    photos: string[];
    videoUrl: string | null;
    tarif: string | null;
    lieu: string | null;
    services: string[] | null;
    disponibilite?: { date?: string; heureDebut?: string; duree?: string } | null;
    description: string | null;
    corpulence?: string | null;
    poids?: number | null;
    attitude?: string | null;
    boireUnVerre?: boolean | null;
    fume?: boolean | null;
    teintePeau?: string | null;
    traits?: string[] | null;
    poitrine?: string | null;
    positions?: string[] | null;
    selfDescriptions?: string[] | null;
  };
};

export default function AnnoncesPage() {
  const [, setLocation] = useLocation();
  const { lang, t } = useI18n();
  const [settings, setSettings] = useAppSettings();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  const openProfile = (profileId: string, ids: string[]) => {
    rememberProfileBook(ids, "annonces");
    setLocation(`/profile/${profileId}`);
  };

  useEffect(() => {
    setCoords(getStoredBrowserCoords());
  }, []);

  const getAccountTypeLabel = (accountType: AnnonceItem["profile"]["accountType"]) => {
    if (accountType === "residence") return lang === "en" ? "Residence" : "Résidence";
    if (accountType === "salon") return "Salon / SPA";
    if (accountType === "adult_shop") return lang === "en" ? "Adult shop" : "Boutique adulte";
    return lang === "en" ? "Private profile" : "Profil privé";
  };

  const getAvailabilityMeta = (disponibilite?: AnnonceItem["profile"]["disponibilite"]) => {
    const date = String(disponibilite?.date ?? "").trim();
    if (!date) return null;
    const lowered = date.toLowerCase();
    if (lowered.includes("occup")) return { label: lang === "en" ? "Busy" : "Occupé", className: "bg-rose-500/10 text-rose-300" };
    if (lowered.startsWith("dans")) return { label: lang === "en" ? "Available soon" : "Disponible bientôt", className: "bg-amber-500/10 text-amber-300" };
    return { label: lang === "en" ? "Available" : "Disponible", className: "bg-emerald-500/10 text-emerald-300" };
  };

  const query = useMemo(() => {
    const selectedServices = settings.selectedServices ?? [];
    const sp = new URLSearchParams({
      proOnly: settings.proOnly ? "1" : "0",
      verifiedOnly: settings.verifiedOnly ? "1" : "0",
      vipOnly: settings.vipOnly ? "1" : "0",
      limit: "30",
      ...(coords
        ? {
            lat: String(coords.lat),
            lng: String(coords.lng),
            maxDistanceKm: String(settings.maxDistanceKm),
          }
        : {}),
    });
    if (selectedServices.length) sp.set("services", selectedServices.join(","));
    return `/api/annonces?${sp.toString()}`;
  }, [coords, settings.maxDistanceKm, settings.proOnly, settings.verifiedOnly, settings.vipOnly, settings.selectedServices]);

  const { data, isLoading, error } = useQuery<AnnonceItem[]>({ queryKey: [query] });

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 px-4 pt-3 pb-3">
        <div className="mx-auto max-w-md flex items-center justify-between">
          <button
            onClick={() => setLocation("/start")}
            className="w-10 h-10 rounded-full bg-card/80 backdrop-blur flex items-center justify-center border border-border"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div className="text-lg font-semibold text-foreground">{lang === "en" ? "Ads" : "Annonces"}</div>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="secondary" size="sm" className="gap-2">
                <SlidersHorizontal className="w-4 h-4" />
                {lang === "en" ? "Filters" : "Filtres"}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-3xl">
              <SheetHeader>
                <SheetTitle>{lang === "en" ? "Search filters" : "Filtres de recherche"}</SheetTitle>
                <SheetDescription>
                  {lang === "en"
                    ? "Filters apply to the ads feed."
                    : "Les filtres s'appliquent au feed d'annonces."}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                <div className="flex items-center justify-between gap-4">
                  <Label className="text-sm text-foreground">{t("proOnly")}</Label>
                  <Switch
                    checked={settings.proOnly}
                    onCheckedChange={(checked) => setSettings({ ...settings, proOnly: Boolean(checked) })}
                  />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <Label className="text-sm text-foreground">{t("verifiedOnly")}</Label>
                  <Switch
                    checked={settings.verifiedOnly}
                    onCheckedChange={(checked) => setSettings({ ...settings, verifiedOnly: Boolean(checked) })}
                  />
                </div>
                <div className="space-y-2">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {lang === "en" ? "Other" : "Autres"}
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <Label className="text-sm text-foreground flex items-center gap-2">
                      <Crown className="w-4 h-4 text-amber-400" />
                      {t("vipOnly")}
                    </Label>
                    <Switch
                      checked={settings.vipOnly}
                      onCheckedChange={(checked) => setSettings({ ...settings, vipOnly: Boolean(checked) })}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">{t("vipOnlyDescription")}</p>
                </div>
                <div className="space-y-2">
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
                      {lang === "en" ? "Practices" : "Pratiques"}
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
                    {(settings.selectedServices ?? []).length
                      ? lang === "en"
                        ? `${(settings.selectedServices ?? []).length} selected`
                        : `${(settings.selectedServices ?? []).length} sélectionnées`
                      : lang === "en"
                        ? "All practices"
                        : "Toutes les pratiques"}
                  </div>
                  <ScrollArea className="h-56 rounded-2xl border border-border bg-muted/20">
                    <div className="p-3 space-y-2">
                      {annonceServiceOptions.map((s) => {
                        const selected = settings.selectedServices ?? [];
                        const checked = selected.includes(s);
                        return (
                          <label key={s} className="flex items-center gap-3 py-2">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={(v) => {
                                const on = Boolean(v);
                                const next = on
                                  ? Array.from(new Set([...selected, s]))
                                  : selected.filter((x) => x !== s);
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
      </header>

      <main className="px-4 pb-10">
        <div className="mx-auto max-w-md space-y-3">
          {!coords && (
            <div className="rounded-2xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              {lang === "en"
                ? "Enable location to sort by proximity."
                : "Active la position pour trier par proximité."}
            </div>
          )}

          {isLoading ? (
            <>
              <div className="h-28 rounded-2xl bg-muted/40 border border-border" />
              <div className="h-28 rounded-2xl bg-muted/40 border border-border" />
              <div className="h-28 rounded-2xl bg-muted/40 border border-border" />
            </>
          ) : error ? (
            <div className="rounded-2xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              {lang === "en" ? "Unable to load ads." : "Impossible de charger les annonces."}
            </div>
          ) : (data ?? []).length === 0 ? (
            <div className="rounded-2xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
              {lang === "en" ? "No ads found." : "Aucune annonce trouvée."}
            </div>
          ) : (
            (data ?? []).map((a) => (
              <button
                key={a.id}
                type="button"
                onClick={() => openProfile(a.profile.id, (data ?? []).map((item) => item.profile.id))}
                className="group w-full border-b border-border/70 py-4 text-left transition last:border-b-0"
              >
                <div className="grid items-start gap-4 md:grid-cols-[156px_minmax(0,1fr)]">
                  <div className="relative h-[132px] overflow-hidden rounded-[24px] bg-muted/20 md:h-[170px]">
                    <img
                      src={getProfilePhoto(a.profile.photoUrl, a.profile.accountType)}
                      alt={a.profile.pseudo}
                      loading="lazy"
                      decoding="async"
                      className="absolute inset-0 h-full w-full object-cover"
                      onError={(e) => {
                        const img = e.currentTarget;
                        img.onerror = null;
                        img.src = getDefaultProfilePhoto(a.profile.accountType);
                      }}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/5 to-transparent" />
                    <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                      {a.profile.isVip ? (
                        <span className="rounded-full bg-black/55 px-2.5 py-1 text-[10px] text-white">
                          VIP
                        </span>
                      ) : null}
                      <span className="rounded-full bg-black/55 px-2.5 py-1 text-[10px] uppercase tracking-[0.16em] text-white">
                        {getAccountTypeLabel(a.profile.accountType)}
                      </span>
                    </div>
                    <div className="absolute bottom-3 left-3 right-3 flex items-end justify-end gap-2">
                      {(a.promotionMeta?.badges ?? []).includes("URGENT") ? (
                        <span className="rounded-full bg-red-500/85 px-2.5 py-1 text-[10px] text-white">
                          Urgent
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-base font-semibold text-foreground line-clamp-2 md:text-[1.2rem]">
                          {a.title}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                          <span className="rounded-full bg-muted/40 px-2.5 py-1">
                            {a.profile.pseudo}
                          </span>
                          {a.profile.isPro ? (
                            <span className="rounded-full bg-primary/10 px-2.5 py-1 text-[10px] uppercase tracking-wide text-primary">
                              pro
                            </span>
                          ) : null}
                          {a.profile.tarif ? (
                            <span className="rounded-full bg-foreground px-2.5 py-1 text-[10px] text-background">
                              {a.profile.tarif}
                            </span>
                          ) : null}
                          {getAvailabilityMeta(a.profile.disponibilite) ? (
                            <span className={`rounded-full px-2.5 py-1 text-[10px] ${getAvailabilityMeta(a.profile.disponibilite)?.className}`}>
                              {getAvailabilityMeta(a.profile.disponibilite)?.label}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="w-3.5 h-3.5" />
                          <span className="truncate">
                            {a.profile.ville}
                            {a.profile.lieu ? ` • ${a.profile.lieu}` : ""}
                            {typeof a.distanceKm === "number" ? ` • ${a.distanceKm.toFixed(1)} km` : ""}
                          </span>
                        </div>
                        <div className="mt-3 text-sm leading-6 text-muted-foreground line-clamp-3">
                          {a.profile.description ?? "—"}
                        </div>
                      </div>
                      <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground" />
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      <div className="flex gap-1.5 flex-wrap">
                        {(a.promotionMeta?.badges ?? []).filter((b) => b !== "URGENT").slice(0, 3).map((b) => (
                          <span key={b} className="rounded-full bg-muted/40 px-2.5 py-1 text-[10px] text-foreground/80">
                            {b === "PROLONGATION" ? "Prolong." : b}
                          </span>
                        ))}
                      </div>
                      {(a.profile.services ?? []).slice(0, 3).map((s) => (
                        <span key={s} className="rounded-full bg-muted/40 px-2.5 py-1 text-[10px] text-muted-foreground">
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      </main>
    </div>
  );
}


