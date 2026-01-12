import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, MapPin, SlidersHorizontal, Crown } from "lucide-react";
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
import avatarUrl from "@assets/avatar.png";
import { annonceServiceOptions } from "@/lib/serviceOptions";

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
    photoUrl: string | null;
    photos: string[];
    videoUrl: string | null;
    tarif: string | null;
    lieu: string | null;
    services: string[] | null;
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

export default function AnnoncesPage() {
  const [, setLocation] = useLocation();
  const { lang, t } = useI18n();
  const [settings, setSettings] = useAppSettings();
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => {},
      { enableHighAccuracy: false, timeout: 6000 },
    );
  }, []);

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
                onClick={() => setLocation(`/profile/${a.profile.id}`)}
                className="w-full text-left rounded-2xl border border-border bg-card/70 overflow-hidden hover:bg-card/90 transition-colors"
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
                        <div className="text-sm font-semibold text-foreground line-clamp-2">{a.title}</div>
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
                        {typeof a.distanceKm === "number" ? ` • ${a.distanceKm.toFixed(1)} km` : ""}
                      </div>
                      <div className="flex gap-1.5 flex-wrap justify-end">
                        {(a.promotionMeta?.badges ?? []).filter((b) => b !== "URGENT").slice(0, 3).map((b) => (
                          <span key={b} className="px-2 py-0.5 rounded-full text-[10px] bg-muted/40 border border-border text-foreground/80">
                            {b === "PROLONGATION" ? "Prolong." : b}
                          </span>
                        ))}
                        {a.profile.isVip ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] bg-amber-400/15 border border-amber-400/25 text-amber-200 flex items-center gap-1">
                            <Crown className="w-3 h-3" />
                            VIP
                          </span>
                        ) : null}
                      </div>
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


