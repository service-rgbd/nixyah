import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useLocation } from "wouter";
import { Compass, Settings2, UserPlus, LogIn, Sparkles, MapPin, SlidersHorizontal, Crown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import spaPhoto from "@assets/photo_2026-01-09_17-36-41.jpg";
import resiPhoto from "@assets/resi-meublmee.jpg";
import eventBgToast from "@assets/Attached_image.png";
import eventBgMask from "@assets/Masque_loup_dentelle_libertine_venitien_sexy_coquin_erotique_venise_deguisement_bal_masquerade_mask_cheapatleast_joel69100-pc.jpg";
import eventBgParty from "@assets/vue-devant-jeune-femme-s-amusant-fete_23-2151108204.jpg.avif";
import eventBgGlam from "@assets/pexels-xeniya-kovaleva-14280792_1024x1024.jpg.webp";
import { annonceServiceOptions } from "@/lib/serviceOptions";
import { maleProducts } from "@/lib/maleProducts";
import { apiRequest } from "@/lib/queryClient";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { Salon } from "@shared/schema";
import { StoryReel, type StoryReelGroup } from "@/components/story-reel";
import { getStoredBrowserCoords, requestBrowserCoords } from "@/lib/browserLocation";
import { getDefaultProfilePhoto, getProfilePhoto } from "@/lib/profile-photo";
import { rememberProfileBook } from "@/lib/profile-book";
import { upcomingEvents } from "@/lib/upcoming-events";

export default function Start() {
  const [, setLocation] = useLocation();
  const [settings, setSettings] = useAppSettings();
  const profileId = getProfileId();
  const hasSession = Boolean(profileId);
  const { lang, t } = useI18n();
  const eventBackgrounds = [eventBgMask, eventBgParty, eventBgToast, eventBgGlam] as const;
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
  const [profileScope, setProfileScope] = useState<"nearby" | "anywhere">("anywhere");
  const [availableOnly, setAvailableOnly] = useState(false);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [rsvpName, setRsvpName] = useState("");
  const [rsvpContact, setRsvpContact] = useState("");
  const [rsvpMessage, setRsvpMessage] = useState("");
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [rsvpDone, setRsvpDone] = useState(false);
  const [eventInfoAccepted, setEventInfoAccepted] = useState(false);

  useEffect(() => {
    setCoords(getStoredBrowserCoords());
  }, []);

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
    disponibilite?: { date?: string; heureDebut?: string; duree?: string } | null;
    accountType?: "profile" | "residence" | "salon" | "adult_shop" | null;
  };

  type StartEventPreview = {
    id: string;
    title: string;
    date: string;
    city: string;
    tag: string;
    description: string;
    imageUrl?: string | null;
    imageUrls?: string[] | null;
    venue?: string | null;
    isIllustration?: boolean;
  };

  const getAccountTypeLabel = (accountType: StartProfile["accountType"]) => {
    if (accountType === "residence") return lang === "en" ? "Residence" : "Résidence";
    if (accountType === "salon") return "Salon / SPA";
    if (accountType === "adult_shop") return lang === "en" ? "Adult shop" : "Boutique adulte";
    return lang === "en" ? "Private profile" : "Profil privé";
  };

  const getProfileTierMeta = (profile: Pick<StartProfile, "accountType" | "isVip" | "isPro">) => {
    if (profile.isVip) {
      return {
        label: "VIP",
        className: "bg-amber-500 text-black border border-amber-300/80",
      };
    }
    if (profile.isPro) {
      return {
        label: "PRO",
        className: "bg-emerald-500/15 text-emerald-300 border border-emerald-400/30",
      };
    }
    if (profile.accountType === "salon") {
      return {
        label: lang === "en" ? "SALON" : "SALON",
        className: "bg-violet-500/15 text-violet-300 border border-violet-400/30",
      };
    }
    if (profile.accountType === "residence") {
      return {
        label: lang === "en" ? "RESIDENCE" : "RÉSIDENCE",
        className: "bg-sky-500/15 text-sky-300 border border-sky-400/30",
      };
    }
    if (profile.accountType === "adult_shop") {
      return {
        label: lang === "en" ? "SHOP" : "BOUTIQUE",
        className: "bg-fuchsia-500/15 text-fuchsia-300 border border-fuchsia-400/30",
      };
    }
    return {
      label: lang === "en" ? "PROFILE" : "PROFIL",
      className: "bg-muted/50 text-foreground/80 border border-border/70",
    };
  };

  const getProfileTierFeedClass = (profile: Pick<StartProfile, "accountType" | "isVip" | "isPro">) => {
    const tier = getProfileTierMeta(profile);
    if (tier.label === "VIP") return "text-amber-500";
    if (tier.label === "PRO") return "text-emerald-500";
    if (tier.label === "SALON") return "text-violet-500";
    if (tier.label === "RÉSIDENCE" || tier.label === "RESIDENCE") return "text-sky-500";
    if (tier.label === "SHOP" || tier.label === "BOUTIQUE") return "text-fuchsia-500";
    return "text-foreground/80";
  };

  const getAvailabilityMeta = (disponibilite?: StartProfile["disponibilite"]) => {
    const date = String(disponibilite?.date ?? "").trim();
    if (!date) return null;
    const lowered = date.toLowerCase();
    if (lowered.includes("occup")) {
      return {
        label: lang === "en" ? "Busy" : "Occupé",
        className: "bg-rose-500/10 text-rose-300",
        availableNow: false,
      };
    }
    if (lowered.startsWith("dans")) {
      return {
        label: lang === "en" ? "Available soon" : "Disponible bientôt",
        className: "bg-amber-500/10 text-amber-300",
        availableNow: false,
      };
    }
    return {
      label: lang === "en" ? "Available" : "Disponible",
      className: "bg-emerald-500/10 text-emerald-300",
      availableNow: true,
    };
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
    includeLatestAnnonce: "1",
    ...(profileScope === "nearby" && coords
      ? {
          lat: String(coords.lat),
          lng: String(coords.lng),
          maxDistanceKm: String(settings.maxDistanceKm),
        }
      : {}),
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
      if (zoneFilter !== "__all__" && normalize(p.ville) !== normalize(zoneFilter)) return false;
      if (accountTypeFilter !== "__all__" && (p.accountType ?? "profile") !== accountTypeFilter) return false;
      if (availableOnly && !getAvailabilityMeta(p.disponibilite)?.availableNow) return false;
      if (qQuartier) {
        const locationText = normalize([p.ville, p.lieu].filter(Boolean).join(" • "));
        if (!locationText.includes(qQuartier)) return false;
      }
      return true;
    });
  };

  const profilesFiltered = useMemo(
    () => applyProfileFilters(profilesAll ?? []),
    [profilesAll, zoneFilter, quartierFilter, ageRange, accountTypeFilter, availableOnly],
  );
  const profileHighlights = (profilesFiltered ?? []).slice(0, 4);
  const vipHighlights = useMemo(
    () => (profilesFiltered ?? []).filter((profile) => Boolean(profile.isVip)).slice(0, 3),
    [profilesFiltered],
  );
  const featuredVipProfile = vipHighlights[0] ?? profileHighlights[0] ?? null;
  const featuredVipUsesFallback = !vipHighlights.length && Boolean(featuredVipProfile);

  const formatEventDate = (d: string | Date) =>
    new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "fr-FR", {
      weekday: "short",
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(typeof d === "string" ? new Date(d) : d);

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

  const { data: storyGroups } = useQuery<StoryReelGroup[]>({
    queryKey: ["/api/stories"],
  });

  const { data: liveEvents } = useQuery<any[]>({
    queryKey: ["/api/events?limit=3"],
  });

  const previewEvents = useMemo<StartEventPreview[]>(
    () => {
      if ((liveEvents ?? []).length > 0) {
        return (liveEvents ?? []).map((event) => ({
          id: event.id,
          title: event.title,
          date: event.startsAt,
          city: event.city,
          tag: event.visibility === "private" ? "Privé" : "Public",
          description: event.description ?? "",
          imageUrl: event.imageUrl ?? null,
          imageUrls: event.imageUrls ?? null,
          venue: event.venue ?? null,
          isIllustration: false,
        }));
      }

      return upcomingEvents.slice(0, 4).map((event) => ({
        ...event,
        isIllustration: true,
      }));
    },
    [liveEvents],
  );
  const featuredVipEvent = useMemo(() => {
    const rows = [...(liveEvents ?? [])];
    rows.sort((a: any, b: any) => {
      const aTime = new Date(a?.createdAt ?? a?.startsAt ?? 0).getTime();
      const bTime = new Date(b?.createdAt ?? b?.startsAt ?? 0).getTime();
      return bTime - aTime;
    });
    return rows[0] ?? null;
  }, [liveEvents]);

  const selectedEvent = useMemo(
    () => previewEvents.find((e) => e.id === selectedEventId) ?? null,
    [selectedEventId, previewEvents],
  );

  const openProfile = (id: string, ids?: string[], source = "start") => {
    if (ids?.length) rememberProfileBook(ids, source);
    setLocation(`/profile/${id}`);
  };

  const openEvent = (event: StartEventPreview) => {
    if (event.isIllustration) {
      setLocation("/events");
      return;
    }
    setLocation(`/events/${event.id}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="px-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-3 sm:px-6">
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

      <main className="px-2 pb-10 sm:px-4">
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
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
                    void (async () => {
                      const nextCoords = await requestBrowserCoords();
                      if (nextCoords) {
                        setCoords(nextCoords);
                        setGeoDenied(false);
                      } else {
                        setGeoDenied(true);
                      }
                    })();
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
                  onClick={() => openProfile(a.profile.id, topNearby.map((item) => item.profile.id), "start-nearby")}
                  className="w-full overflow-hidden rounded-[28px] border border-border/70 bg-card/80 text-left backdrop-blur transition-colors hover:bg-card/95"
                >
                  <div className="flex">
                    <div className="h-32 w-32 shrink-0 overflow-hidden rounded-[24px] bg-muted">
                      <img
                        src={getProfilePhoto(a.profile.photoUrl, a.profile.accountType)}
                        alt={a.profile.pseudo}
                        className="h-full w-full object-cover"
                        onError={(e) => {
                          const img = e.currentTarget;
                          img.onerror = null;
                          img.src = getDefaultProfilePhoto(a.profile.accountType);
                        }}
                      />
                    </div>
                    <div className="min-w-0 flex-1 px-4 py-3.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-[15px] font-semibold text-foreground">{a.title}</div>
                          <div className="mt-1 flex flex-wrap items-center gap-1.5">
                            <span className="rounded-full bg-muted/50 px-2.5 py-1 text-[10px] text-foreground/85">
                              {getAccountTypeLabel(a.profile.accountType)}
                            </span>
                            {getAvailabilityMeta(a.profile.disponibilite) ? (
                              <span className={`rounded-full px-2.5 py-1 text-[10px] ${getAvailabilityMeta(a.profile.disponibilite)?.className}`}>
                                {getAvailabilityMeta(a.profile.disponibilite)?.label}
                              </span>
                            ) : null}
                          </div>
                          <div className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5" />
                            <span className="truncate">
                              {a.profile.pseudo} • {a.profile.ville}
                            </span>
                          </div>
                        </div>
                        {typeof a.distanceKm === "number" ? (
                          <div className="shrink-0 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-xs text-foreground/80">
                            {a.distanceKm.toFixed(1)} km
                          </div>
                        ) : null}
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {(a.profile.services ?? []).slice(0, 3).map((s: string) => (
                          <span key={s} className="rounded-full border border-border bg-muted/60 px-2.5 py-1 text-[11px] text-foreground/80">
                            {s}
                          </span>
                        ))}
                        {a.profile.tarif ? (
                          <span className="rounded-full bg-primary px-2.5 py-1 text-[11px] font-semibold text-white">
                            {a.profile.tarif}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                </button>
              ))}

              {coords && nearbyLoading ? (
                <div className="h-28 rounded-[26px] border border-border bg-muted/40" />
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
          {/* Aperçu compact de l'utilisateur (si connecté) */}
          {hasSession && (
            <div className="rounded-3xl border border-border bg-gradient-to-br from-card via-card to-primary/5 p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <img
                    src={getProfilePhoto(meProfile?.photoUrl, meProfile?.accountType)}
                    alt="Moi"
                    className="w-11 h-11 rounded-2xl object-cover border border-border"
                    onError={(e) => {
                      const img = e.currentTarget;
                      img.onerror = null;
                      img.src = getDefaultProfilePhoto(meProfile?.accountType);
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
                        ? "NIXYAH • Private profiles nearby • Wellness spaces & residences • Private events and discreet listings • Create your profile anonymously."
                        : "NIXYAH • Profils privés près de toi • Espaces bien-être & résidences • Évènements publiés et annonces discrètes • Crée ton profil anonymement."}
                    </p>
                  ))}
                </motion.div>
              </div>
            </div>
          </div>

          {/* Quick actions (compacts) */}
          <div className="grid grid-cols-3 gap-1.5">
            <Button
              variant="secondary"
              className="h-11 gap-1 rounded-2xl text-xs"
              onClick={() => setLocation("/annonces")}
              data-testid="button-go-ads"
            >
              <Compass className="w-4 h-4" />
              {lang === "en" ? "Ads" : "Annonces"}
            </Button>
            <Button
              variant="outline"
              className="h-11 gap-1 rounded-2xl text-xs"
              onClick={() => setLocation("/explore")}
              data-testid="button-go-profiles"
            >
              <Compass className="w-4 h-4" />
              {lang === "en" ? "Profiles" : "Profils"}
            </Button>
            <Button
              variant="outline"
              className="h-11 gap-1 rounded-2xl text-xs"
              onClick={() => setLocation(hasSession ? "/dashboard" : "/signup")}
              data-testid="button-go-profile"
            >
              <UserPlus className="w-4 h-4" />
              {hasSession ? t("mySpace") : (lang === "en" ? "Profile" : "Profil")}
            </Button>
          </div>

          {/* Événements à venir */}
          <div className="space-y-3">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-xl font-semibold tracking-tight text-foreground">
                  {lang === "en" ? "Upcoming events" : "Événements à venir"}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {lang === "en"
                    ? "Published events, private venues and selected gatherings."
                    : "Évènements publiés, lieux privés et rassemblements sélectionnés."}
                </div>
              </div>
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setLocation("/events")}>
                {lang === "en" ? "See more" : "Voir plus"}
              </Button>
            </div>

            <div className="space-y-3">
              {previewEvents.slice(0, 4).map((ev, idx) => {
                const bg = eventBackgrounds[idx % eventBackgrounds.length];
                const eventCover = ev.imageUrls?.[0] || ev.imageUrl || bg;
                const isLead = idx === 0;
                return (
                  <div
                    key={ev.id}
                    className={`group flex w-full cursor-pointer items-stretch gap-3 text-left ${isLead ? "min-h-[180px]" : "min-h-[148px]"}`}
                    onClick={() => openEvent(ev)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        openEvent(ev);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                  >
                    <div className={`relative shrink-0 overflow-hidden rounded-[26px] ${isLead ? "w-[40%] min-w-[40%]" : "w-[36%] min-w-[36%]"}`}>
                      <img
                        src={eventCover}
                        alt={ev.title}
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        draggable={false}
                        onError={(e) => {
                          const img = e.currentTarget;
                          img.onerror = null;
                          img.src = bg;
                        }}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/72 via-black/18 to-transparent" />
                      <span className="absolute left-3 top-3 rounded-full bg-black/50 px-2.5 py-1 text-[10px] text-white">
                        {ev.tag}
                      </span>
                      {isLead ? (
                        <div className="absolute inset-x-3 bottom-3 text-white">
                          <div className="text-[10px] uppercase tracking-[0.18em] text-white/78">
                            {lang === "en" ? "Featured now" : "À découvrir"}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="min-w-0 flex flex-1 flex-col justify-between py-1">
                      <div>
                        <div className={`font-semibold tracking-tight text-foreground line-clamp-2 ${isLead ? "text-[1.02rem]" : "text-[0.98rem]"}`}>
                          {ev.title}
                        </div>
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          {formatEventDate(ev.date)} • {ev.city}
                        </div>
                        {ev.venue ? (
                          <div className="mt-1 text-[11px] text-muted-foreground line-clamp-1">
                            {ev.venue}
                          </div>
                        ) : null}
                        <p className={`mt-2 text-[12px] leading-5 text-muted-foreground ${isLead ? "line-clamp-3" : "line-clamp-2"}`}>
                          {ev.description}
                        </p>
                      </div>
                      <div className="mt-3 inline-flex items-center gap-2 text-[11px] font-medium text-foreground">
                        <span>
                          {ev.isIllustration
                            ? lang === "en"
                              ? "Discover"
                              : "Découvrir"
                            : lang === "en"
                              ? "Open event"
                              : "Ouvrir l'évènement"}
                        </span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <Button variant="outline" className="w-full rounded-2xl" onClick={() => setLocation("/events")}>
              {lang === "en" ? "See all upcoming events" : "Voir tous les évènements"}
            </Button>
          </div>

          {/* Stories + filtres principaux */}
          <section className="space-y-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="text-xl font-semibold text-foreground">
                  {lang === "en" ? "Stories" : "Stories"}
                </div>
                <div className="text-[12px] text-muted-foreground">
                  {lang === "en"
                    ? "Public stories and locked private videos from active profiles"
                    : "Stories publiques et vidéos privées verrouillées des profils actifs"}
                </div>
              </div>
              {hasSession ? (
                <Button variant="outline" size="sm" onClick={() => setLocation("/stories/new")}>
                  {lang === "en" ? "Post mine" : "Poster la mienne"}
                </Button>
              ) : null}
            </div>

            <div className="py-1">
              <StoryReel
                groups={storyGroups ?? []}
                emptyLabel={
                  lang === "en"
                    ? "No story or private video available yet."
                    : "Aucune story ni vidéo privée disponible pour le moment."
                }
                onOpenProfile={openProfile}
              />
            </div>
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
                    {lang === "en" ? "Targeted filters" : "Filtres ciblés"}
                  </span>
                  <span className="text-[10px] text-muted-foreground truncate max-w-[55%] text-right">
                    {lang === "en"
                      ? "Profiles, residences, salons and shops"
                      : "Profils, résidences, salons et boutiques"}
                  </span>
                </Button>
              </SheetTrigger>
              <SheetContent side="bottom" className="h-[100svh] rounded-none overflow-y-auto">
                <SheetHeader>
                  <SheetTitle>{lang === "en" ? "Targeted filters" : "Filtres ciblés"}</SheetTitle>
                  <SheetDescription>
                    {lang === "en"
                      ? "Refine what you want to see: private profiles, residences, salons / SPA or adult shops."
                      : "Affinez exactement ce que vous cherchez : profils privés, résidences, salons / SPA ou boutiques adultes."}
                  </SheetDescription>
                </SheetHeader>

                <div className="mt-6 space-y-6">
                  <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {lang === "en" ? "0) Search by profile category" : "0) Recherche par catégorie de profil"}
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
                      <div className="text-xs text-muted-foreground">{lang === "en" ? "I am looking for" : "Je recherche"}</div>
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
                  <div className="rounded-2xl border border-border bg-muted/20 p-4 space-y-3">
                    <div className="text-xs text-muted-foreground">
                      {lang === "en" ? "Profile scope" : "Portée des profils"}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setProfileScope("nearby")}
                        className={`rounded-2xl border px-3 py-2 text-sm ${
                          profileScope === "nearby"
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-border bg-background/50 text-muted-foreground"
                        }`}
                      >
                        {lang === "en" ? "Nearby only" : "Proches seulement"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setProfileScope("anywhere")}
                        className={`rounded-2xl border px-3 py-2 text-sm ${
                          profileScope === "anywhere"
                            ? "border-primary/40 bg-primary/10 text-primary"
                            : "border-border bg-background/50 text-muted-foreground"
                        }`}
                      >
                        {lang === "en" ? "All profiles" : "Tous les profils"}
                      </button>
                    </div>
                    {!coords && profileScope === "nearby" ? (
                      <div className="text-[11px] text-muted-foreground">
                        {lang === "en"
                          ? "Enable your location to filter by nearby distance."
                          : "Active ta position pour filtrer par distance proche."}
                      </div>
                    ) : null}
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <Label className="text-sm text-foreground">
                      {lang === "en" ? "Available now only" : "Disponibles maintenant"}
                    </Label>
                    <Switch checked={availableOnly} onCheckedChange={(checked) => setAvailableOnly(Boolean(checked))} />
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
                    <div className="text-[11px] text-muted-foreground">
                      {profileScope === "anywhere"
                        ? lang === "en"
                          ? "Distance limit is ignored while \"All profiles\" is selected."
                          : "La distance est ignorée tant que \"Tous les profils\" est sélectionné."
                        : lang === "en"
                          ? "Nearby profiles respect your selected radius."
                          : "Les profils proches respectent le rayon choisi."}
                    </div>
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
          </section>

          {/* VIP shortcut (premium, without breaking existing navigation) */}
          <div
            className="relative w-full overflow-hidden rounded-[28px] border border-amber-500/20 bg-[linear-gradient(135deg,rgba(20,16,10,0.98),rgba(38,30,17,0.96)_45%,rgba(18,15,11,0.98))] px-4 py-4 text-left shadow-[0_24px_80px_-45px_rgba(245,158,11,0.55)]"
          >
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute -right-10 top-0 h-28 w-28 rounded-full bg-amber-400/16 blur-3xl" />
              <div className="absolute bottom-0 left-0 h-20 w-20 rounded-full bg-amber-300/10 blur-2xl" />
            </div>

            <div className="relative space-y-4">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-[18px] bg-white/8 text-amber-300 ring-1 ring-white/10">
                    <Crown className="h-5 w-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[10px] uppercase tracking-[0.26em] text-amber-300/85">
                      {lang === "en" ? "Elite access" : "Accès elite"}
                    </div>
                    <div className="mt-1 text-base font-semibold tracking-tight text-white">
                      {lang === "en" ? "VIP profiles & premium selection" : "Profils VIP & sélection premium"}
                    </div>
                    <div className="mt-1 text-[11px] text-white/70">
                      {lang === "en"
                        ? "High-priority profiles, premium visibility."
                        : "Profils premium, visibilité prioritaire."}
                    </div>
                    {featuredVipUsesFallback ? (
                      <div className="mt-1 text-[10px] text-amber-200/80">
                        {lang === "en"
                          ? "Selected from the current profiles feed."
                          : "Sélectionné depuis le feed actuel des profils."}
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="inline-flex shrink-0 items-center gap-2">
                  {vipCount ? (
                    <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-medium text-white ring-1 ring-white/10">
                      {vipCount} VIP
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setLocation("/vip")}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-white/8 text-white ring-1 ring-white/10"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {featuredVipProfile ? (
                <button
                  type="button"
                  onClick={() => openProfile(featuredVipProfile.id, [featuredVipProfile.id], "start-vip")}
                  className="flex min-h-[188px] w-full items-stretch gap-0 overflow-hidden rounded-[26px] bg-white/6 text-left ring-1 ring-white/10"
                >
                  <img
                    src={getProfilePhoto(featuredVipProfile.photoUrl, featuredVipProfile.accountType)}
                    alt={featuredVipProfile.pseudo}
                    className="h-auto w-[40%] shrink-0 object-cover"
                    onError={(e) => {
                      const img = e.currentTarget;
                      img.onerror = null;
                      img.src = getDefaultProfilePhoto(featuredVipProfile.accountType);
                    }}
                  />
                  <div className="flex min-w-0 flex-1 flex-col justify-between px-4 py-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-[15px] font-semibold tracking-tight text-white">
                          {featuredVipProfile.pseudo} • {featuredVipProfile.age}
                        </div>
                        <div className="mt-1 text-[11px] text-white/65">
                          {featuredVipProfile.ville}
                          {featuredVipProfile.lieu ? ` • ${featuredVipProfile.lieu}` : ""}
                        </div>
                      </div>
                      {featuredVipProfile.tarif ? (
                        <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 text-[10px] text-white ring-1 ring-white/10">
                          {featuredVipProfile.tarif}
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <span className="text-[10px] uppercase tracking-[0.16em] text-amber-300">VIP</span>
                      <span className="text-[10px] text-white/72">{getAccountTypeLabel(featuredVipProfile.accountType)}</span>
                      {getAvailabilityMeta(featuredVipProfile.disponibilite) ? (
                        <span className="text-[10px] text-white/72">
                          {getAvailabilityMeta(featuredVipProfile.disponibilite)?.label}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-[12px] leading-5 text-white/70 line-clamp-4">
                      {featuredVipProfile.description ??
                        (lang === "en"
                          ? "Open the VIP page to explore the premium selection."
                          : "Ouvre la page VIP pour découvrir la sélection premium.")}
                    </p>
                    <div className="mt-3 inline-flex items-center text-[11px] font-medium text-white">
                      {lang === "en" ? "Open VIP profile" : "Ouvrir le profil VIP"}
                    </div>
                  </div>
                </button>
              ) : null}

              {featuredVipEvent ? (
                <button
                  type="button"
                  onClick={() => openEvent({
                    id: featuredVipEvent.id,
                    title: featuredVipEvent.title,
                    date: featuredVipEvent.startsAt,
                    city: featuredVipEvent.city,
                    tag: featuredVipEvent.visibility === "private" ? "Privé" : "Public",
                    description: featuredVipEvent.description ?? "",
                    imageUrl: featuredVipEvent.imageUrl ?? null,
                    imageUrls: featuredVipEvent.imageUrls ?? null,
                    venue: featuredVipEvent.venue ?? null,
                    isIllustration: false,
                  })}
                  className="flex min-h-[154px] w-full items-stretch gap-0 overflow-hidden rounded-[26px] bg-white/[0.045] text-left ring-1 ring-white/10"
                >
                  <img
                    src={featuredVipEvent.imageUrls?.[0] || featuredVipEvent.imageUrl || eventBgParty}
                    alt={featuredVipEvent.title}
                    className="h-auto w-[40%] shrink-0 object-cover"
                    onError={(e) => {
                      const img = e.currentTarget;
                      img.onerror = null;
                      img.src = eventBgParty;
                    }}
                  />
                  <div className="flex min-w-0 flex-1 flex-col justify-between px-4 py-4">
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.16em] text-amber-300">
                        {lang === "en" ? "VIP event" : "Évènement VIP"}
                      </div>
                      <div className="mt-1 text-[15px] font-semibold tracking-tight text-white line-clamp-2">
                        {featuredVipEvent.title}
                      </div>
                      <div className="mt-1 text-[11px] text-white/65">
                        {formatEventDate(featuredVipEvent.startsAt)} • {featuredVipEvent.city}
                      </div>
                      <p className="mt-2 text-[12px] leading-5 text-white/70 line-clamp-3">
                        {featuredVipEvent.description ??
                          (lang === "en"
                            ? "Open the VIP event to see the details."
                            : "Ouvre l'évènement VIP pour voir les détails.")}
                      </p>
                    </div>
                    <div className="mt-3 inline-flex items-center text-[11px] font-medium text-white">
                      {lang === "en" ? "Open VIP event" : "Ouvrir l'évènement VIP"}
                    </div>
                  </div>
                </button>
              ) : null}
            </div>
          </div>

          {/* Profils en vedette */}
          <div className="space-y-3">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-xl font-semibold tracking-tight text-foreground">
                  {lang === "en" ? "Profiles" : "Profils"}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {lang === "en"
                    ? "Clean horizontal selection before opening the full feed."
                    : "Sélection horizontale propre avant d'ouvrir le feed complet."}
                </div>
              </div>
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setLocation("/explore")}>
                {lang === "en" ? "Open" : "Voir"}
              </Button>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
              {profilesAllLoading ? (
                <>
                  <div className="h-[172px] w-[94%] shrink-0 rounded-[24px] bg-muted/40 sm:w-[76%] md:w-[56%] lg:w-[42%]" />
                  <div className="h-[172px] w-[94%] shrink-0 rounded-[24px] bg-muted/40 sm:w-[76%] md:w-[56%] lg:w-[42%]" />
                  <div className="h-[172px] w-[94%] shrink-0 rounded-[24px] bg-muted/40 sm:w-[76%] md:w-[56%] lg:w-[42%]" />
                </>
              ) : profileHighlights.length === 0 ? (
                <div className="w-full rounded-2xl bg-muted/30 p-4 text-sm text-muted-foreground">
                  {lang === "en" ? "No profiles for current filters." : "Aucun profil avec les filtres actuels."}
                </div>
              ) : (
                <>
                  {profileHighlights.map((profile) => (
                    <button
                      key={profile.id}
                      type="button"
                      onClick={() => openProfile(profile.id, profileHighlights.map((item) => item.id), "start-highlights")}
                      className="flex h-[188px] w-[94%] shrink-0 items-stretch gap-0 overflow-hidden rounded-[28px] border border-border/70 bg-card/70 text-left shadow-[0_18px_50px_-32px_rgba(0,0,0,0.35)] transition-all hover:border-border hover:bg-card sm:w-[76%] md:w-[56%] lg:w-[42%]"
                    >
                      <img
                        src={getProfilePhoto(profile.photoUrl, profile.accountType)}
                        alt={profile.pseudo}
                        className="h-full w-[40%] shrink-0 object-cover"
                        onError={(e) => {
                          const img = e.currentTarget;
                          img.onerror = null;
                          img.src = getDefaultProfilePhoto(profile.accountType);
                        }}
                      />
                      <div className="flex min-w-0 flex-1 flex-col justify-between px-4 py-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-[15px] font-semibold tracking-tight text-foreground truncate">
                              {profile.pseudo} • {profile.age}
                            </div>
                            <div className="mt-1 text-[11px] text-muted-foreground truncate">
                              {profile.ville}
                              {profile.lieu ? ` • ${profile.lieu}` : ""}
                              {typeof profile.distanceKm === "number" ? ` • ${Math.round(profile.distanceKm)} km` : ""}
                            </div>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            {profile.isVip ? (
                              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">
                                VIP
                              </span>
                            ) : null}
                            {profile.tarif ? (
                              <span className="rounded-full bg-muted/40 px-2 py-0.5 text-[10px] text-foreground/85">
                                {profile.tarif}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-1.5">
                          <span className="rounded-full bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground">
                            {getAccountTypeLabel(profile.accountType)}
                          </span>
                          {getAvailabilityMeta(profile.disponibilite) ? (
                            <span className={`rounded-full px-2 py-0.5 text-[10px] ${getAvailabilityMeta(profile.disponibilite)?.className}`}>
                              {getAvailabilityMeta(profile.disponibilite)?.label}
                            </span>
                          ) : null}
                          {profile.isPro ? (
                            <span className="rounded-full bg-muted/40 px-2 py-0.5 text-[10px] text-foreground/75">
                              Pro
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-3 text-[12px] leading-5 text-muted-foreground line-clamp-4">
                          {profile.description ??
                            (lang === "en"
                              ? "Tap to view profile details."
                              : "Appuie pour voir les détails du profil.")}
                        </p>
                        <div className="mt-4 inline-flex items-center gap-2 text-[11px] font-medium text-foreground/85">
                          <span className="rounded-full bg-foreground px-3 py-1 text-background">
                            {lang === "en" ? "View profile" : "Voir son profil"}
                          </span>
                        </div>
                      </div>
                    </button>
                  ))}
                </>
              )}
            </div>
          </div>

        <div className="space-y-3">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-xl font-semibold tracking-tight text-foreground">
                {lang === "en" ? "Energy & men’s care" : "Énergie & produits masculins"}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {lang === "en"
                  ? "Selected products for comfort and endurance."
                  : "Produits choisis pour le confort et l'endurance."}
              </div>
            </div>
            <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setLocation("/adult-products")}>
              {lang === "en" ? "Open" : "Voir"}
            </Button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
            {maleProducts.slice(0, 4).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setLocation(`/adult-products/${p.id}`)}
                className="flex w-[94%] shrink-0 gap-3 overflow-hidden rounded-[24px] border border-border/70 bg-card/40 px-3 py-3 text-left transition-colors hover:bg-muted/10 sm:w-[70%] md:w-[52%] lg:w-[38%]"
              >
                <img src={p.imageUrl} alt={p.name} className="h-[96px] w-[96px] shrink-0 rounded-[20px] object-cover" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold tracking-tight text-foreground line-clamp-2">{p.name}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground">
                          {p.tag}
                        </span>
                        <span className="rounded-full bg-muted/40 px-2 py-0.5 text-[10px] text-foreground/85">
                          {p.size}
                        </span>
                      </div>
                    </div>
                    <span className="shrink-0 rounded-full bg-foreground px-2.5 py-1 text-[10px] font-medium text-background">
                      {p.price}
                    </span>
                  </div>
                  <p className="mt-2 text-[12px] leading-5 text-muted-foreground line-clamp-2">{p.description}</p>
                </div>
              </button>
            ))}
            <button
              type="button"
              onClick={() => setLocation("/adult-products")}
              className="flex w-[78%] shrink-0 items-center justify-center rounded-[24px] border border-dashed border-border/70 bg-muted/20 px-4 py-4 text-sm text-muted-foreground transition-colors hover:bg-muted/40 sm:w-[52%] md:w-[36%] lg:w-[28%]"
            >
              {lang === "en" ? "See all products" : "Voir tous les produits"}
            </button>
          </div>
        </div>

          {/* Salon massages privés / SPA */}
          <div className="space-y-3">
            <div className="flex items-end justify-between">
              <div>
                <div className="text-sm font-semibold text-foreground">
                  {lang === "en" ? "Wellness spaces & residences" : "Espaces bien-être & résidences"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {lang === "en"
                    ? "Nearby wellness spaces, private salons and furnished residences."
                    : "Espaces bien-être à proximité, salons privés et résidences meublées."}
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
                                  ? "Sélection de prestations bien-être proposées dans un cadre discret."
                                  : "Appartements meublés discrets pour séjours, passages et rendez-vous organisés.")}
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
                <div className="text-xl font-semibold tracking-tight text-foreground">
                  {lang === "en" ? "Latest ads" : "Dernières annonces"}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {lang === "en" ? "Newest posts from active profiles." : "Les publications les plus récentes."}
                </div>
              </div>
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setLocation("/annonces")}>
                {lang === "en" ? "See all" : "Tout voir"}
              </Button>
            </div>
            <div className="space-y-2.5">
              {(newsLoading ? Array.from({ length: 6 }) : topNews.slice(0, 8)).map((a: any, idx: number) =>
                newsLoading ? (
                  <div key={idx} className="h-[144px] border-b border-border/40 bg-muted/15" />
                ) : (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => openProfile(a.profile.id, topNews.map((item) => item.profile.id), "start-latest")}
                    className="group w-full border-b border-border/50 py-3 text-left transition-opacity hover:opacity-90"
                  >
                    <div className="flex min-h-[144px] items-start gap-3 sm:gap-4">
                      <div className="h-[136px] w-[106px] shrink-0 overflow-hidden bg-muted/20 sm:h-[152px] sm:w-[118px]">
                          <img
                            src={getProfilePhoto(a.profile.photoUrl, a.profile.accountType)}
                            alt={a.profile.pseudo}
                            className="h-full w-full object-cover"
                            onError={(e) => {
                              const img = e.currentTarget;
                              img.onerror = null;
                              img.src = getDefaultProfilePhoto(a.profile.accountType);
                            }}
                          />
                      </div>

                      <div className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
                              <span className={`font-semibold tracking-[0.12em] ${getProfileTierFeedClass(a.profile)}`}>
                                {getProfileTierMeta(a.profile).label}
                              </span>
                              <span>
                                {getAccountTypeLabel(a.profile.accountType)}
                              </span>
                              <span>
                                {a.profile.pseudo}
                              </span>
                              {a.profile.isPro ? (
                                <span className="text-primary">PRO</span>
                              ) : null}
                              {(a.promotionMeta?.badges ?? []).includes("URGENT") ? (
                                <span className="text-red-500">Urgent</span>
                              ) : null}
                            </div>
                            <div className="mt-1.5 text-[15px] font-semibold tracking-tight text-foreground line-clamp-2 md:text-[1.05rem]">
                              {a.title}
                            </div>
                            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-muted-foreground">
                              <span className="inline-flex items-center gap-1.5">
                                <MapPin className="h-3.5 w-3.5" />
                                <span className="truncate">
                                  {a.profile.ville}
                                  {a.profile.lieu ? ` • ${a.profile.lieu}` : ""}
                                  {typeof a.distanceKm === "number" ? ` • ${Math.round(a.distanceKm)} km` : ""}
                                </span>
                              </span>
                              {a.profile.tarif ? (
                                <span className="font-medium text-foreground">{a.profile.tarif}</span>
                              ) : null}
                              {getAvailabilityMeta(a.profile.disponibilite) ? (
                                <span className={getAvailabilityMeta(a.profile.disponibilite)?.className}>
                                  {getAvailabilityMeta(a.profile.disponibilite)?.label}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </div>

                        <p className="mt-2.5 max-w-3xl text-[12px] leading-5 text-muted-foreground line-clamp-4">
                          {(a.body ?? a.profile.description) ??
                            (lang === "en"
                              ? "Open the profile to see the full details."
                              : "Ouvre le profil pour voir tous les détails.")}
                        </p>

                        <div className="mt-2.5 flex items-end justify-between gap-3">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-muted-foreground">
                            {(a.promotionMeta?.badges ?? [])
                              .filter((b: string) => b !== "URGENT")
                              .slice(0, 2)
                              .map((b: string) => (
                                <span
                                  key={b}
                                  className="text-foreground/75"
                                >
                                  {b === "PROLONGATION" ? "Prolong." : b}
                                </span>
                              ))}
                            {(a.profile.services ?? []).slice(0, 2).map((s: string) => (
                              <span
                                key={s}
                                className="text-muted-foreground"
                              >
                                {s}
                              </span>
                            ))}
                          </div>
                          <span className="inline-flex shrink-0 items-center text-[10px] font-medium text-foreground">
                            {lang === "en" ? "Open profile" : "Ouvrir le profil"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                ),
              )}
            </div>
            {!newsLoading && (news?.length ?? 0) > 8 ? (
              <Button
                variant="outline"
                className="w-full rounded-2xl"
                onClick={() => setLocation("/explore")}
              >
                {lang === "en" ? "Show more profiles" : "Afficher plus de profils"}
              </Button>
            ) : null}
          </div>

        </motion.div>

        <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
          <DialogContent className="rounded-3xl">
            <DialogHeader>
              <DialogTitle>{selectedEvent?.title ?? (lang === "en" ? "Event" : "Évènement")}</DialogTitle>
              <DialogDescription>
                {selectedEvent
                  ? `${formatEventDate(selectedEvent.date)} • ${selectedEvent.city}`
                  : (lang === "en" ? "Read before you participate." : "Lis ceci avant de participer.")}
              </DialogDescription>
            </DialogHeader>

            {rsvpDone ? (
              <div className="rounded-2xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                {lang === "en"
                  ? "Your request is recorded. We’ll contact you before the event date."
                  : "Ta demande est enregistrée. On te contactera avant la date de l’évènement."}
              </div>
            ) : !eventInfoAccepted ? (
              <div className="space-y-4">
                <div className="rounded-2xl bg-muted/30 p-4 text-sm leading-6 text-muted-foreground">
                  {lang === "en"
                    ? "Some events are free and others are paid. Please make sure to get informed before any participation."
                    : "Certains évènements sont gratuits et d'autres payants. Merci de bien vous informer avant toute participation."}
                </div>
                <Button
                  className="w-full rounded-2xl"
                  onClick={() => setEventInfoAccepted(true)}
                >
                  {lang === "en" ? "Continue" : "Continuer"}
                </Button>
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



