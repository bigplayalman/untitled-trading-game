/**
 * city.js
 * City simulation backed by data-driven definitions and tuning knobs.
 */

import { GOODS, PRICE_CONFIG } from './goods.js';
import { PriceEngine } from './priceEngine.js';

export class City {
  constructor(def) {
    this.id = def.id;
    this.name = def.name;
    this.description = def.description;
    this.x = def.x;
    this.y = def.y;
    this.color = def.color ?? '#b5891c';

    this.population = def.startPopulation ?? 1000;
    this.wealth = def.startWealth ?? 500;
    this.naturalProduction = { ...def.naturalProduction };
    this.dailyConsumption = { ...def.dailyConsumption };
    this.inventory = {};

    for (const [id] of Object.entries(GOODS)) {
      this.inventory[id] = def.startInventory?.[id] ?? 0;
    }

    this.playerBuildings = [];
    this._dayAccumulator = 0;
    this.priceEngine = new PriceEngine(this.id, this.inventory, this.dailyConsumption);
  }

  tick(gameHoursElapsed) {
    this._dayAccumulator += gameHoursElapsed;
    while (this._dayAccumulator >= 24) {
      this._dayAccumulator -= 24;
      this._runDay();
    }
  }

  _runDay() {
    for (const [id, qty] of Object.entries(this.naturalProduction)) {
      this.inventory[id] = (this.inventory[id] ?? 0) + qty;
    }

    for (const [id, qty] of Object.entries(this.dailyConsumption)) {
      const current = this.inventory[id] ?? 0;
      const consumed = Math.min(current, qty);
      this.inventory[id] = current - consumed;

      if (consumed < qty) {
        this.wealth = Math.max(0, this.wealth - (qty - consumed) * 2);
      } else {
        this.wealth = Math.min(99999, this.wealth + 1);
      }
    }

    for (const id of Object.keys(this.inventory)) {
      this.inventory[id] = Math.min(this.inventory[id], PRICE_CONFIG.cityInventoryCap);
    }

    this.priceEngine.recalculate();

    const hasBread = (this.inventory.bread ?? 0) > PRICE_CONFIG.breadGrowthThreshold;
    if (hasBread && this.population < PRICE_CONFIG.maxPopulation) {
      this.population += Math.floor(this.population * PRICE_CONFIG.dailyPopulationGrowthRate);
    }
  }

  getBuyPrice(goodId) {
    return this.priceEngine.getPrice(goodId);
  }

  getSellPrice(goodId) {
    return Math.max(
      1,
      Math.floor(this.priceEngine.getPrice(goodId) * PRICE_CONFIG.playerSellPriceRatio)
    );
  }

  canBuy(goodId, qty) {
    return (this.inventory[goodId] ?? 0) >= qty;
  }

  playerBuys(goodId, qty) {
    const price = this.getBuyPrice(goodId);
    const total = price * qty;
    this.inventory[goodId] = Math.max(0, (this.inventory[goodId] ?? 0) - qty);
    this.priceEngine.recalculate();
    return total;
  }

  playerSells(goodId, qty) {
    const price = this.getSellPrice(goodId);
    const total = price * qty;
    this.inventory[goodId] = (this.inventory[goodId] ?? 0) + qty;
    this.priceEngine.recalculate();
    return total;
  }

  getSummary() {
    return {
      id: this.id,
      name: this.name,
      population: this.population,
      wealth: this.wealth,
    };
  }

  serialize() {
    return {
      id: this.id,
      population: this.population,
      wealth: this.wealth,
      inventory: { ...this.inventory },
      playerBuildings: this.playerBuildings.map(building => ({ ...building })),
      priceEngine: this.priceEngine.serialize(),
    };
  }

  loadSave(data) {
    this.population = data.population ?? this.population;
    this.wealth = data.wealth ?? this.wealth;
    this.inventory = { ...data.inventory };
    this.playerBuildings = data.playerBuildings ?? [];
    if (data.priceEngine) this.priceEngine.load(data.priceEngine);
  }
}
