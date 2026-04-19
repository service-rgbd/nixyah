import { useEffect, useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AdultProduct } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { getProfileId } from "@/lib/session";
import { adultProducts as staticAdultProducts } from "@/lib/maleProducts";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch } from "@/lib/queryClient";
import { SeoHead, buildBreadcrumbJsonLd } from "@/components/seo-head";

type PaymentMethod = "delivery" | "direct";

type ApiAdultProduct = AdultProduct;

type DetailProduct = {
  id: string;
  name: string;
  subtitle?: string | null;
  price: string;
  size?: string | null;
  description?: string | null;
  imageUrl: string;
  ownerProfileId?: string | null;
  stockQty?: number | null;
  placeType?: string | null;
};

export default function AdultProductDetailPage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [product, setProduct] = useState<DetailProduct | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [deliveryTime, setDeliveryTime] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("delivery");
  const [submitting, setSubmitting] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const [note, setNote] = useState("");
  const [otherProducts, setOtherProducts] = useState<DetailProduct[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        // 1) Try static products first (anciens produits définis dans l'app)
        const staticP = staticAdultProducts.find((p) => p.id === params.id);
        if (staticP) {
          if (!cancelled) {
            setProduct({
              id: staticP.id,
              name: staticP.name,
              subtitle: staticP.subtitle,
              price: staticP.price,
              size: staticP.size,
              description: staticP.description,
              imageUrl: staticP.imageUrl,
            });
          }
          return;
        }

        // 2) Sinon, chercher dans la base SQL
        const res = await apiFetch(`/api/adult-products/${params.id}`);
        if (!res.ok) throw new Error("Produit introuvable");
        const data = (await res.json()) as ApiAdultProduct;
        if (!cancelled) {
          setProduct({
            id: data.id,
            name: data.name,
            subtitle: data.subtitle,
            price: data.price,
            size: data.size,
            description: data.description,
            imageUrl: data.imageUrl ?? "",
            ownerProfileId: (data as any).ownerProfileId ?? null,
            stockQty: (data as any).stockQty ?? null,
            placeType: (data as any).placeType ?? null,
          });
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Erreur de chargement");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!product?.ownerProfileId) return;
      try {
        const res = await apiFetch(
          `/api/adult-products?ownerProfileId=${encodeURIComponent(product.ownerProfileId)}&limit=8`,
        );
        if (!res.ok) return;
        const rows = (await res.json()) as ApiAdultProduct[];
        const mapped = rows
          .filter((p) => p.id !== product.id)
          .slice(0, 6)
          .map((p) => ({
            id: p.id,
            name: p.name,
            subtitle: p.subtitle,
            price: p.price,
            size: p.size,
            description: p.description,
            imageUrl: p.imageUrl ?? "",
            ownerProfileId: (p as any).ownerProfileId ?? null,
            stockQty: (p as any).stockQty ?? null,
            placeType: (p as any).placeType ?? null,
          }));
        if (!cancelled) setOtherProducts(mapped);
      } catch {
        // ignore
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [product?.ownerProfileId, product?.id]);

  const productStructuredData = useMemo(() => {
    if (!product) return null;
    const origin = typeof window !== "undefined" ? window.location.origin : "https://www.nixyah.com";
    const numericPrice = Number(String(product.price).replace(/[^\d.,]/g, "").replace(",", "."));
    return [
      buildBreadcrumbJsonLd(
        [
          { name: "Accueil", path: "/start" },
          { name: "Boutique adulte", path: "/adult-products" },
          { name: product.name, path: `/adult-products/${product.id}` },
        ],
        origin,
      ),
      {
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.name,
        description: product.description || product.subtitle || undefined,
        image: product.imageUrl || undefined,
        sku: product.id,
        brand: {
          "@type": "Brand",
          name: "NIXYAH",
        },
        offers: {
          "@type": "Offer",
          priceCurrency: "XOF",
          price: Number.isFinite(numericPrice) ? numericPrice : undefined,
          availability:
            typeof product.stockQty === "number" && product.stockQty <= 0
              ? "https://schema.org/OutOfStock"
              : "https://schema.org/InStock",
          url: `${origin}/adult-products/${product.id}`,
        },
      },
    ];
  }, [product]);

  async function submitOrder() {
    if (!product) return;
    if (!phone || !address || !deliveryTime) {
      toast({
        title: "Informations incomplètes",
        description: "Merci de remplir téléphone, adresse et heure de livraison.",
      });
      return;
    }

    if (paymentMethod === "direct" && !getProfileId()) {
      toast({
        title: "Inscription requise",
        description: "Crée un compte pour payer directement. Tu peux aussi choisir paiement à la livraison.",
      });
      setLocation("/signup");
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiFetch("/api/adult-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId: product.id,
          productName: product.name,
          price: product.price,
          size: product.size,
          phone,
          address,
          deliveryTime,
          paymentMethod,
          note: note.trim() ? note.trim() : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || "Erreur serveur");
      }
      toast({
        title: "Commande prise en compte",
        description: "Nous avons bien reçu ta demande. Un vendeur va préparer ta commande.",
      });
      setOrderOpen(false);
    } catch (err: any) {
      toast({
        title: "Impossible d’envoyer la commande",
        description: err?.message ?? "Réessaie dans quelques instants.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Chargement du produit…</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="space-y-3 text-center">
          <p className="text-foreground font-semibold">Produit introuvable</p>
          <Button onClick={() => setLocation("/adult-products")}>Retour à la boutique</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SeoHead
        title={product ? `${product.name} - boutique intime premium` : "Produit intime premium"}
        description={
          product?.description ||
          product?.subtitle ||
          "Découvre les détails d’un produit intime premium, ses caractéristiques, son prix et ses options de commande."
        }
        canonicalPath={product ? `/adult-products/${product.id}` : "/adult-products"}
        image={product?.imageUrl || undefined}
        keywords={[
          product?.name || "produit intime premium",
          "détail produit adulte",
          "achat accessoire intime",
          "boutique adulte premium",
        ]}
        type="product"
        structuredData={productStructuredData}
      />
      <div className="relative h-[50vh] overflow-hidden">
        <img
          src={product.imageUrl}
          alt={product.name}
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent" />
        <button
          onClick={() => setLocation("/adult-products")}
          className="absolute top-4 left-4 w-10 h-10 rounded-full bg-black/50 border border-white/10 flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-white" />
        </button>
        <div className="absolute bottom-6 left-6 right-6 space-y-2">
          <div className="text-[11px] uppercase tracking-[0.18em] text-white/70">Produit adulte</div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">{product.name}</h1>
          {product.subtitle && <p className="text-sm text-white/80">{product.subtitle}</p>}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 text-xs text-white">
            <span className="font-semibold">{product.price}</span>
            {product.size && <span className="text-white/70">• {product.size}</span>}
          </div>
        </div>
      </div>

      <main className="relative z-10 -mt-6 px-4 pb-8">
        <div className="mx-auto max-w-[980px] space-y-5">
          <div className="space-y-4 border-b border-border/70 pb-5">
          {product.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">{product.description}</p>
          )}

          <div className="flex flex-wrap gap-2">
            <div className="rounded-full bg-muted/35 px-3 py-2 text-sm text-foreground">
              <span className="text-muted-foreground">Stock</span>{" "}
              <span className="font-semibold text-foreground">
                {typeof product.stockQty === "number" ? product.stockQty : "—"}
              </span>
            </div>
            <div className="rounded-full bg-muted/35 px-3 py-2 text-sm text-foreground">
              <span className="text-muted-foreground">Type de lieu</span>{" "}
              <span className="font-semibold text-foreground">
                {product.placeType ?? "—"}
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button className="h-11 flex-1 gap-2" onClick={() => setOrderOpen(true)}>
              <ShoppingCart className="w-4 h-4" />
              Commander
            </Button>

            {product.ownerProfileId && (
              <Button
                variant="outline"
                className="h-11 flex-1"
                onClick={() => setLocation(`/profile/${product.ownerProfileId}`)}
              >
                Voir la boutique
              </Button>
            )}
          </div>
          </div>

        {otherProducts.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-semibold tracking-tight text-foreground">Autres produits</div>
            <div className="space-y-1">
              {otherProducts.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setLocation(`/adult-products/${p.id}`)}
                  className="w-full border-b border-border/70 py-3 text-left transition-colors last:border-b-0 hover:bg-muted/10"
                >
                  <div className="flex gap-3">
                    <img
                      src={p.imageUrl}
                      alt={p.name}
                      loading="lazy"
                      decoding="async"
                      className="h-20 w-20 shrink-0 rounded-[18px] object-cover"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-sm font-semibold tracking-tight text-foreground line-clamp-2">{p.name}</div>
                          {p.size ? <div className="mt-1 text-[11px] text-muted-foreground">{p.size}</div> : null}
                        </div>
                        <span className="shrink-0 rounded-full bg-foreground px-2.5 py-1 text-[10px] font-medium text-background">{p.price}</span>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
        </div>
      </main>

      <Dialog open={orderOpen} onOpenChange={setOrderOpen}>
        <DialogContent className="rounded-3xl">
          <DialogHeader>
            <DialogTitle>Commander</DialogTitle>
            <DialogDescription>
              {product.name} • {product.price}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="adult-phone-detail" className="text-xs">
                Numéro de téléphone
              </Label>
              <Input
                id="adult-phone-detail"
                inputMode="tel"
                placeholder="+237 …"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adult-address-detail" className="text-xs">
                Adresse de livraison
              </Label>
              <Input
                id="adult-address-detail"
                placeholder="Quartier, repère…"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adult-time-detail" className="text-xs">
                Heure souhaitée
              </Label>
              <Input
                id="adult-time-detail"
                placeholder="Ex: ce soir 20h, demain matin, etc."
                value={deliveryTime}
                onChange={(e) => setDeliveryTime(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Note (optionnel)</Label>
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} className="rounded-2xl" />
            </div>
            <div className="space-y-1.5 pt-1">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                Mode de paiement
              </div>
              <div className="flex flex-col gap-1.5 text-xs">
                <button
                  type="button"
                  className={`flex items-center justify-between rounded-full border px-3 py-2 ${
                    paymentMethod === "delivery"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground"
                  }`}
                  onClick={() => setPaymentMethod("delivery")}
                >
                  <span>Payer à la livraison</span>
                  {paymentMethod === "delivery" && <span className="text-primary">✓</span>}
                </button>
                <button
                  type="button"
                  className={`flex items-center justify-between rounded-full border px-3 py-2 ${
                    paymentMethod === "direct"
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground"
                  }`}
                  onClick={() => setPaymentMethod("direct")}
                >
                  <span>Payer directement (compte requis)</span>
                  {paymentMethod === "direct" && <span className="text-primary">✓</span>}
                </button>
              </div>
            </div>

            <Button className="w-full h-11 gap-2" disabled={submitting} onClick={submitOrder}>
              <ShoppingCart className="w-4 h-4" />
              {submitting ? "Envoi en cours..." : "Confirmer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}


