/** les six carburants que publie le flux officiel */
export const FUELS = ["gazole", "sp95", "sp98", "e10", "e85", "gplc"] as const;

export type Fuel = (typeof FUELS)[number];

/** ce qu'on affiche dans l'interface */
export const FUEL_LABELS: Record<Fuel, string> = {
  gazole: "Gazole",
  sp95: "SP95",
  sp98: "SP98",
  e10: "SP95-E10",
  e85: "E85",
  gplc: "GPLc",
};

/** versions courtes, pour les pastilles et les marqueurs */
export const FUEL_SHORT: Record<Fuel, string> = {
  gazole: "Gazole",
  sp95: "SP95",
  sp98: "SP98",
  e10: "E10",
  e85: "E85",
  gplc: "GPL",
};

/**
 * Les noms du flux (champs `prix`, `rupture`, `carburants_disponibles`...)
 * vers nos clés à nous.
 */
const FUEL_ALIASES: Record<string, Fuel> = {
  gazole: "gazole",
  diesel: "gazole",
  sp95: "sp95",
  "sp95-e5": "sp95",
  sp98: "sp98",
  "sp98-e5": "sp98",
  e10: "e10",
  "sp95-e10": "e10",
  e85: "e85",
  gplc: "gplc",
  gpl: "gplc",
  "gpl-c": "gplc",
};

/** range un nom venu du flux dans nos clés, null si on connaît pas */
export function toFuel(raw: unknown): Fuel | null {
  if (typeof raw !== "string") return null;
  const key = raw.trim().toLowerCase().replace(/\s+/g, "");
  return FUEL_ALIASES[key] ?? null;
}

export function isFuel(value: unknown): value is Fuel {
  return typeof value === "string" && (FUELS as readonly string[]).includes(value);
}
