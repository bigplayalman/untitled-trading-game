/**
 * stateManager.js
 * Central event bus + game state container.
 * All systems read/write game state through here.
 */

export class EventBus {
  constructor() {
    this._listeners = {};
  }

  subscribe(event, callback) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(callback);
    // Return unsubscribe function
    return () => {
      this._listeners[event] = this._listeners[event].filter(cb => cb !== callback);
    };
  }

  publish(event, data) {
    if (!this._listeners[event]) return;
    for (const cb of this._listeners[event]) {
      try { cb(data); } catch (e) { console.error(`EventBus error on ${event}:`, e); }
    }
  }
}

export function createInitialState() {
  return {
    player: {
      gold: 50,
      inventory: {},       // { goodId: quantity }
      cargoCapacity: 100,  // starting hand-cart capacity (units)
      reputation: {},      // { cityId: 0-100 }
      currentCityId: 'cogsworth',
      tier: 0,             // 0=Peddler, 1=Merchant, 2=Manufacturer, 3=Magnate, 4=Governor, 5=King
    },
    vehicles: [],          // Vehicle objects
    routes:   [],          // Active trade routes
    cities:   {},          // { cityId: CityState }
    milestones: {
      completed: [],
      active: 'intro_01',
    },
    flags: {},             // story/event flags
    stats: {
      totalGoldEarned: 0,
      totalTrades: 0,
      daysSurvived: 0,
    },
  };
}

export const TIER_NAMES = [
  'Peddler',
  'Merchant',
  'Manufacturer',
  'Magnate',
  'Governor',
  'King',
];
