/**
 * market.js
 * Handles player buy/sell transactions.
 *
 * All goods flow through vehicles — the player has no personal inventory.
 * Reputation gates which goods can be bought at each city.
 * Selling high-demand goods gives boosted reputation gain.
 * Higher reputation gives a sell price bonus.
 */

import { GOODS }                                        from './goods.js';
import { canBuy, canSell, addRep, gainFromTrade,
         getSellBonus, getRepForCity }                  from '../player/reputation.js';

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
   * @param {Vehicle} vehicle
   * Returns { ok, message, cost }
   */
  buy(cityId, goodId, qty, vehicle) {
    qty = Math.max(1, Math.floor(qty));
    const city   = this._cities.get(cityId);
    const good   = GOODS[goodId];
    const player = this._state.player;

    if (!city || !good) return { ok: false, message: 'Invalid city or good.' };

    // Vehicle checks
    if (!vehicle)              return { ok: false, message: 'Select a vehicle to load goods into.' };
    if (vehicle.isTravelling)  return { ok: false, message: `${vehicle.name} is currently en route.` };
    if (vehicle.currentCityId !== cityId) return { ok: false, message: `${vehicle.name} is not at this city.` };

    // Reputation gate
    const rep    = getRepForCity(this._state, cityId);
    const repChk = canBuy(rep, good);
    if (!repChk.ok) {
      return {
        ok: false,
        message: `Need ${repChk.minRep} reputation (${repChk.tierName}) to buy ${good.name} here. You have ${Math.floor(rep)}.`,
      };
    }

    // City stock check
    if (!city.canBuy(goodId, qty)) {
      const stock = city.inventory[goodId] ?? 0;
      return { ok: false, message: `Not enough stock. City has ${stock} ${good.name}.` };
    }

    // Vehicle transport capacity (weight-based)
    const weightNeeded = good.weight * qty;
    if (weightNeeded > vehicle.transportFree) {
      const canLoad = vehicle.maxLoadable(goodId);
      return {
        ok: false,
        message: canLoad > 0
          ? `Not enough space. ${vehicle.name} can take ${canLoad} more ${good.name}.`
          : `${vehicle.name} is full (${vehicle.transportUsed}/${vehicle.capacity} wt).`,
      };
    }

    // Gold check
    const cost = city.getBuyPrice(goodId) * qty;
    if (player.gold < cost) {
      return { ok: false, message: `Not enough gold. Need ${cost}g, have ${Math.floor(player.gold)}g.` };
    }

    // Commit
    city.playerBuys(goodId, qty);
    player.gold -= cost;
    const previousQty = vehicle.transport[goodId] ?? 0;
    const previousCostBasis = vehicle.transportCostBasis?.[goodId] ?? 0;
    vehicle.transport[goodId] = previousQty + qty;
    vehicle.transportCostBasis[goodId] = previousCostBasis + cost;

    // Reputation gain (base only for buying — no demand multiplier)
    const repGain = gainFromTrade(good.category, 1, false);
    addRep(this._state, cityId, this._bus, repGain);

    this._state.stats.totalTrades++;
    this._bus.publish('market:buy', {
      cityId, goodId, qty, cost,
      vehicleId: vehicle.id,
      priceEach: Math.round(cost / qty),
      repGain,
    });

    return { ok: true, message: `Bought ${qty}x ${good.name} for ${cost}g → ${vehicle.name}.`, cost };
  }

  /**
   * Player sells goods from a vehicle's transport bay.
   * @param {string}  cityId
   * @param {string}  goodId
   * @param {number}  qty
   * @param {Vehicle} vehicle
   * Returns { ok, message, earned }
   */
  sell(cityId, goodId, qty, vehicle) {
    qty = Math.max(1, Math.floor(qty));
    const city   = this._cities.get(cityId);
    const good   = GOODS[goodId];
    const player = this._state.player;

    if (!city || !good) return { ok: false, message: 'Invalid city or good.' };

    // Vehicle checks
    if (!vehicle)             return { ok: false, message: 'Select a vehicle to sell from.' };
    if (vehicle.isTravelling) return { ok: false, message: `${vehicle.name} is currently en route.` };
    if (vehicle.currentCityId !== cityId) return { ok: false, message: `${vehicle.name} is not at this city.` };

    // Selling is always allowed, but locked-to-buy goods pay less
    const rep    = getRepForCity(this._state, cityId);
    const repChk = canSell(rep, good);

    // Transport check
    const onboard = vehicle.transport[goodId] ?? 0;
    if (onboard < qty) {
      return { ok: false, message: `${vehicle.name} only has ${onboard} ${good.name}.` };
    }

    // Base sell price × reputation bonus
    const baseEarned  = city.playerSells(goodId, qty);
    const lockPenalty = repChk.sellMultiplier ?? 1;
    const repBonus    = getSellBonus(rep);
    const adjustedBase = Math.round(baseEarned * lockPenalty);
    const earned      = Math.round(adjustedBase * repBonus);
    const penaltyLost = baseEarned - adjustedBase;
    const bonusEarned = earned - adjustedBase;

    // Demand-scaled reputation gain
    const currentPrice = city.getSellPrice(goodId);
    const priceRatio   = currentPrice / (good.basePrice || 1);
    const repGain      = gainFromTrade(good.category, priceRatio, true);

    // Commit
    vehicle.transport[goodId] = onboard - qty;
    const avgBuyPrice = onboard > 0 ? ((vehicle.transportCostBasis?.[goodId] ?? 0) / onboard) : 0;
    const remainingQty = vehicle.transport[goodId];
    if (remainingQty > 0) {
      vehicle.transportCostBasis[goodId] = Math.max(0, Math.round((avgBuyPrice * remainingQty) * 100) / 100);
    } else {
      delete vehicle.transport[goodId];
      delete vehicle.transportCostBasis[goodId];
    }
    player.gold += earned;

    addRep(this._state, cityId, this._bus, repGain);

    this._state.stats.totalGoldEarned += earned;
    this._state.stats.totalTrades++;
    this._bus.publish('market:sell', {
      cityId, goodId, qty, earned, bonusEarned,
      vehicleId: vehicle.id,
      priceEach: Math.round(earned / qty),
      priceRatio,
      repGain,
      lockedToBuy: repChk.lockedToBuy,
      penaltyLost,
    });

    const penaltyStr = repChk.lockedToBuy ? ` (-${penaltyLost}g locked-item penalty)` : '';
    const bonusStr = bonusEarned > 0 ? ` (+${bonusEarned}g rep bonus)` : '';
    return { ok: true, message: `Sold ${qty}x ${good.name} for ${earned}g${penaltyStr}${bonusStr}.`, earned };
  }
}
