"use client";

import type { PriceStats } from "@/lib/filter";
import { FUEL_LABELS } from "@/lib/fuels";
import type { Fuel } from "@/lib/fuels";
import { formatCount, formatPrice } from "@/lib/format";

interface Props {
  stats: PriceStats;
  fuel: Fuel;
}

/**
 * La légende du dégradé. Une seule série, donc pas de boîte à puces : juste
 * les deux bornes et la médiane pour se repérer.
 */
export default function PriceLegend({ stats, fuel }: Props) {
  return (
    <div className="pointer-events-none absolute bottom-4 left-1/2 z-[500] -translate-x-1/2">
      <div className="rounded-xl bg-base-100/95 px-4 py-2.5 shadow-lg ring-1 ring-base-300 backdrop-blur">
        <div className="mb-1.5 flex items-baseline justify-between gap-6">
          <span className="text-[11px] font-semibold tracking-wide uppercase opacity-60">
            {FUEL_LABELS[fuel]}
          </span>
          <span className="text-[11px] opacity-50">
            {formatCount(stats.count)} stations
          </span>
        </div>
        <div className="legend-gradient w-56" aria-hidden="true" />
        <div className="mt-1 flex justify-between text-[11px]">
          <span className="tabular font-semibold">{formatPrice(stats.min)}</span>
          <span className="tabular opacity-55">
            méd. {formatPrice(stats.median)}
          </span>
          <span className="tabular font-semibold">{formatPrice(stats.max)}</span>
        </div>
      </div>
    </div>
  );
}
