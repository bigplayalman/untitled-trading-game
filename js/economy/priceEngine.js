/**
 * priceEngine.js
 * Dynamic pricing model based on supply/demand ratio.
 */

import { GOODS, PRICE_CONFIG } from './goods.js';

export class PriceEngine {
  constructor(cityId, inventory, consumption) {
    this._cityId = cityId;
    this._inventory = inventory;
    this._consumption = consumption;
    this._prices = {};
    this._history = {};

    for (const [id, good] of Object.entries(GOODS)) {
      this._prices[id] = good.basePrice;
      this._history[id] = [good.basePrice];
    }
  }

  recalculate() {
    for (const [id, good] of Object.entries(GOODS)) {
      const stock = this._inventory[id] ?? 0;
      const dailyDemand = this._consumption[id] ?? 0;
      let rawPrice;

      if (dailyDemand === 0) {
        const ratio = stock / PRICE_CONFIG.normalStock;
        rawPrice = good.basePrice * Math.max(
          PRICE_CONFIG.noDemandFloor,
          1 - ratio * PRICE_CONFIG.noDemandStockPressure
        );
      } else {
        const stockDays = stock / dailyDemand;
        const ratio = stockDays / PRICE_CONFIG.neutralStockDays;
        const multiplier = Math.pow(
          ratio + PRICE_CONFIG.shortageCurveOffset,
          PRICE_CONFIG.shortageCurvePower
        );
        rawPrice = good.basePrice * multiplier;
      }

      const floor = good.basePrice * PRICE_CONFIG.priceFloor;
      const ceiling = good.basePrice * PRICE_CONFIG.priceCeiling;
      rawPrice = Math.max(floor, Math.min(ceiling, rawPrice));

      this._prices[id] = this._prices[id] * (1 - PRICE_CONFIG.emaAlpha) + rawPrice * PRICE_CONFIG.emaAlpha;
      this._history[id].push(Math.round(this._prices[id] * 10) / 10);
      if (this._history[id].length > PRICE_CONFIG.historyLength) {
        this._history[id].shift();
      }
    }
  }

  getPrice(goodId) {
    return Math.round(this._prices[goodId] ?? GOODS[goodId]?.basePrice ?? 0);
  }

  getHistory(goodId) {
    return this._history[goodId] ?? [];
  }

  getTrend(goodId) {
    const history = this._history[goodId];
    if (!history || history.length < 3) return 'flat';
    const recent = history.slice(-3);
    const delta = recent[recent.length - 1] - recent[0];
    const pct = delta / (recent[0] || 1);
    if (pct > 0.02) return 'up';
    if (pct < -0.02) return 'down';
    return 'flat';
  }

  getPriceClass(goodId) {
    const base = GOODS[goodId]?.basePrice ?? 1;
    const current = this._prices[goodId] ?? base;
    const ratio = current / base;
    if (ratio < 0.75) return 'cheap';
    if (ratio > 1.3) return 'expensive';
    return 'normal';
  }

  serialize() {
    return { prices: { ...this._prices }, history: { ...this._history } };
  }

  load(data) {
    if (data.prices) this._prices = data.prices;
    if (data.history) this._history = data.history;
  }
}
