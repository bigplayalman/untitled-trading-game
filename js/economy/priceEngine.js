/**
 * priceEngine.js
 * Dynamic pricing model based on supply/demand ratio.
 *
 * Formula:
 *   price = basePrice * pressureMultiplier * categoryModifier
 *
 * pressureMultiplier:
 *   - When stock > demand target: price falls (surplus)
 *   - When stock < demand target: price rises (shortage)
 *   - Uses a smooth log curve so price never swings instantly
 *
 * Prices are smoothed with exponential moving average (EMA)
 * to prevent wild oscillation.
 */

import { GOODS } from './goods.js';

// How many units is considered "normal" stock for a city
const NORMAL_STOCK   = 50;
// Price floor and ceiling as fractions of base price
const PRICE_FLOOR    = 0.20;
const PRICE_CEILING  = 5.00;
// EMA smoothing factor (0 = no change, 1 = instant)
const EMA_ALPHA      = 0.08;
// History length for trend display
const HISTORY_LENGTH = 20;

export class PriceEngine {
  /**
   * @param {string} cityId
   * @param {object} inventory  - reference to city's live inventory { goodId: qty }
   * @param {object} consumption - reference to city's daily consumption { goodId: qty }
   */
  constructor(cityId, inventory, consumption) {
    this._cityId      = cityId;
    this._inventory   = inventory;
    this._consumption = consumption;

    // smoothed prices
    this._prices  = {};
    // price history arrays (for sparkline trend display)
    this._history = {};

    // Initialise prices at base values
    for (const [id, good] of Object.entries(GOODS)) {
      this._prices[id]  = good.basePrice;
      this._history[id] = [good.basePrice];
    }
  }

  /** Call once per game-day to recalculate all prices */
  recalculate() {
    for (const [id, good] of Object.entries(GOODS)) {
      const stock       = this._inventory[id]   ?? 0;
      const dailyDemand = this._consumption[id] ?? 0;

      let rawPrice;

      if (dailyDemand === 0) {
        // City doesn't consume this good - minor surplus pressure
        const ratio = stock / NORMAL_STOCK;
        rawPrice = good.basePrice * Math.max(0.4, 1 - ratio * 0.3);
      } else {
        // stockDays = how many days of supply remain
        const stockDays = dailyDemand > 0 ? stock / dailyDemand : stock / 1;
        // Target: 10 days of stock = neutral price
        const targetDays = 10;
        const ratio = stockDays / targetDays;
        // log curve: shortage -> high price, surplus -> low price
        // ratio=0 -> multiplier ~4, ratio=1 -> multiplier=1, ratio=2 -> ~0.5
        const multiplier = Math.pow(ratio + 0.01, -0.6);
        rawPrice = good.basePrice * multiplier;
      }

      // Apply floors and ceilings
      const floor   = good.basePrice * PRICE_FLOOR;
      const ceiling = good.basePrice * PRICE_CEILING;
      rawPrice = Math.max(floor, Math.min(ceiling, rawPrice));

      // EMA smoothing
      this._prices[id] = this._prices[id] * (1 - EMA_ALPHA) + rawPrice * EMA_ALPHA;

      // Record history
      this._history[id].push(Math.round(this._prices[id] * 10) / 10);
      if (this._history[id].length > HISTORY_LENGTH) {
        this._history[id].shift();
      }
    }
  }

  /** Get current smoothed price for a good */
  getPrice(goodId) {
    return Math.round(this._prices[goodId] ?? GOODS[goodId]?.basePrice ?? 0);
  }

  /** Get price history array for a good (for sparklines) */
  getHistory(goodId) {
    return this._history[goodId] ?? [];
  }

  /**
   * Returns trend string: 'up', 'down', 'flat'
   * based on last few data points
   */
  getTrend(goodId) {
    const h = this._history[goodId];
    if (!h || h.length < 3) return 'flat';
    const recent = h.slice(-3);
    const delta  = recent[recent.length - 1] - recent[0];
    const pct    = delta / (recent[0] || 1);
    if (pct >  0.02) return 'up';
    if (pct < -0.02) return 'down';
    return 'flat';
  }

  /**
   * Returns 'cheap', 'normal', or 'expensive' vs base price
   */
  getPriceClass(goodId) {
    const base    = GOODS[goodId]?.basePrice ?? 1;
    const current = this._prices[goodId] ?? base;
    const ratio   = current / base;
    if (ratio < 0.75) return 'cheap';
    if (ratio > 1.30) return 'expensive';
    return 'normal';
  }

  /** Serialise for save */
  serialize() {
    return { prices: { ...this._prices }, history: { ...this._history } };
  }

  load(data) {
    if (data.prices)  this._prices  = data.prices;
    if (data.history) this._history = data.history;
  }
}
