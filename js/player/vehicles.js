/**
 * vehicles.js
 * Vehicle class and vehicle type definitions.
 *
 * Vehicles are the only way to transport goods between cities.
 * The player has no personal carrying capacity; all goods travel
 * via vehicle transport bays.
 */

import { GOODS } from '../economy/goods.js';
import { VEHICLE_TYPES } from '../data/player.js';

export { VEHICLE_TYPES };

let _nextId = 1;

export class Vehicle {
  /**
   * @param {string} typeId
   * @param {string} cityId
   */
  constructor(typeId, cityId) {
    const def = VEHICLE_TYPES[typeId];
    if (!def) throw new Error(`Unknown vehicle type: ${typeId}`);

    this.id = `v${_nextId++}`;
    this.typeId = typeId;
    this.name = def.name;
    this.icon = def.icon;
    this.speed = def.speed;
    this.capacity = def.capacity;
    this.ownerType = 'player';
    this.ownerId = null;
    this.ownerName = '';

    this.transport = {};
    this.transportCostBasis = {};

    this.status = 'idle';
    this.currentCityId = cityId;
    this.fromCityId = cityId;
    this.toCityId = null;
    this.finalCityId = cityId;
    this.distanceTotal = 0;
    this.distanceTravelled = 0;
    this.routeQueue = [];
    this.progress = 0;
    this.etaHours = 0;
    this.aiCooldownHours = 0;
  }

  get transportUsed() {
    return Object.entries(this.transport).reduce(
      (sum, [id, qty]) => sum + (GOODS[id]?.weight ?? 1) * qty,
      0
    );
  }

  get transportFree() {
    return this.capacity - this.transportUsed;
  }

  maxLoadable(goodId) {
    const weight = GOODS[goodId]?.weight ?? 1;
    return Math.floor(this.transportFree / weight);
  }

  get isIdle() { return this.status === 'idle'; }
  get isTravelling() { return this.status === 'travelling'; }

  load(goodId, qty, sourceInventory) {
    if (!this.isIdle) return { ok: false, message: `${this.name} is not idle.` };
    if (qty <= 0) return { ok: false, message: 'Invalid quantity.' };

    const good = GOODS[goodId];
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

  unloadAll(destInventory) {
    for (const [goodId, qty] of Object.entries(this.transport)) {
      destInventory[goodId] = (destInventory[goodId] ?? 0) + qty;
    }
    this.transport = {};
  }

  dispatch(toCityId, distance, routeQueue = [], finalCityId = toCityId) {
    if (!this.isIdle) return { ok: false, message: `${this.name} is already travelling.` };
    if (toCityId === this.currentCityId) return { ok: false, message: 'Already at that city.' };

    this.status = 'travelling';
    this.fromCityId = this.currentCityId;
    this.toCityId = toCityId;
    this.finalCityId = finalCityId;
    this.distanceTotal = distance;
    this.distanceTravelled = 0;
    this.progress = 0;
    this.etaHours = distance / this.speed;
    this.routeQueue = [...routeQueue];
    return { ok: true, message: `${this.name} dispatched.` };
  }

  tick(gameHoursElapsed) {
    if (!this.isTravelling) return false;

    this.distanceTravelled = Math.min(
      this.distanceTotal,
      this.distanceTravelled + this.speed * gameHoursElapsed
    );
    this.progress = this.distanceTravelled / this.distanceTotal;
    this.etaHours = Math.max(0, (this.distanceTotal - this.distanceTravelled) / this.speed);

    if (this.distanceTravelled >= this.distanceTotal) {
      this.status = 'idle';
      this.progress = 0;
      this.currentCityId = this.toCityId;
      this.fromCityId = this.currentCityId;
      this.etaHours = 0;
      return true;
    }
    return false;
  }

  getEtaString() {
    if (!this.isTravelling) return '';
    const hours = Math.floor(this.etaHours);
    const minutes = Math.floor((this.etaHours - hours) * 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  }

  serialize() {
    return {
      id: this.id,
      typeId: this.typeId,
      name: this.name,
      icon: this.icon,
      speed: this.speed,
      capacity: this.capacity,
      ownerType: this.ownerType,
      ownerId: this.ownerId,
      ownerName: this.ownerName,
      transport: { ...this.transport },
      transportCostBasis: { ...this.transportCostBasis },
      status: this.status,
      currentCityId: this.currentCityId,
      fromCityId: this.fromCityId,
      toCityId: this.toCityId,
      finalCityId: this.finalCityId,
      distanceTotal: this.distanceTotal,
      distanceTravelled: this.distanceTravelled,
      progress: this.progress,
      etaHours: this.etaHours,
      aiCooldownHours: this.aiCooldownHours,
      routeQueue: [...this.routeQueue],
    };
  }

  static fromSave(data) {
    const vehicle = new Vehicle(data.typeId, data.currentCityId);
    Object.assign(vehicle, data);
    if (!vehicle.transport && data.cargo) vehicle.transport = data.cargo;
    if (!vehicle.transport) vehicle.transport = {};
    if (!vehicle.transportCostBasis) vehicle.transportCostBasis = {};
    vehicle.ownerType = data.ownerType ?? 'player';
    vehicle.ownerId = data.ownerId ?? null;
    vehicle.ownerName = data.ownerName ?? '';
    vehicle.aiCooldownHours = data.aiCooldownHours ?? 0;
    return vehicle;
  }
}
