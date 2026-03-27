/**
 * npcTradeManager.js
 * Simulates NPC merchants trading through the same city inventories as the player.
 */

import { GOODS } from './goods.js';
import { Vehicle } from '../player/vehicles.js';
import { buildAdjacency, getDirectDistance, shortestPath } from '../world/worldMap.js';

const NPC_MERCHANT_LAYOUT = {
  major: { count: 2, vehicleTypes: ['horse_wagon', 'steam_wagon'], capital: [1800, 2600] },
  middle: { count: 3, vehicleTypes: ['horse_wagon'], capital: [650, 1100] },
  small: { count: 5, vehicleTypes: ['hand_cart'], capital: [180, 420] },
};

const NAME_PREFIXES = ['Ash', 'Brass', 'Cinder', 'Crown', 'Ember', 'Gale', 'Iron', 'Moss', 'River', 'Silver', 'Steam', 'Vale'];
const NAME_SUFFIXES = ['& Co.', 'Consortium', 'Exchange', 'Freight', 'Guild', 'House', 'Ledger', 'Line', 'Partners', 'Supply', 'Trade', 'Works'];

export class NpcTradeManager {
  constructor(state, cities, bus) {
    this._state = state;
    this._cities = cities;
    this._bus = bus;
    this._adjacency = buildAdjacency();

    this._merchants = [];
    this._vehicles = [];

    this.loadFromState();
  }

  get vehicles() {
    return this._vehicles;
  }

  getVehiclesAt(cityId) {
    return this._vehicles.filter(vehicle => vehicle.currentCityId === cityId && vehicle.isIdle);
  }

  getTravelling() {
    return this._vehicles.filter(vehicle => vehicle.isTravelling);
  }

  getCityPresence(cityId) {
    const merchants = this._merchants.filter(merchant => merchant.homeCityId === cityId).length;
    const dockedVehicles = this.getVehiclesAt(cityId).length;
    const movingVehicles = this._vehicles.filter(
      vehicle => vehicle.isTravelling && (
        vehicle.fromCityId === cityId ||
        vehicle.toCityId === cityId ||
        vehicle.finalCityId === cityId
      )
    ).length;

    return { merchants, dockedVehicles, movingVehicles };
  }

  loadFromState() {
    const saved = this._state.npc ?? {};
    const hasSavedMerchants = Array.isArray(saved.merchants) && saved.merchants.length > 0;
    const hasSavedVehicles = Array.isArray(saved.vehicles) && saved.vehicles.length > 0;

    if (hasSavedMerchants && hasSavedVehicles) {
      this._merchants = saved.merchants.map(merchant => ({
        ...merchant,
        preferredGoods: [...(merchant.preferredGoods ?? [])],
        vehicleIds: [...(merchant.vehicleIds ?? [])],
      }));
      this._vehicles = saved.vehicles.map(data => Vehicle.fromSave(data));
      this._syncState();
      return;
    }

    this._bootstrapNewSimulation();
  }

  tick(gameHours) {
    if (gameHours <= 0) return;

    let changed = false;
    for (const vehicle of this._vehicles) {
      if (vehicle.isTravelling) {
        const arrived = vehicle.tick(gameHours);
        changed = true;
        if (arrived) this._handleArrival(vehicle);
        continue;
      }

      vehicle.aiCooldownHours = Math.max(0, (vehicle.aiCooldownHours ?? 0) - gameHours);
      if (vehicle.aiCooldownHours <= 0) {
        changed = this._evaluateIdleVehicle(vehicle) || changed;
      }
    }

    if (changed) this._syncState();
  }

  _bootstrapNewSimulation() {
    this._merchants = [];
    this._vehicles = [];
    let merchantIndex = 1;

    for (const city of this._cities.values()) {
      const preferredGoods = this._getPreferredGoods(city);
      for (const [tier, config] of Object.entries(NPC_MERCHANT_LAYOUT)) {
        for (let i = 0; i < config.count; i++) {
          const merchantId = `npcm_${merchantIndex++}`;
          const merchant = {
            id: merchantId,
            name: this._generateMerchantName(city.name, tier, merchantIndex),
            homeCityId: city.id,
            tier,
            capital: this._rollRange(config.capital[0], config.capital[1]),
            preferredGoods: this._rotateGoods(preferredGoods, i),
            vehicleIds: [],
          };

          for (const typeId of config.vehicleTypes) {
            const vehicle = new Vehicle(typeId, city.id);
            vehicle.ownerType = 'npc';
            vehicle.ownerId = merchantId;
            vehicle.ownerName = merchant.name;
            vehicle.name = this._formatVehicleName(merchant.name, merchant.vehicleIds.length + 1);
            vehicle.aiCooldownHours = this._rollRange(2, 10);
            this._vehicles.push(vehicle);
            merchant.vehicleIds.push(vehicle.id);
          }

          this._merchants.push(merchant);
        }
      }
    }

    this._syncState();
  }

  _evaluateIdleVehicle(vehicle) {
    const merchant = this._merchants.find(entry => entry.id === vehicle.ownerId);
    const origin = this._cities.get(vehicle.currentCityId);
    if (!merchant || !origin) {
      vehicle.aiCooldownHours = 12;
      return false;
    }

    const opportunity = this._findBestOpportunity(origin.id, merchant, vehicle);
    if (!opportunity) {
      vehicle.aiCooldownHours = this._rollRange(8, 18);
      return false;
    }

    const { targetCityId, goodId, qty, cost } = opportunity;
    const good = GOODS[goodId];
    if (!good || qty <= 0 || merchant.capital < cost || (origin.inventory[goodId] ?? 0) < qty) {
      vehicle.aiCooldownHours = 12;
      return false;
    }

    origin.inventory[goodId] = Math.max(0, (origin.inventory[goodId] ?? 0) - qty);
    origin.priceEngine.recalculate();

    merchant.capital -= cost;
    vehicle.transport[goodId] = (vehicle.transport[goodId] ?? 0) + qty;
    vehicle.transportCostBasis[goodId] = (vehicle.transportCostBasis[goodId] ?? 0) + cost;

    const route = shortestPath(this._adjacency, origin.id, targetCityId);
    if (!route || route.path.length < 2) {
      this._rollbackPurchase(origin, merchant, vehicle, goodId, qty, cost);
      vehicle.aiCooldownHours = 12;
      return false;
    }

    const firstHop = route.path[1];
    const distance = getDirectDistance(origin.id, firstHop);
    if (distance === null) {
      this._rollbackPurchase(origin, merchant, vehicle, goodId, qty, cost);
      vehicle.aiCooldownHours = 12;
      return false;
    }

    const result = vehicle.dispatch(firstHop, distance, route.path.slice(2), targetCityId);
    if (!result.ok) {
      this._rollbackPurchase(origin, merchant, vehicle, goodId, qty, cost);
      vehicle.aiCooldownHours = 12;
      return false;
    }

    return true;
  }

  _handleArrival(vehicle) {
    const merchant = this._merchants.find(entry => entry.id === vehicle.ownerId);
    const city = this._cities.get(vehicle.currentCityId);
    if (!merchant || !city) {
      vehicle.aiCooldownHours = 10;
      return;
    }

    let totalEarned = 0;
    for (const [goodId, qty] of Object.entries(vehicle.transport)) {
      if (qty <= 0) continue;
      totalEarned += city.getSellPrice(goodId) * qty;
      city.inventory[goodId] = (city.inventory[goodId] ?? 0) + qty;
    }

    city.priceEngine.recalculate();
    merchant.capital += totalEarned;
    vehicle.transport = {};
    vehicle.transportCostBasis = {};
    vehicle.aiCooldownHours = this._rollRange(4, 12);
  }

  _findBestOpportunity(originCityId, merchant, vehicle) {
    const origin = this._cities.get(originCityId);
    if (!origin) return null;

    let best = null;
    for (const [goodId, stock] of Object.entries(origin.inventory)) {
      const good = GOODS[goodId];
      if (!good || stock <= 3) continue;

      const buyPrice = origin.getBuyPrice(goodId);
      const maxAffordable = Math.floor(merchant.capital / Math.max(1, buyPrice));
      const maxByCapacity = vehicle.maxLoadable(goodId);
      const qty = Math.min(stock, maxAffordable, maxByCapacity);
      if (qty <= 0) continue;

      for (const [targetCityId, targetCity] of this._cities) {
        if (targetCityId === originCityId) continue;

        const route = shortestPath(this._adjacency, originCityId, targetCityId);
        if (!route) continue;

        const unitMargin = targetCity.getSellPrice(goodId) - buyPrice;
        if (unitMargin <= 0) continue;

        const preferenceBoost = merchant.preferredGoods.includes(goodId) ? 1.15 : 1;
        const distancePenalty = Math.max(1, route.totalDistance / 120);
        const score = (unitMargin * qty * preferenceBoost) / distancePenalty;

        if (!best || score > best.score) {
          best = {
            goodId,
            targetCityId,
            qty,
            cost: buyPrice * qty,
            score,
          };
        }
      }
    }

    return best;
  }

  _rollbackPurchase(origin, merchant, vehicle, goodId, qty, cost) {
    origin.inventory[goodId] = (origin.inventory[goodId] ?? 0) + qty;
    origin.priceEngine.recalculate();
    merchant.capital += cost;
    delete vehicle.transport[goodId];
    delete vehicle.transportCostBasis[goodId];
  }

  _getPreferredGoods(city) {
    const produced = Object.entries(city.naturalProduction)
      .sort((a, b) => b[1] - a[1])
      .map(([goodId]) => goodId);
    const consumed = Object.entries(city.dailyConsumption)
      .sort((a, b) => b[1] - a[1])
      .map(([goodId]) => goodId);
    return [...new Set([...produced, ...consumed])].slice(0, 5);
  }

  _rotateGoods(goods, offset) {
    if (!goods.length) return [];
    const result = [];
    for (let i = 0; i < Math.min(3, goods.length); i++) {
      result.push(goods[(i + offset) % goods.length]);
    }
    return result;
  }

  _generateMerchantName(cityName, tier, seed) {
    const cityKey = cityName.replace(/[^A-Za-z]/g, '').slice(0, 4) || 'Guild';
    const prefix = NAME_PREFIXES[seed % NAME_PREFIXES.length];
    const suffix = NAME_SUFFIXES[(seed + tier.length) % NAME_SUFFIXES.length];
    return `${prefix} ${cityKey} ${suffix}`;
  }

  _formatVehicleName(merchantName, index) {
    return `${merchantName.split(' ')[0]} Hauler ${index}`;
  }

  _rollRange(min, max) {
    return min + Math.floor(Math.random() * (max - min + 1));
  }

  _syncState() {
    this._state.npc = {
      merchants: this._merchants.map(merchant => ({
        ...merchant,
        preferredGoods: [...merchant.preferredGoods],
        vehicleIds: [...merchant.vehicleIds],
      })),
      vehicles: this._vehicles.map(vehicle => vehicle.serialize()),
    };
  }
}
