/**
 * market.js
 * Handles player buy/sell transactions and validates them against
 * player inventory, gold, and city stock.
 */

import { GOODS } from './goods.js';

export class Market {
  /**
   * @param {object} state     - central game state
   * @param {Map}    cities    - Map<id, City>
   * @param {EventBus} bus
   */
  constructor(state, cities, bus) {
    this._state  = state;
    this._cities = cities;
    this._bus    = bus;
  }

  /**
   * Player buys qty of goodId from cityId.
   * Returns { ok, message, cost }
   */
  buy(cityId, goodId, qty) {
    qty = Math.max(1, Math.floor(qty));
    const city   = this._cities.get(cityId);
    const good   = GOODS[goodId];
    const player = this._state.player;

    if (!city || !good) return { ok: false, message: 'Invalid city or good.' };

    // Check city stock
    if (!city.canBuy(goodId, qty)) {
      const stock = city.inventory[goodId] ?? 0;
      return { ok: false, message: `Not enough stock. City has ${stock} ${good.name}.` };
    }

    // Check player can carry (weight * qty vs remaining capacity)
    const currentLoad = this._getInventoryWeight(player.inventory);
    const addWeight   = good.weight * qty;
    if (currentLoad + addWeight > player.cargoCapacity) {
      const remaining = player.cargoCapacity - currentLoad;
      return { ok: false, message: `Not enough cargo space. Remaining: ${remaining} units.` };
    }

    const cost = city.playerBuys(goodId, qty);

    // Check gold
    if (player.gold < cost) {
      // Undo the stock removal
      city.inventory[goodId] = (city.inventory[goodId] ?? 0) + qty;
      return { ok: false, message: `Not enough gold. Need ${cost}g, have ${player.gold}g.` };
    }

    // Commit transaction
    player.gold -= cost;
    player.inventory[goodId] = (player.inventory[goodId] ?? 0) + qty;

    this._state.stats.totalTrades++;
    this._bus.publish('market:buy', { cityId, goodId, qty, cost, priceEach: Math.round(cost / qty) });

    return { ok: true, message: `Bought ${qty}x ${good.name} for ${cost}g.`, cost };
  }

  /**
   * Player sells qty of goodId to cityId.
   * Returns { ok, message, earned }
   */
  sell(cityId, goodId, qty) {
    qty = Math.max(1, Math.floor(qty));
    const city   = this._cities.get(cityId);
    const good   = GOODS[goodId];
    const player = this._state.player;

    if (!city || !good) return { ok: false, message: 'Invalid city or good.' };

    const owned = player.inventory[goodId] ?? 0;
    if (owned < qty) {
      return { ok: false, message: `You only have ${owned} ${good.name}.` };
    }

    const earned = city.playerSells(goodId, qty);

    // Commit
    player.inventory[goodId] = owned - qty;
    if (player.inventory[goodId] === 0) delete player.inventory[goodId];
    player.gold += earned;

    this._state.stats.totalGoldEarned += earned;
    this._state.stats.totalTrades++;
    this._bus.publish('market:sell', { cityId, goodId, qty, earned, priceEach: Math.round(earned / qty) });

    return { ok: true, message: `Sold ${qty}x ${good.name} for ${earned}g.`, earned };
  }

  /** Inventory weight helper */
  _getInventoryWeight(inventory) {
    let total = 0;
    for (const [id, qty] of Object.entries(inventory)) {
      total += (GOODS[id]?.weight ?? 1) * qty;
    }
    return total;
  }
}
