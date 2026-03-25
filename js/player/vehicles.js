/**
 * vehicles.js
 * Vehicle class and vehicle type definitions.
 *
 * Vehicles carry cargo between cities. The player manually loads/unloads
 * cargo and dispatches vehicles to a destination. On arrival, cargo sits
 * in transit storage at the destination city until the player collects it.
 */

/** Vehicle type definitions */
export const VEHICLE_TYPES = {
  hand_cart: {
    id:       'hand_cart',
    name:     'Hand Cart',
    icon:     '🛒',
    speed:    20,      // km per game-hour
    capacity: 30,      // cargo units
    cost:     0,       // free starter vehicle
    minTier:  0,
    description: 'A simple wooden cart. Slow but free.',
  },
  horse_wagon: {
    id:       'horse_wagon',
    name:     'Horse Wagon',
    icon:     '🐴',
    speed:    40,
    capacity: 80,
    cost:     200,
    minTier:  0,
    description: 'A sturdy wagon pulled by two horses. Good capacity.',
  },
  steam_wagon: {
    id:       'steam_wagon',
    name:     'Steam Wagon',
    icon:     '🚂',
    speed:    70,
    capacity: 150,
    cost:     800,
    minTier:  1,
    description: 'Coal-powered road hauler. Fast and reliable.',
  },
  airship: {
    id:       'airship',
    name:     'Airship',
    icon:     '🎈',
    speed:    120,
    capacity: 300,
    cost:     3000,
    minTier:  2,
    description: 'Aetheric lift vessel. Ignores terrain, moves between any connected cities at top speed.',
  },
};

let _nextId = 1;

export class Vehicle {
  /**
   * @param {string} typeId   - key from VEHICLE_TYPES
   * @param {string} cityId   - starting city
   */
  constructor(typeId, cityId) {
    const def = VEHICLE_TYPES[typeId];
    if (!def) throw new Error(`Unknown vehicle type: ${typeId}`);

    this.id       = `v${_nextId++}`;
    this.typeId   = typeId;
    this.name     = def.name;
    this.icon     = def.icon;
    this.speed    = def.speed;
    this.capacity = def.capacity;

    // Cargo: { goodId: qty }
    this.cargo    = {};

    // Location / travel state
    this.status           = 'idle';   // 'idle' | 'travelling' | 'arrived'
    this.currentCityId    = cityId;   // city where vehicle is idle or last departed from
    this.fromCityId       = cityId;
    this.toCityId         = null;
    this.distanceTotal    = 0;
    this.distanceTravelled= 0;

    // Derived: 0-1 progress for map rendering
    this.progress = 0;

    // ETA tracking
    this.etaHours = 0;
  }

  /** How many cargo units are currently loaded */
  get cargoUsed() {
    return Object.values(this.cargo).reduce((sum, q) => sum + q, 0);
  }

  get cargoFree() {
    return this.capacity - this.cargoUsed;
  }

  get isIdle()       { return this.status === 'idle'; }
  get isTravelling() { return this.status === 'travelling'; }
  get hasArrived()   { return this.status === 'arrived'; }

  /**
   * Load goods from a source inventory onto this vehicle.
   * Returns { ok, message }
   */
  loadCargo(goodId, qty, sourceInventory) {
    if (!this.isIdle) return { ok: false, message: `${this.name} is not idle.` };
    if (qty <= 0)     return { ok: false, message: 'Invalid quantity.' };

    const available = sourceInventory[goodId] ?? 0;
    if (available < qty) return { ok: false, message: `Only ${available} available to load.` };
    if (this.cargoFree < qty) {
      return { ok: false, message: `Only ${this.cargoFree} cargo space remaining on ${this.name}.` };
    }

    sourceInventory[goodId] = available - qty;
    if (sourceInventory[goodId] === 0) delete sourceInventory[goodId];
    this.cargo[goodId] = (this.cargo[goodId] ?? 0) + qty;
    return { ok: true, message: `Loaded ${qty} onto ${this.name}.` };
  }

  /**
   * Unload goods from vehicle back into a destination inventory.
   * Returns { ok, message }
   */
  unloadCargo(goodId, qty, destInventory) {
    if (this.isTravelling) return { ok: false, message: `${this.name} is en route.` };
    const onboard = this.cargo[goodId] ?? 0;
    if (onboard < qty) return { ok: false, message: `Only ${onboard} of that on board.` };

    this.cargo[goodId] = onboard - qty;
    if (this.cargo[goodId] === 0) delete this.cargo[goodId];
    destInventory[goodId] = (destInventory[goodId] ?? 0) + qty;
    return { ok: true, message: `Unloaded ${qty} from ${this.name}.` };
  }

  /** Unload ALL cargo into destination inventory */
  unloadAll(destInventory) {
    for (const [goodId, qty] of Object.entries(this.cargo)) {
      destInventory[goodId] = (destInventory[goodId] ?? 0) + qty;
    }
    this.cargo = {};
  }

  /**
   * Dispatch vehicle to a destination city.
   * @param {string} toCityId
   * @param {number} distance  km
   */
  dispatch(toCityId, distance) {
    if (!this.isIdle) return { ok: false, message: `${this.name} is already travelling.` };
    if (toCityId === this.currentCityId) return { ok: false, message: 'Already at that city.' };

    this.status            = 'travelling';
    this.fromCityId        = this.currentCityId;
    this.toCityId          = toCityId;
    this.distanceTotal     = distance;
    this.distanceTravelled = 0;
    this.progress          = 0;
    this.etaHours          = distance / this.speed;
    return { ok: true, message: `${this.name} dispatched to ${toCityId}.` };
  }

  /**
   * Advance travel progress.
   * @param {number} gameHoursElapsed
   * @returns {boolean} true if arrived this tick
   */
  tick(gameHoursElapsed) {
    if (!this.isTravelling) return false;

    const kmTravelled = this.speed * gameHoursElapsed;
    this.distanceTravelled = Math.min(
      this.distanceTotal,
      this.distanceTravelled + kmTravelled
    );
    this.progress = this.distanceTravelled / this.distanceTotal;
    this.etaHours = Math.max(0, (this.distanceTotal - this.distanceTravelled) / this.speed);

    if (this.distanceTravelled >= this.distanceTotal) {
      this.status        = 'arrived';
      this.progress      = 1;
      this.currentCityId = this.toCityId;
      this.etaHours      = 0;
      return true; // signal arrival
    }
    return false;
  }

  /** After arrival is processed, set vehicle back to idle at destination */
  setIdle() {
    this.status    = 'idle';
    this.fromCityId= this.currentCityId;
    this.toCityId  = null;
    this.progress  = 0;
  }

  getEtaString() {
    if (!this.isTravelling) return '';
    const h = Math.floor(this.etaHours);
    const m = Math.floor((this.etaHours - h) * 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  }

  serialize() {
    return {
      id:                this.id,
      typeId:            this.typeId,
      name:              this.name,
      icon:              this.icon,
      speed:             this.speed,
      capacity:          this.capacity,
      cargo:             { ...this.cargo },
      status:            this.status,
      currentCityId:     this.currentCityId,
      fromCityId:        this.fromCityId,
      toCityId:          this.toCityId,
      distanceTotal:     this.distanceTotal,
      distanceTravelled: this.distanceTravelled,
      progress:          this.progress,
      etaHours:          this.etaHours,
    };
  }

  static fromSave(data) {
    const v = new Vehicle(data.typeId, data.currentCityId);
    Object.assign(v, data);
    return v;
  }
}
