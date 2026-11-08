import type { Coordinates } from "./types";

const EARTH_DIAMETER_KM = 12_742;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** distance à vol d'oiseau en km (haversine) */
export function distanceKm(a: Coordinates, b: Coordinates): number {
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.lat)) * Math.cos(toRadians(b.lat)) * Math.sin(dLon / 2) ** 2;
  return EARTH_DIAMETER_KM * Math.asin(Math.sqrt(h));
}

/** le centre de la France, là où la carte s'ouvre par défaut */
export const FRANCE_CENTER: Coordinates = { lat: 46.6, lon: 2.4 };
export const FRANCE_ZOOM = 6;
