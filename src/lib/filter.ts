import type { Fuel } from "./fuels";
import { daysSince } from "./format";
import { distanceKm } from "./geo";
import { openStateAt } from "./schedule";
import type { Coordinates, Station } from "./types";

/** « all » = pas de carburant choisi, on montre tout */
export type FuelSelection = Fuel | "all";

export type SortKey = "price" | "distance" | "freshness";

export interface Filters {
  fuel: FuelSelection;
  /** Ville, code postal ou enseigne. */
  query: string;
  hideShortages: boolean;
  excludeHighways: boolean;
  /** que les relevés de moins de 7 jours */
  recentOnly: boolean;
  /** que les stations ouvertes là, maintenant */
  openNow: boolean;
  /** rayon de recherche en km autour du point de départ */
  radiusKm: number;
  sort: SortKey;
}

export const DEFAULT_FILTERS: Filters = {
  fuel: "gazole",
  query: "",
  hideShortages: true,
  excludeHighways: false,
  recentOnly: true,
  openNow: false,
  radiusKm: 25,
  sort: "price",
};

export const RADIUS_STEPS = [5, 10, 25, 50, 100] as const;

/** Une station retenue, avec ce que le tri a calculé au passage. */
export interface Ranked {
  station: Station;
  /** prix du carburant choisi, null si fuel vaut « all » */
  price: number | null;
  /** distance au point de départ, null s'il y en a pas */
  distance: number | null;
  /** âge du relevé, en jours */
  age: number;
}

const FRESHNESS_LIMIT_DAYS = 7;

function matchesQuery(station: Station, needle: string): boolean {
  if (needle === "") return true;
  const haystack = [
    station.name,
    station.brand,
    station.city,
    station.postalCode,
    station.address,
    station.department,
  ];
  return haystack.some((field) => field?.toLowerCase().includes(needle));
}

/** On filtre, on calcule prix / distance / fraîcheur, puis on trie. */
export function rankStations(
  stations: Station[],
  filters: Filters,
  reference: Coordinates | null,
  now: number = Date.now(),
): Ranked[] {
  const needle = filters.query.trim().toLowerCase();
  const nowDate = new Date(now);
  const out: Ranked[] = [];

  for (const station of stations) {
    if (filters.excludeHighways && station.location === "highway") continue;
    if (!matchesQuery(station, needle)) continue;

    if (filters.openNow) {
      const state = openStateAt(station.schedule, nowDate);
      if (state.status !== "open") continue;
    }

    const distance = reference
      ? distanceKm(reference, { lat: station.lat, lon: station.lon })
      : null;
    if (distance !== null && distance > filters.radiusKm) continue;

    let price: number | null = null;
    if (filters.fuel !== "all") {
      const entry = station.prices[filters.fuel];

      if (!entry) continue;

      // y a que les ruptures temporaires qui comptent vraiment
      if (filters.hideShortages && entry.shortage === "temporaire") continue;

      const age = daysSince(entry.updatedAt, now);
      if (filters.recentOnly && age > FRESHNESS_LIMIT_DAYS) continue;
      price = entry.price;
      out.push({ station, price, distance, age });
      continue;
    }

    out.push({
      station,
      price: null,
      distance,
      age: daysSince(station.updatedAt, now),
    });
  }

  return sortRanked(out, filters.sort);
}

function sortRanked(rows: Ranked[], key: SortKey): Ranked[] {
  const byPrice = (a: Ranked, b: Ranked) => {
    if (a.price === null && b.price === null) return 0;
    if (a.price === null) return 1;
    if (b.price === null) return -1;
    return a.price - b.price;
  };
  const byDistance = (a: Ranked, b: Ranked) => {
    if (a.distance === null && b.distance === null) return 0;
    if (a.distance === null) return 1;
    if (b.distance === null) return -1;
    return a.distance - b.distance;
  };

  return [...rows].sort((a, b) => {
    switch (key) {
      case "price":
        return byPrice(a, b) || byDistance(a, b);
      case "distance":
        return byDistance(a, b) || byPrice(a, b);
      case "freshness":
        return a.age - b.age || byPrice(a, b);
    }
  });
}

export interface PriceStats {
  min: number;
  max: number;
  median: number;
  /** combien de stations ont un prix pour ce carburant */
  count: number;
}

/** les stats de la sélection, pour la légende */
export function priceStats(rows: Ranked[]): PriceStats | null {
  const values = rows
    .map((row) => row.price)
    .filter((price): price is number => price !== null)
    .sort((a, b) => a - b);

  if (values.length === 0) return null;

  const mid = Math.floor(values.length / 2);
  const median =
    values.length % 2 === 1
      ? (values[mid] as number)
      : ((values[mid - 1] as number) + (values[mid] as number)) / 2;

  return {
    min: values[0] as number,
    max: values[values.length - 1] as number,
    median,
    count: values.length,
  };
}

/** où tombe un prix dans l'échelle actuelle, de 0 à 1 */
export function pricePosition(price: number, stats: PriceStats): number {
  if (stats.max === stats.min) return 0;
  return (price - stats.min) / (stats.max - stats.min);
}
