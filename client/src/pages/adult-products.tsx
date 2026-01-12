import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AdultProduct } from "@shared/schema";
import { adultProducts as staticAdultProducts } from "@/lib/maleProducts";

type ApiAdultProduct = AdultProduct;

type ListProduct = {
  id: string;
  name: string;
  subtitle?: string | null;
  price: string;
  size?: string | null;
  description?: string | null;
  imageUrl: string;
  tag?: string | null;
};

export default function AdultProductsPage() {
  const [, setLocation] = useLocation();
  const [products, setProducts] = useState<ListProduct[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/adult-products");
        const apiProducts = res.ok ? ((await res.json()) as ApiAdultProduct[]) : [];

        const staticList: ListProduct[] = staticAdultProducts.map((p) => ({
          id: p.id,
          name: p.name,
          subtitle: p.subtitle,
          price: p.price,
          size: p.size,
          description: p.description,
          imageUrl: p.imageUrl,
          tag: p.tag,
        }));

        const sqlList: ListProduct[] = apiProducts.map((p) => ({
          id: p.id,
          name: p.name,
          subtitle: p.subtitle,
          price: p.price,
          size: p.size,
          description: p.description,
          imageUrl: p.imageUrl ?? "",
          tag: p.tag,
        }));

        const combined = [...staticList, ...sqlList];
        if (!cancelled) setProducts(combined);
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Erreur réseau");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between px-4 pt-[calc(env(safe-area-inset-top)+0.75rem)] pb-3">
        <button
          onClick={() => setLocation("/start")}
          className="w-10 h-10 rounded-full bg-card flex items-center justify-center border border-border"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div className="text-base font-semibold text-foreground">Boutique adultes</div>
        <div className="w-10" />
      </header>

      <main className="px-4 pb-8">
        <div className="max-w-md mx-auto space-y-4">
          {loading && (
            <div className="rounded-3xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
              Chargement des produits adultes…
            </div>
          )}
          {error && !loading && (
            <div className="rounded-3xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          )}
          {!loading && !error && (products?.length ?? 0) === 0 && (
            <div className="rounded-3xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
              Aucun produit adulte disponible pour le moment.
            </div>
          )}

          {(products ?? []).map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setLocation(`/adult-products/${p.id}`)}
              className="w-full text-left rounded-3xl border border-border bg-card/80 backdrop-blur overflow-hidden shadow-sm"
            >
              <div className="relative h-40">
                <img
                  src={p.imageUrl}
                  alt={p.name}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] text-white/90">
                  <span className="px-2 py-0.5 rounded-full bg-black/50 border border-white/10">
                    Boutique
                  </span>
                  <span className="font-semibold bg-primary/90 text-xs px-2 py-1 rounded-full">
                    {p.price}
                  </span>
                </div>
              </div>
              <div className="p-3 space-y-1">
                <div className="text-sm font-semibold text-foreground line-clamp-2">{p.name}</div>
                {p.size && <div className="text-[11px] text-muted-foreground">{p.size}</div>}
                {p.description && (
                  <p className="text-[11px] text-muted-foreground line-clamp-3">{p.description}</p>
                )}
              </div>
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}