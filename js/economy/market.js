/**
 * market.js
 * Handles player buy/sell transactions.
 *
 * All goods flow through vehicles — the player has no personal inventory.
 *
 * buy(cityId, goodId, qty, vehicle)
 *   → goods go from city stock into vehicle.transport
 *
 * sell(cityId, goodId, qty, vehicle)
 *   → goods go from vehicle.transport into city stock, gold to player
 */

import { GOODS } from './goods.js';

export class Market {
  constructor(state, cities, bus) {
    this._state  = state;
    this._cities = cities;
    this._bus    = bus;
  }

  /**
   * Player buys goods into a vehicle's transport bay.
   * @param {string}  cityId
   * @param {string}  goodId
   * @param {number}  qty
   * @param {Vehicle} vehicle  - destination vehicle (must be idle at this city)
   * Returns { ok, message, cost }
   */
  buy(cityId, goodId, qty, vehicle) {
    qty = Math.max(1, Math.floor(qty));
    const city   = this._cities.get(cityId);
    const good   = GOODS[goodId];
    const player = this._state.player;

    if (!city || !good) return { ok: false, message: 'Invalid city or good.' };

    if (!vehicle) {
      return { ok: false, message: 'Select a vehicle to load goods into.' };
    }
    if (vehicle.isTravelling) {
      return { ok: false, message: `${vehicle.name} is currently en route.` };
    }
    if (vehicle.currentCityId !== cityId) {
      return { ok: false, message: `${vehicle.name} is not at this city.` };
    }

    // Check city stock
    if (!city.canBuy(goodId, qty)) {
      const stock = city.inventory[goodId] ?? 0;
      return { ok: false, message: `Not enough stock. City has ${stock} ${good.name}.` };
    }

    // Check vehicle transport capacity (weight-based)
    const weightNeeded = good.weight * qty;
    if (weightNeeded > vehicle.transportFree) {
      const canLoad = vehicle.maxLoadable(goodId);
      return {
        ok: false,
        message: canLoad > 0
          ? `Not enough transport space. ${vehicle.name} can take ${canLoad} more ${good.name}.`
          : `${vehicle.name} is full (${vehicle.transportUsed}/${vehicle.capacity} wt).`,
      };
    }

    // Check gold
    const cost = city.getBuyPrice(goodId) * qty;
    if (player.gold < cost) {
      return { ok: false, message: `Not enough gold. Need ${cost}g, have ${Math.floor(player.gold)}g.` };
    }

    // Commit
    city.playerBuys(goodId, qty);
    player.gold -= cost;
    vehicle.transport[goodId] = (vehicle.transport[goodId] ?? 0) + qty;

    this._state.stats.totalTrades++;
    this._bus.publish('market:buy', {
      cityId, goodId, qty, cost,
      vehicleId: vehicle.id,
      priceEach: Math.round(cost / qty),
    });

    return { ok: true, message: `Bought ${qty}x ${good.name} for ${cost}g → ${vehicle.name}.`, cost };
  }

  /**
   * Player sells goods from a vehicle's transport bay.
   * @param {string}  cityId
   * @param {string}  goodId
   * @param {number}  qty
   * @param {Vehicle} vehicle  - source vehicle (must be at this city)
   * Returns { ok, message, earned }
   */
  sell(cityId, goodId, qty, vehicle) {
    qty = Math.max(1, Math.floor(qty));
    const city   = this._cities.get(cityId);
    const good   = GOODS[goodId];
    const player = this._state.player;

    if (!city || !good) return { ok: false, message: 'Invalid city or good.' };

    if (!vehicle) {
      return { ok: false, message: 'Select a vehicle to sell from.' };
    }
    if (vehicle.isTravelling) {
      return { ok: false, message: `${vehicle.name} is currently en route.` };
    }
    if (vehicle.currentCityId !== cityId) {
      return { ok: false, message: `${vehicle.name} is not at this city.` };
    }

    const onboard = vehicle.transport[goodId] ?? 0;
    if (onboard < qty) {
      return { ok: false, message: `${vehicle.name} only has ${onboard} ${good.name}.` };
    }

    const earned = city.playerSells(goodId, qty);

    // Commit
    vehicle.transport[goodId] = onboard - qty;
    if (vehicle.transport[goodId] === 0) delete vehicle.transport[goodId];
    player.gold += earned;

    this._state.stats.totalGoldEarned += earned;
    this._state.stats.totalTrades++;
    this._bus.publish('market:sell', {
      cityId, goodId, qty, earned,
      vehicleId: vehicle.id,
      priceEach: Math.round(earned / qty),
    });

    return { ok: true, message: `Sold ${qty}x ${good.name} for ${earned}g.`, earned };
  }
}
