import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BadgeCheck, Calendar, Crown, MapPin, Play, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { getDefaultProfilePhoto, getProfilePhoto } from "@/lib/profile-photo";
import { rememberProfileBook } from "@/lib/profile-book";

type ApiProfile = {
  id: string;
  pseudo: string;
  age: number;
  ville: string;
  lieu: string | null;
  verified: boolean;
  isPro?: boolean | null;
  isVip?: boolean;
  photoUrl: string | null;
  photos: string[];
  videoUrl: string | null;
  description: string | null;
  services?: string[] | null;
  tarif?: string | null;
  distanceKm?: number | null;
  accountType?: "profile" | "residence" | "salon" | "adult_shop" | null;
  latestAnnonce?: { id: string; title: string; createdAt: string; badges?: string[] } | null;
  disponibilite?: { date: string; heureDebut: string; duree: string } | null;
};

type VipEvent = {
  id: string;
  title: string;
  description?: string | null;
  city: string;
  venue?: string | null;
  startsAt: string;
  createdAt?: string;
  imageUrl?: string | null;
  imageUrls?: string[] | null;
  videoUrl?: string | null;
  organizer?: {
    profileId: string;
    pseudo: string;
  } | null;
};

function scoreProfile(p: ApiProfile): number {
  const badges = p.latestAnnonce?.badges ?? [];
  const premium = badges.includes("PREMIUM");
  const top = badges.includes("TOP");
  const urgent = badges.includes("URGENT");
  const photoCount = Array.isArray(p.photos) ? p.photos.length : 0;
  const hasVideo = Boolean(p.videoUrl);
  return (
    (p.isVip ? 1000 : 0) +
    (premium ? 40 : 0) +
    (top ? 25 : 0) +
    (urgent ? 10 : 0) +
    (p.verified ? 6 : 0) +
    (hasVideo ? 3 : 0) +
    Math.min(12, photoCount) / 10
  );
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

function formatAvailability(
  disponibilite: ApiProfile["disponibilite"],
  lang: "fr" | "en",
) {
  if (!disponibilite?.date) {
    return lang === "en" ? "Availability on request" : "Disponibilite sur demande";
  }
  const parts = [disponibilite.date, disponibilite.heureDebut, disponibilite.duree].filter(Boolean);
  return parts.join(" • ");
}

function VipHero({
  p,
  onOpen,
  lang,
}: {
  p: ApiProfile | null;
  onOpen: (id: string) => void;
  lang: "fr" | "en";
}) {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [index, setIndex] = useState(0);

  const assets = useMemo(() => {
    if (!p) return [];
    const items: Array<{ type: "video" | "photo"; url: string }> = [];
    if (p.videoUrl) items.push({ type: "video", url: p.videoUrl });
    for (const u of p.photos ?? []) items.push({ type: "photo", url: u });
    // If we have no media, fallback to cover.
    if (items.length === 0 && p.photoUrl) items.push({ type: "photo", url: p.photoUrl });
    return items.slice(0, 12);
  }, [p]);

  useEffect(() => setIndex(0), [p?.id]);

  const onScroll = () => {
    const el = trackRef.current;
    if (!el) return;
    const w = el.clientWidth || 1;
    const i = Math.round(el.scrollLeft / w);
    setIndex(Math.min(Math.max(0, i), Math.max(0, assets.length - 1)));
  };

  if (!p) {
    return (
      <div className="rounded-3xl border border-border bg-card/60 p-6">
        <div className="text-sm text-muted-foreground">{lang === "en" ? "No VIP profile yet." : "Aucun profil VIP."}</div>
      </div>
    );
  }

  const badges = p.latestAnnonce?.badges ?? [];
  const premium = badges.includes("PREMIUM");
  const top = badges.includes("TOP");
  const urgent = badges.includes("URGENT");
  const title = p.latestAnnonce?.title?.trim() ? p.latestAnnonce.title : `${p.pseudo} • ${p.age}`;
  const availability = formatAvailability(p.disponibilite, lang);

  return (
    <div className="relative overflow-hidden rounded-3xl border border-amber-500/20 bg-[linear-gradient(180deg,rgba(41,30,13,0.98),rgba(23,20,16,0.98))] shadow-[0_20px_70px_-35px_rgba(245,158,11,0.55)]">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 -right-24 w-56 h-56 rounded-full bg-amber-500/20 blur-3xl" />
        <div className="absolute -bottom-28 -left-28 w-64 h-64 rounded-full bg-fuchsia-500/10 blur-3xl" />
      </div>

      <div className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white backdrop-blur">
            <Crown className="w-4 h-4 text-amber-300" />
            {lang === "en" ? "VIP selection" : "Sélection VIP"}
          </div>
          <div className="text-[11px] text-white/55">
            {assets.length ? `${index + 1}/${assets.length}` : "—"}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onOpen(p.id)}
          className="mt-3 block w-full text-left"
        >
          <div className="text-lg font-semibold leading-snug text-white">
            {title}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-white/70">
            <span className="inline-flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" /> {p.ville}
              {p.lieu ? ` • ${p.lieu}` : ""}
              {typeof p.distanceKm === "number" ? ` • ${Math.round(p.distanceKm)} km` : ""}
            </span>
            {p.verified ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-1">
                <BadgeCheck className="w-3.5 h-3.5" />
                {lang === "en" ? "Certified" : "Certifié"}
              </span>
            ) : null}
            {premium ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                PREMIUM
              </span>
            ) : null}
            {top ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-sky-500/10 text-sky-400 border border-sky-500/20">
                TOP
              </span>
            ) : null}
            {urgent ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-red-500/20 text-red-300 border border-red-500/20">
                {lang === "en" ? "Urgent" : "Urgent"}
              </span>
            ) : null}
          </div>
          <div className="mt-2 inline-flex items-center gap-2 rounded-full bg-white/6 px-3 py-1 text-[11px] text-white/75 ring-1 ring-white/10">
            <Calendar className="h-3.5 w-3.5 text-amber-300" />
            {availability}
          </div>
        </button>

        <div
          ref={trackRef}
          onScroll={onScroll}
          className="mt-4 flex overflow-x-auto snap-x snap-mandatory scroll-smooth rounded-2xl border border-white/10 bg-black/20"
        >
          {assets.length ? (
            assets.map((a, i) => (
              <div key={`${a.type}-${a.url}-${i}`} className="relative snap-start shrink-0 w-full aspect-[4/3]">
                <img
                  src={a.type === "photo" ? a.url : getProfilePhoto(p.photoUrl, p.accountType)}
                  alt={`${p.pseudo} ${i + 1}`}
                  className="absolute inset-0 w-full h-full object-cover"
                  onError={(e) => {
                    const img = e.currentTarget;
                    img.onerror = null;
                    img.src = getDefaultProfilePhoto(p.accountType);
                  }}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
                {a.type === "video" ? (
                  <div className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-black/45 text-white border border-white/15 backdrop-blur px-2 py-1 text-[10px]">
                    <Play className="w-3.5 h-3.5" />
                    video
                  </div>
                ) : null}
                <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-2">
                  <div className="text-white">
                    <div className="text-sm font-semibold">{p.pseudo}</div>
                    <div className="text-[11px] text-white/80">
                      {p.tarif ? p.tarif : ""}
                      {p.latestAnnonce?.createdAt ? ` • ${formatRelativeTime(p.latestAnnonce.createdAt, lang)}` : ""}
                    </div>
                  </div>
                  <div className="px-2 py-0.5 rounded-full text-[10px] bg-black/35 text-white border border-white/15 backdrop-blur">
                    {i + 1}/{assets.length}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="w-full p-6 text-sm text-muted-foreground">{lang === "en" ? "No media" : "Aucun média"}</div>
          )}
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <div className="text-[11px] text-white/60 line-clamp-1">
            {p.description ?? "—"}
          </div>
          <Button size="sm" className="rounded-full bg-white text-black hover:bg-white/90" onClick={() => onOpen(p.id)}>
            {lang === "en" ? "View" : "Voir"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function VipMiniCard({ p, onOpen, lang }: { p: ApiProfile; onOpen: () => void; lang: "fr" | "en" }) {
  const badges = p.latestAnnonce?.badges ?? [];
  const premium = badges.includes("PREMIUM");
  const top = badges.includes("TOP");
  const urgent = badges.includes("URGENT");
  const photoCount = Array.isArray(p.photos) ? p.photos.length : 0;
  const availability = formatAvailability(p.disponibilite, lang);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="shrink-0 w-[270px] overflow-hidden rounded-[30px] border border-amber-500/20 bg-[linear-gradient(180deg,rgba(41,30,13,0.96),rgba(23,20,16,0.98))] shadow-[0_22px_70px_-45px_rgba(245,158,11,0.48)]"
    >
      <div className="relative h-[150px]">
        <img
          src={getProfilePhoto(p.photoUrl, p.accountType)}
          alt={p.pseudo}
          className="absolute inset-0 w-full h-full object-cover"
          onError={(e) => {
            const img = e.currentTarget;
            img.onerror = null;
            img.src = getDefaultProfilePhoto(p.accountType);
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <div className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-black/40 text-white border border-white/15 backdrop-blur px-2 py-1 text-[10px]">
          <Crown className="w-3.5 h-3.5 text-amber-300" />
          VIP
        </div>
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2">
          <div className="text-white">
            <div className="text-sm font-semibold">{p.pseudo}</div>
            <div className="text-[11px] text-white/80">
              {p.ville} • {p.age}
              {p.tarif ? ` • ${p.tarif}` : ""}
            </div>
          </div>
          {photoCount ? (
            <div className="px-2 py-0.5 rounded-full text-[10px] bg-black/35 text-white border border-white/15 backdrop-blur">
              {photoCount} {lang === "en" ? "assets" : "assets"}
            </div>
          ) : (
            <span />
          )}
        </div>
      </div>

      <div className="p-3 text-left">
        <div className="text-[11px] text-white/65 line-clamp-1">{availability}</div>
        <div className="flex flex-wrap gap-1.5">
          {p.verified ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-1">
              <BadgeCheck className="w-3.5 h-3.5" />
              {lang === "en" ? "Certified" : "Certifié"}
            </span>
          ) : null}
          {premium ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              PREMIUM
            </span>
          ) : null}
          {top ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-sky-500/10 text-sky-400 border border-sky-500/20">
              TOP
            </span>
          ) : null}
          {urgent ? (
            <span className="px-2 py-0.5 rounded-full text-[10px] bg-red-500/20 text-red-300 border border-red-500/20">
              {lang === "en" ? "Urgent" : "Urgent"}
            </span>
          ) : null}
        </div>
        <div className="mt-2 text-[11px] text-white/60 line-clamp-2">{p.description ?? "—"}</div>
      </div>
    </button>
  );
}

function RegularRow({ p, onOpen, lang }: { p: ApiProfile; onOpen: () => void; lang: "fr" | "en" }) {
  const badges = p.latestAnnonce?.badges ?? [];
  const urgent = badges.includes("URGENT");
  const premium = badges.includes("PREMIUM");
  const top = badges.includes("TOP");
  const photoCount = Array.isArray(p.photos) ? p.photos.length : 0;
  const title = p.latestAnnonce?.title?.trim() ? p.latestAnnonce.title : `${p.pseudo} • ${p.age}`;
  const availability = formatAvailability(p.disponibilite, lang);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group w-full overflow-hidden border-b border-border/50 py-3 text-left transition-colors last:border-b-0 hover:bg-amber-500/[0.03]"
    >
      <div className="grid grid-cols-[40%_minmax(0,1fr)] gap-3 sm:gap-4">
        <div className="relative h-[148px] shrink-0 overflow-hidden rounded-[26px] bg-muted/30 sm:h-[190px]">
          <img
            src={getProfilePhoto(p.photoUrl, p.accountType)}
            alt={p.pseudo}
            className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => {
              const img = e.currentTarget;
              img.onerror = null;
              img.src = getDefaultProfilePhoto(p.accountType);
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-2">
            {photoCount > 0 ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-black/35 text-white border border-white/15 backdrop-blur">
                {photoCount} {lang === "en" ? "assets" : "assets"}
              </span>
            ) : (
              <span />
            )}
            {urgent ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-red-500/80 text-white border border-white/15">
                {lang === "en" ? "Urgent" : "Urgent"}
              </span>
            ) : null}
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold text-foreground leading-snug line-clamp-2 sm:text-base">{title}</div>
          <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground sm:text-xs">
            <MapPin className="w-3.5 h-3.5" />
            <span className="truncate">
              {p.ville}
              {p.lieu ? ` • ${p.lieu}` : ""}
              {typeof p.distanceKm === "number" ? ` • ${Math.round(p.distanceKm)} km` : ""}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {p.verified ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 inline-flex items-center gap-1">
                <BadgeCheck className="w-3.5 h-3.5" />
                {lang === "en" ? "Certified" : "Certifié"}
              </span>
            ) : null}
            {premium ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                PREMIUM
              </span>
            ) : null}
            {top ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-sky-500/10 text-sky-400 border border-sky-500/20">
                TOP
              </span>
            ) : null}
            {(p.services ?? []).slice(0, 2).map((s) => (
              <span key={s} className="px-2 py-0.5 rounded-full text-[10px] bg-muted/30 text-muted-foreground">
                {s}
              </span>
            ))}
          </div>
          <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-amber-500/8 px-2.5 py-1 text-[10px] text-foreground/80 ring-1 ring-amber-500/10">
            <Calendar className="h-3 w-3 text-muted-foreground" />
            {availability}
          </div>
          <div className="mt-2 text-[11px] leading-5 text-muted-foreground line-clamp-3">{p.description ?? "—"}</div>
        </div>
      </div>
    </button>
  );
}

export default function Vip() {
  const [, setLocation] = useLocation();
  const { lang } = useI18n();

  // VIP: only pros by default (escort/masseuse). No hard filters yet to avoid breaking existing behaviors.
  const vipQuery = `/api/profiles?${new URLSearchParams({
    vipOnly: "1",
    proOnly: "1",
    includeLatestAnnonce: "1",
    limit: "80",
  }).toString()}`;

  const { data: vipRaw, isLoading: vipLoading } = useQuery<ApiProfile[]>({ queryKey: [vipQuery] });
  const { data: vipEventsRaw = [], isLoading: vipEventLoading } = useQuery<VipEvent[]>({
    queryKey: ["/api/events?limit=12"],
  });

  const vip = useMemo(() => {
    return (vipRaw ?? [])
      .filter((p) => p && p.isVip)
      .slice()
      .sort((a, b) => scoreProfile(b) - scoreProfile(a));
  }, [vipRaw]);
  const [selectedVipId, setSelectedVipId] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedVipId && vip.length) setSelectedVipId(vip[0].id);
  }, [selectedVipId, vip]);

  const selectedVip = useMemo(
    () => vip.find((p) => p.id === selectedVipId) ?? (vip[0] ?? null),
    [vip, selectedVipId],
  );
  const otherVipProfiles = useMemo(
    () => vip.filter((profile) => profile.id !== selectedVip?.id),
    [vip, selectedVip?.id],
  );
  const vipEvent = useMemo(() => {
    return [...vipEventsRaw].sort((a, b) => {
      const aTime = new Date(a.createdAt ?? a.startsAt).getTime();
      const bTime = new Date(b.createdAt ?? b.startsAt).getTime();
      return bTime - aTime;
    })[0] ?? null;
  }, [vipEventsRaw]);

  const pageSize = 10;
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(otherVipProfiles.length / pageSize));
  const pageSafe = Math.min(Math.max(0, page), pageCount - 1);
  useEffect(() => {
    if (page !== pageSafe) setPage(pageSafe);
  }, [page, pageSafe]);

  const paged = useMemo(() => {
    const start = pageSafe * pageSize;
    return otherVipProfiles.slice(start, start + pageSize);
  }, [otherVipProfiles, pageSafe]);

  const openProfile = (id: string) => {
    rememberProfileBook(vip.map((profile) => profile.id), "vip");
    setLocation(`/profile/${id}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <div className="mx-auto flex max-w-[980px] items-center justify-between gap-2">
          <Button
            variant="secondary"
            size="icon"
            className="rounded-full"
            onClick={() => setLocation("/start")}
            aria-label={lang === "en" ? "Back" : "Retour"}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 text-center">
            <div className="text-sm font-semibold tracking-tight text-foreground">
              {lang === "en" ? "VIP profiles" : "Profils VIP"}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {lang === "en"
                ? "Premium selection, simple and direct."
                : "Sélection premium, simple et directe."}
            </div>
          </div>
          <Button
            variant="secondary"
            size="icon"
            className="rounded-full"
            onClick={() => setLocation("/explore")}
            aria-label="Explore"
          >
            <Sparkles className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <main className="px-4 pb-10 pt-4">
        <div className="mx-auto max-w-[980px] space-y-5">
          <VipHero p={selectedVip} lang={lang} onOpen={openProfile} />

          <div className="sticky top-[calc(env(safe-area-inset-top)+0.5rem)] z-30 -mx-4 border-y border-amber-500/10 bg-background px-4 py-2">
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                <Crown className="w-4 h-4 text-amber-400" />
                <span className="font-medium text-foreground">
                  {lang === "en" ? "Premium selection" : "Sélection premium"}
                </span>
                <span className="text-muted-foreground">•</span>
                <span>{vip.length} {lang === "en" ? "profiles" : "profils"}</span>
              </div>
              {vip.length ? (
                <div className="text-[10px] text-muted-foreground">
                  {lang === "en" ? "VIP only" : "VIP seulement"}
                </div>
              ) : null}
            </div>
            <div className="mt-2 flex gap-3 overflow-x-auto pb-1">
              {vipLoading ? (
                <div className="text-xs text-muted-foreground">{lang === "en" ? "Loading VIP…" : "Chargement VIP…"}</div>
              ) : vip.length ? (
                vip.map((p) => (
                  <div key={p.id} onClick={() => setSelectedVipId(p.id)} className={selectedVipId === p.id ? "scale-[1.01]" : ""}>
                    <VipMiniCard p={p} lang={lang} onOpen={() => openProfile(p.id)} />
                  </div>
                ))
              ) : (
                <div className="text-xs text-muted-foreground">
                  {lang === "en" ? "No VIP profile yet." : "Aucun profil VIP pour le moment."}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="text-sm font-semibold text-foreground">
              {lang === "en" ? "VIP event" : "Évènement VIP"}
            </div>
            {vipEventLoading ? (
              <div className="text-sm text-muted-foreground">{lang === "en" ? "Loading event…" : "Chargement de l'évènement…"}</div>
            ) : vipEvent ? (
              <button
                type="button"
                onClick={() => setLocation(`/events/${vipEvent.id}`)}
                className="group flex w-full items-stretch gap-3 text-left"
              >
                <img
                  src={vipEvent.imageUrls?.[0] || vipEvent.imageUrl || getDefaultProfilePhoto("profile")}
                  alt={vipEvent.title}
                  className="h-[150px] w-[40%] shrink-0 rounded-[26px] object-cover"
                />
                <div className="min-w-0 flex flex-1 flex-col justify-between py-1">
                  <div>
                    <div className="text-[15px] font-semibold tracking-tight text-foreground line-clamp-2 sm:text-base">
                      {vipEvent.title}
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">
                      {new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "fr-FR", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      }).format(new Date(vipEvent.startsAt))}{" "}
                      • {vipEvent.city}
                    </div>
                    {vipEvent.venue ? (
                      <div className="mt-1 text-[11px] text-muted-foreground line-clamp-1">
                        {vipEvent.venue}
                      </div>
                    ) : null}
                    <p className="mt-2 text-[12px] leading-5 text-muted-foreground line-clamp-3">
                      {vipEvent.description ?? (lang === "en" ? "Open the event to read full details." : "Ouvre l'évènement pour voir tous les détails.")}
                    </p>
                  </div>
                  <div className="mt-3 inline-flex items-center gap-2 text-[11px] font-medium text-foreground">
                    <span>{lang === "en" ? "Open event" : "Ouvrir l'évènement"}</span>
                    <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                  </div>
                </div>
              </button>
            ) : (
              <div className="text-sm text-muted-foreground">
                {lang === "en" ? "No VIP event published yet." : "Aucun évènement VIP publié pour le moment."}
              </div>
            )}
          </div>

          <div className="pt-2">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold text-foreground">
                  {lang === "en" ? "Other VIP profiles" : "Autres profils VIP"}
                </div>
                <div className="text-[11px] text-muted-foreground">
                  {lang === "en"
                    ? "Only profiles marked VIP appear here."
                    : "Seuls les profils marqués VIP apparaissent ici."}
                </div>
              </div>
              <div className="text-[11px] text-muted-foreground">
                {otherVipProfiles.length ? `${pageSafe + 1}/${pageCount}` : "—"}
              </div>
            </div>
            <div className="mt-3 space-y-3">
              {vipLoading && !paged.length ? (
                <div className="text-sm text-muted-foreground">{lang === "en" ? "Loading…" : "Chargement…"}</div>
              ) : paged.length ? (
                paged.map((p) => <RegularRow key={p.id} p={p} lang={lang} onOpen={() => openProfile(p.id)} />)
              ) : (
                <div className="rounded-3xl border border-amber-500/10 bg-card/60 p-5 text-sm text-muted-foreground">
                  {lang === "en" ? "No other VIP profiles found." : "Aucun autre profil VIP trouvé."}
                </div>
              )}
            </div>

            {otherVipProfiles.length > pageSize ? (
              <div className="mt-4 flex items-center justify-between">
                <Button
                  variant="outline"
                  className="rounded-full"
                  disabled={pageSafe === 0}
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                >
                  {lang === "en" ? "Previous" : "Précédent"}
                </Button>
                <Button
                  variant="outline"
                  className="rounded-full"
                  disabled={pageSafe >= pageCount - 1}
                  onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
                >
                  {lang === "en" ? "Next" : "Suivant"}
                </Button>
              </div>
            ) : null}
          </div>
        </div>
      </main>
    </div>
  );
}


