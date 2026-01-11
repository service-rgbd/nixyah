import { useEffect, useMemo, useState } from "react";
import type { CarouselApi } from "@/components/ui/carousel";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Carousel, CarouselContent, CarouselItem } from "@/components/ui/carousel";

function uniq(urls: Array<string | null | undefined>) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const u of urls) {
    if (!u) continue;
    // R2 presigned URLs can differ per request; dedupe on stable part (path without query/hash).
    const stable = u.split("#")[0]?.split("?")[0] ?? u;
    if (seen.has(stable)) continue;
    seen.add(stable);
    out.push(u);
  }
  return out;
}

export function PhotoSwipe(props: {
  urls: Array<string | null | undefined>;
  alt: string;
  fallbackUrl: string;
  wrapperClassName?: string;
  imgClassName?: string;
  showDots?: boolean;
  showArrows?: boolean;
}) {
  const images = useMemo(() => uniq(props.urls), [props.urls]);
  const [api, setApi] = useState<CarouselApi | null>(null);
  const [index, setIndex] = useState(0);
  const [canPrev, setCanPrev] = useState(false);
  const [canNext, setCanNext] = useState(false);

  useEffect(() => {
    if (!api) return;
    const onSelect = () => {
      setIndex(api.selectedScrollSnap());
      setCanPrev(api.canScrollPrev());
      setCanNext(api.canScrollNext());
    };
    onSelect();
    api.on("select", onSelect);
    api.on("reInit", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api]);

  const imgClass = props.imgClassName ?? "w-full h-full object-cover";

  if (images.length === 0) {
    return (
      <img
        src={props.fallbackUrl}
        alt={props.alt}
        className={imgClass}
        draggable={false}
      />
    );
  }

  if (images.length === 1) {
    return (
      <img
        src={images[0] ?? props.fallbackUrl}
        alt={props.alt}
        className={imgClass}
        draggable={false}
        onError={(e) => {
          const img = e.currentTarget;
          img.onerror = null;
          img.src = props.fallbackUrl;
        }}
      />
    );
  }

  return (
    <div className={`relative w-full h-full ${props.wrapperClassName ?? ""}`}>
      <Carousel setApi={(a) => setApi(a)} opts={{ loop: true, align: "start" }} className="h-full">
        <CarouselContent className="ml-0 h-full">
          {images.map((u, i) => (
            <CarouselItem key={`${u}-${i}`} className="pl-0 h-full">
              <img
                src={u}
                alt={props.alt}
                className={imgClass}
                draggable={false}
                onError={(e) => {
                  const img = e.currentTarget;
                  img.onerror = null;
                  img.src = props.fallbackUrl;
                }}
              />
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>

      {props.showArrows && (
        <>
          <button
            type="button"
            aria-label="Previous"
            disabled={!canPrev}
            onClick={() => api?.scrollPrev()}
            className={`absolute left-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full flex items-center justify-center border border-white/10 backdrop-blur ${
              canPrev ? "bg-black/35 hover:bg-black/45 text-white" : "bg-black/20 text-white/40"
            }`}
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            aria-label="Next"
            disabled={!canNext}
            onClick={() => api?.scrollNext()}
            className={`absolute right-4 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full flex items-center justify-center border border-white/10 backdrop-blur ${
              canNext ? "bg-black/35 hover:bg-black/45 text-white" : "bg-black/20 text-white/40"
            }`}
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}

      {props.showDots !== false && (
        <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-1.5 pointer-events-none">
          {images.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === index ? "w-6 bg-white/80" : "w-1.5 bg-white/35"
              }`}
            />
          ))}
        </div>
      )}
    </div>
  );
}


