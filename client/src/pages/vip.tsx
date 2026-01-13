import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, BadgeCheck, Crown, MapPin, Play, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import avatarUrl from "@assets/avatar.png";

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

  return (
    <div className="relative rounded-3xl overflow-hidden border border-amber-500/20 bg-gradient-to-b from-amber-500/10 via-card/60 to-card shadow-[0_18px_60px_-35px_rgba(245,158,11,0.65)]">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute -top-24 -right-24 w-56 h-56 rounded-full bg-amber-500/20 blur-3xl" />
        <div className="absolute -bottom-28 -left-28 w-64 h-64 rounded-full bg-fuchsia-500/10 blur-3xl" />
      </div>

      <div className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-2">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/30 text-white px-3 py-1 text-xs backdrop-blur">
            <Crown className="w-4 h-4 text-amber-300" />
            {lang === "en" ? "VIP selection" : "Sélection VIP"}
          </div>
          <div className="text-[11px] text-muted-foreground">
            {assets.length ? `${index + 1}/${assets.length}` : "—"}
          </div>
        </div>

        <button
          type="button"
          onClick={() => onOpen(p.id)}
          className="mt-3 block w-full text-left"
        >
          <div className="text-lg font-semibold text-foreground leading-snug">
            {title}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
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
        </button>

        <div
          ref={trackRef}
          onScroll={onScroll}
          className="mt-4 flex overflow-x-auto snap-x snap-mandatory scroll-smooth rounded-2xl border border-border bg-muted/20"
        >
          {assets.length ? (
            assets.map((a, i) => (
              <div key={`${a.type}-${a.url}-${i}`} className="relative snap-start shrink-0 w-full aspect-[4/3]">
                <img
                  src={a.type === "photo" ? a.url : (p.photoUrl || avatarUrl)}
                  alt={`${p.pseudo} ${i + 1}`}
                  className="absolute inset-0 w-full h-full object-cover"
                  onError={(e) => {
                    const img = e.currentTarget;
                    img.onerror = null;
                    img.src = avatarUrl;
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
          <div className="text-[11px] text-muted-foreground line-clamp-1">
            {p.description ?? "—"}
          </div>
          <Button size="sm" className="rounded-full" onClick={() => onOpen(p.id)}>
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

  return (
    <button
      type="button"
      onClick={onOpen}
      className="shrink-0 w-[230px] rounded-3xl overflow-hidden border border-amber-500/20 bg-gradient-to-b from-amber-500/10 via-card/60 to-card shadow-[0_18px_60px_-45px_rgba(245,158,11,0.55)]"
    >
      <div className="relative h-[150px]">
        <img
          src={p.photoUrl || avatarUrl}
          alt={p.pseudo}
          className="absolute inset-0 w-full h-full object-cover"
          onError={(e) => {
            const img = e.currentTarget;
            img.onerror = null;
            img.src = avatarUrl;
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
        <div className="mt-2 text-[11px] text-muted-foreground line-clamp-2">{p.description ?? "—"}</div>
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

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group w-full text-left rounded-3xl border border-border bg-card/70 hover:bg-card transition-colors overflow-hidden shadow-sm hover:shadow-md"
    >
      <div className="flex gap-3 p-3">
        <div className="relative w-[92px] h-[112px] rounded-2xl overflow-hidden border border-border shrink-0 bg-muted/30">
          <img
            src={p.photoUrl || avatarUrl}
            alt={p.pseudo}
            className="absolute inset-0 w-full h-full object-cover"
            onError={(e) => {
              const img = e.currentTarget;
              img.onerror = null;
              img.src = avatarUrl;
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
          <div className="text-sm font-semibold text-foreground leading-snug line-clamp-2">{title}</div>
          <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
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
              <span key={s} className="px-2 py-0.5 rounded-full text-[10px] bg-muted/30 text-muted-foreground border border-border">
                {s}
              </span>
            ))}
          </div>
          <div className="mt-2 text-[11px] text-muted-foreground line-clamp-2">{p.description ?? "—"}</div>
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

  const allQuery = `/api/profiles?${new URLSearchParams({
    proOnly: "1",
    includeLatestAnnonce: "1",
    limit: "200",
  }).toString()}`;

  const { data: vipRaw, isLoading: vipLoading } = useQuery<ApiProfile[]>({ queryKey: [vipQuery] });
  const { data: allRaw, isLoading: allLoading } = useQuery<ApiProfile[]>({ queryKey: [allQuery] });

  const vip = useMemo(() => {
    return (vipRaw ?? [])
      .filter((p) => p && p.isVip)
      .slice()
      .sort((a, b) => scoreProfile(b) - scoreProfile(a));
  }, [vipRaw]);

  const regular = useMemo(() => {
    const vips = new Set(vip.map((p) => p.id));
    return (allRaw ?? [])
      .filter((p) => p && !vips.has(p.id))
      .slice()
      .sort((a, b) => scoreProfile(b) - scoreProfile(a));
  }, [allRaw, vip]);

  const [selectedVipId, setSelectedVipId] = useState<string | null>(null);
  useEffect(() => {
    if (!selectedVipId && vip.length) setSelectedVipId(vip[0].id);
  }, [selectedVipId, vip]);

  const selectedVip = useMemo(() => vip.find((p) => p.id === selectedVipId) ?? (vip[0] ?? null), [vip, selectedVipId]);

  const pageSize = 10;
  const [page, setPage] = useState(0);
  const pageCount = Math.max(1, Math.ceil(regular.length / pageSize));
  const pageSafe = Math.min(Math.max(0, page), pageCount - 1);
  useEffect(() => {
    if (page !== pageSafe) setPage(pageSafe);
  }, [page, pageSafe]);

  const paged = useMemo(() => {
    const start = pageSafe * pageSize;
    return regular.slice(start, start + pageSize);
  }, [regular, pageSafe]);

  const openProfile = (id: string) => setLocation(`/profile/${id}`);

  return (
    <div className="min-h-screen bg-background">
      <div className="px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)]">
        <div className="mx-auto max-w-md flex items-center justify-between gap-2">
          <Button
            variant="secondary"
            size="icon"
            className="rounded-full"
            onClick={() => setLocation("/start")}
            aria-label={lang === "en" ? "Back" : "Retour"}
          >
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="text-center flex-1">
            <div className="text-sm font-semibold text-foreground">
              {lang === "en" ? "VIP Escorts & VIP Masseuses" : "Escortes VIP & Masseuses VIP"}
            </div>
            <div className="text-[11px] text-muted-foreground">
              {lang === "en"
                ? "Premium profiles stay on top."
                : "Les profils premium restent en premier."}
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
        <div className="mx-auto max-w-md space-y-4">
          <VipHero p={selectedVip} lang={lang} onOpen={openProfile} />

          <div className="sticky top-[calc(env(safe-area-inset-top)+4.25rem)] z-20 -mx-4 px-4 py-3 bg-background/85 backdrop-blur border-y border-border">
            <div className="flex items-center justify-between gap-2">
              <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                <Crown className="w-4 h-4 text-amber-400" />
                <span className="font-medium text-foreground">
                  {lang === "en" ? "VIP first" : "VIP en premier"}
                </span>
                <span className="text-muted-foreground">•</span>
                <span>{vip.length} {lang === "en" ? "profiles" : "profils"}</span>
              </div>
              {vip.length ? (
                <div className="text-[10px] text-muted-foreground">
                  {lang === "en" ? "Pinned" : "Épinglé"}
                </div>
              ) : null}
            </div>
            <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
              {vipLoading ? (
                <div className="text-xs text-muted-foreground">{lang === "en" ? "Loading VIP…" : "Chargement VIP…"}</div>
              ) : vip.length ? (
                vip.map((p) => (
                  <div key={p.id} onClick={() => setSelectedVipId(p.id)}>
                    <VipMiniCard p={p} lang={lang} onOpen={() => openProfile(p.id)} />
                  </div>
                ))
              ) : (
                <div className="text-xs text-muted-foreground">
                  {lang === "en" ? "No VIP profiles yet." : "Aucun profil VIP pour le moment."}
                </div>
              )}
            </div>
          </div>

          <div className="pt-2">
            <div className="flex items-center justify-between">
              <div className="text-sm font-semibold text-foreground">
                {lang === "en" ? "More profiles" : "Autres profils"}
              </div>
              <div className="text-[11px] text-muted-foreground">
                {regular.length ? `${pageSafe + 1}/${pageCount}` : "—"}
              </div>
            </div>
            <div className="mt-3 space-y-3">
              {(vipLoading || allLoading) && !paged.length ? (
                <div className="text-sm text-muted-foreground">{lang === "en" ? "Loading…" : "Chargement…"}</div>
              ) : paged.length ? (
                paged.map((p) => <RegularRow key={p.id} p={p} lang={lang} onOpen={() => openProfile(p.id)} />)
              ) : (
                <div className="rounded-3xl border border-border bg-card/60 p-5 text-sm text-muted-foreground">
                  {lang === "en" ? "No profiles found." : "Aucun profil trouvé."}
                </div>
              )}
            </div>

            {regular.length > pageSize ? (
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


