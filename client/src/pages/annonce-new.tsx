import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { ArrowLeft, Calendar, MapPin, Tag, Wand2, Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
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

  const { data: profileDetail, isLoading } = useQuery<any>({
    queryKey: profileId ? [`/api/profiles/${profileId}`] : ["__no_profile__"],
    enabled: Boolean(profileId),
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

  useEffect(() => {
    if (!profileDetail || prefilled) return;
    // Edit mode: prefill from existing profile fields + annonce title
    if (profileDetail?.annonce?.title) setTitle(profileDetail.annonce.title);
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
  }, [profileDetail, prefilled]);

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

    const res = await fetch("/api/uploads/direct", {
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

      await apiRequest("POST", "/api/annonces", {
        profileId,
        title,
        tarif: computedTarif,
        lieu: lieu || undefined,
        services: services.slice(0, 25),
        description: finalDescription || undefined,
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
      setLocation("/dashboard");
    } catch (e: any) {
      setError(e?.message ?? "Erreur lors de la publication");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="flex items-center justify-between px-6 py-4">
        <button
          onClick={() => setLocation("/dashboard")}
          className="w-10 h-10 rounded-full bg-card flex items-center justify-center border border-border"
          data-testid="button-back-annonce"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <h1 className="text-xl font-semibold text-foreground">
          {profileDetail?.annonce
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
      </header>

      <main className="px-6 pb-10 space-y-4">
        {isLoading || !profileDetail ? (
          <p className="text-sm text-muted-foreground mt-6">Chargement du formulaire…</p>
        ) : (
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}>
          <Card className="border-border">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Wand2 className="w-4 h-4 text-primary" />
                {profileDetail?.annonce
                  ? "Mise à jour"
                  : accountType === "profile"
                  ? "Fiche mise en avant"
                  : accountType === "residence"
                  ? "Fiche résidence meublée"
                  : accountType === "salon"
                  ? "Fiche salon / SPA"
                  : "Fiche boutique produits adultes"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              {error && (
                <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                  {error}
                </div>
              )}

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
                      className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card cursor-pointer"
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
                <>
                  <Separator />
                  <div className="space-y-2">
                    <div className="text-sm font-semibold text-foreground">Profil & préférences</div>
                    <p className="text-xs text-muted-foreground">
                      Ces informations s’affichent sur votre fiche (plus de confiance, plus de contacts).
                    </p>
                  </div>

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
                          className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card cursor-pointer"
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
                          className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card cursor-pointer"
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
                          className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card cursor-pointer"
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
                </>
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

              <Button
                className="w-full h-12"
                onClick={handleSubmit}
                disabled={loading || title.trim().length < 2}
                data-testid="button-publish-annonce"
              >
                {loading ? "Publication..." : profileDetail?.annonce ? "Mettre à jour" : "Publier l'annonce"}
              </Button>

              {profileDetail?.annonce?.id && (
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
            </CardContent>
          </Card>
        </motion.div>
        )}
      </main>
    </div>
  );
}


