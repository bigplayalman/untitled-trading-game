/**
 * progression.js
 * Declarative progression and reputation tuning data.
 */

export const REP_TIERS = [
  { min: 0, name: 'Stranger', color: '#9a8a60' },
  { min: 20, name: 'Acquaintance', color: '#60a0d0' },
  { min: 40, name: 'Known Trader', color: '#5fca5f' },
  { min: 60, name: 'Trusted Merchant', color: '#b5891c' },
  { min: 80, name: 'City Partner', color: '#c060c0' },
];

export const REP_GAIN_BY_CATEGORY = {
  raw: 0.3,
  processed: 0.5,
  finished: 0.8,
};

export const SELL_BONUS_BY_REP = [
  { minRep: 80, multiplier: 1.1 },
  { minRep: 60, multiplier: 1.06 },
  { minRep: 40, multiplier: 1.03 },
  { minRep: 0, multiplier: 1.0 },
];

export const DEMAND_REP_MULTIPLIERS = [
  { minPriceRatio: 2.0, multiplier: 2.0 },
  { minPriceRatio: 1.3, multiplier: 1.5 },
  { minPriceRatio: 0.75, multiplier: 1.0 },
  { minPriceRatio: -Infinity, multiplier: 0.5 },
];
