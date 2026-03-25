/**
 * vehicleManager.js
 * Manages the player's fleet: purchasing, dispatching, ticking,
 * and handling arrivals with transit cargo storage.
 */

import { Vehicle, VEHICLE_TYPES } from './vehicles.js';
import { GOODS } from '../economy/goods.js';
import { getDirectDistance } from '../world/worldMap.js';

export class VehicleManager {
  /**
   * @param {object}   state   - central game state
   * @param {Map}      cities  - Map<id, City>
   * @param {EventBus} bus
   */
  constructor(state, cities, bus) {
    this._state  = state;
    this._cities = cities;
    this._bus    = bus;

    // Transit storage: goods waiting at a city for the player to collect
    // { cityId: { vehicleId: { goodId: qty } } }
    this._transit = {};

    // Hydrate vehicles array from state (supports save/load)
    // state.vehicles holds plain serialised objects; wrap them in Vehicle instances
    this._vehicles = [];
    for (const vData of (state.vehicles ?? [])) {
      this._vehicles.push(Vehicle.fromSave(vData));
    }
    this._syncState();

    // Give the player their free starter hand cart if they have nothing
    if (this._vehicles.length === 0) {
      this._giveStarterCart();
    }
  }

  get vehicles() { return this._vehicles; }

  /** Get all vehicles currently at a specific city (idle or arrived) */
  getVehiclesAt(cityId) {
    return this._vehicles.filter(v => v.currentCityId === cityId && !v.isTravelling);
  }

  /** Get all vehicles currently travelling */
  getTravelling() {
    return this._vehicles.filter(v => v.isTravelling);
  }

  // ── Purchase ──────────────────────────────────────────────────

  /**
   * Buy a vehicle for the player.
   * @param {string} typeId
   * @returns {{ ok: boolean, message: string }}
   */
  purchase(typeId) {
    const def    = VEHICLE_TYPES[typeId];
    const player = this._state.player;

    if (!def) return { ok: false, message: 'Unknown vehicle type.' };
    if (player.tier < def.minTier) {
      return { ok: false, message: `Requires Tier ${def.minTier} to purchase.` };
    }
    if (player.gold < def.cost) {
      return { ok: false, message: `Need ${def.cost}g. You have ${Math.floor(player.gold)}g.` };
    }

    player.gold -= def.cost;
    const v = new Vehicle(typeId, player.currentCityId);
    this._vehicles.push(v);
    this._syncState();

    this._bus.publish('vehicle:purchased', { vehicleId: v.id, typeId, cityId: player.currentCityId });
    return { ok: true, message: `Purchased ${def.name}!`, vehicleId: v.id };
  }

  // ── Cargo Operations ─────────────────────────────────────────

  /**
   * Load goods from player inventory onto a vehicle.
   */
  loadCargo(vehicleId, goodId, qty) {
    const v = this._getVehicle(vehicleId);
    if (!v) return { ok: false, message: 'Vehicle not found.' };

    const result = v.loadCargo(goodId, qty, this._state.player.inventory);
    if (result.ok) {
      this._syncState();
      this._bus.publish('vehicle:cargoChanged', { vehicleId });
    }
    return result;
  }

  /**
   * Unload goods from a vehicle back to player inventory.
   */
  unloadCargo(vehicleId, goodId, qty) {
    const v = this._getVehicle(vehicleId);
    if (!v) return { ok: false, message: 'Vehicle not found.' };

    const result = v.unloadCargo(goodId, qty, this._state.player.inventory);
    if (result.ok) {
      this._syncState();
      this._bus.publish('vehicle:cargoChanged', { vehicleId });
    }
    return result;
  }

  /**
   * Collect transit cargo at a city into player inventory.
   * Call this when player visits a city that has waiting transit cargo.
   */
  collectTransit(cityId) {
    const cityTransit = this._transit[cityId];
    if (!cityTransit) return [];

    const collected = [];
    for (const [vehicleId, cargo] of Object.entries(cityTransit)) {
      for (const [goodId, qty] of Object.entries(cargo)) {
        if (qty <= 0) continue;
        this._state.player.inventory[goodId] = (this._state.player.inventory[goodId] ?? 0) + qty;
        const good = GOODS[goodId];
        collected.push({ goodId, qty, goodName: good?.name ?? goodId });
      }
    }
    delete this._transit[cityId];

    if (collected.length > 0) {
      this._bus.publish('vehicle:transitCollected', { cityId, collected });
    }
    return collected;
  }

  /** Check if there is uncollected transit cargo at a city */
  hasTransitAt(cityId) {
    const t = this._transit[cityId];
    if (!t) return false;
    return Object.values(t).some(cargo => Object.values(cargo).some(q => q > 0));
  }

  // ── Dispatch ─────────────────────────────────────────────────

  /**
   * Dispatch a vehicle to a destination city.
   */
  dispatch(vehicleId, toCityId) {
    const v      = this._getVehicle(vehicleId);
    const player = this._state.player;

    if (!v) return { ok: false, message: 'Vehicle not found.' };
    if (v.currentCityId !== player.currentCityId) {
      return { ok: false, message: `${v.name} is not at your current city.` };
    }

    const distance = getDirectDistance(v.currentCityId, toCityId);
    if (distance === null) {
      return { ok: false, message: `No direct route from ${v.currentCityId} to ${toCityId}.` };
    }

    const result = v.dispatch(toCityId, distance);
    if (result.ok) {
      this._syncState();
      this._bus.publish('vehicle:dispatched', {
        vehicleId,
        from: v.fromCityId,
        to:   toCityId,
        eta:  v.getEtaString(),
      });
    }
    return result;
  }

  // ── Tick ─────────────────────────────────────────────────────

  /** Called every game loop tick with game-hours already computed */
  tick(gameHours) {
    if (gameHours <= 0) return;

    let anyChanged = false;
    for (const v of this._vehicles) {
      if (!v.isTravelling) continue;
      const arrived = v.tick(gameHours);
      anyChanged = true;

      if (arrived) {
        this._handleArrival(v);
      }
    }

    if (anyChanged) this._syncState();
  }

  // ── Internal ─────────────────────────────────────────────────

  _handleArrival(vehicle) {
    const cityId = vehicle.toCityId;

    // Move cargo to transit storage at destination
    if (Object.keys(vehicle.cargo).length > 0) {
      if (!this._transit[cityId]) this._transit[cityId] = {};
      this._transit[cityId][vehicle.id] = { ...vehicle.cargo };
      vehicle.cargo = {};
    }

    vehicle.setIdle();

    const cityName = this._cities.get(cityId)?.name ?? cityId;
    this._bus.publish('vehicle:arrived', {
      vehicleId: vehicle.id,
      vehicleName: vehicle.name,
      cityId,
      cityName,
      hasCargo: !!(this._transit[cityId]?.[vehicle.id] &&
                   Object.keys(this._transit[cityId][vehicle.id]).length > 0),
    });
  }

  _getVehicle(vehicleId) {
    return this._vehicles.find(v => v.id === vehicleId) ?? null;
  }

  /** Keep state.vehicles in sync with our live Vehicle instances */
  _syncState() {
    this._state.vehicles = this._vehicles.map(v => v.serialize());
  }

  _giveStarterCart() {
    const v = new Vehicle('hand_cart', this._state.player.currentCityId);
    v.name = 'Old Reliable'; // flavour name
    this._vehicles.push(v);
    this._syncState();
    this._bus.publish('vehicle:purchased', {
      vehicleId: v.id,
      typeId: 'hand_cart',
      cityId: this._state.player.currentCityId,
      starter: true,
    });
  }

  /** Serialise transit for save */
  serializeTransit() {
    return JSON.parse(JSON.stringify(this._transit));
  }

  loadTransit(data) {
    this._transit = data ?? {};
  }

  /** Rebuild Vehicle instances from saved plain objects */
  loadVehicles(savedVehicles) {
    this._vehicles = (savedVehicles ?? []).map(d => Vehicle.fromSave(d));
    this._syncState();
  }
}
