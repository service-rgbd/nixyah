import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Play, X } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import avatarUrl from "@assets/avatar.png";

export type StoryReelItem = {
  id: string;
  mediaUrl: string | null;
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
  };
  items: StoryReelItem[];
  latestCreatedAt?: string;
};

export function StoryReel(props: {
  groups: StoryReelGroup[];
  emptyLabel?: string;
  onOpenProfile?: (profileId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [groupIndex, setGroupIndex] = useState(0);
  const [itemIndex, setItemIndex] = useState(0);

  const groups = useMemo(() => props.groups.filter((group) => group.items.length > 0), [props.groups]);
  const activeGroup = groups[groupIndex] ?? null;
  const activeItem = activeGroup?.items[itemIndex] ?? null;

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
    if (!open || !activeItem) return;
    const timer = window.setTimeout(goNext, Math.max(1, activeItem.durationSeconds) * 1000);
    return () => window.clearTimeout(timer);
  }, [open, groupIndex, itemIndex, activeItem?.id]);

  if (!groups.length) {
    return props.emptyLabel ? <div className="text-sm text-muted-foreground">{props.emptyLabel}</div> : null;
  }

  return (
    <>
      <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
        {groups.map((group, index) => (
          <button
            key={group.profile.id}
            type="button"
            onClick={() => openStory(index)}
            className="flex min-w-[76px] flex-col items-center gap-2 text-center"
          >
            <div className="rounded-full bg-[conic-gradient(from_180deg_at_50%_50%,rgba(244,63,94,0.95),rgba(251,191,36,0.95),rgba(244,63,94,0.95))] p-[2px] shadow-[0_16px_40px_-28px_rgba(0,0,0,0.7)]">
              <div className="rounded-full bg-background p-[2px]">
                <img
                  src={group.profile.photoUrl || avatarUrl}
                  alt={group.profile.pseudo}
                  className="h-16 w-16 rounded-full object-cover"
                />
              </div>
            </div>
            <div className="max-w-[76px] text-[11px] font-medium leading-4 text-foreground line-clamp-2">
              {group.profile.pseudo}
            </div>
          </button>
        ))}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md border-0 bg-black p-0 text-white sm:rounded-[28px] overflow-hidden">
          {activeGroup && activeItem ? (
            <div className="relative min-h-[70vh] bg-black">
              <div className="absolute left-0 right-0 top-0 z-20 flex gap-1 px-4 pt-4">
                {activeGroup.items.map((story, index) => (
                  <div key={story.id} className="h-1 flex-1 overflow-hidden rounded-full bg-white/20">
                    <div
                      className={`h-full rounded-full ${index < itemIndex ? "w-full bg-white" : index === itemIndex ? "w-2/3 bg-white" : "w-0 bg-white"}`}
                    />
                  </div>
                ))}
              </div>

              <div className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-4 pt-8">
                <button
                  type="button"
                  className="flex items-center gap-3 text-left"
                  onClick={() => props.onOpenProfile?.(activeGroup.profile.id)}
                >
                  <img
                    src={activeGroup.profile.photoUrl || avatarUrl}
                    alt={activeGroup.profile.pseudo}
                    className="h-10 w-10 rounded-full object-cover border border-white/20"
                  />
                  <div>
                    <div className="text-sm font-semibold">{activeGroup.profile.pseudo}</div>
                    <div className="text-[11px] text-white/70">{activeGroup.profile.ville ?? "NIXYAH"}</div>
                  </div>
                </button>
                <Button variant="ghost" size="icon" className="text-white hover:bg-white/10" onClick={() => setOpen(false)}>
                  <X className="h-5 w-5" />
                </Button>
              </div>

              <button type="button" className="absolute inset-y-0 left-0 z-10 w-1/4" onClick={goPrevious} aria-label="Story précédente" />
              <button type="button" className="absolute inset-y-0 right-0 z-10 w-1/4" onClick={goNext} aria-label="Story suivante" />

              <div className="flex min-h-[70vh] items-center justify-center px-3 pb-20 pt-24">
                {activeItem.mediaUrl ? (
                  <video
                    key={activeItem.id}
                    src={activeItem.mediaUrl}
                    className="max-h-[62vh] w-full rounded-[24px] border border-white/10 bg-black object-cover"
                    autoPlay
                    muted
                    playsInline
                    onEnded={goNext}
                  />
                ) : (
                  <div className="flex h-[62vh] w-full items-center justify-center rounded-[24px] border border-white/10 bg-white/5">
                    <div className="text-center text-white/70">
                      <Play className="mx-auto h-8 w-8" />
                      <div className="mt-3 text-sm">Story indisponible</div>
                    </div>
                  </div>
                )}
              </div>

              <div className="absolute bottom-0 left-0 right-0 z-20 bg-gradient-to-t from-black via-black/80 to-transparent px-4 pb-5 pt-12">
                <div className="flex items-end justify-between gap-3">
                  <div className="min-w-0">
                    {activeItem.caption ? <div className="text-sm leading-6 text-white/90">{activeItem.caption}</div> : null}
                    <div className="mt-2 text-[11px] uppercase tracking-[0.22em] text-white/55">
                      {Math.max(1, activeItem.durationSeconds)}s story
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="secondary" size="icon" className="h-10 w-10 rounded-full bg-white/12 text-white hover:bg-white/20" onClick={goPrevious}>
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <Button variant="secondary" size="icon" className="h-10 w-10 rounded-full bg-white/12 text-white hover:bg-white/20" onClick={goNext}>
                      <ChevronRight className="h-5 w-5" />
                    </Button>
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
