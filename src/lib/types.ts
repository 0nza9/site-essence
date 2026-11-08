import type { Fuel } from "./fuels";

/** un jour de la semaine, nommé comme dans le flux */
export const WEEKDAYS = [
  "Lundi",
  "Mardi",
  "Mercredi",
  "Jeudi",
  "Vendredi",
  "Samedi",
  "Dimanche",
] as const;

export type Weekday = (typeof WEEKDAYS)[number];

export interface Period {
  /** "08:30" */
  opening: string;
  /** "12:00" */
  closing: string;
}

export interface DaySchedule {
  /** la station est ouverte ce jour-là */
  open: boolean;
  /** les plages d'ouverture, vide si c'est ouvert en continu */
  periods: Period[];
  /** ouverte 24h/24 ce jour-là (pas de plage, ou 00:00-23:59) */
  allDay: boolean;
}

export type Schedule = Partial<Record<Weekday, DaySchedule>>;

export type ShortageKind = "temporaire" | "definitive";

export interface Shortage {
  fuel: Fuel;
  kind: ShortageKind;
  /** début de la rupture, si le flux le donne */
  since: string | null;
}

export interface FuelPrice {
  fuel: Fuel;
  /** prix au litre, arrondi au millième */
  price: number;
  /** date du dernier relevé pour ce carburant */
  updatedAt: string | null;
  /** pompe à sec alors qu'un prix est affiché — c'est ça que filtre « masquer les ruptures » */
  shortage: ShortageKind | null;
}

export interface Coordinates {
  lat: number;
  lon: number;
}

export interface Station {
  id: string;
  /** le nom, sinon l'enseigne, sinon l'adresse */
  name: string;
  brand: string | null;
  address: string;
  postalCode: string;
  city: string;
  department: string | null;
  region: string | null;
  /** « highway » quand le flux met `pop: "A"` (autoroute) */
  location: "highway" | "road";
  lat: number;
  lon: number;
  prices: Partial<Record<Fuel, FuelPrice>>;
  shortages: Shortage[];
  services: string[];
  /** true / false, ou null si le flux dit rien */
  automate24h: boolean | null;
  schedule: Schedule | null;
  /** le relevé le plus récent, toutes pompes confondues */
  updatedAt: string | null;
}

export interface StationDataset {
  stations: Station[];
  /** les lignes virées faute d'id ou de coordonnées valables */
  rejected: number;
  /** les prix écartés parce que trop loin de la médiane */
  discardedPrices: number;
  /** la médiane nationale par carburant, pour repérer les aberrations */
  medians: Partial<Record<Fuel, number>>;
  fetchedAt: string;
}
