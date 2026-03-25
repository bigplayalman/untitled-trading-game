/**
 * player.js
 * Player state helpers and progression logic.
 *
 * The player has no personal carrying capacity.
 * All goods are transported via vehicles.
 */

import { TIER_NAMES } from '../engine/stateManager.js';
import { buildAdjacency, shortestPath } from '../world/worldMap.js';

export const TIER_THRESHOLDS = [
  { tier: 1, goldRequired: 500,    desc: 'Earn 500g total to become a Merchant.' },
  { tier: 2, goldRequired: 5000,   desc: 'Earn 5,000g total to become a Manufacturer.' },
  { tier: 3, goldRequired: 25000,  desc: 'Earn 25,000g total to become a Magnate.' },
  { tier: 4, goldRequired: 100000, desc: 'Earn 100,000g total to become a Governor.' },
  { tier: 5, goldRequired: 500000, desc: 'Earn 500,000g total to become a King.' },
];

export class Player {
  constructor(state, bus) {
    this._state = state;
    this._bus   = bus;
  }

  get gold()        { return this._state.player.gold; }
  get tier()        { return this._state.player.tier; }
  get tierName()    { return TIER_NAMES[this._state.player.tier]; }
  get currentCityId() { return this._state.player.currentCityId; }

  travelTo(cityId) {
    const prev = this._state.player.currentCityId;
    if (prev === cityId) return;

    const route = shortestPath(buildAdjacency(), prev, cityId);
    this._state.player.currentCityId = cityId;
    this._bus.publish('player:travel', {
      from: prev,
      to: cityId,
      path: route?.path ?? [prev, cityId],
      totalDistance: route?.totalDistance ?? 0,
    });
  }

  /** Check for tier-up on each day change */
  checkTierUp() {
    const currentTier = this._state.player.tier;
    if (currentTier >= TIER_THRESHOLDS.length) return;
    const next = TIER_THRESHOLDS[currentTier];
    if (this._state.stats.totalGoldEarned >= next.goldRequired) {
      this._state.player.tier = next.tier;
      this._bus.publish('player:tierUp', {
        tier:     next.tier,
        tierName: TIER_NAMES[next.tier],
      });
    }
  }
}
