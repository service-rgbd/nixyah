import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Calendar, MapPin, Tag, Wand2, Plus, Minus, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, apiRequest, queryClient, refreshProfileSurfaceData } from "@/lib/queryClient";
import { getProfileId } from "@/lib/session";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { annonceServiceOptions } from "@/lib/serviceOptions";
import { useQuery } from "@tanstack/react-query";
import { Separator } from "@/components/ui/separator";
import {
  attitudeOptions,
  corpulenceOptions,
  poitrineOptions,
  positionOptions,
  selfDescriptionOptions,
  teintePeauOptions,
  traitOptions,
} from "@/lib/profileAttributes";

export default function AnnonceNew() {
  const [, setLocation] = useLocation();
  const profileId = getProfileId();
  const [prefilled, setPrefilled] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const createNewAnnonce = useMemo(() => {
    if (typeof window === "undefined") return true;
    return new URLSearchParams(window.location.search).get("mode") !== "edit";
  }, []);

  const { data: profileDetail, isLoading } = useQuery<any>({
    queryKey: profileId ? [`/api/profiles/${profileId}`] : ["__no_profile__"],
    enabled: Boolean(profileId),
  });

  const { data: account } = useQuery<{ tokensBalance?: number; email?: string | null; emailVerified?: boolean }>({
    queryKey: ["/api/me/account"],
    enabled: Boolean(profileId),
    retry: false,
  });

  const { data: publishingConfig } = useQuery<any>({
    queryKey: ["/api/publishing/config"],
    retry: false,
  });

  const [title, setTitle] = useState("");
  const [currency, setCurrency] = useState<"XOF" | "EUR" | "USD" | "GBP" | "MAD">("XOF");
  const [price, setPrice] = useState<string>("");
  const [status, setStatus] = useState<"active" | "busy" | "active_soon">("active");
  const [activeInHours, setActiveInHours] = useState<number>(2);
  const [lieu, setLieu] = useState<string>("Hôtel");
  const [services, setServices] = useState<string[]>(["Massage"]);
  const [description, setDescription] = useState("");
  const [corpulence, setCorpulence] = useState<string>("");
  const [poids, setPoids] = useState<string>("");
  const [attitude, setAttitude] = useState<string>("");
  const [boireUnVerre, setBoireUnVerre] = useState<"" | "yes" | "no">("");
  const [fume, setFume] = useState<"" | "yes" | "no">("");
  const [teintePeau, setTeintePeau] = useState<string>("");
  const [poitrine, setPoitrine] = useState<string>("");
  const [traits, setTraits] = useState<string[]>([]);
  const [positions, setPositions] = useState<string[]>([]);
  const [selfDescriptions, setSelfDescriptions] = useState<string[]>([]);
  const [mainPhoto, setMainPhoto] = useState<File | null>(null);
  const [extraPhotos, setExtraPhotos] = useState<File[]>([]);
  const [video, setVideo] = useState<File | null>(null);
  const [mainPreview, setMainPreview] = useState<string | null>(null);
  const [extraPreviews, setExtraPreviews] = useState<string[]>([]);
  const [videoName, setVideoName] = useState<string | null>(null);
  const [heureDebut, setHeureDebut] = useState("18:00");
  const [duree, setDuree] = useState("2h");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [spaOffers, setSpaOffers] = useState<
    Array<{ name: string; price: string; masseuse: string }>
  >([]);

  // Promote selections (keep the keys exactly: promote['extended'], promote['featured'], etc.)
  const [extendedOptionId, setExtendedOptionId] = useState<string>("none");
  const [extendedPaymentMode] = useState<"tokens">("tokens");
  const [featuredOptionId, setFeaturedOptionId] = useState<string>("none");
  const [autorenewOptionId, setAutorenewOptionId] = useState<string>("none");
  const [urgentOptionId, setUrgentOptionId] = useState<string>("none");

  const accountType: "profile" | "residence" | "salon" | "adult_shop" =
    profileDetail?.accountType === "residence" ||
    profileDetail?.accountType === "salon" ||
    profileDetail?.accountType === "adult_shop"
      ? (profileDetail.accountType as any)
      : "profile";

  const isEstablishment =
    accountType === "residence" || accountType === "salon" || accountType === "adult_shop";

  const serviceOptions = useMemo(() => {
    if (accountType === "profile") return annonceServiceOptions;
    if (accountType === "residence") {
      return [
        "Chambre climatisée",
        "Résidence discrète",
        "Parking sécurisé",
        "Wi‑Fi",
        "Salle de bain privée",
        "Réservation à l’heure",
      ];
    }
    if (accountType === "salon") {
      return [
        "Massage relaxant",
        "Massage tantrique",
        "SPA / jacuzzi",
        "Sauna / hammam",
        "Espace très discret",
        "Formules couple",
      ];
    }
    // adult_shop
    return [
      "Préservatifs premium",
      "Lubrifiants",
      "Sextoys",
      "Coffrets couples",
      "Huiles de massage",
      "Accessoires BDSM soft",
    ];
  }, [accountType]);

  const currencySymbol: Record<string, string> = {
    XOF: "CFA",
    EUR: "€",
    USD: "$",
    GBP: "£",
    MAD: "MAD",
  };

  const computedTarif = useMemo(() => {
    const p = price.trim();
    if (!p) return undefined;
    const symbol = currencySymbol[currency] ?? currency;
    // Keep it human-readable; API stores a string
    return currency === "EUR" || currency === "USD" || currency === "GBP"
      ? `${p}${symbol}`
      : `${p} ${symbol}`;
  }, [price, currency]);

  const disponibilite = useMemo(() => {
    if (status === "busy") {
      return { date: "Occupé", heureDebut: "--:--", duree: "--" };
    }
    if (status === "active_soon") {
      return { date: `Dans ${activeInHours}h`, heureDebut, duree };
    }
    return { date: "Aujourd'hui", heureDebut, duree };
  }, [status, activeInHours, heureDebut, duree]);

  const tokenSummary = useMemo(() => {
    const cfg = publishingConfig;
    const balance = Number(account?.tokensBalance ?? 0);
    const isVip = Boolean(profileDetail?.isVip);

    const pubRequired = cfg?.publication?.enabled ? Number(cfg.publication.tokenRequired ?? 0) : 0;
    const promote = cfg?.promote ?? {};
    const find = (arr: any[], id: number) => (Array.isArray(arr) ? arr.find((o) => Number(o.id) === id) : undefined);

    let total = Math.max(0, pubRequired);
    if (extendedOptionId !== "none") {
      const opt = find(promote?.extended?.options, Number(extendedOptionId));
      if (opt) total += Number(opt.tokens ?? 0);
    }
    if (featuredOptionId !== "none") {
      const opt = find(promote?.featured?.options, Number(featuredOptionId));
      if (opt) total += Number(opt.tokens ?? 0);
    }
    if (autorenewOptionId !== "none") {
      const opt = find(promote?.autorenew?.options, Number(autorenewOptionId));
      if (opt) total += Number(opt.tokens ?? 0);
    }
    if (urgentOptionId !== "none") {
      const opt = find(promote?.urgent?.options, Number(urgentOptionId));
      if (opt) total += Number(opt.tokens ?? 0);
    }

    // VIP discount (estimate; server remains source of truth)
    if (isVip && featuredOptionId !== "none" && autorenewOptionId !== "none") {
      total = Math.max(0, total - 1);
    }

    return {
      publicationTokens: pubRequired,
      totalTokens: total,
      remainingTokens: Math.max(0, balance - total),
      allowed: balance >= total,
      balance,
    };
  }, [
    publishingConfig,
    account?.tokensBalance,
    profileDetail?.isVip,
    extendedOptionId,
    extendedPaymentMode,
    featuredOptionId,
    autorenewOptionId,
    urgentOptionId,
  ]);

  const canGoStep2 = useMemo(() => {
    return title.trim().length >= 2 && services.length > 0;
  }, [title, services.length]);

  const extendedSupportsMoney = Array.isArray(publishingConfig?.promote?.extended?.paymentMode)
    ? publishingConfig.promote.extended.paymentMode.includes("money")
    : false;

  const recap = useMemo(() => {
    const cfg = publishingConfig;
    const promote = cfg?.promote ?? {};
    const find = (arr: any[], id: number) =>
      (Array.isArray(arr) ? arr.find((o) => Number(o.id) === id) : undefined);

    const items: Array<{ label: string; tokens: number }> = [];
    if (cfg?.publication?.enabled) {
      items.push({
        label: cfg.publication.label ?? "Publication",
        tokens: Number(cfg.publication.tokenRequired ?? 0),
      });
    }

    if (extendedOptionId !== "none") {
      const opt = find(promote?.extended?.options, Number(extendedOptionId));
      if (opt) {
        items.push({
          label: `Prolongation ${opt.days}j (jetons)`,
          tokens: Number(opt.tokens ?? 0),
        });
      }
    }
    if (featuredOptionId !== "none") {
      const opt = find(promote?.featured?.options, Number(featuredOptionId));
      if (opt) items.push({ label: `Premium ${opt.days}j`, tokens: Number(opt.tokens ?? 0) });
    }
    if (autorenewOptionId !== "none") {
      const opt = find(promote?.autorenew?.options, Number(autorenewOptionId));
      if (opt) items.push({ label: `TOP ${opt.days}j (chaque ${opt.everyHours}h)`, tokens: Number(opt.tokens ?? 0) });
    }
    if (urgentOptionId !== "none") {
      const opt = find(promote?.urgent?.options, Number(urgentOptionId));
      if (opt) items.push({ label: `Urgent ${opt.days}j`, tokens: Number(opt.tokens ?? 0) });
    }

    return items;
  }, [
    publishingConfig,
    extendedOptionId,
    extendedPaymentMode,
    featuredOptionId,
    autorenewOptionId,
    urgentOptionId,
  ]);

  useEffect(() => {
    if (!profileDetail || prefilled) return;
    // Edit mode: prefill from existing profile fields + annonce title
    if (!createNewAnnonce && profileDetail?.annonce?.title) setTitle(profileDetail.annonce.title);
    if (typeof profileDetail?.lieu === "string" && profileDetail.lieu) setLieu(profileDetail.lieu);
    if (Array.isArray(profileDetail?.services) && profileDetail.services.length) setServices(profileDetail.services);
    if (typeof profileDetail?.description === "string") setDescription(profileDetail.description ?? "");
    if (typeof profileDetail?.corpulence === "string") setCorpulence(profileDetail.corpulence ?? "");
    if (typeof profileDetail?.poids === "number") setPoids(String(profileDetail.poids));
    if (typeof profileDetail?.attitude === "string") setAttitude(profileDetail.attitude ?? "");
    if (typeof profileDetail?.boireUnVerre === "boolean") setBoireUnVerre(profileDetail.boireUnVerre ? "yes" : "no");
    if (typeof profileDetail?.fume === "boolean") setFume(profileDetail.fume ? "yes" : "no");
    if (typeof profileDetail?.teintePeau === "string") setTeintePeau(profileDetail.teintePeau ?? "");
    if (typeof profileDetail?.poitrine === "string") setPoitrine(profileDetail.poitrine ?? "");
    if (Array.isArray(profileDetail?.traits)) setTraits(profileDetail.traits ?? []);
    if (Array.isArray(profileDetail?.positions)) setPositions(profileDetail.positions ?? []);
    if (Array.isArray(profileDetail?.selfDescriptions)) setSelfDescriptions(profileDetail.selfDescriptions ?? []);

    if (typeof profileDetail?.tarif === "string" && profileDetail.tarif.length) {
      const raw = String(profileDetail.tarif);
      const m = raw.match(/(\d[\d\s.,]*)\s*([A-Za-z€$£]+)?/);
      if (m?.[1]) setPrice(m[1].replace(/[^\d]/g, ""));
      const cur = (m?.[2] ?? "").toUpperCase();
      if (cur.includes("CFA") || cur.includes("XOF")) setCurrency("XOF");
      else if (cur.includes("€") || cur.includes("EUR")) setCurrency("EUR");
      else if (cur.includes("$") || cur.includes("USD")) setCurrency("USD");
      else if (cur.includes("£") || cur.includes("GBP")) setCurrency("GBP");
      else if (cur.includes("MAD")) setCurrency("MAD");
    }

    if (profileDetail?.disponibilite?.heureDebut) setHeureDebut(profileDetail.disponibilite.heureDebut);
    if (profileDetail?.disponibilite?.duree) setDuree(profileDetail.disponibilite.duree);
    if (typeof profileDetail?.disponibilite?.date === "string") {
      const d = profileDetail.disponibilite.date;
      if (d.toLowerCase().includes("occup")) setStatus("busy");
      else if (d.startsWith("Dans")) setStatus("active_soon");
      else setStatus("active");
    }

    setPrefilled(true);
  }, [profileDetail, prefilled, createNewAnnonce]);

  useEffect(() => {
    if (accountType === "salon" && spaOffers.length === 0) {
      setSpaOffers([
        { name: "Massage relaxant", price: "", masseuse: "" },
        { name: "Massage tantrique", price: "", masseuse: "" },
      ]);
    }
    if (accountType !== "salon" && spaOffers.length > 0) {
      setSpaOffers([]);
    }
  }, [accountType, spaOffers.length]);

  useEffect(() => {
    if (!mainPhoto) {
      setMainPreview(null);
      return;
    }
    const url = URL.createObjectURL(mainPhoto);
    setMainPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [mainPhoto]);

  useEffect(() => {
    const urls = extraPhotos.map((f) => URL.createObjectURL(f));
    setExtraPreviews(urls);
    return () => {
      urls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [extraPhotos]);

  useEffect(() => {
    setVideoName(video?.name ?? null);
  }, [video]);

  async function uploadToR2(file: File, kind: "photo" | "video") {
    // Upload via our server to avoid browser CORS issues with direct PUT to R2.
    const fd = new FormData();
    fd.append("file", file);
    fd.append("kind", kind);

    const res = await apiFetch(`/api/uploads/direct`, {
      method: "POST",
      body: fd,
    });
    if (!res.ok) {
      if (res.status === 401) {
        throw new Error("Session expirée. Merci de vous reconnecter (Dashboard → Connexion) puis réessayer.");
      }
      const text = await res.text().catch(() => "");
      throw new Error(`Upload failed: ${res.status} ${text || res.statusText}`);
    }
    const { key, publicUrl, viewUrl } = await res.json();
    return { key, publicUrl: publicUrl ?? viewUrl };
  }

  const handleSubmit = async () => {
    if (!profileId) {
      setError("Session introuvable. Merci de vous inscrire à nouveau.");
      return;
    }
    if (!publishingConfig) {
      setError("Chargement de la configuration…");
      return;
    }
    if (!publishingConfig?.publication?.enabled) {
      setError("Publication temporairement indisponible.");
      return;
    }
    if (!account?.email) {
      setError("Ajoute un email puis confirme-le avant de pouvoir publier une annonce.");
      return;
    }
    if (account?.emailVerified === false) {
      setError("Confirme ton email avant de pouvoir publier une annonce. (Dashboard → Email du compte → Renvoyer)");
      return;
    }
    if (!tokenSummary.allowed) {
      setError("Crédit insuffisant, veuillez recharger vos jetons.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      if (!services.length) {
        setError("Veuillez sélectionner au moins un service.");
        return;
      }
      // Upload files (optional) and build media list
      const media: Array<{ type: "photo" | "video"; url: string; key?: string; sortOrder?: number }> = [];
      if (mainPhoto) {
        const up = await uploadToR2(mainPhoto, "photo");
        media.push({ type: "photo", url: up.publicUrl, key: up.key, sortOrder: 0 });
      }
      if (extraPhotos.length) {
        for (let i = 0; i < extraPhotos.length; i++) {
          const f = extraPhotos[i]!;
          const up = await uploadToR2(f, "photo");
          media.push({ type: "photo", url: up.publicUrl, key: up.key, sortOrder: i + 1 });
        }
      }
      if (video) {
        const up = await uploadToR2(video, "video");
        media.push({ type: "video", url: up.publicUrl, key: up.key, sortOrder: 999 });
      }

      let finalDescription = description || "";
      if (accountType === "salon" && spaOffers.length) {
        const lines = spaOffers
          .filter((o) => o.name.trim() && o.price.trim())
          .map((o) => {
            const base = `- ${o.name.trim()} – ${o.price.trim()} CFA`;
            return o.masseuse.trim()
              ? `${base} (Masseuse: ${o.masseuse.trim()})`
              : base;
          });
        if (lines.length) {
          const block = `\n\nMassages proposés :\n${lines.join("\n")}`;
          finalDescription = (finalDescription || "") + block;
        }
      }

      const promotePayload: any = {};
      if (extendedOptionId !== "none") {
        promotePayload.extended = {
          optionId: Number(extendedOptionId),
          paymentMode: "tokens",
        };
      }
      if (featuredOptionId !== "none") promotePayload.featured = { optionId: Number(featuredOptionId) };
      if (autorenewOptionId !== "none") promotePayload.autorenew = { optionId: Number(autorenewOptionId) };
      if (urgentOptionId !== "none") promotePayload.urgent = { optionId: Number(urgentOptionId) };

      await apiRequest("POST", "/api/annonces", {
        profileId,
        forceNew: createNewAnnonce,
        title,
        tarif: computedTarif,
        lieu: lieu || undefined,
        services: services.slice(0, 25),
        description: finalDescription || undefined,
        promote: Object.keys(promotePayload).length ? promotePayload : undefined,
        ...(accountType === "profile"
          ? {
              corpulence: corpulence || undefined,
              poids: poids.trim().length ? Number(poids) : undefined,
              attitude: attitude || undefined,
              boireUnVerre: boireUnVerre === "" ? undefined : boireUnVerre === "yes",
              fume: fume === "" ? undefined : fume === "yes",
              teintePeau: teintePeau || undefined,
              poitrine: poitrine || undefined,
              traits: traits.length ? traits : undefined,
              positions: positions.length ? positions : undefined,
              selfDescriptions: selfDescriptions.length ? selfDescriptions : undefined,
            }
          : {}),
        disponibilite,
        media: media.length ? media : undefined,
      });
      await refreshProfileSurfaceData(queryClient, profileId);
      setLocation("/dashboard");
    } catch (e: any) {
      setError(e?.message ?? "Erreur lors de la publication");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-5xl px-4 pb-12 pt-[calc(env(safe-area-inset-top)+1rem)] sm:px-6">
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => setLocation("/dashboard")}
              className="flex h-10 w-10 items-center justify-center rounded-full border border-border/70 text-muted-foreground"
              data-testid="button-back-annonce"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <h1 className="text-xl font-semibold text-foreground">
              {!createNewAnnonce && profileDetail?.annonce
                ? "Modifier l'annonce"
                : accountType === "profile"
                ? "Nouvelle annonce"
                : accountType === "residence"
                ? "Fiche résidence meublée"
                : accountType === "salon"
                ? "Fiche salon / SPA"
                : "Fiche boutique adultes"}
            </h1>
            <div className="w-10" />
          </div>

        {isLoading || !profileDetail ? (
          <p className="text-sm text-muted-foreground mt-6">Chargement du formulaire…</p>
        ) : (
        <div className="space-y-6">
            <div className="mb-5 border-b border-border/70 pb-4">
              <div className="flex items-center gap-2 text-base">
                <Wand2 className="w-4 h-4 text-primary" />
                <span className="text-xs text-muted-foreground">Étape {step}/3</span>
                <span className="text-foreground">
                  {step === 1 ? "Contenu" : step === 2 ? "Visibilité" : "Validation"}
                </span>
              </div>
            </div>
            <div className="space-y-5">
              {account && (!account.email || account.emailVerified === false) && (
                <div className="border-b border-amber-500/20 pb-4 text-sm text-foreground">
                  <div className="flex items-start gap-2">
                    <Mail className="w-4 h-4 text-amber-400 mt-0.5" />
                    <div className="space-y-1">
                      <div className="font-semibold">
                        {account.email
                          ? "Email non confirmé"
                          : "Email requis"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {account.email
                          ? "Confirme ton email pour pouvoir publier une annonce."
                          : "Ajoute un email puis confirme-le pour pouvoir publier une annonce."}
                      </div>
                      <div className="pt-1">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9"
                          onClick={() => setLocation("/dashboard")}
                        >
                          Aller au dashboard
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {error && (
                <div className="border-b border-destructive/20 pb-4 text-sm text-destructive">
                  {error}
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6 border-b border-border/70 pb-6">
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-foreground">Visibilité & jetons</div>
                    <p className="text-xs text-muted-foreground">
                      Solde: <span className="text-foreground font-medium">{tokenSummary.balance}</span> • Publication:{" "}
                      <span className="text-foreground font-medium">{tokenSummary.publicationTokens}</span> • Total:{" "}
                      <span className="text-foreground font-medium">{tokenSummary.totalTokens}</span> • Restant:{" "}
                      <span className="text-foreground font-medium">{tokenSummary.remainingTokens}</span>
                    </p>
                    {!tokenSummary.allowed && (
                      <p className="text-xs text-destructive">
                        Crédit insuffisant, veuillez recharger vos jetons.
                      </p>
                    )}
                    {!tokenSummary.allowed && (
                      <div className="pt-1">
                        <Button type="button" variant="outline" size="sm" onClick={() => setLocation("/dashboard")}>
                          Recharger mes jetons
                        </Button>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4">
                    {/* Helper tile */}
                    <div className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Prolongation
                      </div>
                      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                        <button
                          type="button"
                          onClick={() => setExtendedOptionId("none")}
                          className={
                            "min-w-[160px] text-left rounded-2xl border p-3 " +
                            (extendedOptionId === "none"
                              ? "border-primary/40 bg-primary/10"
                              : "border-border/70 bg-background hover:bg-muted/40")
                          }
                        >
                          <div className="text-sm font-semibold text-foreground">Aucune</div>
                          <div className="text-xs text-muted-foreground">0 jeton</div>
                        </button>
                        {(publishingConfig?.promote?.extended?.options ?? []).map((o: any) => {
                          const selected = extendedOptionId === String(o.id);
                          return (
                            <button
                              key={o.id}
                              type="button"
                              onClick={() => setExtendedOptionId(String(o.id))}
                              className={
                                "min-w-[200px] text-left rounded-2xl border p-3 " +
                                (selected
                                  ? "border-primary/40 bg-primary/10"
                                  : "border-border/70 bg-background hover:bg-muted/40")
                              }
                            >
                              <div className="flex items-center justify-between gap-2">
                                <div className="text-sm font-semibold text-foreground">{o.days} jours</div>
                                <div className="text-xs text-muted-foreground">{o.tokens}🪙</div>
                              </div>
                              {!extendedSupportsMoney ? (
                                <div className="text-xs text-muted-foreground mt-1">Débit sur votre solde de jetons</div>
                              ) : (
                                <div className="text-xs text-muted-foreground mt-1">
                                  {o.pricePromo ? `${o.pricePromo} CFA (promo)` : o.price ? `${o.price} CFA` : ""}
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      {extendedOptionId !== "none" ? (
                        <div className="text-xs text-muted-foreground">
                          Paiement en jetons uniquement. Paystack sert uniquement a acheter des packs de jetons pour le moment.
                        </div>
                      ) : null}
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Premium
                      </div>
                      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                        <button
                          type="button"
                          onClick={() => setFeaturedOptionId("none")}
                          className={
                            "min-w-[160px] text-left rounded-2xl border p-3 " +
                            (featuredOptionId === "none"
                              ? "border-primary/40 bg-primary/10"
                              : "border-border/70 bg-background hover:bg-muted/40")
                          }
                        >
                          <div className="text-sm font-semibold text-foreground">Aucun</div>
                          <div className="text-xs text-muted-foreground">0 jeton</div>
                        </button>
                        {(publishingConfig?.promote?.featured?.options ?? []).map((o: any) => {
                          const selected = featuredOptionId === String(o.id);
                          return (
                            <button
                              key={o.id}
                              type="button"
                              onClick={() => setFeaturedOptionId(String(o.id))}
                              className={
                                "min-w-[180px] text-left rounded-2xl border p-3 " +
                                (selected
                                  ? "border-emerald-500/40 bg-emerald-500/10"
                                  : "border-border/70 bg-background hover:bg-muted/40")
                              }
                            >
                              <div className="text-sm font-semibold text-foreground">PREMIUM</div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {o.days} jours • {o.tokens}🪙
                              </div>
                              <div className="text-[11px] text-muted-foreground mt-1">
                                Visibilité maximale
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        TOP
                      </div>
                      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                        <button
                          type="button"
                          onClick={() => setAutorenewOptionId("none")}
                          className={
                            "min-w-[160px] text-left rounded-2xl border p-3 " +
                            (autorenewOptionId === "none"
                              ? "border-primary/40 bg-primary/10"
                              : "border-border/70 bg-background hover:bg-muted/40")
                          }
                        >
                          <div className="text-sm font-semibold text-foreground">Aucun</div>
                          <div className="text-xs text-muted-foreground">0 jeton</div>
                        </button>
                        {(publishingConfig?.promote?.autorenew?.options ?? []).map((o: any) => {
                          const selected = autorenewOptionId === String(o.id);
                          return (
                            <button
                              key={o.id}
                              type="button"
                              onClick={() => setAutorenewOptionId(String(o.id))}
                              className={
                                "min-w-[220px] text-left rounded-2xl border p-3 " +
                                (selected
                                  ? "border-sky-500/40 bg-sky-500/10"
                                  : "border-border/70 bg-background hover:bg-muted/40")
                              }
                            >
                              <div className="text-sm font-semibold text-foreground">TOP</div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {o.days} jours • chaque {o.everyHours}h • {o.tokens}🪙
                              </div>
                              <div className="text-[11px] text-muted-foreground mt-1">
                                Remonte automatiquement
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        Urgent
                      </div>
                      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                        <button
                          type="button"
                          onClick={() => setUrgentOptionId("none")}
                          className={
                            "min-w-[160px] text-left rounded-2xl border p-3 " +
                            (urgentOptionId === "none"
                              ? "border-primary/40 bg-primary/10"
                              : "border-border/70 bg-background hover:bg-muted/40")
                          }
                        >
                          <div className="text-sm font-semibold text-foreground">Aucun</div>
                          <div className="text-xs text-muted-foreground">0 jeton</div>
                        </button>
                        {(publishingConfig?.promote?.urgent?.options ?? []).map((o: any) => {
                          const selected = urgentOptionId === String(o.id);
                          return (
                            <button
                              key={o.id}
                              type="button"
                              onClick={() => setUrgentOptionId(String(o.id))}
                              className={
                                "min-w-[180px] text-left rounded-2xl border p-3 " +
                                (selected
                                  ? "border-red-500/40 bg-red-500/10"
                                  : "border-border/70 bg-background hover:bg-muted/40")
                              }
                            >
                              <div className="text-sm font-semibold text-foreground">URGENT</div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {o.days} jours • {o.tokens}🪙
                              </div>
                              <div className="text-[11px] text-muted-foreground mt-1">
                                Badge rouge
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {step === 1 && (
                <>
              <div className="space-y-2">
                <Label htmlFor="title" className="flex items-center gap-2">
                  <Tag className="w-4 h-4 text-muted-foreground" />
                  Titre
                </Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={
                    accountType === "profile"
                      ? "Ex: Disponible ce soir - discrétion garantie"
                      : accountType === "residence"
                      ? "Ex: Studio meublé cocon, idéal rendez-vous discret"
                      : accountType === "salon"
                      ? "Ex: Massage relaxant, SPA privé"
                      : "Ex: Coffret produits adultes, sextoys, lubrifiants..."
                  }
                  className="h-12"
                  data-testid="input-annonce-title"
                />
              </div>

              {accountType === "salon" && (
                <div className="space-y-3">
                  <Separator />
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-foreground">
                      Détail des massages & masseuses
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Ajoute plusieurs types de massages, chacun avec son prix, et indique la masseuse si besoin.
                    </p>
                  </div>
                  <div className="space-y-2">
                    {spaOffers.map((offer, idx) => (
                      <div key={idx} className="grid grid-cols-3 gap-2">
                        <Input
                          value={offer.name}
                          onChange={(e) =>
                            setSpaOffers((prev) =>
                              prev.map((o, i) =>
                                i === idx ? { ...o, name: e.target.value } : o,
                              ),
                            )
                          }
                          placeholder="Massage relaxant"
                          className="h-10 text-xs"
                        />
                        <Input
                          value={offer.price}
                          onChange={(e) =>
                            setSpaOffers((prev) =>
                              prev.map((o, i) =>
                                i === idx ? { ...o, price: e.target.value } : o,
                              ),
                            )
                          }
                          placeholder="Prix (ex: 25000)"
                          className="h-10 text-xs"
                        />
                        <Input
                          value={offer.masseuse}
                          onChange={(e) =>
                            setSpaOffers((prev) =>
                              prev.map((o, i) =>
                                i === idx ? { ...o, masseuse: e.target.value } : o,
                              ),
                            )
                          }
                          placeholder="Masseuse (optionnel)"
                          className="h-10 text-xs"
                        />
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 px-3 text-xs gap-1"
                      onClick={() =>
                        setSpaOffers((prev) => [
                          ...prev,
                          { name: "", price: "", masseuse: "" },
                        ])
                      }
                    >
                      <Plus className="w-3 h-3" />
                      Ajouter un massage
                    </Button>
                    {spaOffers.length > 1 && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 px-3 text-xs gap-1"
                        onClick={() =>
                          setSpaOffers((prev) => prev.slice(0, prev.length - 1))
                        }
                      >
                        <Minus className="w-3 h-3" />
                        Retirer
                      </Button>
                    )}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Devise</Label>
                  <Select value={currency} onValueChange={(v) => setCurrency(v as any)}>
                    <SelectTrigger className="h-12" data-testid="select-currency">
                      <SelectValue placeholder="Choisir une devise" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="XOF">XOF (CFA)</SelectItem>
                      <SelectItem value="EUR">EUR (€)</SelectItem>
                      <SelectItem value="USD">USD ($)</SelectItem>
                      <SelectItem value="GBP">GBP (£)</SelectItem>
                      <SelectItem value="MAD">MAD</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Input
                    id="price"
                    value={price}
                    onChange={(e) => setPrice(e.target.value)}
                    placeholder="Prix (ex: 15000)"
                    className="h-12"
                    data-testid="input-price"
                  />
                  <p className="text-xs text-muted-foreground">
                    Affiché: <span className="text-foreground">{computedTarif ?? "—"}</span>
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-muted-foreground" />
                  {accountType === "profile"
                    ? "Lieu de rencontre (suggestions)"
                    : accountType === "residence"
                    ? "Type de résidence"
                    : accountType === "salon"
                    ? "Type d’établissement"
                    : "Type de lieu"}
                </Label>
                <Select value={lieu} onValueChange={setLieu}>
                  <SelectTrigger className="h-12" data-testid="select-lieu">
                    <SelectValue placeholder="Choisir un lieu" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Hôtel">Hôtel</SelectItem>
                    <SelectItem value="Résidence">Résidence</SelectItem>
                    <SelectItem value="Lieu privé">Lieu privé</SelectItem>
                    <SelectItem value="À définir">À définir</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>
                  {accountType === "profile"
                    ? "Services proposés (obligatoire)"
                    : accountType === "residence"
                    ? "Équipements / atouts de la résidence"
                    : accountType === "salon"
                    ? "Types de massages / prestations"
                    : "Catégories de produits proposés"}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {accountType === "profile"
                    ? "Coche exactement ce que tu proposes. Plus c’est précis, plus ton annonce est visible."
                    : accountType === "residence"
                    ? "Décris ce qui rend ta résidence idéale pour accueillir les rendez‑vous."
                    : accountType === "salon"
                    ? "Mets en avant les prestations clés de ton salon / SPA."
                    : "Mets en avant les grandes familles de produits que tu vends."}
                </p>

                {services.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {services.map((s) => (
                      <span
                        key={s}
                        className="px-3 py-1 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {serviceOptions.map((s) => (
                    <label
                      key={s}
                      className="flex items-center gap-3 rounded-xl border border-border/70 bg-background p-3 cursor-pointer"
                    >
                      <Checkbox
                        checked={services.includes(s)}
                        onCheckedChange={(checked) => {
                          const isChecked = Boolean(checked);
                          setServices((prev) =>
                            isChecked ? Array.from(new Set([...prev, s])) : prev.filter((x) => x !== s),
                          );
                        }}
                        data-testid={`checkbox-service-${s}`}
                      />
                      <span className="text-sm text-foreground">{s}</span>
                    </label>
                  ))}
                </div>
              </div>

              {accountType === "profile" && (
                <details className="border-t border-border/70 pt-4">
                  <summary className="cursor-pointer select-none py-2">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-semibold text-foreground">
                        Détails du profil (optionnel)
                      </div>
                      <span className="text-xs text-muted-foreground">Ouvrir</span>
                    </div>
                  </summary>
                  <div className="px-4 pb-4 space-y-4">
                  <div className="space-y-4 pt-2">
                  <p className="text-xs text-muted-foreground">
                    Ces informations s’affichent sur votre fiche (plus de confiance, plus de contacts).
                  </p>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Corpulence</Label>
                      <Select
                        value={corpulence || "none"}
                        onValueChange={(v) => setCorpulence(v === "none" ? "" : v)}
                      >
                        <SelectTrigger className="h-12">
                          <SelectValue placeholder="Choisir" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Non précisé</SelectItem>
                          {corpulenceOptions.map((o) => (
                            <SelectItem key={o} value={o}>
                              {o}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Poids (kg)</Label>
                      <Input
                        value={poids}
                        onChange={(e) => setPoids(e.target.value)}
                        placeholder="ex: 62"
                        className="h-12"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Attitude</Label>
                      <Select
                        value={attitude || "none"}
                        onValueChange={(v) => setAttitude(v === "none" ? "" : v)}
                      >
                        <SelectTrigger className="h-12">
                          <SelectValue placeholder="Choisir" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Non précisé</SelectItem>
                          {attitudeOptions.map((o) => (
                            <SelectItem key={o} value={o}>
                              {o}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Teinte de peau</Label>
                      <Select
                        value={teintePeau || "none"}
                        onValueChange={(v) => setTeintePeau(v === "none" ? "" : v)}
                      >
                        <SelectTrigger className="h-12">
                          <SelectValue placeholder="Choisir" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Non précisé</SelectItem>
                          {teintePeauOptions.map((o) => (
                            <SelectItem key={o} value={o}>
                              {o}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Partager un verre</Label>
                      <Select
                        value={boireUnVerre || "none"}
                        onValueChange={(v) => setBoireUnVerre(v === "none" ? "" : (v as any))}
                      >
                        <SelectTrigger className="h-12">
                          <SelectValue placeholder="Choisir" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Non précisé</SelectItem>
                          <SelectItem value="yes">Oui</SelectItem>
                          <SelectItem value="no">Non</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Fume</Label>
                      <Select value={fume || "none"} onValueChange={(v) => setFume(v === "none" ? "" : (v as any))}>
                        <SelectTrigger className="h-12">
                          <SelectValue placeholder="Choisir" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">Non précisé</SelectItem>
                          <SelectItem value="yes">Oui</SelectItem>
                          <SelectItem value="no">Non</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Poitrine</Label>
                    <Select
                      value={poitrine || "none"}
                      onValueChange={(v) => setPoitrine(v === "none" ? "" : v)}
                    >
                      <SelectTrigger className="h-12">
                        <SelectValue placeholder="Choisir" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Non précisé</SelectItem>
                        {poitrineOptions.map((o) => (
                          <SelectItem key={o} value={o}>
                            {o}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Traits (ex: accueillante, gentille…)</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {traitOptions.map((s) => (
                        <label
                          key={s}
                          className="flex items-center gap-3 rounded-xl border border-border/70 bg-background p-3 cursor-pointer"
                        >
                          <Checkbox
                            checked={traits.includes(s)}
                            onCheckedChange={(checked) => {
                              const on = Boolean(checked);
                              setTraits((prev) =>
                                on ? Array.from(new Set([...prev, s])) : prev.filter((x) => x !== s),
                              );
                            }}
                          />
                          <span className="text-sm text-foreground">{s}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Positions préférées</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {positionOptions.map((s) => (
                        <label
                          key={s}
                          className="flex items-center gap-3 rounded-xl border border-border/70 bg-background p-3 cursor-pointer"
                        >
                          <Checkbox
                            checked={positions.includes(s)}
                            onCheckedChange={(checked) => {
                              const on = Boolean(checked);
                              setPositions((prev) =>
                                on ? Array.from(new Set([...prev, s])) : prev.filter((x) => x !== s),
                              );
                            }}
                          />
                          <span className="text-sm text-foreground">{s}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Se décrit comme</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {selfDescriptionOptions.map((s) => (
                        <label
                          key={s}
                          className="flex items-center gap-3 rounded-xl border border-border/70 bg-background p-3 cursor-pointer"
                        >
                          <Checkbox
                            checked={selfDescriptions.includes(s)}
                            onCheckedChange={(checked) => {
                              const on = Boolean(checked);
                              setSelfDescriptions((prev) =>
                                on ? Array.from(new Set([...prev, s])) : prev.filter((x) => x !== s),
                              );
                            }}
                          />
                          <span className="text-sm text-foreground">{s}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  </div>
                  </div>
                </details>
              )}

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    Statut
                  </Label>
                  <Select value={status} onValueChange={(v) => setStatus(v as any)}>
                    <SelectTrigger className="h-12" data-testid="select-status">
                      <SelectValue placeholder="Choisir un statut" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Actif</SelectItem>
                      <SelectItem value="busy">Occupé</SelectItem>
                      <SelectItem value="active_soon">Actif dans quelques heures</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="heureDebut">Heure</Label>
                  <Input
                    id="heureDebut"
                    value={heureDebut}
                    onChange={(e) => setHeureDebut(e.target.value)}
                    className="h-12"
                    data-testid="input-annonce-heure"
                    disabled={status === "busy"}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="duree">Durée</Label>
                  <Input
                    id="duree"
                    value={duree}
                    onChange={(e) => setDuree(e.target.value)}
                    className="h-12"
                    data-testid="input-annonce-duree"
                    disabled={status === "busy"}
                  />
                </div>
              </div>

              {status === "active_soon" && (
                <div className="space-y-2">
                  <Label>Actif dans (heures)</Label>
                  <Select
                    value={String(activeInHours)}
                    onValueChange={(v) => setActiveInHours(Number(v))}
                  >
                    <SelectTrigger className="h-12" data-testid="select-active-in-hours">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[1, 2, 3, 4, 6, 8, 12].map((h) => (
                        <SelectItem key={h} value={String(h)}>
                          {h}h
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Affiché: <span className="text-foreground">{disponibilite.date}</span>
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Décrivez votre annonce (style, services, conditions...)"
                  className="min-h-[120px]"
                  data-testid="textarea-annonce-description"
                />
              </div>

              <div className="space-y-2">
                <Label>Photo principale (mise en avant)</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setMainPhoto(e.target.files?.[0] ?? null)}
                  className="h-12 pt-2"
                  data-testid="input-main-photo"
                />
                {mainPreview && (
                  <img
                    src={mainPreview}
                    alt="Preview"
                    className="w-full h-56 object-cover rounded-2xl border border-border"
                  />
                )}
              </div>

              <div className="space-y-2">
                <Label>Autres photos (optionnel)</Label>
                <Input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(e) => setExtraPhotos(Array.from(e.target.files ?? []))}
                  className="h-12 pt-2"
                  data-testid="input-extra-photos"
                />
                {extraPreviews.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                    {extraPreviews.slice(0, 8).map((u, idx) => (
                      <img
                        key={idx}
                        src={u}
                        alt={`Preview ${idx + 1}`}
                        className="w-20 h-24 object-cover rounded-xl border border-border flex-shrink-0"
                      />
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Vidéo (optionnel)</Label>
                <Input
                  type="file"
                  accept="video/*"
                  onChange={(e) => setVideo(e.target.files?.[0] ?? null)}
                  className="h-12 pt-2"
                  data-testid="input-video"
                />
                {videoName && (
                  <p className="text-xs text-muted-foreground">
                    Fichier sélectionné: <span className="text-foreground">{videoName}</span>
                  </p>
                )}
              </div>
                </>
              )}

              {step === 3 && (
                <div className="space-y-3 border-b border-border/70 pb-4">
                  <div className="text-sm font-semibold text-foreground">Récapitulatif</div>
                  <div className="space-y-2">
                    {recap.map((it, idx) => (
                      <div key={idx} className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">{it.label}</span>
                        <span className="text-foreground font-medium">{it.tokens}🪙</span>
                      </div>
                    ))}
                    <div className="h-px bg-border my-2" />
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-foreground font-semibold">Total</span>
                      <span className="text-foreground font-semibold">{tokenSummary.totalTokens}🪙</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">Solde restant</span>
                      <span className="text-muted-foreground">{tokenSummary.remainingTokens}🪙</span>
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  className="h-12"
                  onClick={() => {
                    if (step === 1) setLocation("/dashboard");
                    else setStep((s) => (s === 1 ? 1 : ((s - 1) as any)));
                  }}
                >
                  {step === 1 ? "Annuler" : "Retour"}
                </Button>

                {step < 3 ? (
                  <Button
                    type="button"
                    className="h-12"
                    onClick={() => setStep((s) => ((s + 1) as any))}
                    disabled={
                      (step === 1 && (!canGoStep2 || !publishingConfig)) ||
                      (step === 2 && !publishingConfig)
                    }
                    data-testid="button-next-step"
                  >
                    Continuer
                  </Button>
                ) : (
                  <Button
                    className="h-12"
                    onClick={handleSubmit}
                    disabled={
                      loading ||
                      !publishingConfig ||
                      !tokenSummary.allowed ||
                      !account?.email ||
                      account?.emailVerified === false
                    }
                    data-testid="button-publish-annonce"
                  >
                    {loading ? "Publication..." : "Publier maintenant"}
                  </Button>
                )}
              </div>

              {profileDetail?.annonce?.id && step === 3 && !createNewAnnonce && (
                <Button
                  variant="outline"
                  className="w-full h-12"
                  onClick={async () => {
                    await apiRequest("PATCH", `/api/annonces/${profileDetail.annonce.id}`, { active: false });
                    setLocation("/dashboard");
                  }}
                  data-testid="button-unpublish-annonce"
                >
                  Dépublier
                </Button>
              )}
            </div>
        </div>
        )}
        </div>
      </main>
    </div>
  );
}


