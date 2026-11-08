"use client";

import { FUELS, FUEL_LABELS, type Fuel } from "@/lib/fuels";
import {
  formatAge,
  formatDateTime,
  formatDistance,
  formatPrice,
} from "@/lib/format";
import { describeOpenState, openStateAt, weekdayOf } from "@/lib/schedule";
import { WEEKDAYS, type Station } from "@/lib/types";

interface Props {
  station: Station;
  /** le carburant qu'on met en avant, celui du filtre */
  highlight: Fuel | null;
  distance: number | null;
  /** la médiane nationale, pour voir si la station est chère ou pas */
  medians: Partial<Record<Fuel, number>>;
  onClose: () => void;
}

export default function StationDetail({
  station,
  highlight,
  distance,
  medians,
  onClose,
}: Props) {
  const now = new Date();
  const openState = openStateAt(station.schedule, now);
  const today = weekdayOf(now);

  const available = FUELS.filter((fuel) => station.prices[fuel]);
  const temporary = station.shortages.filter((s) => s.kind === "temporaire");
  const unavailable = station.shortages.filter((s) => s.kind === "definitive");
  const itinerary = `https://www.openstreetmap.org/directions?to=${station.lat}%2C${station.lon}`;

  return (
    <section
      aria-label={`Détail de ${station.name}`}
      className="flex h-full flex-col"
    >
      <header className="flex items-start gap-2 border-b border-base-300 px-4 py-3">
        <div className="min-w-0 grow">
          <h2 className="truncate text-base font-semibold">{station.name}</h2>
          <p className="truncate text-xs opacity-60">
            {[
              // le flux donne pas de nom : on retombe sur l'adresse, donc
              // inutile de la répéter juste en dessous
              station.address === station.name ? null : station.address,
              `${station.postalCode} ${station.city}`.trim(),
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="btn btn-ghost btn-sm btn-circle"
          aria-label="Fermer le détail"
        >
          ✕
        </button>
      </header>

      <div className="scroll-thin grow space-y-4 overflow-y-auto px-4 py-3">
        {/* --- Repères --- */}
        <div className="flex flex-wrap gap-1.5">
          <Badge>
            {station.location === "highway" ? "Autoroute" : "Route"}
          </Badge>
          {distance !== null && <Badge>À {formatDistance(distance)}</Badge>}
          {station.brand && <Badge>{station.brand}</Badge>}
          <Badge
            tone={
              openState.status === "open"
                ? "good"
                : openState.status === "closed"
                  ? "critical"
                  : "neutral"
            }
          >
            {describeOpenState(openState)}
          </Badge>
          {station.automate24h === true && <Badge>Automate 24h/24</Badge>}
        </div>

        {/* --- Prix --- */}
        <div>
          <SectionTitle>Prix au litre</SectionTitle>
          {available.length === 0 ? (
            <p className="text-sm opacity-60">Aucun prix publié.</p>
          ) : (
            <ul className="divide-y divide-base-300">
              {available.map((fuel) => {
                const entry = station.prices[fuel];
                if (!entry) return null;
                const median = medians[fuel];
                const delta =
                  median !== undefined && Number.isFinite(median)
                    ? entry.price - median
                    : null;

                return (
                  <li
                    key={fuel}
                    className={[
                      "flex items-baseline gap-2 py-1.5",
                      fuel === highlight ? "font-semibold" : "",
                    ].join(" ")}
                  >
                    <span className="w-24 shrink-0 text-sm">
                      {FUEL_LABELS[fuel]}
                    </span>
                    <span className="tabular grow text-sm">
                      {formatPrice(entry.price)}
                    </span>
                    {delta !== null && (
                      <span
                        className="tabular shrink-0 text-xs opacity-60"
                        title="Écart avec la médiane nationale"
                      >
                        {delta > 0 ? "+" : delta < 0 ? "−" : ""}
                        {Math.abs(delta).toFixed(3).replace(".", ",")}
                      </span>
                    )}
                    {entry.shortage === "temporaire" && (
                      <span
                        className="shrink-0 text-[11px]"
                        style={{ color: "var(--status-warning)" }}
                        title="Rupture signalée : ce prix est celui de la dernière livraison"
                      >
                        <span aria-hidden="true">⚠</span> à sec
                      </span>
                    )}
                    <span className="shrink-0 text-[11px] opacity-45">
                      {formatAge(entry.updatedAt)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* --- Ruptures temporaires --- */}
        {temporary.length > 0 && (
          <div>
            <SectionTitle>Ruptures signalées</SectionTitle>
            <ul className="flex flex-wrap gap-1.5">
              {temporary.map((shortage) => (
                <li key={shortage.fuel}>
                  {/* icône + texte : on compte jamais que sur la couleur */}
                  <Badge tone="warning">
                    <span aria-hidden="true">⚠</span>{" "}
                    {FUEL_LABELS[shortage.fuel]}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* --- Carburants non distribués ---
            Le flux les met en « rupture définitive », parfois depuis des
            années. C'est pas une pénurie, la station les vend juste pas. */}
        {unavailable.length > 0 && (
          <div>
            <SectionTitle>Non proposé</SectionTitle>
            <ul className="flex flex-wrap gap-1.5">
              {unavailable.map((shortage) => (
                <li key={shortage.fuel}>
                  <Badge>{FUEL_LABELS[shortage.fuel]}</Badge>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* --- Horaires --- */}
        {station.schedule && (
          <div>
            <SectionTitle>Horaires</SectionTitle>
            <table className="w-full text-sm">
              <tbody>
                {WEEKDAYS.map((weekday) => {
                  const day = station.schedule?.[weekday];
                  const isToday = weekday === today;
                  return (
                    <tr
                      key={weekday}
                      className={isToday ? "font-semibold" : undefined}
                    >
                      <th scope="row" className="py-0.5 text-left font-normal">
                        <span className={isToday ? "font-semibold" : undefined}>
                          {weekday}
                        </span>
                      </th>
                      <td className="tabular py-0.5 text-right">
                        {!day
                          ? "—"
                          : !day.open
                            ? "Fermé"
                            : day.allDay
                              ? "24h/24"
                              : day.periods
                                  .map((p) => `${p.opening}–${p.closing}`)
                                  .join(", ")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* --- Services --- */}
        {station.services.length > 0 && (
          <div>
            <SectionTitle>Services</SectionTitle>
            <ul className="flex flex-wrap gap-1.5">
              {station.services.map((service) => (
                <li key={service}>
                  <Badge>{service}</Badge>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-[11px] opacity-45">
          Dernier relevé : {formatDateTime(station.updatedAt)}
          {station.department && ` · ${station.department}`}
        </p>
      </div>

      <footer className="border-t border-base-300 px-4 py-3">
        <a
          href={itinerary}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary btn-sm w-full"
        >
          Itinéraire
        </a>
      </footer>
    </section>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mb-1.5 text-[11px] font-semibold tracking-wide uppercase opacity-55">
      {children}
    </h3>
  );
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "good" | "warning" | "critical";
}) {
  const style =
    tone === "good"
      ? { color: "var(--status-good)", borderColor: "var(--status-good)" }
      : tone === "warning"
        ? { color: "var(--status-warning)", borderColor: "var(--status-warning)" }
        : tone === "critical"
          ? {
              color: "var(--status-critical)",
              borderColor: "var(--status-critical)",
            }
          : undefined;

  return (
    <span
      className={[
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px]",
        tone === "neutral" ? "border-base-300 opacity-80" : "",
      ].join(" ")}
      style={style}
    >
      {children}
    </span>
  );
}
