import type { PriceStats } from "./filter";

/** les cinq paliers de la rampe, définie dans globals.css */
export const PRICE_STEPS = 5;

export type PriceStep = 1 | 2 | 3 | 4 | 5;

/**
 * Où placer un prix sur la rampe, de 1 (pas cher) à 5. On découpe par étendue
 * et pas par rang, sinon deux prix identiques pourraient sortir deux couleurs.
 */
export function priceStep(price: number, stats: PriceStats): PriceStep {
  if (stats.max === stats.min) return 3;
  const position = (price - stats.min) / (stats.max - stats.min);
  const step = Math.floor(position * PRICE_STEPS) + 1;
  return Math.min(PRICE_STEPS, Math.max(1, step)) as PriceStep;
}

export function priceStepClass(step: PriceStep): string {
  return `price-marker--s${step}`;
}
