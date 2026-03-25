/**
 * vehicleManager.js
 * Manages the player's fleet: purchasing, dispatching, ticking, arrivals.
 *
 * Goods travel exclusively in vehicle transport bays.
 * On arrival the vehicle is idle at the destination — the player
 * sells directly from the vehicle's transport at the market.
 * There is no separate transit/collection step.
 */

import { Vehicle, VEHICLE_TYPES } from './vehicles.js';
import { getDirectDistance }      from '../world/worldMap.js';

export class VehicleManager {
  constructor(state, cities, bus) {
    this._state  = state;
    this._cities = cities;
    this._bus    = bus;

    // Hydrate live Vehicle instances from serialised state
    this._vehicles = (state.vehicles ?? []).map(d => Vehicle.fromSave(d));
    this._syncState();

    // Give the player their free starter hand cart if they have none
    if (this._vehicles.length === 0) {
      this._giveStarterCart();
    }
  }

  get vehicles() { return this._vehicles; }

  /** All vehicles currently at a city (idle) */
  getVehiclesAt(cityId) {
    return this._vehicles.filter(v => v.currentCityId === cityId && v.isIdle);
  }

  /** All vehicles currently travelling */
  getTravelling() {
    return this._vehicles.filter(v => v.isTravelling);
  }

  /** Get a single vehicle by id */
  getVehicle(vehicleId) {
    return this._vehicles.find(v => v.id === vehicleId) ?? null;
  }

  // ── Purchase ──────────────────────────────────────────────────

  purchase(typeId) {
    const def    = VEHICLE_TYPES[typeId];
    const player = this._state.player;

    if (!def)                    return { ok: false, message: 'Unknown vehicle type.' };
    if (player.tier < def.minTier) return { ok: false, message: `Requires Tier ${def.minTier} to purchase.` };
    if (player.gold < def.cost)  return { ok: false, message: `Need ${def.cost}g. You have ${Math.floor(player.gold)}g.` };

    player.gold -= def.cost;
    const v = new Vehicle(typeId, player.currentCityId);
    this._vehicles.push(v);
    this._syncState();

    this._bus.publish('vehicle:purchased', { vehicleId: v.id, typeId, cityId: player.currentCityId });
    return { ok: true, message: `Purchased ${def.name}!`, vehicleId: v.id };
  }

  // ── Transport operations (called by VehicleUI) ────────────────

  load(vehicleId, goodId, qty, sourceInventory) {
    const v = this.getVehicle(vehicleId);
    if (!v) return { ok: false, message: 'Vehicle not found.' };
    const result = v.load(goodId, qty, sourceInventory);
    if (result.ok) {
      this._syncState();
      this._bus.publish('vehicle:transportChanged', { vehicleId });
    }
    return result;
  }

  unload(vehicleId, goodId, qty, destInventory) {
    const v = this.getVehicle(vehicleId);
    if (!v) return { ok: false, message: 'Vehicle not found.' };
    const result = v.unload(goodId, qty, destInventory);
    if (result.ok) {
      this._syncState();
      this._bus.publish('vehicle:transportChanged', { vehicleId });
    }
    return result;
  }

  // ── Dispatch ──────────────────────────────────────────────────

  dispatch(vehicleId, toCityId) {
    const v = this.getVehicle(vehicleId);

    if (!v) return { ok: false, message: 'Vehicle not found.' };

    const distance = getDirectDistance(v.currentCityId, toCityId);
    if (distance === null) {
      return { ok: false, message: `No direct route to that city.` };
    }

    const result = v.dispatch(toCityId, distance);
    if (result.ok) {
      this._syncState();
      this._bus.publish('vehicle:dispatched', {
        vehicleId,
        vehicleName: v.name,
        from: v.fromCityId,
        to:   toCityId,
        eta:  v.getEtaString(),
      });
    }
    return result;
  }

  // ── Tick ──────────────────────────────────────────────────────

  tick(gameHours) {
    if (gameHours <= 0) return;
    let changed = false;

    for (const v of this._vehicles) {
      if (!v.isTravelling) continue;
      const arrived = v.tick(gameHours);
      changed = true;
      if (arrived) this._handleArrival(v);
    }

    if (changed) this._syncState();
  }

  // ── Internal ──────────────────────────────────────────────────

  _handleArrival(vehicle) {
    const cityName    = this._cities.get(vehicle.currentCityId)?.name ?? vehicle.currentCityId;
    const hasGoods    = Object.keys(vehicle.transport).length > 0;

    this._bus.publish('vehicle:arrived', {
      vehicleId:   vehicle.id,
      vehicleName: vehicle.name,
      cityId:      vehicle.currentCityId,
      cityName,
      hasGoods,
    });
  }

  _giveStarterCart() {
    const v  = new Vehicle('hand_cart', this._state.player.currentCityId);
    v.name   = 'Old Reliable';
    this._vehicles.push(v);
    this._syncState();
    this._bus.publish('vehicle:purchased', {
      vehicleId: v.id,
      typeId:    'hand_cart',
      cityId:    this._state.player.currentCityId,
      starter:   true,
    });
  }

  _syncState() {
    this._state.vehicles = this._vehicles.map(v => v.serialize());
  }

  loadVehicles(savedVehicles) {
    this._vehicles = (savedVehicles ?? []).map(d => Vehicle.fromSave(d));
    this._syncState();
  }

  syncState() {
    this._syncState();
  }
}
