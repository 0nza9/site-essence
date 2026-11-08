"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { normalizeDataset } from "@/lib/normalize";
import type { StationDataset } from "@/lib/types";

/** en dev la fixture locale, en prod l'API du backend */
const STATIONS_URL =
  process.env.NEXT_PUBLIC_STATIONS_URL || "/data/stations.json";

/** rafraîchissement, 30 s minimum pour pas marteler l'API */
const REFRESH_SECONDS = Math.max(
  30,
  Number(process.env.NEXT_PUBLIC_REFRESH_INTERVAL) || 300,
);

export interface StationsState {
  data: StationDataset | null;
  loading: boolean;
  error: string | null;
  /** dernier chargement qui a marché, pour l'indicateur de fraîcheur */
  lastSuccess: Date | null;
  refresh: () => void;
}

export function useStations(): StationsState {
  const [state, setState] = useState<{
    data: StationDataset | null;
    loading: boolean;
    error: string | null;
    lastSuccess: Date | null;
  }>({ data: null, loading: true, error: null, lastSuccess: null });

  const controller = useRef<AbortController | null>(null);
  const lastAttempt = useRef(0);

  const load = useCallback(async () => {
    // on annule celui d'avant s'il tourne encore
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    lastAttempt.current = Date.now();

    setState((previous) => ({ ...previous, loading: true }));

    try {
      // petit paramètre anti-cache
      const separator = STATIONS_URL.includes("?") ? "&" : "?";
      const response = await fetch(`${STATIONS_URL}${separator}_=${Date.now()}`, {
        signal: current.signal,
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const dataset = normalizeDataset(await response.json());
      if (dataset.stations.length === 0) {
        throw new Error("Aucune station exploitable dans la réponse");
      }

      setState({
        data: dataset,
        loading: false,
        error: null,
        lastSuccess: new Date(),
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setState((previous) => ({
        ...previous,
        loading: false,
        error: error instanceof Error ? error.message : "Erreur inconnue",
      }));
    }
  }, []);

  useEffect(() => {
    void load();

    // seulement si l'onglet est visible, inutile de recharger en arrière-plan
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, REFRESH_SECONDS * 1000);

    const onVisible = () => {
      const stale = Date.now() - lastAttempt.current > REFRESH_SECONDS * 1000;
      if (document.visibilityState === "visible" && stale) void load();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      controller.current?.abort();
    };
  }, [load]);

  return { ...state, refresh: load };
}

export { REFRESH_SECONDS, STATIONS_URL };
