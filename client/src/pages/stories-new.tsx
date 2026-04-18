import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Coins, Lock, Sparkles, UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import { apiFetch, apiRequest } from "@/lib/queryClient";
import { getProfileId } from "@/lib/session";
import {
  STORY_FREE_STORY_LIMIT,
  STORY_PRIVATE_MAX_SECONDS,
  STORY_PUBLIC_MAX_SECONDS,
  STORY_PUBLISH_TOKEN_COST,
} from "@shared/story-config";

type AccountResponse = {
  email: string | null;
  emailVerified?: boolean;
  tokensBalance?: number;
};

type MyStory = {
  id: string;
  durationSeconds: number;
};

async function readVideoDuration(file: File): Promise<number> {
  const objectUrl = URL.createObjectURL(file);
  try {
    return await new Promise<number>((resolve, reject) => {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => resolve(Math.max(1, Math.ceil(video.duration || 0)));
      video.onerror = () => reject(new Error("Impossible de lire la durée de cette vidéo."));
      video.src = objectUrl;
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export default function StoriesNewPage() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const profileId = getProfileId();
  const [video, setVideo] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [durationSeconds, setDurationSeconds] = useState(0);
  const [caption, setCaption] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);
  const [saleVideo, setSaleVideo] = useState(false);
  const [saleProduct, setSaleProduct] = useState(false);
  const [saleTitle, setSaleTitle] = useState("");
  const [salePrice, setSalePrice] = useState("");
  const [saleDescription, setSaleDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showFreeStoryDialog, setShowFreeStoryDialog] = useState(false);

  const { data: account } = useQuery<AccountResponse>({
    queryKey: ["/api/me/account"],
    enabled: Boolean(profileId),
  });

  const { data: myStories = [] } = useQuery<MyStory[]>({
    queryKey: ["/api/me/stories"],
    enabled: Boolean(profileId),
  });

  useEffect(() => {
    if (!video) {
      setPreviewUrl(null);
      setDurationSeconds(0);
      return;
    }
    const url = URL.createObjectURL(video);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [video]);

  const saleKind = saleProduct ? "product" : saleVideo ? "video" : "none";
  const tokenBalance = Number(account?.tokensBalance ?? 0);
  const isFirstStoryFree = myStories.length < STORY_FREE_STORY_LIMIT;
  const qualifiesForFreeStory =
    isFirstStoryFree &&
    durationSeconds > 0 &&
    durationSeconds <= STORY_PUBLIC_MAX_SECONDS &&
    !isPrivate;
  const canPublish = qualifiesForFreeStory || tokenBalance >= STORY_PUBLISH_TOKEN_COST;

  useEffect(() => {
    if (!profileId) return;
    if (isFirstStoryFree) setShowFreeStoryDialog(true);
  }, [profileId, isFirstStoryFree]);

  const visibilityLabel = useMemo(() => {
    if (durationSeconds > STORY_PUBLIC_MAX_SECONDS) return "Privée obligatoire";
    return isPrivate ? "Vidéo privée" : "Story publique 24h";
  }, [durationSeconds, isPrivate]);

  const uploadToR2 = async (file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("kind", "video");

    const res = await apiFetch("/api/uploads/direct", {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(text || "Échec de l'upload vidéo.");
    }
    return (await res.json()) as { key?: string; publicUrl?: string; viewUrl?: string };
  };

  const onPickVideo = async (file: File | null) => {
    setVideo(file);
    setError(null);
    if (!file) return;
    try {
      const seconds = await readVideoDuration(file);
      setDurationSeconds(seconds);
      if (seconds > STORY_PUBLIC_MAX_SECONDS) {
        setIsPrivate(true);
      }
      if (seconds > STORY_PRIVATE_MAX_SECONDS) {
        setError(`La vidéo dépasse la limite autorisée de ${STORY_PRIVATE_MAX_SECONDS} secondes.`);
      }
    } catch (e: any) {
      setError(e?.message ?? "Impossible de lire cette vidéo.");
    }
  };

  const handleSubmit = async () => {
    if (!profileId) {
      setError("Session introuvable.");
      return;
    }
    if (!video) {
      setError("Ajoute une vidéo pour publier une story.");
      return;
    }
    if (durationSeconds < 1) {
      setError("La durée de la vidéo est invalide.");
      return;
    }
    if (durationSeconds > STORY_PRIVATE_MAX_SECONDS) {
      setError(`La vidéo dépasse ${STORY_PRIVATE_MAX_SECONDS} secondes.`);
      return;
    }
    if (!canPublish) {
      if (isFirstStoryFree && durationSeconds > STORY_PUBLIC_MAX_SECONDS) {
        setError("La première story offerte doit durer 10 secondes maximum.");
      } else if (isFirstStoryFree && isPrivate) {
        setError("La première story offerte doit être publique. Une story privée utilisera des jetons.");
      } else {
        setError("Crédit insuffisant, veuillez recharger vos jetons.");
      }
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const upload = await uploadToR2(video);
      await apiRequest("POST", "/api/me/stories", {
        mediaUrl: upload.publicUrl ?? upload.viewUrl,
        mediaKey: upload.key,
        durationSeconds,
        caption: caption.trim() || undefined,
        visibility: durationSeconds > STORY_PUBLIC_MAX_SECONDS ? "private" : isPrivate ? "private" : "public",
        saleKind,
        saleTitle: saleKind !== "none" ? saleTitle.trim() || undefined : undefined,
        salePrice: saleKind !== "none" ? salePrice.trim() || undefined : undefined,
        saleDescription: saleKind !== "none" ? saleDescription.trim() || undefined : undefined,
      });

      await queryClient.invalidateQueries({ queryKey: ["/api/me/stories"] });
      await queryClient.invalidateQueries({ queryKey: ["/api/stories"] });
      await queryClient.invalidateQueries({ queryKey: [`/api/profiles/${profileId}`] });
      await queryClient.invalidateQueries({ queryKey: ["/api/me/account"] });
      toast({ title: "Publication réussie", description: "La vidéo est maintenant disponible." });
      setLocation("/dashboard");
    } catch (e: any) {
      setError(e?.message ?? "Impossible de publier cette vidéo.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-3">
          <Button variant="outline" size="icon" className="rounded-full" onClick={() => setLocation("/dashboard")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="text-right">
            <div className="text-xs uppercase tracking-[0.22em] text-muted-foreground">Stories</div>
            <div className="text-sm text-foreground">1 à 10 secondes en public, plus long en privé</div>
          </div>
        </div>

        <section className="border-b border-border/70 pb-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-3xl font-semibold tracking-tight text-foreground">Publier une story vidéo</h1>
              <p className="max-w-2xl text-sm leading-7 text-muted-foreground">
                {isFirstStoryFree
                  ? `Ta première story publique jusqu'à ${STORY_PUBLIC_MAX_SECONDS} secondes est offerte. Ensuite, chaque publication consomme ${STORY_PUBLISH_TOKEN_COST} jetons.`
                  : `Chaque publication consomme ${STORY_PUBLISH_TOKEN_COST} jetons. Les vidéos de 1 à ${STORY_PUBLIC_MAX_SECONDS} secondes peuvent être visibles comme une story publique de 24h. Au-delà, elles basculent en vidéo privée, avec option de vente.`}
              </p>
            </div>
            <div className="min-w-[170px] border-l border-border pl-5 text-right">
              <div className="flex items-center justify-end gap-2 text-xs uppercase tracking-[0.22em] text-muted-foreground">
                <Coins className="h-4 w-4" /> Solde
              </div>
              <div className="mt-1 text-2xl font-semibold text-primary">{tokenBalance}</div>
              {isFirstStoryFree ? <div className="mt-2 text-xs text-emerald-600">Première story offerte</div> : null}
            </div>
          </div>
        </section>

        <section className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-8">
            <div className="space-y-2">
              <Label htmlFor="story-video">Vidéo</Label>
              <div className="rounded-[24px] border border-dashed border-border p-6">
                <input
                  id="story-video"
                  type="file"
                  accept="video/*"
                  onChange={(e) => onPickVideo(e.target.files?.[0] ?? null)}
                  className="hidden"
                />
                <label htmlFor="story-video" className="flex cursor-pointer flex-col items-center justify-center gap-3 py-6 text-center">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full border border-border text-foreground">
                    <UploadCloud className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-sm font-medium text-foreground">Choisir une vidéo</div>
                    <div className="text-xs text-muted-foreground">
                      MP4, MOV, WebM... jusqu’à {STORY_PRIVATE_MAX_SECONDS} secondes.
                      {isFirstStoryFree ? ` Première publication offerte si elle reste publique et <= ${STORY_PUBLIC_MAX_SECONDS}s.` : ""}
                    </div>
                  </div>
                </label>
              </div>
            </div>

            {previewUrl ? (
              <div className="overflow-hidden rounded-[24px] border border-border bg-black">
                <video src={previewUrl} controls className="h-[460px] w-full object-cover" />
              </div>
            ) : null}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="border-b border-border pb-4">
                <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Durée détectée</div>
                <div className="mt-2 text-2xl font-semibold text-foreground">{durationSeconds || 0}s</div>
              </div>
              <div className="border-b border-border pb-4">
                <div className="text-[11px] uppercase tracking-[0.22em] text-muted-foreground">Mode appliqué</div>
                <div className="mt-2 text-lg font-semibold text-foreground">{visibilityLabel}</div>
                {qualifiesForFreeStory ? (
                  <div className="mt-1 text-xs text-emerald-600">Cette story sera publiée gratuitement.</div>
                ) : null}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="story-caption">Légende</Label>
              <Textarea
                id="story-caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                rows={4}
                maxLength={280}
                placeholder="Une phrase courte, une offre, une humeur..."
              />
            </div>

            <div className="space-y-4 border-t border-border pt-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-foreground">Basculer en privé</div>
                  <div className="text-xs text-muted-foreground">Pour vendre une vidéo ou un produit. Au-delà de 10 secondes, c’est automatique.</div>
                </div>
                <Switch
                  checked={durationSeconds > STORY_PUBLIC_MAX_SECONDS ? true : isPrivate}
                  disabled={durationSeconds > STORY_PUBLIC_MAX_SECONDS}
                  onCheckedChange={(checked) => setIsPrivate(Boolean(checked))}
                />
              </div>

              {(isPrivate || durationSeconds > STORY_PUBLIC_MAX_SECONDS) && (
                <div className="space-y-5 border-t border-border pt-5">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Button type="button" variant={saleKind === "video" ? "default" : "outline"} onClick={() => {
                      setSaleVideo(true);
                      setSaleProduct(false);
                    }}>
                      Vente de vidéo
                    </Button>
                    <Button type="button" variant={saleKind === "product" ? "default" : "outline"} onClick={() => {
                      setSaleVideo(false);
                      setSaleProduct(true);
                    }}>
                      Vente de produit
                    </Button>
                  </div>
                  <Button type="button" variant={saleKind === "none" ? "secondary" : "ghost"} className="w-full" onClick={() => {
                    setSaleVideo(false);
                    setSaleProduct(false);
                  }}>
                    Pas de vente, vidéo privée simple
                  </Button>

                  {saleKind !== "none" ? (
                    <div className="grid gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="sale-title">Titre de l’offre</Label>
                        <Input id="sale-title" value={saleTitle} onChange={(e) => setSaleTitle(e.target.value)} placeholder="Ex: Full video privée" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sale-price">Prix</Label>
                        <Input id="sale-price" value={salePrice} onChange={(e) => setSalePrice(e.target.value)} placeholder="Ex: 15 000 FCFA" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="sale-description">Description</Label>
                        <Textarea
                          id="sale-description"
                          value={saleDescription}
                          onChange={(e) => setSaleDescription(e.target.value)}
                          rows={4}
                          placeholder="Ce que la personne obtient, conditions, format, etc."
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            {error ? <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</div> : null}

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button className="h-12 flex-1" disabled={loading} onClick={handleSubmit}>
                {loading ? "Publication…" : "Publier maintenant"}
              </Button>
              <Button variant="outline" className="h-12" onClick={() => setLocation("/dashboard")}>Annuler</Button>
            </div>
          </div>

          <aside className="space-y-8 border-l border-border pl-0 lg:pl-8">
            <section className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Sparkles className="h-4 w-4 text-primary" /> Règles de diffusion
              </div>
              <div className="mt-4 space-y-3 text-sm leading-7 text-muted-foreground">
                <p>Story publique: 24h de visibilité, uniquement de 1 à {STORY_PUBLIC_MAX_SECONDS} secondes.</p>
                <p>Vidéo privée: obligatoire au-delà de {STORY_PUBLIC_MAX_SECONDS} secondes, jusqu’à {STORY_PRIVATE_MAX_SECONDS} secondes.</p>
                <p>
                  {isFirstStoryFree
                    ? `La toute première story du profil est offerte si elle ne dépasse pas ${STORY_PUBLIC_MAX_SECONDS} secondes.`
                    : `Chaque publication débite ${STORY_PUBLISH_TOKEN_COST} jetons au moment de l’envoi.`}
                </p>
              </div>
            </section>

            <section className="space-y-4 border-t border-border pt-6">
              <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                <Lock className="h-4 w-4 text-primary" /> Conseil produit
              </div>
              <p className="text-sm leading-7 text-muted-foreground">
                Si la vidéo dépasse 10 secondes, prépare une offre claire: titre, prix, et ce que l’acheteur reçoit. La fiche privée s’affichera ensuite sur ton profil.
              </p>
            </section>

            {!canPublish ? (
              <section className="border-t border-amber-500/20 pt-6">
                <div className="text-sm font-semibold text-foreground">Jetons insuffisants</div>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">
                  {isFirstStoryFree
                    ? `La première story gratuite doit être publique et limitée à ${STORY_PUBLIC_MAX_SECONDS} secondes. Sinon, il te faut au moins ${STORY_PUBLISH_TOKEN_COST} jetons.`
                    : `Il te faut au moins ${STORY_PUBLISH_TOKEN_COST} jetons pour publier. Recharge depuis le dashboard puis reviens ici.`}
                </p>
                <Button className="mt-4 w-full" onClick={() => setLocation("/dashboard")}>Revenir au dashboard</Button>
              </section>
            ) : null}
          </aside>
        </section>
      </main>
      <Dialog open={showFreeStoryDialog} onOpenChange={setShowFreeStoryDialog}>
        <DialogContent className="rounded-[28px]">
          <DialogHeader>
            <DialogTitle>Première story gratuite</DialogTitle>
            <DialogDescription>
              Chaque membre ayant un profil peut publier une première story offerte, limitée à {STORY_PUBLIC_MAX_SECONDS} secondes.
            </DialogDescription>
          </DialogHeader>
          <div className="rounded-2xl bg-muted/40 px-4 py-3 text-sm text-muted-foreground">
            Cette première publication doit rester en story publique. Les stories suivantes, ou toute vidéo privée, fonctionneront avec des jetons.
          </div>
          <DialogFooter>
            <Button onClick={() => setShowFreeStoryDialog(false)}>J&apos;ai compris</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}