import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AdultProduct } from "@shared/schema";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { getProfileId } from "@/lib/session";
import { adultProducts as staticAdultProducts, type MaleProduct } from "@/lib/maleProducts";

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
        const res = await fetch(`/api/adult-products/${params.id}`);
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
      const res = await fetch("/api/adult-orders", {
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
      <div className="relative h-[55vh] overflow-hidden">
        <img
          src={product.imageUrl}
          alt={product.name}
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
          <div className="text-xs text-white/70 uppercase tracking-wide">Produit adulte</div>
          <h1 className="text-2xl font-semibold text-white">{product.name}</h1>
          {product.subtitle && <p className="text-sm text-white/80">{product.subtitle}</p>}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 text-xs text-white">
            <span className="font-semibold">{product.price}</span>
            {product.size && <span className="text-white/70">• {product.size}</span>}
          </div>
        </div>
      </div>

      <main className="px-4 pb-8 -mt-6 relative z-10">
        <div className="max-w-md mx-auto rounded-3xl bg-card/95 border border-border shadow-lg p-4 space-y-4">
          {product.description && (
            <p className="text-sm text-muted-foreground leading-relaxed">{product.description}</p>
          )}

          <div className="space-y-2 pt-2 border-t border-border/60">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              Coordonnées de livraison
            </div>
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
                </button>
              </div>
            </div>
          </div>

          <Button className="w-full h-11 gap-2" disabled={submitting} onClick={submitOrder}>
            <ShoppingCart className="w-4 h-4" />
            {submitting ? "Envoi en cours..." : "Valider la commande"}
          </Button>
        </div>
      </main>
    </div>
  );
}


