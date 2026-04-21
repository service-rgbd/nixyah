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
  currentIndex?: number;
  onIndexChange?: (index: number) => void;
}) {
  const images = useMemo(() => uniq(props.urls), [props.urls]);
  const [api, setApi] = useState<CarouselApi | null>(null);
  const [index, setIndex] = useState(0);
  const canNavigate = images.length > 1;

  useEffect(() => {
    if (!api) return;
    const onSelect = () => {
      const nextIndex = api.selectedScrollSnap();
      setIndex(nextIndex);
      props.onIndexChange?.(nextIndex);
    };
    onSelect();
    api.on("select", onSelect);
    api.on("reInit", onSelect);
    return () => {
      api.off("select", onSelect);
      api.off("reInit", onSelect);
    };
  }, [api]);

  useEffect(() => {
    if (!api || typeof props.currentIndex !== "number" || !images.length) return;
    const safeIndex = (props.currentIndex + images.length) % images.length;
    if (safeIndex !== api.selectedScrollSnap()) {
      api.scrollTo(safeIndex);
    }
    if (safeIndex !== index) {
      setIndex(safeIndex);
    }
  }, [api, images.length, index, props.currentIndex]);

  const scrollToIndex = (nextIndex: number) => {
    if (!api || !images.length) return;
    const safeIndex = (nextIndex + images.length) % images.length;
    api.scrollTo(safeIndex);
  };

  const imgClass = props.imgClassName ?? "w-full h-full object-cover";

  if (images.length === 0) {
    return (
      <img
        src={props.fallbackUrl}
        alt={props.alt}
        loading="lazy"
        decoding="async"
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
        loading="lazy"
        decoding="async"
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
      <Carousel
        setApi={(a) => setApi(a)}
        opts={{ loop: images.length > 2, align: "start" }}
        className="h-full touch-pan-y"
      >
        <CarouselContent className="ml-0 h-full">
          {images.map((u, i) => (
            <CarouselItem key={`${u}-${i}`} className="pl-0 h-full">
              <img
                src={u}
                alt={props.alt}
                loading={i === 0 ? "eager" : "lazy"}
                decoding="async"
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

      {props.showArrows && canNavigate && (
        <>
          <button
            type="button"
            aria-label="Previous"
            onClick={() => scrollToIndex(index - 1)}
            className="absolute left-4 top-1/2 z-10 -translate-y-1/2 w-11 h-11 rounded-full flex items-center justify-center border border-white/10 backdrop-blur bg-black/35 hover:bg-black/45 text-white"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            type="button"
            aria-label="Next"
            onClick={() => scrollToIndex(index + 1)}
            className="absolute right-4 top-1/2 z-10 -translate-y-1/2 w-11 h-11 rounded-full flex items-center justify-center border border-white/10 backdrop-blur bg-black/35 hover:bg-black/45 text-white"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </>
      )}

      {props.showDots !== false && canNavigate && (
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


