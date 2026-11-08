import { FUELS, toFuel, type Fuel } from "./fuels";
import {
  WEEKDAYS,
  type Coordinates,
  type DaySchedule,
  type FuelPrice,
  type Period,
  type Schedule,
  type Shortage,
  type ShortageKind,
  type Station,
  type StationDataset,
} from "./types";

/**
 * Les deux schémas publics nomment pas les champs pareil : « j-7 » dit address,
 * city, price_gazole, geo_point, timetable ; « flux-instantane-v2 » dit adresse,
 * ville, gazole_prix, geom, horaires. On avale les deux, comme ça le backend
 * sert ce qu'il veut sans qu'on touche à l'interface.
 */

type Raw = Record<string, unknown>;

/* --- Les petits utilitaires tolérants --- */

function str(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed === "" ? null : trimmed;
  }
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function num(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const parsed = Number(value.replace(",", "."));
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** ces champs arrivent tantôt en objet, tantôt en chaîne JSON */
function maybeJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function asArray(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value === null || value === undefined) return [];
  return [value];
}

/** « 08.00 », « 0800 », « 8:00 » -> « 08:00 », null si c'est illisible */
function timeOf(value: unknown): string | null {
  const raw = str(value);
  if (!raw) return null;
  const match = /^(\d{1,2})[.:h]?(\d{2})$/.exec(raw.replace(/\s/g, ""));
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/** les booléens arrivent en « Oui »/« Non », « 1 »/« 0 », ou vides */
function tristate(value: unknown): boolean | null {
  const raw = str(value)?.toLowerCase();
  if (!raw) return null;
  if (["oui", "1", "true", "yes"].includes(raw)) return true;
  if (["non", "0", "false", "no"].includes(raw)) return false;
  return null;
}

function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] as number;
  return ((sorted[mid - 1] as number) + (sorted[mid] as number)) / 2;
}

/* --- Les champs un peu tordus --- */

/** le prix brut, dans un schéma ou dans l'autre */
function rawPrice(record: Raw, fuel: Fuel): number | null {
  return num(record[`price_${fuel}`]) ?? num(record[`${fuel}_prix`]);
}

/** la date du relevé, sinon celle de la station */
function priceUpdatedAt(record: Raw, fuel: Fuel): string | null {
  return (
    str(record[`${fuel}_maj`]) ??
    str(record[`price_${fuel}_maj`]) ??
    str(record.update) ??
    str(record.prix_maj)
  );
}

/** Coordonnées WGS84. Attention : latitude/longitude du flux sont x100 000. */
function coordinates(record: Raw): Coordinates | null {
  const point = (record.geo_point ?? record.geom ?? record.geo_point_2d) as
    | Raw
    | undefined;

  let lat: number | null = null;
  let lon: number | null = null;

  if (point && typeof point === "object") {
    lat = num(point.lat);
    lon = num(point.lon);
  }

  if (lat === null || lon === null) {
    const rawLat = num(record.latitude);
    const rawLon = num(record.longitude);
    if (rawLat !== null && rawLon !== null) {
      lat = Math.abs(rawLat) > 90 ? rawLat / 1e5 : rawLat;
      lon = Math.abs(rawLon) > 180 ? rawLon / 1e5 : rawLon;
    }
  }

  if (lat === null || lon === null) return null;
  if (lat === 0 && lon === 0) return null;
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
  return { lat, lon };
}

/** tableau ou chaîne JSON, et on recolle au passage les libellés coupés en deux */
function services(record: Raw): string[] {
  let source: unknown = record.services_service;

  if (source === undefined || source === null) {
    const parsed = maybeJson(record.services);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      source = (parsed as Raw).service;
    } else {
      source = parsed ?? record.services;
    }
  }

  const out: string[] = [];
  for (const entry of asArray(source)) {
    const label = str(entry);
    if (!label) continue;
    const previous = out[out.length - 1];
    if (previous === "Automate CB 24" && label === "24") {
      out[out.length - 1] = "Automate CB 24/24";
    } else if (previous === "Services réparation" && label === "entretien") {
      out[out.length - 1] = "Services réparation / entretien";
    } else {
      out.push(label);
    }
  }
  return [...new Set(out)];
}

/** les ruptures, de la source la plus riche à la plus pauvre */
function shortages(record: Raw): Shortage[] {
  const byFuel = new Map<Fuel, Shortage>();

  const add = (fuel: Fuel | null, kind: ShortageKind, since: string | null) => {
    if (!fuel) return;
    const existing = byFuel.get(fuel);
    // le définitif l'emporte sur le temporaire
    if (existing && !(kind === "definitive" && existing.kind === "temporaire")) {
      return;
    }
    byFuel.set(fuel, { fuel, kind, since });
  };

  for (const entry of asArray(maybeJson(record.rupture))) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Raw;
    const kind: ShortageKind =
      str(row["@type"])?.toLowerCase() === "temporaire"
        ? "temporaire"
        : "definitive";
    add(toFuel(str(row["@nom"])), kind, str(row["@debut"]));
  }

  const fromSemicolons = (value: unknown, kind: ShortageKind) => {
    const raw = str(value);
    if (!raw) return;
    for (const part of raw.split(";")) add(toFuel(part), kind, null);
  };
  fromSemicolons(record.carburants_rupture_temporaire, "temporaire");
  fromSemicolons(record.carburants_rupture_definitive, "definitive");

  for (const entry of asArray(record.shortage)) {
    add(toFuel(str(entry)), "temporaire", null);
  }

  return [...byFuel.values()];
}

/** 00:00 -> 00:00 ou 00:00 -> 23:59, ça veut dire ouvert en continu */
function isAllDay(periods: Period[]): boolean {
  if (periods.length === 0) return true;
  if (periods.length > 1) return false;
  const only = periods[0] as Period;
  return (
    only.opening === "00:00" &&
    (only.closing === "00:00" || only.closing === "23:59")
  );
}

function dayFromPeriods(open: boolean, periods: Period[]): DaySchedule {
  if (!open) return { open: false, periods: [], allDay: false };
  const allDay = isAllDay(periods);
  return { open: true, periods: allDay ? [] : periods, allDay };
}

/** horaires : « jour » en tableau (schéma B) ou un objet par jour (schéma A) */
function schedule(record: Raw): Schedule | null {
  const parsed = maybeJson(record.horaires ?? record.timetable);
  if (!parsed || typeof parsed !== "object") return null;
  const root = parsed as Raw;
  const out: Schedule = {};

  // --- Schéma B : tableau de jours ---
  const days = asArray(root.jour);
  if (days.length > 0) {
    for (const entry of days) {
      if (!entry || typeof entry !== "object") continue;
      const row = entry as Raw;
      const name = str(row["@nom"]);
      if (!name) continue;
      const weekday = WEEKDAYS.find((d) => d.toLowerCase() === name.toLowerCase());
      if (!weekday) continue;

      const closed = str(row["@ferme"]) === "1";
      const periods: Period[] = [];
      for (const slot of asArray(row.horaire)) {
        if (!slot || typeof slot !== "object") continue;
        const opening = timeOf((slot as Raw)["@ouverture"]);
        const closing = timeOf((slot as Raw)["@fermeture"]);
        if (opening && closing) periods.push({ opening, closing });
      }
      out[weekday] = dayFromPeriods(!closed, periods);
    }
    return Object.keys(out).length > 0 ? out : null;
  }

  // --- Schéma A : objet indexé par nom de jour ---
  for (const weekday of WEEKDAYS) {
    const row = root[weekday] as Raw | undefined;
    if (!row || typeof row !== "object") continue;
    const open = num(row.ouvert) === 1 || tristate(row.ouvert) === true;
    const opening = timeOf(row.ouverture);
    const closing = timeOf(row.fermeture);
    const periods: Period[] = opening && closing ? [{ opening, closing }] : [];
    out[weekday] = dayFromPeriods(open, periods);
  }
  return Object.keys(out).length > 0 ? out : null;
}

/** le flux instantané donne ni nom ni enseigne, du coup on prend l'adresse */
function stationName(record: Raw): string {
  return (
    str(record.name) ??
    str(record.nom) ??
    str(record.brand) ??
    str(record.enseigne) ??
    str(record.address) ??
    str(record.adresse) ??
    "Station-service"
  );
}

/* --- Une ligne du flux -> une station --- */

function normalizeStation(
  record: Raw,
  medians: Partial<Record<Fuel, number>>,
): { station: Station; discarded: number } | null {
  const id = str(record.id) ?? str(record.station_id);
  const point = coordinates(record);
  if (!id || !point) return null;

  const shortageList = shortages(record);

  const prices: Partial<Record<Fuel, FuelPrice>> = {};
  let discarded = 0;
  let latest: string | null = null;

  for (const fuel of FUELS) {
    const price = rawPrice(record, fuel);
    if (price === null || price <= 0) continue;

    // plus de 40 % d'écart à la médiane, c'est une faute de frappe, pas un prix
    const reference = medians[fuel];
    if (
      reference !== undefined &&
      Number.isFinite(reference) &&
      Math.abs(price - reference) / reference > 0.4
    ) {
      discarded += 1;
      continue;
    }

    const updatedAt = priceUpdatedAt(record, fuel);
    prices[fuel] = {
      fuel,
      price: Math.round(price * 1000) / 1000,
      updatedAt,
      // un prix peut cohabiter avec une pompe à sec, sinon le filtre
      // « ruptures » aurait rien à filtrer
      shortage: shortageList.find((s) => s.fuel === fuel)?.kind ?? null,
    };
    if (updatedAt && (latest === null || updatedAt > latest)) latest = updatedAt;
  }

  const automate =
    tristate(record.automate_24_24) ?? tristate(record.horaires_automate_24_24);

  const station: Station = {
    id,
    name: stationName(record),
    brand: str(record.brand) ?? str(record.enseigne),
    address: str(record.address) ?? str(record.adresse) ?? "",
    postalCode: str(record.cp) ?? str(record.postalCode) ?? "",
    city: str(record.city) ?? str(record.ville) ?? "",
    department: str(record.depname) ?? str(record.departement),
    region: str(record.region_name) ?? str(record.region),
    location: str(record.pop) === "A" ? "highway" : "road",
    lat: point.lat,
    lon: point.lon,
    prices,
    // attention : « definitive » veut pas dire pénurie, juste que la station
    // vend pas ce carburant (6 200 pour le GPLc). Seul le temporaire est
    // une vraie rupture.
    shortages: shortageList.filter((s) => !prices[s.fuel]),
    services: services(record),
    automate24h: automate,
    schedule: schedule(record),
    updatedAt: latest ?? str(record.update) ?? str(record.prix_maj),
  };

  return { station, discarded };
}

/* --- Le point d'entrée --- */

/** avale un tableau nu, ou `{ results | stations | records | data: [...] }` */
export function normalizeDataset(payload: unknown): StationDataset {
  let records: Raw[] = [];
  if (Array.isArray(payload)) {
    records = payload as Raw[];
  } else if (payload && typeof payload === "object") {
    const root = payload as Raw;
    const list = root.results ?? root.stations ?? root.records ?? root.data;
    if (Array.isArray(list)) records = list as Raw[];
  }

  // médiane nationale par carburant, ça servira à repérer les prix aberrants
  const medians: Partial<Record<Fuel, number>> = {};
  for (const fuel of FUELS) {
    const values = records
      .map((record) => rawPrice(record, fuel))
      .filter((price): price is number => price !== null && price > 0);
    if (values.length > 0) medians[fuel] = median(values);
  }

  const byId = new Map<string, Station>();
  let rejected = 0;
  let discardedPrices = 0;

  for (const record of records) {
    const result = normalizeStation(record, medians);
    if (!result) {
      rejected += 1;
      continue;
    }
    discardedPrices += result.discarded;

    // le flux a des doublons d'id, on garde le plus récent
    const existing = byId.get(result.station.id);
    if (
      !existing ||
      (result.station.updatedAt ?? "") > (existing.updatedAt ?? "")
    ) {
      byId.set(result.station.id, result.station);
    }
  }

  return {
    stations: [...byId.values()],
    rejected,
    discardedPrices,
    medians,
    fetchedAt: new Date().toISOString(),
  };
}
