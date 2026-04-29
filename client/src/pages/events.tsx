import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, CalendarDays, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { apiRequest } from "@/lib/queryClient";
import { useI18n } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { SeoHead, buildBreadcrumbJsonLd } from "@/components/seo-head";
import eventBgToast from "@assets/Attached_image.png";
import eventBgMask from "@assets/Masque_loup_dentelle_libertine_venitien_sexy_coquin_erotique_venise_deguisement_bal_masquerade_mask_cheapatleast_joel69100-pc.jpg";
import eventBgParty from "@assets/vue-devant-jeune-femme-s-amusant-fete_23-2151108204.jpg.avif";
import eventBgGlam from "@assets/pexels-xeniya-kovaleva-14280792_1024x1024.jpg.webp";

type ApiEvent = {
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
  imageUrl?: string | null;
  imageUrls?: string[] | null;
  videoUrl?: string | null;
  registrationsCount: number;
  spotsLeft?: number | null;
};

export default function EventsPage() {
  const [, setLocation] = useLocation();
  const { lang } = useI18n();
  const { toast } = useToast();
  const eventBackgrounds = [eventBgMask, eventBgParty, eventBgToast, eventBgGlam] as const;
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [rsvpName, setRsvpName] = useState("");
  const [rsvpEmail, setRsvpEmail] = useState("");
  const [rsvpPhone, setRsvpPhone] = useState("");
  const [rsvpWhatsapp, setRsvpWhatsapp] = useState("");
  const [notifyByEmail, setNotifyByEmail] = useState(true);
  const [notifyByWhatsapp, setNotifyByWhatsapp] = useState(false);
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [rsvpDoneMessage, setRsvpDoneMessage] = useState<string | null>(null);
  const [eventInfoAccepted, setEventInfoAccepted] = useState(false);
  const [agreedDisclaimer, setAgreedDisclaimer] = useState(false);
  const [agreedNoRefund, setAgreedNoRefund] = useState(false);

  const { data: events = [], isLoading, error } = useQuery<ApiEvent[]>({
    queryKey: ["/api/events"],
  });

  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? null,
    [events, selectedEventId],
  );

  const eventStructuredData = useMemo(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://www.nixyah.com";
    return [
      buildBreadcrumbJsonLd(
        [
          { name: "Accueil", path: "/start" },
          { name: "Évènements", path: "/events" },
        ],
        origin,
      ),
      ...events.map((event) => ({
        "@context": "https://schema.org",
        "@type": "Event",
        name: event.title,
        startDate: new Date(event.startsAt).toISOString(),
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        eventStatus: "https://schema.org/EventScheduled",
        location: {
          "@type": "Place",
          name: event.city,
          address: {
            "@type": "PostalAddress",
            addressLocality: event.city,
          },
        },
        description: event.description,
        organizer: {
          "@type": "Organization",
          name: "NIXYAH",
          url: `${origin}/events`,
        },
        url: `${origin}/events`,
      })),
    ];
  }, [events]);

  const formatEventDate = (value: string) =>
    new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "fr-FR", {
      weekday: "short",
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));

  const submitRsvp = async () => {
    if (!selectedEvent) return;
    if (!agreedDisclaimer || !agreedNoRefund) {
      toast({
        title: "Consentements requis",
        description: "Tu dois confirmer les mentions légales et la politique de non-remboursement.",
      });
      return;
    }
    setRsvpLoading(true);
    try {
      const res = await apiRequest("POST", `/api/events/${selectedEvent.id}/register`, {
        name: rsvpName,
        email: rsvpEmail,
        phone: rsvpPhone || null,
        whatsapp: rsvpWhatsapp || null,
        notifyByEmail,
        notifyByWhatsapp,
        agreedDisclaimer: true,
        agreedNoRefund: true,
      });
      await res.json();
      setRsvpDoneMessage("Inscription enregistrée. Tu recevras un email de confirmation si tu as activé cette option.");
      toast({
        title: "Inscription confirmée",
        description: "Ta participation a bien été enregistrée.",
      });
    } finally {
      setRsvpLoading(false);
    }
  };

  const resetRegistrationState = () => {
    setEventInfoAccepted(false);
    setRsvpDoneMessage(null);
    setRsvpName("");
    setRsvpEmail("");
    setRsvpPhone("");
    setRsvpWhatsapp("");
    setNotifyByEmail(true);
    setNotifyByWhatsapp(false);
    setAgreedDisclaimer(false);
    setAgreedNoRefund(false);
  };

  return (
    <div className="min-h-screen bg-background">
      <SeoHead
        title="Évènements publiés et lieux privés"
        description="Retrouve les évènements, soirées, anniversaires et rendez-vous organisés publiés sur NIXYAH, avec leurs informations pratiques et conditions d'accès."
        canonicalPath="/events"
        keywords={[
          "évènements privés publiés",
          "soirées et anniversaires",
          "agenda évènements à venir",
          "lieux privés et rendez-vous organisés",
        ]}
        structuredData={eventStructuredData}
      />
      <main className="mx-auto max-w-4xl px-3 pb-10 pt-[calc(env(safe-area-inset-top)+0.9rem)] sm:px-5">
        <div className="space-y-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <Button
                variant="ghost"
                className="-ml-3 mb-2 h-9 rounded-full px-3 text-muted-foreground"
                onClick={() => setLocation("/start")}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                {lang === "en" ? "Back" : "Retour"}
              </Button>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {lang === "en" ? "Upcoming events" : "Événements à venir"}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {lang === "en"
                  ? "Published nights, birthdays and organized gatherings."
                  : "Soirées, anniversaires et rassemblements organisés publiés."}
              </p>
            </div>
            <div className="hidden rounded-full border border-border bg-card/70 px-3 py-1.5 text-xs text-muted-foreground sm:block">
              {events.length} {lang === "en" ? "events" : "évènements"}
            </div>
          </div>

          {isLoading ? (
            <div className="rounded-3xl border border-border/70 bg-card/40 p-4 text-sm text-muted-foreground">
              Chargement des évènements...
            </div>
          ) : error ? (
            <div className="rounded-3xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              {(error as Error).message}
            </div>
          ) : (
            <div className="space-y-3">
              {events.map((event, index) => {
              const bg = eventBackgrounds[index % eventBackgrounds.length];
              return (
                <section
                  key={event.id}
                  className="overflow-hidden rounded-[28px] border border-border/70 bg-card/50"
                >
                  <div className="grid gap-0 md:grid-cols-[220px_minmax(0,1fr)]">
                    <div className="relative h-48 overflow-hidden md:h-full">
                      {event.videoUrl ? (
                        <video
                          src={event.videoUrl}
                          className="absolute inset-0 h-full w-full object-cover"
                          muted
                          playsInline
                          autoPlay
                          loop
                        />
                      ) : (
                        <img
                          src={event.imageUrls?.[0] || event.imageUrl || bg}
                          alt=""
                          aria-hidden="true"
                          loading="lazy"
                          decoding="async"
                          className="absolute inset-0 h-full w-full object-cover"
                          draggable={false}
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                      <div className="absolute left-4 top-4">
                        <span className="rounded-full bg-black/45 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white">
                          {event.visibility === "private" ? "Privé" : "Public"}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-4 px-4 py-4 sm:px-5">
                      <div className="space-y-2">
                        <h2 className="text-lg font-semibold tracking-tight text-foreground">{event.title}</h2>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/40 px-2.5 py-1">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {formatEventDate(event.startsAt)}
                          </span>
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/40 px-2.5 py-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {event.city}
                          </span>
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/40 px-2.5 py-1">
                            {event.priceType === "paid" ? `Payant • ${event.priceAmount ?? 0} ${event.priceCurrency}` : "Gratuit"}
                          </span>
                        </div>
                        <p className="text-sm leading-6 text-muted-foreground">{event.description}</p>
                        <p className="text-xs text-muted-foreground">
                          {event.spotsLeft === null || event.spotsLeft === undefined
                            ? `${event.registrationsCount} inscrit(s)`
                            : `${event.registrationsCount} inscrit(s) • ${event.spotsLeft} place(s) restante(s)`}
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          className="rounded-full"
                          onClick={() => {
                            setSelectedEventId(event.id);
                            setEventDialogOpen(true);
                            resetRegistrationState();
                          }}
                        >
                          Participer
                        </Button>
                        <Button variant="outline" className="rounded-full" onClick={() => setLocation("/start")}>
                          {lang === "en" ? "Back to start" : "Retour au start"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </section>
              );
              })}
              {!events.length ? (
                <div className="rounded-3xl border border-border/70 bg-card/40 p-4 text-sm text-muted-foreground">
                  Aucun évènement publié pour le moment.
                </div>
              ) : null}
            </div>
          )}
        </div>

        <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
          <DialogContent className="rounded-3xl">
            <DialogHeader>
              <DialogTitle>{selectedEvent?.title ?? (lang === "en" ? "Event" : "Évènement")}</DialogTitle>
              <DialogDescription>
                {selectedEvent
                  ? `${formatEventDate(selectedEvent.startsAt)} • ${selectedEvent.city}`
                  : lang === "en"
                    ? "Read before you participate."
                    : "Lis ceci avant de participer."}
              </DialogDescription>
            </DialogHeader>

            {rsvpDoneMessage ? (
              <div className="rounded-2xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                {rsvpDoneMessage}
              </div>
            ) : !eventInfoAccepted ? (
              <div className="space-y-4">
                {selectedEvent?.videoUrl ? (
                  <video
                    src={selectedEvent.videoUrl}
                    controls
                    playsInline
                    className="h-56 w-full rounded-2xl object-cover"
                  />
                ) : null}
                {selectedEvent?.imageUrls?.length ? (
                  <div className={`grid gap-3 ${selectedEvent.imageUrls.length > 1 ? "sm:grid-cols-2" : ""}`}>
                    {selectedEvent.imageUrls.map((url, index) => (
                      <img
                        key={`${url}-${index}`}
                        src={url}
                        alt={`${selectedEvent.title} ${index + 1}`}
                        className="h-48 w-full rounded-2xl object-cover"
                      />
                    ))}
                  </div>
                ) : null}
                <div className="rounded-2xl bg-muted/30 p-4 text-sm leading-6 text-muted-foreground">
                  {selectedEvent?.visibility === "public"
                    ? "Évènement public: toute personne peut s’enregistrer. La mention gratuit ou payant est informative et le règlement se fait en dehors de la plateforme."
                    : "Évènement privé: l’accès dépend de l’inscription validée par l’organisateur. La mention gratuit ou payant est informative uniquement."}
                </div>
                <Button className="w-full rounded-2xl" onClick={() => setEventInfoAccepted(true)}>
                  {lang === "en" ? "Continue" : "Continuer"}
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{lang === "en" ? "Name" : "Nom"}</Label>
                  <Input value={rsvpName} onChange={(e) => setRsvpName(e.target.value)} placeholder={lang === "en" ? "Your name" : "Ton nom"} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Email</Label>
                  <Input value={rsvpEmail} type="email" onChange={(e) => setRsvpEmail(e.target.value)} placeholder="email@exemple.com" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Téléphone</Label>
                  <Input value={rsvpPhone} onChange={(e) => setRsvpPhone(e.target.value)} placeholder="+225 ..." />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">WhatsApp</Label>
                  <Input value={rsvpWhatsapp} onChange={(e) => setRsvpWhatsapp(e.target.value)} placeholder="+225 ..." />
                </div>
                <div className="rounded-2xl border border-border/70 bg-muted/20 p-3 text-sm text-muted-foreground">
                  <div className="flex items-center justify-between gap-4">
                    <span>Recevoir les confirmations par email</span>
                    <Switch checked={notifyByEmail} onCheckedChange={setNotifyByEmail} />
                  </div>
                  <div className="mt-3 flex items-center justify-between gap-4">
                    <span>Recevoir les infos par WhatsApp</span>
                    <Switch checked={notifyByWhatsapp} onCheckedChange={setNotifyByWhatsapp} />
                  </div>
                </div>
                <label className="flex items-start gap-3 rounded-2xl border border-border/70 bg-muted/20 p-3 text-sm text-muted-foreground">
                  <input type="checkbox" className="mt-1" checked={agreedDisclaimer} onChange={(e) => setAgreedDisclaimer(e.target.checked)} />
                  <span>La plateforme ne garantit pas la véracité de l’évènement. Merci de te renseigner avant toute action.</span>
                </label>
                <label className="flex items-start gap-3 rounded-2xl border border-border/70 bg-muted/20 p-3 text-sm text-muted-foreground">
                  <input type="checkbox" className="mt-1" checked={agreedNoRefund} onChange={(e) => setAgreedNoRefund(e.target.checked)} />
                  <span>Aucun remboursement n’est possible si tu décides d’y participer.</span>
                </label>
                <Button
                  className="w-full rounded-2xl"
                  disabled={rsvpLoading || !rsvpName.trim() || !rsvpEmail.trim() || !selectedEvent}
                  onClick={submitRsvp}
                >
                  {rsvpLoading
                    ? "Envoi..."
                    : "Confirmer la participation"}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
