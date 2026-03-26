/**
 * city.js
 * City class: manages inventory, production buildings, population,
 * daily production/consumption cycles.
 */

import { GOODS } from './goods.js';
import { PriceEngine } from './priceEngine.js';

export class City {
  /**
   * @param {object} def - City definition from cities.js
   */
  constructor(def) {
    this.id          = def.id;
    this.name        = def.name;
    this.description = def.description;
    this.x           = def.x;     // map position 0-1 normalised
    this.y           = def.y;
    this.color       = def.color ?? '#b5891c';

    this.population  = def.startPopulation ?? 1000;
    this.wealth      = def.startWealth     ?? 500;

    // Goods the city naturally produces each day (economic personality)
    // { goodId: unitsPerDay }
    this.naturalProduction = { ...def.naturalProduction };

    // Goods the city consumes each day (population needs)
    // { goodId: unitsPerDay }
    this.dailyConsumption  = { ...def.dailyConsumption };

    // Current inventory
    this.inventory = {};
    // Initialise with starting stock
    for (const [id] of Object.entries(GOODS)) {
      this.inventory[id] = def.startInventory?.[id] ?? 0;
    }

    // Player-owned production buildings in this city
    // [{ recipeId, level, progressDays }]
    this.playerBuildings = [];

    this._dayAccumulator = 0;

    // Price engine takes live references to inventory & consumption
    this.priceEngine = new PriceEngine(this.id, this.inventory, this.dailyConsumption);
  }

  /**
   * Called every simulation tick with game-hours elapsed.
   * Accumulates into days before running daily logic.
   */
  tick(gameHoursElapsed) {
    this._dayAccumulator += gameHoursElapsed;
    while (this._dayAccumulator >= 24) {
      this._dayAccumulator -= 24;
      this._runDay();
    }
  }

  _runDay() {
    // 1. Natural production
    for (const [id, qty] of Object.entries(this.naturalProduction)) {
      this.inventory[id] = (this.inventory[id] ?? 0) + qty;
    }

    // 2. Consumption - city buys from its own stock
    for (const [id, qty] of Object.entries(this.dailyConsumption)) {
      const current = this.inventory[id] ?? 0;
      const consumed = Math.min(current, qty);
      this.inventory[id] = current - consumed;

      // Wealth adjusts based on how well-fed/supplied the city is
      if (consumed < qty) {
        this.wealth = Math.max(0, this.wealth - (qty - consumed) * 2);
      } else {
        this.wealth = Math.min(99999, this.wealth + 1);
      }
    }

    // 3. Cap inventory at reasonable max (warehouse limits)
    for (const id of Object.keys(this.inventory)) {
      this.inventory[id] = Math.min(this.inventory[id], 500);
    }

    // 4. Recalculate prices
    this.priceEngine.recalculate();

    // 5. Slow population growth if well-supplied
    const hasBread = (this.inventory['bread'] ?? 0) > 10;
    if (hasBread && this.population < 50000) {
      this.population += Math.floor(this.population * 0.0002);
    }
  }

  /** Get the current buy price (city sells to player) */
  getBuyPrice(goodId) {
    return this.priceEngine.getPrice(goodId);
  }

  /** Get the current sell price (player sells to city) - slightly lower */
  getSellPrice(goodId) {
    return Math.max(1, Math.floor(this.priceEngine.getPrice(goodId) * 0.92));
  }

  /** Check if city has enough stock for player to buy */
  canBuy(goodId, qty) {
    return (this.inventory[goodId] ?? 0) >= qty;
  }

  /** Player buys from city: city loses stock, returns price paid */
  playerBuys(goodId, qty) {
    const price = this.getBuyPrice(goodId);
    const total = price * qty;
    this.inventory[goodId] = Math.max(0, (this.inventory[goodId] ?? 0) - qty);
    this.priceEngine.recalculate();
    return total;
  }

  /** Player sells to city: city gains stock, returns gold received */
  playerSells(goodId, qty) {
    const price = this.getSellPrice(goodId);
    const total = price * qty;
    this.inventory[goodId] = (this.inventory[goodId] ?? 0) + qty;
    this.priceEngine.recalculate();
    return total;
  }

  /** Summary for map tooltip */
  getSummary() {
    return {
      id:         this.id,
      name:       this.name,
      population: this.population,
      wealth:     this.wealth,
    };
  }

  serialize() {
    return {
      id:              this.id,
      population:      this.population,
      wealth:          this.wealth,
      inventory:       { ...this.inventory },
      playerBuildings: this.playerBuildings.map(b => ({ ...b })),
      priceEngine:     this.priceEngine.serialize(),
    };
  }

  loadSave(data) {
    this.population      = data.population ?? this.population;
    this.wealth          = data.wealth     ?? this.wealth;
    Object.keys(this.inventory).forEach(id => {
      this.inventory[id] = data.inventory?.[id] ?? 0;
    });
    this.playerBuildings = data.playerBuildings ?? [];
    if (data.priceEngine) this.priceEngine.load(data.priceEngine);
  }
}
