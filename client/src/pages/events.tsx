import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, CalendarDays, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest } from "@/lib/queryClient";
import { useI18n } from "@/lib/i18n";
import { upcomingEvents } from "@/lib/upcoming-events";
import { SeoHead, buildBreadcrumbJsonLd } from "@/components/seo-head";
import eventBgToast from "@assets/Attached_image.png";
import eventBgMask from "@assets/Masque_loup_dentelle_libertine_venitien_sexy_coquin_erotique_venise_deguisement_bal_masquerade_mask_cheapatleast_joel69100-pc.jpg";
import eventBgParty from "@assets/vue-devant-jeune-femme-s-amusant-fete_23-2151108204.jpg.avif";
import eventBgGlam from "@assets/pexels-xeniya-kovaleva-14280792_1024x1024.jpg.webp";

export default function EventsPage() {
  const [, setLocation] = useLocation();
  const { lang } = useI18n();
  const eventBackgrounds = [eventBgMask, eventBgParty, eventBgToast, eventBgGlam] as const;
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [rsvpName, setRsvpName] = useState("");
  const [rsvpContact, setRsvpContact] = useState("");
  const [rsvpMessage, setRsvpMessage] = useState("");
  const [rsvpLoading, setRsvpLoading] = useState(false);
  const [rsvpDone, setRsvpDone] = useState(false);
  const [eventInfoAccepted, setEventInfoAccepted] = useState(false);

  const selectedEvent = useMemo(
    () => upcomingEvents.find((event) => event.id === selectedEventId) ?? null,
    [selectedEventId],
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
      ...upcomingEvents.map((event) => ({
        "@context": "https://schema.org",
        "@type": "Event",
        name: event.title,
        startDate: new Date(event.date).toISOString(),
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
  }, []);

  const formatEventDate = (value: string) =>
    new Intl.DateTimeFormat(lang === "en" ? "en-GB" : "fr-FR", {
      weekday: "short",
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(new Date(value));

  const submitRsvp = async () => {
    if (!selectedEvent) return;
    setRsvpLoading(true);
    try {
      await apiRequest("POST", "/api/event-rsvp", {
        eventId: selectedEvent.id,
        eventTitle: selectedEvent.title,
        eventDate: formatEventDate(selectedEvent.date),
        name: rsvpName,
        contact: rsvpContact,
        message: rsvpMessage,
      });
      setRsvpDone(true);
    } finally {
      setRsvpLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SeoHead
        title="Évènements privés et soirées premium"
        description="Retrouve les évènements privés, soirées premium et rencontres sélectionnées proposés sur NIXYAH."
        canonicalPath="/events"
        keywords={[
          "évènements privés adultes",
          "soirées premium francophones",
          "agenda évènements privés",
          "rencontres sélectionnées",
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
                  ? "Private nights, meetings and curated experiences."
                  : "Soirées privées, rencontres et expériences sélectionnées."}
              </p>
            </div>
            <div className="hidden rounded-full border border-border bg-card/70 px-3 py-1.5 text-xs text-muted-foreground sm:block">
              {upcomingEvents.length} {lang === "en" ? "events" : "évènements"}
            </div>
          </div>

          <div className="space-y-3">
            {upcomingEvents.map((event, index) => {
              const bg = eventBackgrounds[index % eventBackgrounds.length];
              return (
                <section
                  key={event.id}
                  className="overflow-hidden rounded-[28px] border border-border/70 bg-card/50"
                >
                  <div className="grid gap-0 md:grid-cols-[220px_minmax(0,1fr)]">
                    <div className="relative h-48 overflow-hidden md:h-full">
                      <img
                        src={bg}
                        alt=""
                        aria-hidden="true"
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 h-full w-full object-cover"
                        draggable={false}
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                      <div className="absolute left-4 top-4">
                        <span className="rounded-full bg-black/45 px-3 py-1 text-[10px] uppercase tracking-[0.18em] text-white">
                          {event.tag}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-4 px-4 py-4 sm:px-5">
                      <div className="space-y-2">
                        <h2 className="text-lg font-semibold tracking-tight text-foreground">{event.title}</h2>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/40 px-2.5 py-1">
                            <CalendarDays className="h-3.5 w-3.5" />
                            {formatEventDate(event.date)}
                          </span>
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-muted/40 px-2.5 py-1">
                            <MapPin className="h-3.5 w-3.5" />
                            {event.city}
                          </span>
                        </div>
                        <p className="text-sm leading-6 text-muted-foreground">{event.description}</p>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          className="rounded-full"
                          onClick={() => {
                            setSelectedEventId(event.id);
                            setEventDialogOpen(true);
                            setEventInfoAccepted(false);
                            setRsvpDone(false);
                            setRsvpName("");
                            setRsvpContact("");
                            setRsvpMessage("");
                          }}
                        >
                          {lang === "en" ? "Participate" : "Participer"}
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
          </div>
        </div>

        <Dialog open={eventDialogOpen} onOpenChange={setEventDialogOpen}>
          <DialogContent className="rounded-3xl">
            <DialogHeader>
              <DialogTitle>{selectedEvent?.title ?? (lang === "en" ? "Event" : "Évènement")}</DialogTitle>
              <DialogDescription>
                {selectedEvent
                  ? `${formatEventDate(selectedEvent.date)} • ${selectedEvent.city}`
                  : lang === "en"
                    ? "Read before you participate."
                    : "Lis ceci avant de participer."}
              </DialogDescription>
            </DialogHeader>

            {rsvpDone ? (
              <div className="rounded-2xl border border-border bg-muted/30 p-4 text-sm text-muted-foreground">
                {lang === "en"
                  ? "Your request is recorded. We’ll contact you before the event date."
                  : "Ta demande est enregistrée. On te contactera avant la date de l’évènement."}
              </div>
            ) : !eventInfoAccepted ? (
              <div className="space-y-4">
                <div className="rounded-2xl bg-muted/30 p-4 text-sm leading-6 text-muted-foreground">
                  {lang === "en"
                    ? "Some events are free and others are paid. Please make sure to get informed before any participation."
                    : "Certains évènements sont gratuits et d'autres payants. Merci de bien vous informer avant toute participation."}
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
                  <Label className="text-xs text-muted-foreground">{lang === "en" ? "Contact (phone or email)" : "Contact (téléphone ou email)"}</Label>
                  <Input value={rsvpContact} onChange={(e) => setRsvpContact(e.target.value)} placeholder={lang === "en" ? "Phone / Email" : "Téléphone / Email"} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{lang === "en" ? "Message (optional)" : "Message (optionnel)"}</Label>
                  <Textarea value={rsvpMessage} onChange={(e) => setRsvpMessage(e.target.value)} placeholder={lang === "en" ? "Notes…" : "Notes…"} className="rounded-2xl" />
                </div>
                <Button
                  className="w-full rounded-2xl"
                  disabled={rsvpLoading || !rsvpName.trim() || !rsvpContact.trim() || !selectedEvent}
                  onClick={submitRsvp}
                >
                  {rsvpLoading ? (lang === "en" ? "Sending…" : "Envoi…") : (lang === "en" ? "Confirm participation" : "Confirmer la participation")}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
