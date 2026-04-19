import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AdultProduct } from "@shared/schema";
import { adultProducts as staticAdultProducts } from "@/lib/maleProducts";
import { apiFetch } from "@/lib/queryClient";
import { SeoHead, buildBreadcrumbJsonLd } from "@/components/seo-head";

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
        const res = await apiFetch("/api/adult-products");
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

  const productsStructuredData = [
    buildBreadcrumbJsonLd([
      { name: "Accueil", path: "/start" },
      { name: "Boutique adulte", path: "/adult-products" },
    ]),
    {
      "@context": "https://schema.org",
      "@type": "CollectionPage",
      name: "Boutique adulte NIXYAH",
      description:
        "Sélection de produits intimes, accessoires adultes et articles de bien-être proposés sur NIXYAH.",
      url: typeof window !== "undefined" ? `${window.location.origin}/adult-products` : "https://www.nixyah.com/adult-products",
      hasPart: (products ?? []).slice(0, 12).map((product) => ({
        "@type": "Product",
        name: product.name,
        image: product.imageUrl || undefined,
        description: product.description || product.subtitle || undefined,
        url:
          typeof window !== "undefined"
            ? `${window.location.origin}/adult-products/${product.id}`
            : `https://www.nixyah.com/adult-products/${product.id}`,
      })),
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <SeoHead
        title="Boutique intime et produits adultes"
        description="Achète des produits intimes, accessoires adultes, lubrifiants et articles bien-être sélectionnés sur NIXYAH."
        canonicalPath="/adult-products"
        keywords={[
          "boutique adulte premium",
          "produits intimes",
          "accessoires adultes",
          "bien-être intime francophone",
        ]}
        structuredData={productsStructuredData}
      />
      <header className="sticky top-0 z-20 border-b border-border/70 bg-background/88 px-4 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] backdrop-blur">
        <button
          onClick={() => setLocation("/start")}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/40"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div className="text-base font-semibold tracking-tight text-foreground">Boutique adulte</div>
        <div className="w-10" />
      </header>

      <main className="px-4 pb-8 pt-4">
        <div className="mx-auto max-w-[980px] space-y-5">
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="text-sm font-semibold text-foreground">Adult products</span>
            <span className="rounded-full bg-muted/40 px-2.5 py-1">
              {(products?.length ?? 0) || (loading ? "..." : 0)} produit{(products?.length ?? 0) > 1 ? "s" : ""}
            </span>
          </div>

          {loading && (
            <div className="rounded-2xl bg-muted/40 p-4 text-sm text-muted-foreground">
              Chargement des produits adultes…
            </div>
          )}
          {error && !loading && (
            <div className="rounded-2xl bg-destructive/10 p-4 text-sm text-destructive">
              {error}
            </div>
          )}
          {!loading && !error && (products?.length ?? 0) === 0 && (
            <div className="rounded-2xl bg-muted/40 p-4 text-sm text-muted-foreground">
              Aucun produit adulte disponible pour le moment.
            </div>
          )}

          <div className="space-y-1">
            {(products ?? []).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setLocation(`/adult-products/${p.id}`)}
                className="w-full border-b border-border/70 py-4 text-left transition-colors last:border-b-0 hover:bg-muted/10"
              >
                <div className="flex items-center gap-3">
                  <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-[20px] bg-muted/30">
                    {p.imageUrl ? (
                      <img
                        src={p.imageUrl}
                        alt={p.name}
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    ) : null}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-base font-semibold tracking-tight text-foreground line-clamp-2">
                          {p.name}
                        </div>
                        {p.subtitle ? (
                          <div className="mt-1 text-xs text-muted-foreground line-clamp-1">{p.subtitle}</div>
                        ) : null}
                      </div>
                      <div className="shrink-0 rounded-full bg-foreground px-2.5 py-1 text-[10px] font-medium text-background">
                        {p.price}
                      </div>
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full bg-muted/40 px-2 py-0.5 text-[10px] text-muted-foreground">
                        {p.tag || "Boutique"}
                      </span>
                      {p.size ? (
                        <span className="rounded-full bg-muted/40 px-2 py-0.5 text-[10px] text-foreground/85">
                          {p.size}
                        </span>
                      ) : null}
                    </div>

                    {p.description ? (
                      <p className="mt-2 text-[12px] leading-5 text-muted-foreground line-clamp-2">
                        {p.description}
                      </p>
                    ) : null}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}