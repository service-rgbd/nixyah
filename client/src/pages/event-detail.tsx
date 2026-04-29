import { useMemo, useState } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  Mail,
  MapPin,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { PhotoSwipe } from "@/components/photo-swipe";
import { SeoHead, buildBreadcrumbJsonLd } from "@/components/seo-head";
import { apiRequest } from "@/lib/queryClient";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import eventBgParty from "@assets/vue-devant-jeune-femme-s-amusant-fete_23-2151108204.jpg.avif";

type EventDetail = {
  id: string;
  ownerProfileId: string;
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
  registrationsCount: number;
  spotsLeft?: number | null;
  organizer?: {
    profileId: string;
    pseudo: string;
    accountType?: string | null;
    photoUrl?: string | null;
  } | null;
};

function formatWhatsappHref(value: string) {
  const digits = value.replace(/[^\d+]/g, "");
  return `https://wa.me/${digits.replace(/^\+/, "")}`;
}

export default function EventDetailPage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { lang } = useI18n();
  const { toast } = useToast();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [notifyByEmail, setNotifyByEmail] = useState(true);
  const [notifyByWhatsapp, setNotifyByWhatsapp] = useState(false);
  const [agreedDisclaimer, setAgreedDisclaimer] = useState(false);
  const [agreedNoRefund, setAgreedNoRefund] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const { data: event, isLoading, error } = useQuery<EventDetail>({
    queryKey: [`/api/events/${params.id}`],
    enabled: Boolean(params.id),
  });

  const formattedDate = useMemo(() => {
    if (!event?.startsAt) return "";
    return new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "fr-FR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(event.startsAt));
  }, [event?.startsAt, lang]);

  const formattedEndDate = useMemo(() => {
    if (!event?.endsAt) return null;
    return new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "fr-FR", {
      day: "2-digit",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(event.endsAt));
  }, [event?.endsAt, lang]);

  const seoStructuredData = useMemo(() => {
    if (!event) return null;
    const origin = typeof window !== "undefined" ? window.location.origin : "https://www.nixyah.com";
    return [
      buildBreadcrumbJsonLd(
        [
          { name: "Accueil", path: "/start" },
          { name: "Évènements", path: "/events" },
          { name: event.title, path: `/events/${event.id}` },
        ],
        origin,
      ),
      {
        "@context": "https://schema.org",
        "@type": "Event",
        name: event.title,
        description: event.description || undefined,
        image: event.imageUrls?.length ? event.imageUrls : event.imageUrl ? [event.imageUrl] : undefined,
        startDate: new Date(event.startsAt).toISOString(),
        endDate: event.endsAt ? new Date(event.endsAt).toISOString() : undefined,
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        eventStatus: "https://schema.org/EventScheduled",
        location: {
          "@type": "Place",
          name: event.venue || event.city,
          address: {
            "@type": "PostalAddress",
            addressLocality: event.city,
          },
        },
        organizer: {
          "@type": "Organization",
          name: event.organizer?.pseudo || "NIXYAH",
        },
        url: `${origin}/events/${event.id}`,
      },
    ];
  }, [event]);

  async function submitRegistration() {
    if (!event) return;
    if (!fullName.trim() || !email.trim()) {
      toast({
        title: "Informations incomplètes",
        description: "Merci de renseigner au minimum ton nom et ton email.",
      });
      return;
    }
    if (!agreedDisclaimer || !agreedNoRefund) {
      toast({
        title: "Consentements requis",
        description: "Merci de confirmer les mentions d'information avant de poursuivre.",
      });
      return;
    }

    setSubmitting(true);
    try {
      const res = await apiRequest("POST", `/api/events/${event.id}/register`, {
        name: fullName,
        email,
        phone: phone || null,
        whatsapp: whatsapp || null,
        notifyByEmail,
        notifyByWhatsapp,
        agreedDisclaimer: true,
        agreedNoRefund: true,
      });
      await res.json();
      setConfirmed(true);
      toast({
        title: "Inscription enregistrée",
        description: "Ta participation a bien été envoyée à l'organisateur.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background px-4 py-16">
        <div className="mx-auto max-w-5xl text-sm text-muted-foreground">Chargement de l'évènement...</div>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="min-h-screen bg-background px-4 py-16">
        <div className="mx-auto flex max-w-3xl flex-col items-start gap-4">
          <Button variant="ghost" className="-ml-3 px-3 text-muted-foreground" onClick={() => setLocation("/events")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour aux évènements
          </Button>
          <div className="px-1 py-2 text-sm text-destructive">
            {(error as Error | undefined)?.message ?? "Évènement introuvable"}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <SeoHead
        title={`${event.title} | Évènement à venir`}
        description={event.description || `Découvre ${event.title}, un évènement publié à ${event.city}.`}
        canonicalPath={`/events/${event.id}`}
        keywords={[
          event.title,
          `évènement ${event.city}`,
          "soirée organisée",
          "grand aperçu évènement",
        ]}
        type="article"
        structuredData={seoStructuredData}
      />

      <main className="mx-auto max-w-6xl px-3 pb-12 pt-[calc(env(safe-area-inset-top)+0.9rem)] sm:px-5">
        <div className="space-y-10">
          <Button variant="ghost" className="-ml-3 px-3 text-muted-foreground" onClick={() => setLocation("/events")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {lang === "en" ? "Back to events" : "Retour aux évènements"}
          </Button>

          <section>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,40%)_minmax(0,60%)] lg:items-start">
              <div className="relative min-h-[360px] overflow-hidden rounded-[28px] bg-muted/20 sm:min-h-[420px]">
                {event.videoUrl ? (
                  <video
                    src={event.videoUrl}
                    controls
                    playsInline
                    poster={event.imageUrls?.[0] || event.imageUrl || eventBgParty}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <PhotoSwipe
                    urls={event.imageUrls ?? [event.imageUrl]}
                    alt={event.title}
                    fallbackUrl={eventBgParty}
                    imgClassName="h-full w-full object-cover"
                    wrapperClassName="h-full"
                    showArrows
                  />
                )}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                <div className="absolute left-4 top-4 flex flex-wrap gap-2">
                  <span className="rounded-full bg-black/55 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white">
                    {event.visibility === "private" ? "Privé" : "Public"}
                  </span>
                  <span className="rounded-full bg-black/55 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white">
                    {event.priceType === "paid"
                      ? `Payant${event.priceAmount ? ` • ${event.priceAmount} ${event.priceCurrency}` : ""}`
                      : "Gratuit"}
                  </span>
                </div>
              </div>

              <div className="flex flex-col justify-between gap-6 py-2 sm:py-3">
                <div className="space-y-4">
                  <div className="space-y-3">
                    <div className="inline-flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.18em] text-primary">
                      <Sparkles className="h-3.5 w-3.5" />
                      {lang === "en" ? "Selected event" : "Évènement sélectionné"}
                    </div>
                    <div className="flex items-end justify-between gap-4">
                      <h1 className="min-w-0 flex-1 text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
                        {event.title}
                      </h1>
                      <Button
                        variant="ghost"
                        className="h-auto shrink-0 rounded-none px-0 py-0 text-right"
                        onClick={() => document.getElementById("event-registration")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                      >
                        {lang === "en" ? "Join" : "S'inscrire"}
                      </Button>
                    </div>
                    <div>
                      <p className="mt-3 text-sm leading-6 text-muted-foreground">
                        {event.description || "Découvre tous les détails de cet évènement et inscris-toi si l'ambiance te correspond."}
                      </p>
                    </div>
                  </div>

                  <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
                    <div className="border-b border-border/50 pb-3">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                        <CalendarDays className="h-4 w-4" />
                        Date
                      </div>
                      <div className="mt-2 text-sm font-medium text-foreground">{formattedDate}</div>
                      {formattedEndDate ? (
                        <div className="mt-1 text-xs text-muted-foreground">Fin estimée: {formattedEndDate}</div>
                      ) : null}
                    </div>

                    <div className="border-b border-border/50 pb-3">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                        <MapPin className="h-4 w-4" />
                        Lieu
                      </div>
                      <div className="mt-2 text-sm font-medium text-foreground">{event.city}</div>
                      {event.venue ? (
                        <div className="mt-1 text-xs text-muted-foreground">{event.venue}</div>
                      ) : null}
                    </div>

                    <div className="border-b border-border/50 pb-3">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                        <Users className="h-4 w-4" />
                        Participation
                      </div>
                      <div className="mt-2 text-sm font-medium text-foreground">
                        {event.spotsLeft === null || event.spotsLeft === undefined
                          ? `${event.registrationsCount} inscrit(s)`
                          : `${event.spotsLeft} place(s) restante(s)`}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {event.registrationsCount} personne(s) déjà enregistrée(s)
                      </div>
                    </div>

                    <div className="border-b border-border/50 pb-3">
                      <div className="flex items-center gap-2 text-xs uppercase tracking-[0.14em] text-muted-foreground">
                        <Clock3 className="h-4 w-4" />
                        Accès
                      </div>
                      <div className="mt-2 text-sm font-medium text-foreground">
                        {event.visibility === "private" ? "Validation par l'organisateur" : "Ouvert aux inscriptions"}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {event.priceType === "paid"
                          ? "Le règlement éventuel se fait en dehors de la plateforme."
                          : "Aucun paiement n'est encaissé sur la plateforme."}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap gap-4">
                  <Button
                    variant="ghost"
                    className="h-auto rounded-none px-0 py-0 text-left"
                    onClick={() => {
                      if (event.organizer?.profileId) {
                        setLocation(`/profile/${event.organizer.profileId}`);
                        return;
                      }
                      setLocation("/events");
                    }}
                  >
                    {lang === "en" ? "View organizer" : "Voir l'organisateur"}
                  </Button>
                </div>
              </div>
            </div>
          </section>

          <section className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-4">
              {event.imageUrls && event.imageUrls.length > 1 ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  {event.imageUrls.slice(0, 2).map((url, index) => (
                    <img
                      key={`${url}-${index}`}
                      src={url}
                      alt={`${event.title} visuel ${index + 1}`}
                      className="h-64 w-full object-cover"
                      loading="lazy"
                      decoding="async"
                      onError={(e) => {
                        const img = e.currentTarget;
                        img.onerror = null;
                        img.src = eventBgParty;
                      }}
                    />
                  ))}
                </div>
              ) : null}

              <div className="px-1 py-1">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">À savoir</div>
                <div className="mt-3 space-y-3 text-sm leading-7 text-muted-foreground">
                  <p>
                    Cet aperçu présente l'ambiance, les informations pratiques et les conditions d'accès transmises par
                    l'organisateur. Vérifie toujours les détails avant de te déplacer.
                  </p>
                  <p>
                    La plateforme référence l'évènement et centralise les inscriptions, mais ne garantit ni le contenu,
                    ni l'exécution, ni l'expérience finale sur place.
                  </p>
                </div>
              </div>
            </div>

            <aside className="space-y-4">
              <div className="border-t border-border/50 pt-5">
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Organisateur</div>
                <div className="mt-4 flex items-center gap-3">
                  <img
                    src={event.organizer?.photoUrl || eventBgParty}
                    alt={event.organizer?.pseudo || "Organisateur"}
                    className="h-14 w-14 object-cover"
                    onError={(e) => {
                      const img = e.currentTarget;
                      img.onerror = null;
                      img.src = eventBgParty;
                    }}
                  />
                  <div className="min-w-0">
                    <div className="text-base font-semibold text-foreground">
                      {event.organizer?.pseudo || "Organisateur"}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {event.organizer?.accountType || "Profil"}
                    </div>
                  </div>
                </div>
              </div>

              {(event.contactEmail || event.contactWhatsapp) ? (
                <div className="border-t border-border/50 pt-5">
                  <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Contacts utiles</div>
                  <div className="mt-4 space-y-3 text-sm">
                    {event.contactEmail ? (
                      <a
                        href={`mailto:${event.contactEmail}`}
                        className="flex items-center gap-3 text-foreground transition-opacity hover:opacity-80"
                      >
                        <Mail className="h-4 w-4 text-muted-foreground" />
                        <span className="truncate">{event.contactEmail}</span>
                      </a>
                    ) : null}
                    {event.contactWhatsapp ? (
                      <a
                        href={formatWhatsappHref(event.contactWhatsapp)}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-3 text-foreground transition-opacity hover:opacity-80"
                      >
                        <MessageCircle className="h-4 w-4 text-muted-foreground" />
                        <span>{event.contactWhatsapp}</span>
                      </a>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="border-t border-border/50 pt-5">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="mt-0.5 h-5 w-5 text-primary" />
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="font-medium text-foreground">Information importante</div>
                    <p>Les mentions gratuit/payant sont indicatives. Aucun remboursement n'est géré par la plateforme.</p>
                    <p>Prends tes propres précautions avant toute participation ou tout déplacement.</p>
                  </div>
                </div>
              </div>
            </aside>
          </section>

          <section id="event-registration" className="border-t border-border/60 pt-8">
            <div className="max-w-3xl space-y-5">
              <div>
                <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Participation</div>
                <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                  {lang === "en" ? "Register for this event" : "S'inscrire à cet évènement"}
                </h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  Renseigne tes coordonnées pour transmettre ta demande à l'organisateur. Tu recevras un retour selon les
                  options de contact choisies.
                </p>
              </div>

              {confirmed ? (
                <div className="py-2 text-sm text-foreground">
                  Ta demande a bien été enregistrée. L'organisateur pourra te recontacter avec les détails pratiques.
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label>Nom</Label>
                      <Input className="rounded-none border-x-0 border-t-0 px-0 shadow-none focus-visible:ring-0" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Ton nom" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Email</Label>
                      <Input className="rounded-none border-x-0 border-t-0 px-0 shadow-none focus-visible:ring-0" value={email} type="email" onChange={(e) => setEmail(e.target.value)} placeholder="email@exemple.com" />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Téléphone</Label>
                      <Input className="rounded-none border-x-0 border-t-0 px-0 shadow-none focus-visible:ring-0" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+225 ..." />
                    </div>
                    <div className="space-y-1.5">
                      <Label>WhatsApp</Label>
                      <Input className="rounded-none border-x-0 border-t-0 px-0 shadow-none focus-visible:ring-0" value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+225 ..." />
                    </div>
                  </div>

                  <div className="border-t border-border/50 py-4 text-sm text-muted-foreground">
                    <div className="flex items-center justify-between gap-4">
                      <span>Recevoir les confirmations par email</span>
                      <Switch checked={notifyByEmail} onCheckedChange={setNotifyByEmail} />
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-4">
                      <span>Recevoir les informations via WhatsApp</span>
                      <Switch checked={notifyByWhatsapp} onCheckedChange={setNotifyByWhatsapp} />
                    </div>
                  </div>

                  <label className="flex items-start gap-3 border-t border-border/50 py-4 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={agreedDisclaimer}
                      onChange={(e) => setAgreedDisclaimer(e.target.checked)}
                    />
                    <span>Je comprends que la plateforme ne garantit pas la véracité ni le déroulement effectif de l'évènement.</span>
                  </label>

                  <label className="flex items-start gap-3 border-t border-border/50 py-4 text-sm text-muted-foreground">
                    <input
                      type="checkbox"
                      className="mt-1"
                      checked={agreedNoRefund}
                      onChange={(e) => setAgreedNoRefund(e.target.checked)}
                    />
                    <span>Je comprends qu'aucun remboursement n'est pris en charge par la plateforme.</span>
                  </label>

                  <Button variant="ghost" className="h-auto rounded-none px-0 py-0 text-left" disabled={submitting} onClick={submitRegistration}>
                    {submitting ? "Envoi..." : "Envoyer ma demande de participation"}
                  </Button>
                </div>
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
