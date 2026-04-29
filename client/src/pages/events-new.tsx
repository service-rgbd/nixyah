import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ImagePlus, Video, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiFetch, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type MyEvent = {
  id: string;
  title: string;
  description?: string | null;
  city: string;
  venue?: string | null;
  startsAt: string;
  endsAt?: string | null;
  visibility: "public" | "private";
  priceType: "free" | "paid";
  priceAmount?: number | null;
  priceCurrency: string;
  capacity?: number | null;
  contactWhatsapp?: string | null;
  contactEmail?: string | null;
  imageUrl?: string | null;
  imageUrls?: string[] | null;
  videoUrl?: string | null;
  status: "draft" | "published" | "cancelled";
};

function toLocalDateTimeInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function EventsNewPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const eventId = useMemo(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    return params.get("eventId");
  }, []);

  const { data: myEvents } = useQuery<MyEvent[]>({
    queryKey: ["/api/me/events"],
  });

  const editingEvent = useMemo(
    () => (eventId ? (myEvents ?? []).find((item) => item.id === eventId) ?? null : null),
    [eventId, myEvents],
  );

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [city, setCity] = useState("");
  const [venue, setVenue] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [visibility, setVisibility] = useState<"public" | "private">("public");
  const [priceType, setPriceType] = useState<"free" | "paid">("free");
  const [priceAmount, setPriceAmount] = useState("");
  const [capacity, setCapacity] = useState("");
  const [contactWhatsapp, setContactWhatsapp] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [existingVideoUrl, setExistingVideoUrl] = useState<string | null>(null);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<"draft" | "published">("published");
  const [legalNoticeAccepted, setLegalNoticeAccepted] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!editingEvent) return;
    setTitle(editingEvent.title);
    setDescription(editingEvent.description ?? "");
    setCity(editingEvent.city);
    setVenue(editingEvent.venue ?? "");
    setStartsAt(toLocalDateTimeInput(editingEvent.startsAt));
    setEndsAt(toLocalDateTimeInput(editingEvent.endsAt));
    setVisibility(editingEvent.visibility);
    setPriceType(editingEvent.priceType);
    setPriceAmount(editingEvent.priceAmount ? String(editingEvent.priceAmount) : "");
    setCapacity(editingEvent.capacity ? String(editingEvent.capacity) : "");
    setContactWhatsapp(editingEvent.contactWhatsapp ?? "");
    setContactEmail(editingEvent.contactEmail ?? "");
    setStatus(editingEvent.status === "cancelled" ? "draft" : editingEvent.status);
    setExistingImageUrls(Array.from(new Set([editingEvent.imageUrl, ...(editingEvent.imageUrls ?? [])].filter(Boolean) as string[])).slice(0, 2));
    setExistingVideoUrl(editingEvent.videoUrl ?? null);
    setPhotoFiles([]);
    setVideoFile(null);
  }, [editingEvent]);

  useEffect(() => {
    const urls = photoFiles.map((file) => URL.createObjectURL(file));
    setPhotoPreviews(urls);
    return () => {
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [photoFiles]);

  useEffect(() => {
    if (!videoFile) {
      setVideoPreview(null);
      return;
    }
    const url = URL.createObjectURL(videoFile);
    setVideoPreview(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [videoFile]);

  const displayedImages = photoPreviews.length ? photoPreviews : existingImageUrls;
  const displayedVideo = videoPreview ?? existingVideoUrl;

  async function uploadMedia(file: File, kind: "photo" | "video") {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("kind", kind);

    const res = await apiFetch("/api/uploads/direct", {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || (kind === "video" ? "Impossible d'envoyer cette vidéo." : "Impossible d'envoyer cette photo."));
    }
    const json = (await res.json()) as { publicUrl?: string; viewUrl?: string };
    return json.publicUrl ?? json.viewUrl ?? "";
  }

  const onPickPhotos = (files: FileList | null) => {
    const picked = Array.from(files ?? []).filter((file) => file.type.startsWith("image/")).slice(0, 2);
    setPhotoFiles(picked);
    if (picked.length) {
      setExistingImageUrls([]);
    }
  };

  const onPickVideo = (files: FileList | null) => {
    const picked = Array.from(files ?? []).find((file) => file.type.startsWith("video/")) ?? null;
    setVideoFile(picked);
    if (picked) {
      setExistingVideoUrl(null);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim() || !city.trim() || !startsAt) {
      toast({ title: "Champs requis", description: "Titre, ville et date sont obligatoires." });
      return;
    }
    if (!legalNoticeAccepted) {
      toast({ title: "Mentions obligatoires", description: "Confirme la mention légale avant de continuer." });
      return;
    }

    setSaving(true);
    try {
      const imageUrls = photoFiles.length
        ? (
            await Promise.all(photoFiles.slice(0, 2).map((file) => uploadMedia(file, "photo")))
          ).filter(Boolean)
        : existingImageUrls.slice(0, 2);
      const videoUrl = videoFile
        ? await uploadMedia(videoFile, "video")
        : existingVideoUrl;

      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        city: city.trim(),
        venue: venue.trim() || null,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: endsAt ? new Date(endsAt).toISOString() : null,
        visibility,
        priceType,
        priceAmount: priceType === "paid" ? Number(priceAmount || 0) : 0,
        priceCurrency: "XOF",
        capacity: capacity ? Number(capacity) : null,
        contactWhatsapp: contactWhatsapp.trim() || null,
        contactEmail: contactEmail.trim().toLowerCase() || null,
        imageUrl: imageUrls[0] || null,
        imageUrls,
        videoUrl: videoUrl || null,
        legalNoticeAccepted: true,
        status,
      };

      if (editingEvent) {
        await apiRequest("PATCH", `/api/me/events/${editingEvent.id}`, payload);
      } else {
        await apiRequest("POST", "/api/me/events", payload);
      }

      await queryClient.invalidateQueries({ queryKey: ["/api/me/events"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/events"] });
      toast({
        title: editingEvent ? "Évènement mis à jour" : "Évènement créé",
        description:
          editingEvent
            ? "Les modifications sont enregistrées."
            : "La première annonce d’évènement est gratuite, puis chaque publication coûte 5 crédits.",
      });
      setLocation("/dashboard");
    } catch (e: any) {
      toast({ title: "Erreur", description: e?.message ?? "Impossible d’enregistrer l’évènement." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-4xl px-4 pb-14 pt-[calc(env(safe-area-inset-top)+1rem)]">
        <div className="space-y-8">
          <Button variant="ghost" className="-ml-3 rounded-full px-3 text-muted-foreground" onClick={() => setLocation("/dashboard")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Button>

          <div className="border-b border-border/70 pb-6">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {editingEvent ? "Modifier l’évènement" : "Créer un évènement"}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              La première publication d’évènement est gratuite pour les profils autorisés, puis chaque annonce coûte 5 crédits. Ajoute jusqu’à 2 photos et une courte vidéo d’illustration pour présenter l’ambiance.
            </p>
          </div>

          <div className="space-y-8">
            <div className="grid gap-4 border-b border-border/70 pb-6 sm:grid-cols-2">
              <div className="space-y-2 sm:col-span-2">
                <Label>Titre</Label>
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Soirée privée rooftop" />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label>Description</Label>
                <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[150px]" />
              </div>
            </div>

            <div className="grid gap-4 border-b border-border/70 pb-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Ville</Label>
                <Input value={city} onChange={(e) => setCity(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Lieu</Label>
                <Input value={venue} onChange={(e) => setVenue(e.target.value)} placeholder="Adresse ou repère" />
              </div>

              <div className="space-y-2">
                <Label>Début</Label>
                <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Fin</Label>
                <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} />
              </div>
            </div>

            <div className="grid gap-4 border-b border-border/70 pb-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Visibilité</Label>
                <select className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm" value={visibility} onChange={(e) => setVisibility(e.target.value as "public" | "private")}>
                  <option value="public">Public</option>
                  <option value="private">Privé</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label>Type de prix</Label>
                <select className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm" value={priceType} onChange={(e) => setPriceType(e.target.value as "free" | "paid")}>
                  <option value="free">Gratuit</option>
                  <option value="paid">Payant</option>
                </select>
              </div>

              {priceType === "paid" ? (
                <div className="space-y-2">
                  <Label>Prix (XOF)</Label>
                  <Input type="number" min="0" value={priceAmount} onChange={(e) => setPriceAmount(e.target.value)} />
                </div>
              ) : null}

              <div className="space-y-2">
                <Label>Capacité</Label>
                <Input type="number" min="1" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
              </div>
            </div>

            <div className="grid gap-4 border-b border-border/70 pb-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>WhatsApp organisateur</Label>
                <Input value={contactWhatsapp} onChange={(e) => setContactWhatsapp(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label>Email organisateur</Label>
                <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
              </div>
            </div>

            <div className="space-y-4 border-b border-border/70 pb-6">
              <div>
                <Label>Photos de la soirée</Label>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ajoute jusqu’à 2 photos pour montrer l’ambiance et le lieu.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <input
                  id="event-photos"
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(e) => onPickPhotos(e.target.files)}
                />
                <label htmlFor="event-photos">
                  <span className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-foreground">
                    <ImagePlus className="h-4 w-4" />
                    Choisir 2 photos
                  </span>
                </label>
                {(existingImageUrls.length > 0 || photoFiles.length > 0) ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 text-sm text-muted-foreground"
                    onClick={() => {
                      setExistingImageUrls([]);
                      setPhotoFiles([]);
                    }}
                  >
                    <X className="h-4 w-4" />
                    Retirer les photos
                  </button>
                ) : null}
              </div>

              {displayedImages.length ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {displayedImages.map((url, index) => (
                    <img
                      key={`${url}-${index}`}
                      src={url}
                      alt={`Photo évènement ${index + 1}`}
                      className="h-52 w-full rounded-2xl object-cover"
                    />
                  ))}
                </div>
              ) : null}
            </div>

            <div className="space-y-4 border-b border-border/70 pb-6">
              <div>
                <Label>Courte vidéo d’illustration</Label>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ajoute une vidéo courte pour montrer l’ambiance générale de l’évènement.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <input
                  id="event-video"
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={(e) => onPickVideo(e.target.files)}
                />
                <label htmlFor="event-video">
                  <span className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-foreground">
                    <Video className="h-4 w-4" />
                    Choisir une vidéo
                  </span>
                </label>
                {(existingVideoUrl || videoFile) ? (
                  <button
                    type="button"
                    className="inline-flex items-center gap-2 text-sm text-muted-foreground"
                    onClick={() => {
                      setExistingVideoUrl(null);
                      setVideoFile(null);
                    }}
                  >
                    <X className="h-4 w-4" />
                    Retirer la vidéo
                  </button>
                ) : null}
              </div>

              {displayedVideo ? (
                <video
                  src={displayedVideo}
                  controls
                  playsInline
                  className="h-56 w-full rounded-2xl object-cover"
                />
              ) : null}
            </div>

            <div className="grid gap-4 border-b border-border/70 pb-6 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Publication</Label>
                <select className="h-10 w-full rounded-xl border border-border bg-background px-3 text-sm" value={status} onChange={(e) => setStatus(e.target.value as "draft" | "published")}>
                  <option value="published">Publier</option>
                  <option value="draft">Brouillon</option>
                </select>
              </div>
            </div>

            <label className="flex items-start gap-3 text-sm text-muted-foreground">
              <input type="checkbox" className="mt-1" checked={legalNoticeAccepted} onChange={(e) => setLegalNoticeAccepted(e.target.checked)} />
              <span>
                Je confirme que la plateforme ne garantit pas la véracité de l’évènement et qu’aucun remboursement n’est possible après décision de participation.
              </span>
            </label>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" className="rounded-2xl" onClick={() => setLocation("/dashboard")}>
              Annuler
            </Button>
            <Button className="rounded-2xl" disabled={saving} onClick={handleSubmit}>
              {saving ? "Enregistrement..." : editingEvent ? "Mettre à jour" : "Créer l’évènement"}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
