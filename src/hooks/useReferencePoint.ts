"use client";

import { useCallback, useState } from "react";
import type { Coordinates } from "@/lib/types";

export type ReferenceOrigin = "geolocation" | "map" | null;

export interface ReferencePoint {
  position: Coordinates | null;
  /** d'où vient le point : géoloc du navigateur ou clic sur la carte */
  origin: ReferenceOrigin;
  locating: boolean;
  error: string | null;
  locate: () => void;
  setFromMap: (position: Coordinates) => void;
  clear: () => void;
}

/** les messages du navigateur, en français */
function describeGeolocationError(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "Accès à la position refusé. Cliquez sur la carte pour choisir un point.";
    case error.POSITION_UNAVAILABLE:
      return "Position indisponible. Cliquez sur la carte pour choisir un point.";
    case error.TIMEOUT:
      return "La localisation a pris trop de temps. Réessayez.";
    default:
      return "Localisation impossible.";
  }
}

/** Le point de départ : sert au filtre par rayon et aux distances. */
export function useReferencePoint(): ReferencePoint {
  const [position, setPosition] = useState<Coordinates | null>(null);
  const [origin, setOrigin] = useState<ReferenceOrigin>(null);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const locate = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setError("Votre navigateur ne gère pas la géolocalisation.");
      return;
    }
    setLocating(true);
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (result) => {
        setPosition({
          lat: result.coords.latitude,
          lon: result.coords.longitude,
        });
        setOrigin("geolocation");
        setLocating(false);
      },
      (geolocationError) => {
        setError(describeGeolocationError(geolocationError));
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  }, []);

  const setFromMap = useCallback((next: Coordinates) => {
    setPosition(next);
    setOrigin("map");
    setError(null);
  }, []);

  const clear = useCallback(() => {
    setPosition(null);
    setOrigin(null);
    setError(null);
  }, []);

  return { position, origin, locating, error, locate, setFromMap, clear };
}
