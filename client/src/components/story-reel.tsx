import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2, Lock, MessageCircle, Play, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
import { buildContactMessage, openTelegram, openWhatsApp } from "@/lib/contact";
import { getProfilePhoto } from "@/lib/profile-photo";

export type StoryReelItem = {
  id: string;
  mediaUrl: string | null;
  visibility?: "public" | "private";
  isLocked?: boolean;
  durationSeconds: number;
  caption: string | null;
  createdAt?: string;
};

export type StoryReelGroup = {
  profile: {
    id: string;
    pseudo: string;
    ville?: string | null;
    accountType?: string | null;
    photoUrl: string | null;
    contact?: {
      phone: string | null;
      telegram: string | null;
      preference?: "whatsapp" | "telegram" | null;
    } | null;
  };
  items: StoryReelItem[];
  latestCreatedAt?: string;
};

function buildStoryRingBackground(count: number) {
  const safeCount = Math.max(1, Math.min(12, count));
  if (safeCount === 1) {
    return "conic-gradient(from 0deg, rgb(239 68 68) 0deg 360deg)";
  }

  const gapDeg = Math.min(12, 40 / safeCount);
  const slice = 360 / safeCount;
  const parts: string[] = [];

  for (let index = 0; index < safeCount; index += 1) {
    const start = index * slice;
    const end = start + Math.max(0, slice - gapDeg);
    parts.push(`rgb(239 68 68) ${start}deg ${end}deg`);
    parts.push(`rgba(255,255,255,0.16) ${end}deg ${(index + 1) * slice}deg`);
  }

  return `conic-gradient(from -90deg, ${parts.join(", ")})`;
}

export function StoryReel(props: {
  groups: StoryReelGroup[];
  emptyLabel?: string;
  onOpenProfile?: (profileId: string) => void;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hasPlaybackStartedRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [groupIndex, setGroupIndex] = useState(0);
  const [itemIndex, setItemIndex] = useState(0);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [isVideoBuffering, setIsVideoBuffering] = useState(false);
  const [hasVideoError, setHasVideoError] = useState(false);
  const [progress, setProgress] = useState(0);

  const groups = useMemo(() => props.groups.filter((group) => group.items.length > 0), [props.groups]);
  const activeGroup = groups[groupIndex] ?? null;
  const activeItem = activeGroup?.items[itemIndex] ?? null;
  const activeContact = activeGroup?.profile.contact ?? null;
  const hasActiveContact = Boolean(activeContact?.phone || activeContact?.telegram);

  const openStory = (nextGroupIndex: number) => {
    setGroupIndex(nextGroupIndex);
    setItemIndex(0);
    setOpen(true);
  };

  const goNext = () => {
    if (!activeGroup) return;
    if (itemIndex < activeGroup.items.length - 1) {
      setItemIndex((current) => current + 1);
      return;
    }
    if (groupIndex < groups.length - 1) {
      setGroupIndex((current) => current + 1);
      setItemIndex(0);
      return;
    }
    setOpen(false);
  };

  const goPrevious = () => {
    if (!activeGroup) return;
    if (itemIndex > 0) {
      setItemIndex((current) => current - 1);
      return;
    }
    if (groupIndex > 0) {
      const previousGroupIndex = groupIndex - 1;
      const previousGroup = groups[previousGroupIndex];
      setGroupIndex(previousGroupIndex);
      setItemIndex(Math.max(0, (previousGroup?.items.length ?? 1) - 1));
    }
  };

  useEffect(() => {
    hasPlaybackStartedRef.current = false;
    setIsVideoReady(false);
    setIsVideoBuffering(false);
    setHasVideoError(false);
    setProgress(0);
    if (activeItem?.isLocked || !activeItem?.mediaUrl) {
      setIsVideoReady(true);
    }
  }, [open, activeItem?.id]);

  useEffect(() => {
    if (!open || !activeItem?.isLocked) return;
    let frame = 0;
    const durationMs = 3000;
    const start = performance.now();
    const step = (now: number) => {
      const ratio = Math.max(0, Math.min(1, (now - start) / durationMs));
      setProgress(ratio);
      if (ratio >= 1) {
        goNext();
        return;
      }
      frame = window.requestAnimationFrame(step);
    };
    frame = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(frame);
  }, [open, activeItem?.id, activeItem?.isLocked]);

  useEffect(() => {
    if (!open || !activeItem || activeItem.isLocked || !activeItem.mediaUrl) return;
    const node = videoRef.current;
    if (!node) return;
    const playPromise = node.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {
        // Autoplay may be delayed until the browser is ready; keep the viewer open.
      });
    }
  }, [open, activeItem?.id, activeItem?.isLocked, activeItem?.mediaUrl]);

  const handleContact = async () => {
    if (!activeGroup) return;

    const message = buildContactMessage({ pseudo: activeGroup.profile.pseudo });
    const preferred = activeContact?.preference;

    if (preferred === "telegram" && activeContact?.telegram) {
      return openTelegram({ usernameOrLink: activeContact.telegram, message });
    }
    if (preferred === "whatsapp" && activeContact?.phone) {
      return openWhatsApp({ phone: activeContact.phone, message });
    }
    if (activeContact?.phone) {
      return openWhatsApp({ phone: activeContact.phone, message });
    }
    if (activeContact?.telegram) {
      return openTelegram({ usernameOrLink: activeContact.telegram, message });
    }

    toast({
      title: "Aucun contact disponible",
      description: "Ce profil n'a pas activé ses coordonnées.",
    });
  };

  if (!groups.length) {
    return props.emptyLabel ? <div className="text-sm text-muted-foreground">{props.emptyLabel}</div> : null;
  }

  return (
    <>
      <div className="flex w-full gap-3 overflow-x-auto pb-2 no-scrollbar">
        {groups.map((group, index) => {
          const hasLockedItem = group.items.some((item) => item.isLocked);
          const storyCount = group.items.length;
          return (
            <button
              key={group.profile.id}
              type="button"
              onClick={() => openStory(index)}
              className="flex min-w-[94px] flex-col items-center gap-2 text-center"
            >
              <div
                className="relative rounded-full p-[4px]"
                style={{
                  backgroundImage: buildStoryRingBackground(storyCount),
                }}
              >
                <div className="rounded-full bg-background p-[3px]">
                  <img
                    src={getProfilePhoto(group.profile.photoUrl, group.profile.accountType as any)}
                    alt={group.profile.pseudo}
                    loading="lazy"
                    decoding="async"
                    className="h-[72px] w-[72px] rounded-full object-cover"
                  />
                </div>
                {hasLockedItem ? (
                  <div className="absolute -bottom-1 left-1/2 flex h-5 w-5 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-background text-foreground">
                    <Lock className="h-3 w-3" />
                  </div>
                ) : null}
              </div>
              <div className="max-w-[94px] text-[11px] font-medium leading-4 text-foreground line-clamp-2">
                {group.profile.pseudo}
              </div>
            </button>
          );
        })}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="left-0 top-0 h-[100dvh] w-screen max-w-none translate-x-0 translate-y-0 overflow-hidden rounded-none border-0 bg-black p-0 text-white [&>button]:hidden sm:rounded-none"
          onPointerDownOutside={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
        >
          <DialogTitle className="sr-only">
            {activeGroup ? `Story de ${activeGroup.profile.pseudo}` : "Story"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {activeItem?.isLocked
              ? "Visionneuse de story privee avec actions de navigation et contact."
              : "Visionneuse de story video avec actions de navigation et contact."}
          </DialogDescription>
          {activeGroup && activeItem ? (
            <div className="flex h-full w-full flex-col bg-black px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-[calc(env(safe-area-inset-top)+0.75rem)] text-white sm:px-4">
              <div className="mx-auto w-full max-w-[52rem]">
                <div className="flex gap-1 pb-3">
                  {activeGroup.items.map((story, index) => (
                    <div key={story.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/20">
                      <div
                        className="h-full rounded-full bg-white transition-[width] duration-150 ease-linear"
                        style={{
                          width:
                            index < itemIndex
                              ? "100%"
                              : index === itemIndex
                                ? `${Math.max(0, Math.min(100, progress * 100))}%`
                                : "0%",
                        }}
                      />
                    </div>
                  ))}
                </div>

                <div className="flex items-start justify-between gap-3 pb-3">
                  <button
                    type="button"
                    className="flex min-w-0 items-center gap-3 text-left"
                    onClick={() => props.onOpenProfile?.(activeGroup.profile.id)}
                  >
                    <img
                      src={getProfilePhoto(activeGroup.profile.photoUrl, activeGroup.profile.accountType as any)}
                      alt={activeGroup.profile.pseudo}
                      className="h-10 w-10 rounded-full border border-white/20 object-cover"
                    />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-white">{activeGroup.profile.pseudo}</div>
                      <div className="truncate text-[11px] text-white/72">{activeGroup.profile.ville ?? "NIXYAH"}</div>
                    </div>
                  </button>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 rounded-full text-white hover:bg-white/10"
                    onClick={() => setOpen(false)}
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              <div className="flex min-h-0 flex-1 items-center justify-center">
                <div className="grid w-full max-w-[52rem] min-h-0 grid-cols-[2.75rem_minmax(0,1fr)_2.75rem] items-center gap-2 sm:gap-3">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 rounded-full text-white hover:bg-white/10"
                    onClick={goPrevious}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </Button>

                  <div className="flex h-full max-h-[calc(100dvh-15rem)] min-h-0 w-full items-center justify-center overflow-hidden rounded-[28px] bg-black">
                    {activeItem.isLocked ? (
                      <div className="flex w-full max-w-sm flex-col items-center justify-center px-6 text-center">
                        <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/20 text-white">
                          <Lock className="h-5 w-5" />
                        </div>
                        <div className="mt-4 text-base font-semibold text-white">Vidéo privée</div>
                        <div className="mt-2 text-sm text-white/70">
                          Ouvre le profil ou contacte la personne pour accéder à cette vidéo.
                        </div>
                      </div>
                    ) : activeItem.mediaUrl ? (
                      <video
                        ref={videoRef}
                        key={activeItem.id}
                        src={activeItem.mediaUrl}
                        className="h-full w-full bg-black object-contain"
                        autoPlay
                        muted
                        playsInline
                        preload="auto"
                        disablePictureInPicture
                        controls={false}
                        onLoadedMetadata={(event) => {
                          const duration = event.currentTarget.duration;
                          if (Number.isFinite(duration) && duration > 0) {
                            setProgress(event.currentTarget.currentTime / duration);
                          }
                        }}
                        onCanPlay={() => {
                          setIsVideoReady(true);
                          setIsVideoBuffering(false);
                        }}
                        onPlaying={() => {
                          hasPlaybackStartedRef.current = true;
                          setIsVideoReady(true);
                          setIsVideoBuffering(false);
                        }}
                        onWaiting={() => {
                          if (isVideoReady) setIsVideoBuffering(true);
                        }}
                        onTimeUpdate={(event) => {
                          const duration = event.currentTarget.duration;
                          if (!Number.isFinite(duration) || duration <= 0) return;
                          setProgress(event.currentTarget.currentTime / duration);
                        }}
                        onError={() => {
                          setHasVideoError(true);
                          setIsVideoBuffering(false);
                        }}
                        onEnded={(event) => {
                          const elapsed = event.currentTarget.currentTime;
                          if (!hasPlaybackStartedRef.current && elapsed < 0.25) {
                            return;
                          }
                          setProgress(1);
                          goNext();
                        }}
                      />
                    ) : (
                      <div className="text-center text-white/70">
                        <Play className="mx-auto h-8 w-8" />
                        <div className="mt-3 text-sm">Story indisponible</div>
                      </div>
                    )}
                  </div>

                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-11 w-11 rounded-full text-white hover:bg-white/10"
                    onClick={goNext}
                  >
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>
              </div>

              <div className="mx-auto w-full max-w-[52rem] pt-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    {activeItem.caption ? <div className="text-sm leading-6 text-white/90">{activeItem.caption}</div> : null}
                    <div className="mt-2 text-[11px] uppercase tracking-[0.22em] text-white/55">
                      {activeItem.isLocked
                        ? "video privee"
                        : `${Math.round(Math.max(0, (videoRef.current?.currentTime ?? 0) || 0))}/${Math.max(
                            1,
                            Math.round((videoRef.current?.duration || activeItem.durationSeconds || 1)),
                          )}s`}
                    </div>
                    {!activeItem.isLocked && !hasVideoError && !isVideoReady ? (
                      <div className="mt-2 inline-flex items-center gap-2 text-[11px] text-white/60">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Chargement de la story…
                      </div>
                    ) : null}
                    {!activeItem.isLocked && isVideoReady && isVideoBuffering && !hasVideoError ? (
                      <div className="mt-2 inline-flex items-center gap-2 text-[11px] text-white/60">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Synchronisation…
                      </div>
                    ) : null}
                    {hasVideoError ? (
                      <div className="mt-2 inline-flex items-center gap-2 text-[11px] text-white/60">
                        <Play className="h-3.5 w-3.5" />
                        Impossible d'afficher cette story vidéo.
                      </div>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    {props.onOpenProfile ? (
                      <Button
                        variant="secondary"
                        className="h-9 rounded-full border border-white/15 bg-transparent px-3 text-white hover:bg-white/10"
                        onClick={() => props.onOpenProfile?.(activeGroup.profile.id)}
                      >
                        Voir le profil
                      </Button>
                    ) : null}
                    {hasActiveContact ? (
                      <Button
                        variant="secondary"
                        className="h-9 rounded-full border border-white/15 bg-white px-3 text-black hover:bg-white/90"
                        onClick={handleContact}
                      >
                        <MessageCircle className="h-4 w-4" />
                        Contacter
                      </Button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}
