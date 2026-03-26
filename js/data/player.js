/**
 * player.js
 * Declarative player, fleet, and initial-state data.
 */

export const TIER_NAMES = [
  'Peddler',
  'Merchant',
  'Manufacturer',
  'Magnate',
  'Governor',
  'King',
];

export const PLAYER_TIER_THRESHOLDS = [
  { tier: 1, goldRequired: 500, desc: 'Earn 500g total to become a Merchant.' },
  { tier: 2, goldRequired: 5000, desc: 'Earn 5,000g total to become a Manufacturer.' },
  { tier: 3, goldRequired: 25000, desc: 'Earn 25,000g total to become a Magnate.' },
  { tier: 4, goldRequired: 100000, desc: 'Earn 100,000g total to become a Governor.' },
  { tier: 5, goldRequired: 500000, desc: 'Earn 500,000g total to become a King.' },
];

export const VEHICLE_TYPES = {
  hand_cart: {
    id: 'hand_cart',
    name: 'Hand Cart',
    icon: '🛒',
    speed: 20,
    capacity: 30,
    cost: 0,
    minTier: 0,
    description: 'A simple wooden cart. Slow but free. Carries 30 wt - good for finished goods.',
  },
  horse_wagon: {
    id: 'horse_wagon',
    name: 'Horse Wagon',
    icon: '🐴',
    speed: 40,
    capacity: 80,
    cost: 200,
    minTier: 0,
    description: 'A sturdy wagon pulled by two horses. 80 wt capacity.',
  },
  steam_wagon: {
    id: 'steam_wagon',
    name: 'Steam Wagon',
    icon: '🚂',
    speed: 70,
    capacity: 150,
    cost: 800,
    minTier: 1,
    description: 'Coal-powered road hauler. 150 wt - viable for bulk raw goods.',
  },
  airship: {
    id: 'airship',
    name: 'Airship',
    icon: '🎈',
    speed: 120,
    capacity: 300,
    cost: 3000,
    minTier: 2,
    description: 'Aetheric lift vessel. 300 wt - the ultimate bulk transporter.',
  },
};

export const INITIAL_STATE = {
  player: {
    name: '',
    gold: 50,
    reputation: {
      cogsworth: 10,
      ironhaven: 0,
      verdania: 0,
      steamport: 0,
      crystaldeep: 0,
      millhurst: 0,
      windhollow: 0,
    },
    currentCityId: 'cogsworth',
    tier: 0,
  },
  vehicles: [],
  routes: [],
  cities: {},
  milestones: {
    completed: [],
    active: 'intro_01',
  },
  flags: {},
  stats: {
    totalGoldEarned: 0,
    totalTrades: 0,
    daysSurvived: 0,
  },
};
