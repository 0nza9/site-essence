"use client";

import { FUELS, FUEL_SHORT } from "@/lib/fuels";
import type { FuelSelection } from "@/lib/filter";

interface Props {
  value: FuelSelection;
  onChange: (value: FuelSelection) => void;
  /** combien de stations par carburant, pour griser ceux que personne vend */
  counts: Partial<Record<FuelSelection, number>>;
}

export default function FuelChips({ value, onChange, counts }: Props) {
  const options: FuelSelection[] = [...FUELS, "all"];

  return (
    <div role="radiogroup" aria-label="Carburant" className="flex flex-wrap gap-1.5">
      {options.map((option) => {
        const selected = option === value;
        const label = option === "all" ? "Tous" : FUEL_SHORT[option];
        const count = counts[option];
        const empty = option !== "all" && count === 0;

        return (
          <button
            key={option}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={empty}
            onClick={() => onChange(option)}
            title={
              empty
                ? `Aucune station ne propose ce carburant dans la sélection`
                : count !== undefined
                  ? `${count} stations`
                  : undefined
            }
            className={[
              "btn btn-xs rounded-full font-medium",
              selected ? "btn-primary" : "btn-ghost border border-base-300",
              empty ? "opacity-40" : "",
            ].join(" ")}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
