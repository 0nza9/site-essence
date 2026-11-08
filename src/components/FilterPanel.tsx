"use client";

import { RADIUS_STEPS, type Filters, type SortKey } from "@/lib/filter";

interface Props {
  filters: Filters;
  onChange: (patch: Partial<Filters>) => void;
  /** le rayon sert à rien sans point de départ */
  hasReference: boolean;
  /**
   * Ce que le filtre « ruptures » enlèverait. Souvent 0 : le flux vire le prix
   * dès qu'il signale une rupture. Du coup on grise la case.
   */
  shortageAffects: number;
}

const SORT_LABELS: Record<SortKey, string> = {
  price: "Prix",
  distance: "Distance",
  freshness: "Fraîcheur",
};

export default function FilterPanel({
  filters,
  onChange,
  hasReference,
  shortageAffects,
}: Props) {
  return (
    <div className="space-y-3">
      <label className="input input-sm flex w-full items-center gap-2">
        <span aria-hidden="true" className="opacity-50">
          ⌕
        </span>
        <input
          type="search"
          className="grow"
          placeholder="Ville, code postal, enseigne…"
          value={filters.query}
          onChange={(event) => onChange({ query: event.target.value })}
          aria-label="Rechercher une ville, un code postal ou une enseigne"
        />
      </label>

      <div className="flex flex-col gap-1.5 text-sm">
        <Check
          label={
            shortageAffects > 0
              ? `Masquer les ruptures signalées (${shortageAffects})`
              : "Masquer les ruptures signalées"
          }
          checked={filters.hideShortages}
          disabled={shortageAffects === 0}
          hint={
            shortageAffects === 0
              ? "Aucune station de la sélection ne publie à la fois un prix et une rupture."
              : undefined
          }
          onChange={(hideShortages) => onChange({ hideShortages })}
        />
        <Check
          label="Exclure les autoroutes"
          checked={filters.excludeHighways}
          onChange={(excludeHighways) => onChange({ excludeHighways })}
        />
        <Check
          label="Relevés de moins de 7 jours"
          checked={filters.recentOnly}
          onChange={(recentOnly) => onChange({ recentOnly })}
        />
        <Check
          label="Ouvertes maintenant"
          checked={filters.openNow}
          onChange={(openNow) => onChange({ openNow })}
        />
      </div>

      <div>
        <div className="mb-1 flex items-baseline justify-between">
          <span className="text-xs font-medium opacity-70">Trier par</span>
        </div>
        <div
          role="radiogroup"
          aria-label="Trier par"
          className="flex w-full overflow-hidden rounded-lg border border-base-300"
        >
          {(Object.keys(SORT_LABELS) as SortKey[]).map((key, index) => (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={filters.sort === key}
              disabled={key === "distance" && !hasReference}
              onClick={() => onChange({ sort: key })}
              className={[
                "btn btn-xs grow rounded-none border-0",
                index > 0 ? "border-l border-base-300" : "",
                filters.sort === key ? "btn-primary" : "btn-ghost",
              ].join(" ")}
            >
              {SORT_LABELS[key]}
            </button>
          ))}
        </div>
      </div>

      {hasReference && (
        <div>
          <label
            htmlFor="radius"
            className="mb-1 flex items-baseline justify-between text-xs"
          >
            <span className="font-medium opacity-70">Rayon</span>
            <span className="tabular font-semibold">{filters.radiusKm} km</span>
          </label>
          <input
            id="radius"
            type="range"
            className="range range-xs range-primary"
            min={0}
            max={RADIUS_STEPS.length - 1}
            step={1}
            value={Math.max(
              0,
              RADIUS_STEPS.indexOf(
                filters.radiusKm as (typeof RADIUS_STEPS)[number],
              ),
            )}
            onChange={(event) => {
              const step = RADIUS_STEPS[Number(event.target.value)];
              if (step !== undefined) onChange({ radiusKm: step });
            }}
          />
          <div className="mt-0.5 flex justify-between px-1 text-[10px] opacity-50">
            {RADIUS_STEPS.map((step) => (
              <span key={step}>{step}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Check({
  label,
  checked,
  onChange,
  disabled = false,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  hint?: string;
}) {
  return (
    <label
      title={hint}
      className={[
        "flex items-center gap-2",
        disabled ? "cursor-not-allowed opacity-45" : "cursor-pointer",
      ].join(" ")}
    >
      <input
        type="checkbox"
        className="checkbox checkbox-xs checkbox-primary"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}
