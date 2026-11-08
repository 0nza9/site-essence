/** un prix au litre à la française : « 1,879 € » */
export function formatPrice(price: number): string {
  return `${price.toFixed(3).replace(".", ",")} €`;
}

/** un écart signé : « +0,12 € » / « −0,04 € » */
export function formatDelta(delta: number): string {
  const sign = delta > 0 ? "+" : delta < 0 ? "\u2212" : "";
  return `${sign}${Math.abs(delta).toFixed(2).replace(".", ",")} €`;
}

/** une distance : « 450 m » sous le kilomètre, sinon « 12,3 km » */
export function formatDistance(km: number): string {
  if (km < 1) return `${Math.round(km * 1000)} m`;
  if (km < 10) return `${km.toFixed(1).replace(".", ",")} km`;
  return `${Math.round(km)} km`;
}

/** une date ISO en date + heure françaises */
export function formatDateTime(iso: string | null): string {
  if (!iso) return "date inconnue";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleString("fr-FR", { dateStyle: "short", timeStyle: "short" });
}

/** combien de jours depuis une date ISO, Infinity si elle est pourrie */
export function daysSince(iso: string | null, now: number = Date.now()): number {
  if (!iso) return Infinity;
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) return Infinity;
  return (now - time) / 86_400_000;
}

/** « il y a 2 h », « hier », « il y a 5 j » — l'âge d'un relevé */
export function formatAge(iso: string | null, now: number = Date.now()): string {
  const days = daysSince(iso, now);
  if (!Number.isFinite(days)) return "date inconnue";
  const hours = days * 24;
  if (hours < 1) return "a l'instant";
  if (hours < 24) return `il y a ${Math.round(hours)} h`;
  if (days < 2) return "hier";
  return `il y a ${Math.round(days)} j`;
}

/** un entier avec les espaces qui vont bien : « 9 827 » */
export function formatCount(n: number): string {
  return n.toLocaleString("fr-FR");
}
