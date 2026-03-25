/**
 * vehicles.js
 * Vehicle class and vehicle type definitions.
 *
 * Vehicles are the only way to transport goods between cities.
 * The player has no personal carrying capacity — all goods travel
 * via vehicle transport bays.
 *
 * Transport capacity is weight-based:
 *   - Raw goods are heavy (weight 2-4) — fewer units per vehicle
 *   - Processed goods are medium (weight 1-2)
 *   - Finished goods are light (weight 1) — most efficient to ship
 */

import { GOODS } from '../economy/goods.js';

/** Vehicle type definitions */
export const VEHICLE_TYPES = {
  hand_cart: {
    id:          'hand_cart',
    name:        'Hand Cart',
    icon:        '🛒',
    speed:       20,    // km per game-hour
    capacity:    30,    // transport capacity in weight units
    cost:        0,
    minTier:     0,
    description: 'A simple wooden cart. Slow but free. Carries 30 wt — good for finished goods.',
  },
  horse_wagon: {
    id:          'horse_wagon',
    name:        'Horse Wagon',
    icon:        '🐴',
    speed:       40,
    capacity:    80,
    cost:        200,
    minTier:     0,
    description: 'A sturdy wagon pulled by two horses. 80 wt capacity.',
  },
  steam_wagon: {
    id:          'steam_wagon',
    name:        'Steam Wagon',
    icon:        '🚂',
    speed:       70,
    capacity:    150,
    cost:        800,
    minTier:     1,
    description: 'Coal-powered road hauler. 150 wt — viable for bulk raw goods.',
  },
  airship: {
    id:          'airship',
    name:        'Airship',
    icon:        '🎈',
    speed:       120,
    capacity:    300,
    cost:        3000,
    minTier:     2,
    description: 'Aetheric lift vessel. 300 wt — the ultimate bulk transporter.',
  },
};

let _nextId = 1;

export class Vehicle {
  /**
   * @param {string} typeId  - key from VEHICLE_TYPES
   * @param {string} cityId  - starting city
   */
  constructor(typeId, cityId) {
    const def = VEHICLE_TYPES[typeId];
    if (!def) throw new Error(`Unknown vehicle type: ${typeId}`);

    this.id       = `v${_nextId++}`;
    this.typeId   = typeId;
    this.name     = def.name;
    this.icon     = def.icon;
    this.speed    = def.speed;
    this.capacity = def.capacity; // weight units

    // Transport bay: { goodId: qty }
    this.transport = {};
    this.transportCostBasis = {};

    // Location / travel state
    this.status            = 'idle'; // 'idle' | 'travelling'
    this.currentCityId     = cityId;
    this.fromCityId        = cityId;
    this.toCityId          = null;
    this.finalCityId       = cityId;
    this.distanceTotal     = 0;
    this.distanceTravelled = 0;
    this.routeQueue        = [];

    // 0-1 progress for map rendering
    this.progress  = 0;
    this.etaHours  = 0;
  }

  // ── Transport capacity (weight-based) ──────────────────────

  /** Total weight currently loaded */
  get transportUsed() {
    return Object.entries(this.transport).reduce(
      (sum, [id, qty]) => sum + (GOODS[id]?.weight ?? 1) * qty, 0
    );
  }

  /** Remaining weight capacity */
  get transportFree() {
    return this.capacity - this.transportUsed;
  }

  /** Max units of a specific good that can still be loaded */
  maxLoadable(goodId) {
    const w = GOODS[goodId]?.weight ?? 1;
    return Math.floor(this.transportFree / w);
  }

  // ── State helpers ──────────────────────────────────────────

  get isIdle()       { return this.status === 'idle'; }
  get isTravelling() { return this.status === 'travelling'; }

  // ── Transport operations ───────────────────────────────────

  /**
   * Load goods into this vehicle's transport bay.
   * sourceInventory is mutated (goods removed from it).
   * Returns { ok, message }
   */
  load(goodId, qty, sourceInventory) {
    if (!this.isIdle) return { ok: false, message: `${this.name} is not idle.` };
    if (qty <= 0)     return { ok: false, message: 'Invalid quantity.' };

    const good      = GOODS[goodId];
    const available = sourceInventory[goodId] ?? 0;
    const weightNeeded = (good?.weight ?? 1) * qty;

    if (available < qty) {
      return { ok: false, message: `Only ${available} available.` };
    }
    if (weightNeeded > this.transportFree) {
      const canLoad = this.maxLoadable(goodId);
      return {
        ok: false,
        message: canLoad > 0
          ? `Not enough transport space. Can load ${canLoad} more ${good?.name ?? goodId}.`
          : `${this.name} is full.`,
      };
    }

    sourceInventory[goodId] = available - qty;
    if (sourceInventory[goodId] === 0) delete sourceInventory[goodId];
    this.transport[goodId] = (this.transport[goodId] ?? 0) + qty;
    return { ok: true, message: `Loaded ${qty}x ${good?.name ?? goodId} onto ${this.name}.` };
  }

  /**
   * Remove goods from this vehicle's transport bay.
   * destInventory is mutated (goods added to it).
   * Returns { ok, message }
   */
  unload(goodId, qty, destInventory) {
    if (this.isTravelling) return { ok: false, message: `${this.name} is en route.` };
    const onboard = this.transport[goodId] ?? 0;
    if (onboard < qty) {
      return { ok: false, message: `Only ${onboard} on board.` };
    }

    this.transport[goodId] = onboard - qty;
    if (this.transport[goodId] === 0) delete this.transport[goodId];
    destInventory[goodId] = (destInventory[goodId] ?? 0) + qty;
    return { ok: true, message: `Unloaded ${qty} from ${this.name}.` };
  }

  /** Remove ALL goods from transport bay into destInventory */
  unloadAll(destInventory) {
    for (const [goodId, qty] of Object.entries(this.transport)) {
      destInventory[goodId] = (destInventory[goodId] ?? 0) + qty;
    }
    this.transport = {};
  }

  // ── Travel ─────────────────────────────────────────────────

  /**
   * Dispatch vehicle to a destination city.
   * @param {string} toCityId
   * @param {number} distance  km
   * Returns { ok, message }
   */
  dispatch(toCityId, distance, routeQueue = [], finalCityId = toCityId) {
    if (!this.isIdle)              return { ok: false, message: `${this.name} is already travelling.` };
    if (toCityId === this.currentCityId) return { ok: false, message: 'Already at that city.' };

    this.status            = 'travelling';
    this.fromCityId        = this.currentCityId;
    this.toCityId          = toCityId;
    this.finalCityId       = finalCityId;
    this.distanceTotal     = distance;
    this.distanceTravelled = 0;
    this.progress          = 0;
    this.etaHours          = distance / this.speed;
    this.routeQueue        = [...routeQueue];
    return { ok: true, message: `${this.name} dispatched.` };
  }

  /**
   * Advance travel. Returns true if arrived this tick.
   * @param {number} gameHoursElapsed
   */
  tick(gameHoursElapsed) {
    if (!this.isTravelling) return false;

    this.distanceTravelled = Math.min(
      this.distanceTotal,
      this.distanceTravelled + this.speed * gameHoursElapsed
    );
    this.progress  = this.distanceTravelled / this.distanceTotal;
    this.etaHours  = Math.max(0, (this.distanceTotal - this.distanceTravelled) / this.speed);

    if (this.distanceTravelled >= this.distanceTotal) {
      this.status        = 'idle';
      this.progress      = 0;
      this.currentCityId = this.toCityId;
      this.fromCityId    = this.currentCityId;
      this.etaHours      = 0;
      return true;
    }
    return false;
  }

  getEtaString() {
    if (!this.isTravelling) return '';
    const h = Math.floor(this.etaHours);
    const m = Math.floor((this.etaHours - h) * 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  // ── Serialisation ──────────────────────────────────────────

  serialize() {
    return {
      id:                this.id,
      typeId:            this.typeId,
      name:              this.name,
      icon:              this.icon,
      speed:             this.speed,
      capacity:          this.capacity,
      transport:         { ...this.transport },
      transportCostBasis:{ ...this.transportCostBasis },
      status:            this.status,
      currentCityId:     this.currentCityId,
      fromCityId:        this.fromCityId,
      toCityId:          this.toCityId,
      finalCityId:       this.finalCityId,
      distanceTotal:     this.distanceTotal,
      distanceTravelled: this.distanceTravelled,
      progress:          this.progress,
      etaHours:          this.etaHours,
      routeQueue:        [...this.routeQueue],
    };
  }

  static fromSave(data) {
    const v = new Vehicle(data.typeId, data.currentCityId);
    Object.assign(v, data);
    // Support legacy saves that used 'cargo' key
    if (!v.transport && data.cargo) v.transport = data.cargo;
    if (!v.transport) v.transport = {};
    if (!v.transportCostBasis) v.transportCostBasis = {};
    return v;
  }
}
