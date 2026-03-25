/**
 * reputation.js
 * All reputation logic: tiers, gain calculation, gating, sell bonuses.
 *
 * Reputation is per-city, 0-100.
 * - Trading raw goods gives slow gain
 * - Trading higher-tier goods gives more gain
 * - Selling goods in HIGH DEMAND gives a multiplied gain
 * - Buying always gives base gain (no demand multiplier)
 *
 * Reputation gates what goods can be bought/sold at a city.
 * Sell threshold is half the buy threshold (city accepts goods
 * more readily than it reveals its own stock to strangers).
 */

export const REP_TIERS = [
  { min: 0,  name: 'Stranger',         color: '#9a8a60' },
  { min: 20, name: 'Acquaintance',     color: '#60a0d0' },
  { min: 40, name: 'Known Trader',     color: '#5fca5f' },
  { min: 60, name: 'Trusted Merchant', color: '#b5891c' },
  { min: 80, name: 'City Partner',     color: '#c060c0' },
];

/** Get the current reputation tier object for a given rep value */
export function getRepTier(rep) {
  let tier = REP_TIERS[0];
  for (const t of REP_TIERS) {
    if (rep >= t.min) tier = t;
  }
  return tier;
}

/**
 * Progress percentage within the current tier (0-100%).
 * Used to fill the reputation progress bar.
 */
export function getRepProgress(rep) {
  const tier = getRepTier(rep);
  const idx  = REP_TIERS.indexOf(tier);
  const next = REP_TIERS[idx + 1];
  if (!next) return 100; // maxed out
  return Math.round(((rep - tier.min) / (next.min - tier.min)) * 100);
}

/**
 * Sell price bonus multiplier based on reputation.
 * Applied to the city's sell price when player sells goods.
 */
export function getSellBonus(rep) {
  if (rep >= 80) return 1.10;
  if (rep >= 60) return 1.06;
  if (rep >= 40) return 1.03;
  return 1.00;
}

/**
 * Base reputation gain per trade, scaled by good category.
 * For sells, this is further multiplied by the demand multiplier.
 */
const BASE_GAIN = { raw: 0.3, processed: 0.5, finished: 0.8 };

/**
 * Calculate reputation gain for a trade.
 *
 * @param {string} category    - 'raw' | 'processed' | 'finished'
 * @param {number} priceRatio  - currentPrice / basePrice (only used for sells)
 * @param {boolean} isSell     - true = selling to city, false = buying from city
 * @returns {number} rep gain (may be fractional, accumulated over time)
 */
export function gainFromTrade(category, priceRatio, isSell) {
  const base = BASE_GAIN[category] ?? 0.3;
  if (!isSell) return base;

  // Demand multiplier: higher price ratio = city needs it more = more rep for supplying it
  let demandMult;
  if      (priceRatio > 2.0)  demandMult = 2.0;
  else if (priceRatio > 1.3)  demandMult = 1.5;
  else if (priceRatio >= 0.75) demandMult = 1.0;
  else                         demandMult = 0.5;

  return base * demandMult;
}

/**
 * Check whether the player can BUY a good at a city.
 * @param {number} rep  - current reputation at that city
 * @param {object} good - good definition from GOODS
 * @returns {{ ok: boolean, minRep: number, tierName: string }}
 */
export function canBuy(rep, good) {
  const minRep = good.minReputation ?? 0;
  if (rep >= minRep) return { ok: true, minRep, tierName: '' };
  const tier = REP_TIERS.slice().reverse().find(t => t.min <= minRep) ?? REP_TIERS[0];
  return { ok: false, minRep, tierName: tier.name };
}

/**
 * Check whether the player can SELL a good at a city.
 * Threshold is half the buy threshold (rounded down).
 * @param {number} rep  - current reputation at that city
 * @param {object} good - good definition from GOODS
 * @returns {{ ok: boolean, minRepSell: number, tierName: string }}
 */
export function canSell(rep, good) {
  const minRepSell = good.minRepSell ?? 0;
  if (rep >= minRepSell) return { ok: true, minRepSell, tierName: '' };
  const tier = REP_TIERS.slice().reverse().find(t => t.min <= minRepSell) ?? REP_TIERS[0];
  return { ok: false, minRepSell, tierName: tier.name };
}

/**
 * Get the player's reputation at a specific city.
 * Returns 0 if never visited.
 */
export function getRepForCity(state, cityId) {
  return state.player.reputation[cityId] ?? 0;
}

/**
 * Add reputation at a city, fire bus events.
 * Handles tier-up detection and caps at 100.
 *
 * @param {object}   state
 * @param {string}   cityId
 * @param {EventBus} bus
 * @param {number}   amount  - may be fractional
 */
export function addRep(state, cityId, bus, amount) {
  const prev   = state.player.reputation[cityId] ?? 0;
  const prevTier = getRepTier(prev).min;

  const next   = Math.min(100, prev + amount);
  state.player.reputation[cityId] = next;

  const newTier = getRepTier(next);

  bus.publish('reputation:gained', {
    cityId,
    amount,
    newRep:   next,
    tierName: newTier.name,
  });

  // Fire tier-up if we crossed a threshold
  if (newTier.min > prevTier) {
    bus.publish('reputation:tierUp', {
      cityId,
      tier:     newTier.min,
      tierName: newTier.name,
      color:    newTier.color,
    });
  }
}
