"use client";

import { useEffect, useRef } from "react";
import type { Ranked } from "@/lib/filter";
import { formatDistance, formatPrice } from "@/lib/format";
import type { PriceStats } from "@/lib/filter";
import { priceStep } from "@/lib/scale";

interface Props {
  rows: Ranked[];
  stats: PriceStats | null;
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** true quand aucun carburant n'est choisi : on cache les prix */
  showPrices: boolean;
}

const FRESHNESS_LIMIT_DAYS = 7;

export default function StationList({
  rows,
  stats,
  selectedId,
  onSelect,
  showPrices,
}: Props) {
  const listRef = useRef<HTMLOListElement>(null);

  // la sélection peut venir de la carte, donc on scrolle jusqu'à la ligne
  useEffect(() => {
    if (!selectedId || !listRef.current) return;
    const row = listRef.current.querySelector<HTMLElement>(
      `[data-station-id="${CSS.escape(selectedId)}"]`,
    );
    row?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedId]);

  if (rows.length === 0) {
    return (
      <p className="px-1 py-6 text-center text-sm opacity-60">
        Aucune station ne correspond.
        <br />
        Élargissez le rayon ou assouplissez les filtres.
      </p>
    );
  }

  return (
    <ol ref={listRef} className="flex flex-col gap-0.5">
      {rows.map((row, index) => {
        const selected = row.station.id === selectedId;
        const step = showPrices && row.price !== null && stats
          ? priceStep(row.price, stats)
          : null;
        const stale = row.age > FRESHNESS_LIMIT_DAYS;

        return (
          <li key={row.station.id} data-station-id={row.station.id}>
            <button
              type="button"
              onClick={() => onSelect(row.station.id)}
              aria-current={selected ? "true" : undefined}
              className={[
                "flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors",
                selected ? "bg-primary/12 ring-1 ring-primary/40" : "hover:bg-base-200",
              ].join(" ")}
            >
              <span
                className="tabular w-5 shrink-0 text-right text-xs font-semibold opacity-40"
                aria-hidden="true"
              >
                {index + 1}
              </span>

              <span className="min-w-0 grow">
                <span className="block truncate text-sm font-medium">
                  {row.station.name}
                </span>
                <span className="block truncate text-xs opacity-60">
                  {row.station.city}
                  {row.distance !== null && ` · ${formatDistance(row.distance)}`}
                  {row.station.location === "highway" && " · autoroute"}
                  {stale && " · prix ancien"}
                </span>
              </span>

              {showPrices && row.price !== null && (
                <span className="flex shrink-0 items-center gap-1.5">
                  {step !== null && (
                    <span
                      aria-hidden="true"
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: `var(--price-${step})` }}
                    />
                  )}
                  <span className="tabular text-sm font-semibold">
                    {formatPrice(row.price)}
                  </span>
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
