/**
 * player.js
 * Player state helpers and progression logic.
 */

import { PLAYER_TIER_THRESHOLDS, TIER_NAMES } from '../data/player.js';
import { buildAdjacency, shortestPath } from '../world/worldMap.js';

export const TIER_THRESHOLDS = PLAYER_TIER_THRESHOLDS;

export class Player {
  constructor(state, bus) {
    this._state = state;
    this._bus = bus;
  }

  get gold() { return this._state.player.gold; }
  get tier() { return this._state.player.tier; }
  get tierName() { return TIER_NAMES[this._state.player.tier]; }
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

  checkTierUp() {
    const currentTier = this._state.player.tier;
    if (currentTier >= TIER_THRESHOLDS.length) return;
    const next = TIER_THRESHOLDS[currentTier];
    if (this._state.stats.totalGoldEarned >= next.goldRequired) {
      this._state.player.tier = next.tier;
      this._bus.publish('player:tierUp', {
        tier: next.tier,
        tierName: TIER_NAMES[next.tier],
      });
    }
  }
}
