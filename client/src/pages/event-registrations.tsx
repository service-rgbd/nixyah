import { useState } from "react";
import { useLocation, useParams } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

type Attendee = {
  id: string;
  guestName: string;
  guestEmail: string;
  guestPhone?: string | null;
  guestWhatsapp?: string | null;
  createdAt: string;
};

type EventRegistrationsResponse = {
  event: { id: string; title: string };
  attendees: Attendee[];
};

export default function EventRegistrationsPage() {
  const params = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [sendingReminder, setSendingReminder] = useState(false);

  const { data, isLoading, error } = useQuery<EventRegistrationsResponse>({
    queryKey: [`/api/me/events/${params.id}/registrations`],
  });

  const handleSendReminders = async () => {
    setSendingReminder(true);
    try {
      const res = await apiRequest("POST", `/api/me/events/${params.id}/send-reminders`);
      const json = (await res.json()) as { sent?: number };
      await queryClient.invalidateQueries({ queryKey: [`/api/me/events/${params.id}/registrations`] });
      toast({
        title: "Rappels envoyés",
        description: `${json.sent ?? 0} email(s) envoyés.`,
      });
    } catch (e: any) {
      toast({ title: "Erreur", description: e?.message ?? "Impossible d’envoyer les rappels." });
    } finally {
      setSendingReminder(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <main className="mx-auto max-w-4xl px-4 pb-12 pt-[calc(env(safe-area-inset-top)+1rem)]">
        <div className="space-y-5">
          <Button variant="ghost" className="-ml-3 rounded-full px-3 text-muted-foreground" onClick={() => setLocation("/dashboard")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Retour
          </Button>

          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {data?.event.title ?? "Participants"}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Liste des inscrits avec email, téléphone et WhatsApp.
              </p>
            </div>
            <Button className="rounded-2xl" disabled={sendingReminder || !data?.attendees.length} onClick={handleSendReminders}>
              <BellRing className="mr-2 h-4 w-4" />
              {sendingReminder ? "Envoi..." : "Envoyer les rappels"}
            </Button>
          </div>

          {isLoading ? (
            <div className="rounded-3xl border border-border/70 bg-card/40 p-4 text-sm text-muted-foreground">
              Chargement des inscrits...
            </div>
          ) : error ? (
            <div className="rounded-3xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
              {(error as Error).message}
            </div>
          ) : !data?.attendees.length ? (
            <div className="rounded-3xl border border-border/70 bg-card/40 p-4 text-sm text-muted-foreground">
              Aucun inscrit pour le moment.
            </div>
          ) : (
            <div className="space-y-3">
              {data.attendees.map((attendee) => (
                <section key={attendee.id} className="rounded-3xl border border-border/70 bg-card/40 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold text-foreground">{attendee.guestName}</div>
                      <div className="mt-1 text-sm text-muted-foreground">{attendee.guestEmail}</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        Téléphone: {attendee.guestPhone || "—"} • WhatsApp: {attendee.guestWhatsapp || "—"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs text-muted-foreground">
                        Inscrit le {new Date(attendee.createdAt).toLocaleString("fr-FR")}
                      </div>
                    </div>
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
