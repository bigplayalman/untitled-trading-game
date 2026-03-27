/**
 * reputation.js
 * Reputation logic sourced from declarative progression data.
 */

import {
  DEMAND_REP_MULTIPLIERS,
  REP_GAIN_BY_CATEGORY,
  REP_TIERS,
  SELL_BONUS_BY_REP,
} from '../data/progression.js';

export { REP_TIERS };

export function getRepTier(rep) {
  let tier = REP_TIERS[0];
  for (const candidate of REP_TIERS) {
    if (rep >= candidate.min) tier = candidate;
  }
  return tier;
}

export function getRepProgress(rep) {
  const tier = getRepTier(rep);
  const idx = REP_TIERS.indexOf(tier);
  const next = REP_TIERS[idx + 1];
  if (!next) return 100;
  return Math.round(((rep - tier.min) / (next.min - tier.min)) * 100);
}

export function getSellBonus(rep) {
  return SELL_BONUS_BY_REP.find(entry => rep >= entry.minRep)?.multiplier ?? 1.0;
}

export function gainFromTrade(category, priceRatio, isSell) {
  const base = REP_GAIN_BY_CATEGORY[category] ?? REP_GAIN_BY_CATEGORY.raw;
  if (!isSell) return base;

  const demandMult = DEMAND_REP_MULTIPLIERS.find(
    entry => priceRatio > entry.minPriceRatio
  )?.multiplier ?? 1.0;

  return base * demandMult;
}

export function canBuy(rep, good) {
  const minRep = good.minReputation ?? 0;
  if (rep >= minRep) return { ok: true, minRep, tierName: '' };
  const tier = REP_TIERS.slice().reverse().find(entry => entry.min <= minRep) ?? REP_TIERS[0];
  return { ok: false, minRep, tierName: tier.name };
}

export function canSell(rep, good) {
  const buyAccess = canBuy(rep, good);
  return {
    ok: true,
    minRepSell: good.minRepSell ?? 0,
    tierName: buyAccess.ok ? '' : buyAccess.tierName,
    lockedToBuy: !buyAccess.ok,
    sellMultiplier: buyAccess.ok ? 1 : 0.5,
  };
}

export function getRepForCity(state, cityId) {
  return state.player.reputation[cityId] ?? 0;
}

export function addRep(state, cityId, bus, amount) {
  const prev = state.player.reputation[cityId] ?? 0;
  const prevTier = getRepTier(prev).min;

  const next = Math.min(100, prev + amount);
  state.player.reputation[cityId] = next;

  const newTier = getRepTier(next);

  bus.publish('reputation:gained', {
    cityId,
    amount,
    newRep: next,
    tierName: newTier.name,
  });

  if (newTier.min > prevTier) {
    bus.publish('reputation:tierUp', {
      cityId,
      tier: newTier.min,
      tierName: newTier.name,
      color: newTier.color,
    });
  }
}
