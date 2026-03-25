/**
 * main.js
 * Entry point. Initialises all systems and starts the game loop.
 */

import { GameLoop }                       from './engine/gameLoop.js';
import { TimeManager }                    from './engine/timeManager.js';
import { EventBus, createInitialState }   from './engine/stateManager.js';
import { SaveLoad }                       from './engine/saveLoad.js';

import { GOODS }                          from './economy/goods.js';
import { City }                           from './economy/city.js';
import { Market }                         from './economy/market.js';

import { CITY_DEFS }                      from './world/cities.js';
import { buildAdjacency }                 from './world/worldMap.js';
import { MapRenderer }                    from './world/mapRenderer.js';

import { Player }                         from './player/player.js';
import { VehicleManager }                 from './player/vehicleManager.js';
import { UIManager }                      from './ui/uiManager.js';
import { VehicleUI }                      from './ui/vehicleUI.js';
import { MapPanel }                       from './ui/mapPanel.js';
import { MILESTONES, TIER_UP_DIALOGUES }  from './story/milestones.js';

// ── 1. Core systems ─────────────────────────────────────────────
const bus    = new EventBus();
const state  = createInitialState();
const timeMgr = new TimeManager(bus);

// ── 2. Cities ───────────────────────────────────────────────────
const cities = new Map();
for (const def of CITY_DEFS) cities.set(def.id, new City(def));
buildAdjacency(); // warm up (used internally by vehicleManager via worldMap)

// ── 3. Game systems ─────────────────────────────────────────────
const market     = new Market(state, cities, bus);
const player     = new Player(state, bus);
const vehicleMgr = new VehicleManager(state, cities, bus);
const saveLoad   = new SaveLoad(state, timeMgr, cities, bus);
saveLoad.setVehicleManager(vehicleMgr);

// ── 4. UI ────────────────────────────────────────────────────────
const ui        = new UIManager(state, cities, market, timeMgr, player, bus);
const vehicleUI = new VehicleUI(state, vehicleMgr, market, cities, player, bus);
ui.setVehicleUI(vehicleUI);
ui.setVehicleManager(vehicleMgr);

// ── 5. Map renderer + map panel ─────────────────────────────────
const canvas = document.getElementById('game-map');
const mapRenderer = new MapRenderer(canvas, cities, state, bus);
mapRenderer.setVehicleManager(vehicleMgr);
const mapPanel = new MapPanel(vehicleMgr, mapRenderer, cities, bus);

// ── 6. Game loop ─────────────────────────────────────────────────
const economySystem = {
  update(realDeltaMs) {
    const gameHours = (realDeltaMs / 1000) * timeMgr.speed;
    for (const city of cities.values()) city.tick(gameHours);
    vehicleMgr.tick(gameHours);
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

// ── 7. Event wiring ──────────────────────────────────────────────

bus.subscribe('map:cityClick',   ({ cityId }) => mapRenderer.setSelected(cityId));
bus.subscribe('ui:citySelected', ({ cityId }) => mapRenderer.setSelected(cityId));

// Day change
timeMgr.onDay(dateObj => {
  state.stats.daysSurvived++;
  player.checkTierUp();
  saveLoad.checkAutoSave(dateObj);
  ui.markMarketDirty();
});

// Tier up
bus.subscribe('player:tierUp', ({ tier }) => {
  const dlg = TIER_UP_DIALOGUES[tier];
  if (dlg) ui.showDialogue({ ...dlg, choices: [{ text: 'Excellent!', action: 'close' }] });
});

// Dialogue closed → resume speed 1
bus.subscribe('dialogue:closed', () => {
  timeMgr.setSpeed(1);
  document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.speed-btn[data-speed="1"]').classList.add('active');
});

// Market → journal
bus.subscribe('market:buy', ({ goodId, qty, cost, vehicleId }) => {
  const good    = GOODS[goodId];
  const vehicle = vehicleMgr.getVehicle(vehicleId);
  ui.addNotification(`Bought ${qty}x ${good?.name} for ${cost}g → ${vehicle?.name ?? ''}`, 'info');
});

bus.subscribe('market:sell', ({ goodId, qty, earned, bonusEarned, repGain, priceRatio }) => {
  const good = GOODS[goodId];
  const bonusStr  = bonusEarned > 0 ? ` (+${bonusEarned}g)` : '';
  const demandStr = priceRatio > 1.3 ? ' 🔥 high demand' : '';
  ui.addNotification(`Sold ${qty}x ${good?.name} for ${earned}g${bonusStr}${demandStr}`, 'good');
});

// Reputation events → journal + toast
bus.subscribe('reputation:tierUp', ({ cityId, tierName, color }) => {
  const cityName = cities.get(cityId)?.name ?? cityId;
  ui.toast(`${cityName} now sees you as: ${tierName}!`, 'good');
  ui.addNotification(`Reputation in ${cityName}: ${tierName}`, 'good');
});

// Vehicle events → journal
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
  const toName   = cities.get(to)?.name ?? to;
  const pathNames = (path ?? []).map(id => cities.get(id)?.name ?? id).join(' → ');
  const msg = totalDistance > 0
    ? `Travelled from ${fromName} to ${toName} via ${pathNames} (${totalDistance}km).`
    : `Travelled to ${toName}.`;
  ui.addNotification(msg, 'info');
});

// Save / Load
bus.subscribe('ui:save', () => saveLoad.save());
bus.subscribe('ui:load', () => {
  const data = saveLoad.load();
  if (!data) { ui.toast('No save found.', 'bad'); return; }

  Object.assign(state, data.state);
  timeMgr.load(data.time);
  for (const [id, cityData] of Object.entries(data.cities ?? {})) {
    cities.get(id)?.loadSave(cityData);
  }
  vehicleMgr.loadVehicles(data.state?.vehicles ?? []);

  document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
  const spd = timeMgr.paused ? 0 : timeMgr.speed;
  document.querySelector(`.speed-btn[data-speed="${spd}"]`)?.classList.add('active');
  ui.markMarketDirty();
  vehicleUI.markDirty();
  ui.toast('Game loaded.', 'good');
});

// ── 8. Story / Milestones ────────────────────────────────────────
function showMilestone(id) {
  const m = MILESTONES.find(m => m.id === id);
  if (m) ui.showDialogue(m);
}

bus.subscribe('dialogue:choice', ({ next }) => {
  if (next) showMilestone(next);
});

// ── 9. Start ─────────────────────────────────────────────────────
ui.init();
loop.start();

setTimeout(() => showMilestone('intro_01'), 300);

console.log('%c⚙ Oumzy loaded', 'color:#b5891c;font-weight:bold;font-size:14px');
console.log('Cities:', [...cities.keys()].join(', '));
console.log('Goods:', Object.keys(GOODS).length);
