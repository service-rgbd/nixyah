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
                className="w-full text-left rounded-2xl border border-border bg-card/70 backdrop-blur overflow-hidden hover:bg-card/90 transition-colors"
              >
                <div className="relative h-52">
                  <img
                    src={a.profile.photoUrl || avatarUrl}
                    alt={a.profile.pseudo}
                    className="absolute inset-0 w-full h-full object-cover"
                    onError={(e) => {
                      const img = e.currentTarget;
                      img.onerror = null;
                      img.src = avatarUrl;
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/25 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-white font-semibold truncate">{a.title}</div>
                        <div className="text-white/70 text-sm truncate mt-0.5">
                          {a.profile.pseudo} • {a.profile.age}
                        </div>
                      </div>
                      {a.profile.tarif ? (
                        <div className="shrink-0 px-3 py-1.5 rounded-full text-xs bg-primary text-white font-semibold">
                          {a.profile.tarif}
                        </div>
                      ) : null}
                    </div>

                    <div className="text-white/70 text-sm flex items-center justify-between gap-3 mt-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <MapPin className="w-4 h-4" />
                        <span className="truncate">{a.profile.ville}</span>
                      </div>
                      {typeof a.distanceKm === "number" ? (
                        <span className="shrink-0 text-xs">{a.distanceKm.toFixed(1)} km</span>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2 mt-3">
                      {(a.profile.services ?? []).slice(0, 4).map((s) => (
                        <span
                          key={s}
                          className="px-3 py-1 rounded-full text-[11px] bg-white/10 text-white/90 border border-white/10"
                        >
                          {s}
                        </span>
                      ))}
                      {a.profile.attitude ? (
                        <span className="px-3 py-1 rounded-full text-[11px] bg-white/10 text-white/90 border border-white/10">
                          {a.profile.attitude}
                        </span>
                      ) : null}
                      {a.profile.boireUnVerre === true ? (
                        <span className="px-3 py-1 rounded-full text-[11px] bg-white/10 text-white/90 border border-white/10">
                          🍷 OK
                        </span>
                      ) : null}
                      {a.profile.fume === false ? (
                        <span className="px-3 py-1 rounded-full text-[11px] bg-white/10 text-white/90 border border-white/10">
                          🚭
                        </span>
                      ) : null}
                      {a.profile.isVip ? (
                        <span className="px-3 py-1 rounded-full text-[11px] bg-amber-400/20 text-amber-200 border border-amber-400/30 flex items-center gap-2">
                          <Crown className="w-3.5 h-3.5" />
                          VIP
                        </span>
                      ) : null}
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


