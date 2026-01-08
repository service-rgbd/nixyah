export interface Profile {
  id: string;
  pseudo: string;
  age: number;
  ville: string;
  verified: boolean;
  photoUrl: string;
  photos: string[];
  videoUrl?: string;
  disponibilite: {
    date: string;
    heureDebut: string;
    duree: string;
  };
  services: string[];
  lieu: string;
  tarif: string;
  description?: string;
}

export const mockProfiles: Profile[] = [
  {
    id: "1",
    pseudo: "Amara",
    age: 26,
    ville: "Paris",
    verified: true,
    photoUrl: "/attached_assets/c57a31df-9f73-42e9-bfe8-8181654b6932_1767904353125.png",
    photos: [
      "/attached_assets/c57a31df-9f73-42e9-bfe8-8181654b6932_1767904353125.png",
    ],
    disponibilite: {
      date: "Aujourd'hui",
      heureDebut: "18:00",
      duree: "2h",
    },
    services: ["Massage", "Accompagnement"],
    lieu: "Hôtel",
    tarif: "200€",
    description: "Femme élégante et raffinée, disponible pour des rencontres de qualité.",
  },
  {
    id: "2",
    pseudo: "Naomi",
    age: 24,
    ville: "Lyon",
    verified: true,
    photoUrl: "/attached_assets/1e504b33-1c82-480a-b5ee-310fc690a3e2_1767904894440.png",
    photos: [
      "/attached_assets/1e504b33-1c82-480a-b5ee-310fc690a3e2_1767904894440.png",
    ],
    disponibilite: {
      date: "Demain",
      heureDebut: "14:00",
      duree: "3h",
    },
    services: ["Dating", "Accompagnement"],
    lieu: "Résidence",
    tarif: "250€",
    description: "Douce et attentionnée, je sais créer une atmosphère unique.",
  },
  {
    id: "3",
    pseudo: "Sasha",
    age: 28,
    ville: "Marseille",
    verified: false,
    photoUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&h=1200&fit=crop",
    photos: [],
    disponibilite: {
      date: "Ce week-end",
      heureDebut: "20:00",
      duree: "4h",
    },
    services: ["Massage", "Dating"],
    lieu: "À définir",
    tarif: "180€",
  },
  {
    id: "4",
    pseudo: "Luna",
    age: 25,
    ville: "Bordeaux",
    verified: true,
    photoUrl: "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&h=1200&fit=crop",
    photos: [],
    disponibilite: {
      date: "Aujourd'hui",
      heureDebut: "21:00",
      duree: "2h",
    },
    services: ["Accompagnement"],
    lieu: "Hôtel",
    tarif: "220€",
    description: "Compagnie agréable pour soirées et événements.",
  },
];

export const serviceOptions = [
  "Massage",
  "Dating",
  "Accompagnement",
  "Autres",
];

export const lieuOptions = [
  "Hôtel",
  "Résidence",
  "Lieu privé",
  "À définir",
];