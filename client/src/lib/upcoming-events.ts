export type UpcomingEvent = {
  id: string;
  title: string;
  date: string;
  city: string;
  tag: string;
  description: string;
};

export const upcomingEvents: UpcomingEvent[] = [
  {
    id: "masked-velvet-night",
    title: "Soirée Masquée — Velvet Night",
    date: "2026-01-18T20:00:00",
    city: "Abidjan",
    tag: "Club privé",
    description: "Masques, élégance, accès sur invitation. Places limitées.",
  },
  {
    id: "z-party-jan",
    title: "Rencontre Z‑Party — Édition Janvier",
    date: "2026-01-31T21:00:00",
    city: "Abidjan",
    tag: "Z‑Party",
    description: "Rencontres + ambiance premium. Confirmation avant l’accès.",
  },
  {
    id: "private-villa-march",
    title: "Soirée Privée — Villa Sessions",
    date: "2026-03-07T20:30:00",
    city: "Bonapriso",
    tag: "Privé",
    description: "Villa, sécurité, dress code. Respect & discrétion.",
  },
  {
    id: "masked-march",
    title: "Soirée Masquée — Midnight Rendez‑vous",
    date: "2026-03-14T21:00:00",
    city: "Cocody",
    tag: "Masquée",
    description: "Évènement à venir. Inscription pour recevoir l’accès.",
  },
  {
    id: "club-march",
    title: "Club Privé — After Hours",
    date: "2026-03-28T22:00:00",
    city: "Abidjan",
    tag: "After",
    description: "Évènement à venir. Places limitées, validation manuelle.",
  },
];
