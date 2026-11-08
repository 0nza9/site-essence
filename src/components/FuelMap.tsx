"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import FilterPanel from "./FilterPanel";
import FuelChips from "./FuelChips";
import PriceLegend from "./PriceLegend";
import StationDetail from "./StationDetail";
import StationList from "./StationList";
import ThemeToggle from "./ThemeToggle";
import { useReferencePoint } from "@/hooks/useReferencePoint";
import { useStations } from "@/hooks/useStations";
import {
  DEFAULT_FILTERS,
  priceStats,
  rankStations,
  type FuelSelection,
  type Filters,
} from "@/lib/filter";
import { FUELS, FUEL_LABELS } from "@/lib/fuels";
import { formatCount, formatDistance } from "@/lib/format";

// Leaflet tape dans window dès l'import, donc pas de SSR possible.
const MapCanvas = dynamic(() => import("./MapCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center bg-base-200 text-sm opacity-60">
      Chargement de la carte…
    </div>
  ),
});

export default function FuelMap() {
  const { data, loading, error, lastSuccess, refresh } = useStations();
  const reference = useReferencePoint();

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const patch = useCallback((next: Partial<Filters>) => {
    setFilters((previous) => ({ ...previous, ...next }));
  }, []);

  const stations = data?.stations ?? [];

  const rows = useMemo(
    () => rankStations(stations, filters, reference.position),
    [stations, filters, reference.position],
  );

  const stats = useMemo(() => priceStats(rows), [rows]);

  /** le compte par carburant, pour les pastilles */
  const fuelCounts = useMemo(() => {
    const counts: Partial<Record<FuelSelection, number>> = { all: stations.length };
    for (const fuel of FUELS) {
      counts[fuel] = stations.reduce(
        (total, station) => (station.prices[fuel] ? total + 1 : total),
        0,
      );
    }
    return counts;
  }, [stations]);

  /** ce que le filtre « ruptures » enlèverait — calculé avant filtrage, sinon il se cache lui-même */
  const shortageAffects = useMemo(() => {
    if (filters.fuel === "all") return 0;
    return stations.reduce(
      (total, station) =>
        station.prices[filters.fuel as Exclude<FuelSelection, "all">]
          ?.shortage === "temporaire"
          ? total + 1
          : total,
      0,
    );
  }, [stations, filters.fuel]);

  /** toutes celles au prix mini, pas juste la première */
  const bestIds = useMemo(() => {
    if (!stats) return new Set<string>();
    const ids = new Set<string>();
    for (const row of rows) {
      if (row.price !== null && row.price === stats.min) ids.add(row.station.id);
    }
    return ids;
  }, [rows, stats]);

  const selected = useMemo(
    () => rows.find((row) => row.station.id === selectedId) ?? null,
    [rows, selectedId],
  );

  // si la station sort de la sélection, on ferme son détail
  useEffect(() => {
    if (selectedId && !selected) setSelectedId(null);
  }, [selected, selectedId]);

  // Échap : ferme le détail, puis le panneau mobile
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (selectedId) setSelectedId(null);
      else if (drawerOpen) setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [drawerOpen, selectedId]);

  const select = useCallback((id: string) => {
    setSelectedId((previous) => (previous === id ? null : id));
  }, []);

  const activeFuel = filters.fuel === "all" ? null : filters.fuel;

  return (
    <div className="flex h-dvh flex-col overflow-hidden lg:flex-row">
      {/* --- Barre mobile --- */}
      <header className="flex items-center gap-2 border-b border-base-300 bg-base-100 px-3 py-2 lg:hidden">
        <h1 className="grow text-sm font-semibold">
          <span aria-hidden="true">⛽</span> FuelMap
        </h1>
        {stats && (
          <span className="tabular text-xs opacity-60">
            {formatCount(stats.count)} stations
          </span>
        )}
        <ThemeToggle />
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => setDrawerOpen((open) => !open)}
          aria-expanded={drawerOpen}
        >
          {drawerOpen ? "Carte" : "Filtres"}
        </button>
      </header>

      {/* --- Panneau latéral --- */}
      <aside
        className={[
          "flex w-full shrink-0 flex-col border-base-300 bg-base-100 lg:w-96 lg:border-r",
          // sur mobile le panneau remplace la carte : une carte en bandeau sert à rien
          drawerOpen ? "grow" : "hidden lg:flex",
        ].join(" ")}
      >
        <div className="hidden items-center gap-2 border-b border-base-300 px-4 py-3 lg:flex">
          <h1 className="grow text-base font-semibold">
            <span aria-hidden="true">⛽</span> FuelMap
          </h1>
          <ThemeToggle />
          <button
            type="button"
            className="btn btn-ghost btn-sm btn-circle"
            onClick={refresh}
            disabled={loading}
            title="Actualiser les prix"
            aria-label="Actualiser les prix"
          >
            <span className={loading ? "inline-block animate-spin" : undefined}>
              ↻
            </span>
          </button>
        </div>

        {selected ? (
          <StationDetail
            station={selected.station}
            highlight={activeFuel}
            distance={selected.distance}
            medians={data?.medians ?? {}}
            onClose={() => setSelectedId(null)}
          />
        ) : (
          <>
            <div className="space-y-3 border-b border-base-300 px-4 py-3">
              <div>
                <span className="mb-1.5 block text-xs font-medium opacity-70">
                  Carburant
                </span>
                <FuelChips
                  value={filters.fuel}
                  onChange={(fuel) => patch({ fuel })}
                  counts={fuelCounts}
                />
              </div>

              <FilterPanel
                filters={filters}
                onChange={patch}
                hasReference={reference.position !== null}
                shortageAffects={shortageAffects}
              />

              <div className="flex gap-2">
                <button
                  type="button"
                  className="btn btn-primary btn-sm grow"
                  onClick={reference.locate}
                  disabled={reference.locating}
                >
                  {reference.locating ? "Localisation…" : "📍 Ma position"}
                </button>
                {reference.position && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={reference.clear}
                  >
                    Effacer
                  </button>
                )}
              </div>

              {reference.error && (
                <p
                  role="status"
                  className="text-xs"
                  style={{ color: "var(--status-critical)" }}
                >
                  <span aria-hidden="true">⚠</span> {reference.error}
                </p>
              )}
              {!reference.position && !reference.error && (
                <p className="text-xs opacity-55">
                  Ou cliquez sur la carte pour choisir un point de départ.
                </p>
              )}
            </div>

            <div className="scroll-thin grow overflow-y-auto px-2 py-2">
              <h2 className="px-2 pb-1.5 text-xs font-semibold tracking-wide uppercase opacity-55">
                {filters.fuel === "all"
                  ? `${formatCount(rows.length)} stations`
                  : reference.position
                    ? `Les moins chères à ${formatDistance(filters.radiusKm)} (${FUEL_LABELS[filters.fuel]})`
                    : `Les moins chères (${FUEL_LABELS[filters.fuel]})`}
              </h2>

              {filters.fuel === "all" && (
                <p className="px-2 pb-2 text-xs opacity-55">
                  Choisissez un carburant pour comparer les prix.
                </p>
              )}

              {loading && !data ? (
                <ul className="space-y-1 px-2 py-2">
                  {Array.from({ length: 8 }, (_, index) => (
                    <li
                      key={index}
                      className="h-11 animate-pulse rounded-lg bg-base-200"
                    />
                  ))}
                </ul>
              ) : (
                <StationList
                  rows={rows}
                  stats={stats}
                  selectedId={selectedId}
                  onSelect={select}
                  showPrices={filters.fuel !== "all"}
                />
              )}
            </div>
          </>
        )}

        <footer className="border-t border-base-300 px-4 py-2 text-[11px] opacity-50">
          {error ? (
            <span style={{ color: "var(--status-critical)" }}>
              <span aria-hidden="true">⚠</span> {error} —{" "}
              <button type="button" className="link" onClick={refresh}>
                réessayer
              </button>
            </span>
          ) : data ? (
            <>
              {formatCount(rows.length)} sur {formatCount(data.stations.length)}{" "}
              stations
              {data.discardedPrices > 0 &&
                ` · ${formatCount(data.discardedPrices)} prix aberrants écartés`}
              {lastSuccess &&
                ` · maj ${lastSuccess.toLocaleTimeString("fr-FR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}`}
            </>
          ) : (
            "Chargement des prix…"
          )}
        </footer>
      </aside>

      {/* --- La carte --- */}
      <main
        className={[
          "relative grow",
          drawerOpen ? "hidden lg:block" : "block",
        ].join(" ")}
      >
        <MapCanvas
          rows={rows}
          stats={stats}
          fuel={activeFuel}
          selectedId={selectedId}
          onSelect={select}
          onPickReference={reference.setFromMap}
          reference={reference.position}
          radiusKm={filters.radiusKm}
          bestIds={bestIds}
        />
        {stats && activeFuel && <PriceLegend stats={stats} fuel={activeFuel} />}
      </main>
    </div>
  );
}
