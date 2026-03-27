/**
 * main.js
 * Entry point. Initialises all systems and starts the game loop.
 */

import { GameLoop } from './engine/gameLoop.js';
import { TimeManager } from './engine/timeManager.js';
import { EventBus, createInitialState } from './engine/stateManager.js';
import { SaveLoad } from './engine/saveLoad.js';

import { GOODS } from './economy/goods.js';
import { City } from './economy/city.js';
import { Market } from './economy/market.js';
import { NpcTradeManager } from './economy/npcTradeManager.js';

import { CITY_DEFS } from './world/cities.js';
import { buildAdjacency } from './world/worldMap.js';
import { MapRenderer } from './world/mapRenderer.js';

import { Player } from './player/player.js';
import { VehicleManager } from './player/vehicleManager.js';
import { UIManager } from './ui/uiManager.js';
import { VehicleUI } from './ui/vehicleUI.js';
import { MapPanel } from './ui/mapPanel.js';

const bus = new EventBus();
const state = createInitialState();
const timeMgr = new TimeManager(bus);

const cities = new Map();
for (const def of CITY_DEFS) cities.set(def.id, new City(def));
buildAdjacency();

const market = new Market(state, cities, bus);
const npcTradeMgr = new NpcTradeManager(state, cities, bus);
const player = new Player(state, bus);
const vehicleMgr = new VehicleManager(state, cities, bus);
const saveLoad = new SaveLoad(state, timeMgr, cities, bus);
saveLoad.setVehicleManager(vehicleMgr);

const ui = new UIManager(state, cities, market, timeMgr, player, bus);
const vehicleUI = new VehicleUI(state, vehicleMgr, market, cities, player, bus);
ui.setVehicleUI(vehicleUI);
ui.setVehicleManager(vehicleMgr);

const canvas = document.getElementById('game-map');
const mapRenderer = new MapRenderer(canvas, cities, state, bus);
mapRenderer.setVehicleManager(vehicleMgr);
mapRenderer.setNpcTradeManager(npcTradeMgr);
const mapPanel = new MapPanel(vehicleMgr, mapRenderer, cities, bus);

const economySystem = {
  update(realDeltaMs) {
    const gameHours = timeMgr.getGameHoursElapsed(realDeltaMs);
    for (const city of cities.values()) city.tick(gameHours);
    vehicleMgr.tick(gameHours);
    npcTradeMgr.tick(gameHours);
    timeMgr.update(realDeltaMs);
  },
};

const renderSystem = {
  render() {
    mapRenderer.render();
    ui.render();
    mapPanel.tick();
  },
};

const loop = new GameLoop();
loop.register(economySystem);
loop.register(renderSystem);

bus.subscribe('map:cityClick', ({ cityId }) => mapRenderer.setSelected(cityId));
bus.subscribe('ui:citySelected', ({ cityId }) => mapRenderer.setSelected(cityId));

timeMgr.onDay(dateObj => {
  state.stats.daysSurvived++;
  player.checkTierUp();
  saveLoad.checkAutoSave(dateObj);
  ui.markMarketDirty();
});

bus.subscribe('market:buy', ({ cityId, goodId, qty, cost, vehicleId }) => {
  const good = GOODS[goodId];
  const vehicle = vehicleMgr.getVehicle(vehicleId);
  ui.addNotification(`Bought ${qty}x ${good?.name} for ${cost}g -> ${vehicle?.name ?? ''}`, 'info');
});

bus.subscribe('market:sell', ({ cityId, goodId, qty, earned, bonusEarned, priceRatio }) => {
  const good = GOODS[goodId];
  const bonusStr = bonusEarned > 0 ? ` (+${bonusEarned}g)` : '';
  const demandStr = priceRatio > 1.3 ? ' high demand' : '';
  ui.addNotification(`Sold ${qty}x ${good?.name} for ${earned}g${bonusStr}${demandStr}`, 'good');
});

bus.subscribe('reputation:tierUp', ({ cityId, tierName }) => {
  const cityName = cities.get(cityId)?.name ?? cityId;
  ui.toast(`${cityName} now sees you as: ${tierName}!`, 'good');
  ui.addNotification(`Reputation in ${cityName}: ${tierName}`, 'good');
});

bus.subscribe('vehicle:purchased', ({ typeId, starter }) => {
  if (!starter) ui.addNotification(`Purchased a new ${typeId.replace(/_/g, ' ')}!`, 'good');
});

bus.subscribe('vehicle:dispatched', ({ vehicleName, to, nextStop, route, eta }) => {
  const cityName = cities.get(to)?.name ?? to;
  const nextStopName = cities.get(nextStop)?.name ?? nextStop ?? to;
  const routeStr = Array.isArray(route) && route.length > 2
    ? ` via ${route.slice(1, -1).map(id => cities.get(id)?.name ?? id).join(' -> ')}`
    : '';
  ui.addNotification(`${vehicleName} dispatched to ${cityName}${routeStr}. Next stop: ${nextStopName} (${eta})`, 'info');
});

bus.subscribe('vehicle:transitLeg', ({ vehicleName, to, finalCityId, eta }) => {
  const nextStopName = cities.get(to)?.name ?? to;
  const finalName = cities.get(finalCityId)?.name ?? finalCityId;
  ui.addNotification(`${vehicleName} continues toward ${finalName}. Next stop: ${nextStopName} (${eta})`, 'info');
});

bus.subscribe('vehicle:arrived', ({ vehicleName, cityName, hasGoods }) => {
  const msg = hasGoods
    ? `${vehicleName} arrived at ${cityName} with goods!`
    : `${vehicleName} arrived at ${cityName}.`;
  ui.addNotification(msg, 'good');
  ui.toast(msg, 'good');
});

bus.subscribe('player:travel', ({ from, to, path, totalDistance }) => {
  const fromName = cities.get(from)?.name ?? from;
  const toName = cities.get(to)?.name ?? to;
  const pathNames = (path ?? []).map(id => cities.get(id)?.name ?? id).join(' -> ');
  const msg = totalDistance > 0
    ? `Travelled from ${fromName} to ${toName} via ${pathNames} (${totalDistance}km).`
    : `Travelled to ${toName}.`;
  ui.addNotification(msg, 'info');
});

bus.subscribe('ui:save', () => saveLoad.save());
bus.subscribe('ui:load', () => {
  const data = saveLoad.load();
  if (!data) {
    ui.toast('No save found.', 'bad');
    return;
  }

  Object.assign(state, data.state);
  timeMgr.load(data.time);
  for (const [id, cityData] of Object.entries(data.cities ?? {})) {
    cities.get(id)?.loadSave(cityData);
  }
  vehicleMgr.loadVehicles(data.state?.vehicles ?? []);
  npcTradeMgr.loadFromState();

  document.querySelectorAll('.speed-btn').forEach(btn => btn.classList.remove('active'));
  const speed = timeMgr.paused ? 0 : timeMgr.speed;
  document.querySelector(`.speed-btn[data-speed="${speed}"]`)?.classList.add('active');
  ui.markMarketDirty();
  vehicleUI.markDirty();
  ui.toast('Game loaded.', 'good');
});

ui.init();
loop.start();

console.log('%cOumzy loaded', 'color:#b5891c;font-weight:bold;font-size:14px');
console.log('Cities:', [...cities.keys()].join(', '));
console.log('Goods:', Object.keys(GOODS).length);
