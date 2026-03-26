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

import { CITY_DEFS } from './world/cities.js';
import { buildAdjacency } from './world/worldMap.js';
import { MapRenderer } from './world/mapRenderer.js';

import { Player } from './player/player.js';
import { VehicleManager } from './player/vehicleManager.js';
import { addRep } from './player/reputation.js';
import { UIManager } from './ui/uiManager.js';
import { VehicleUI } from './ui/vehicleUI.js';
import { MapPanel } from './ui/mapPanel.js';
import { MILESTONES, TIER_UP_DIALOGUES } from './story/milestones.js';

const bus = new EventBus();
const state = createInitialState();
const timeMgr = new TimeManager(bus);

const cities = new Map();
for (const def of CITY_DEFS) cities.set(def.id, new City(def));
buildAdjacency();

const market = new Market(state, cities, bus);
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
const mapPanel = new MapPanel(vehicleMgr, mapRenderer, cities, bus);

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

function getCidStarterQuest() {
  if (!state.flags.cidStarterQuest) {
    state.flags.cidStarterQuest = {
      boughtWheat: 0,
      soldWheat: 0,
      completed: false,
    };
  }
  return state.flags.cidStarterQuest;
}

function renderCidStarterQuest() {
  if (state.player.tier < 1) {
    ui.setQuestDisplay(
      'Life At Cid\'s Lodge',
      'You are still recovering under Cid\'s care. Help him, learn the town, and wait for the day the road finally opens to you.',
      [
        { label: 'Recover your strength', done: true },
        { label: 'Earn the town\'s trust through errands', done: true },
        { label: 'Take up Cid\'s burden when the moment comes', done: false },
      ]
    );
    return;
  }

  const quest = getCidStarterQuest();
  ui.setQuestDisplay(
    'Cid\'s Grain Debt',
    quest.completed
      ? 'You settled the first part of Cid\'s trouble with the guild: buy grain where it is cheap, carry it where it is needed, and keep the road working.'
      : 'Cid entrusted you with his grain route. Buy 10 wheat in Cogsworth Landing, then sell 10 wheat in Ironhaven.',
    [
      { label: `Buy 10 Wheat in Cogsworth (${Math.min(quest.boughtWheat, 10)}/10)`, done: quest.boughtWheat >= 10 },
      { label: `Sell 10 Wheat in Ironhaven (${Math.min(quest.soldWheat, 10)}/10)`, done: quest.soldWheat >= 10 },
    ]
  );
}

function updateCidStarterQuest() {
  const quest = getCidStarterQuest();
  if (!quest.completed && quest.boughtWheat >= 10 && quest.soldWheat >= 10) {
    quest.completed = true;
    state.player.gold += 25;
    addRep(state, 'cogsworth', bus, 5);
    ui.toast('Quest complete: Cid\'s Grain Debt.', 'good');
    ui.addNotification('Cid smiles faintly. "That run kept us in the guild\'s good graces."', 'good');
  }
  renderCidStarterQuest();
}

bus.subscribe('map:cityClick', ({ cityId }) => mapRenderer.setSelected(cityId));
bus.subscribe('ui:citySelected', ({ cityId }) => mapRenderer.setSelected(cityId));

timeMgr.onDay(dateObj => {
  state.stats.daysSurvived++;
  player.checkTierUp();
  saveLoad.checkAutoSave(dateObj);
  ui.markMarketDirty();
});

bus.subscribe('player:tierUp', ({ tier }) => {
  const dlg = TIER_UP_DIALOGUES[tier];
  if (dlg) ui.showDialogue({ ...dlg, choices: [{ text: 'Excellent!', action: 'close' }] });
});

bus.subscribe('dialogue:closed', ({ milestoneId }) => {
  if (milestoneId === 'intro_09' && state.player.tier < 1) {
    state.player.tier = 1;
    ui.toast('Market access unlocked. You have entered the merchant class.', 'good');
    ui.addNotification('Cid places his old route in your hands. You are now recognized as a Merchant.', 'good');
    renderCidStarterQuest();
  }
  timeMgr.setSpeed(1);
  document.querySelectorAll('.speed-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelector('.speed-btn[data-speed="1"]')?.classList.add('active');
});

bus.subscribe('market:buy', ({ cityId, goodId, qty, cost, vehicleId }) => {
  const good = GOODS[goodId];
  const vehicle = vehicleMgr.getVehicle(vehicleId);
  ui.addNotification(`Bought ${qty}x ${good?.name} for ${cost}g -> ${vehicle?.name ?? ''}`, 'info');

  const quest = getCidStarterQuest();
  if (!quest.completed && cityId === 'cogsworth' && goodId === 'wheat') {
    quest.boughtWheat += qty;
    updateCidStarterQuest();
  }
});

bus.subscribe('market:sell', ({ cityId, goodId, qty, earned, bonusEarned, priceRatio }) => {
  const good = GOODS[goodId];
  const bonusStr = bonusEarned > 0 ? ` (+${bonusEarned}g)` : '';
  const demandStr = priceRatio > 1.3 ? ' high demand' : '';
  ui.addNotification(`Sold ${qty}x ${good?.name} for ${earned}g${bonusStr}${demandStr}`, 'good');

  const quest = getCidStarterQuest();
  if (!quest.completed && cityId === 'ironhaven' && goodId === 'wheat') {
    quest.soldWheat += qty;
    updateCidStarterQuest();
  }
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

  document.querySelectorAll('.speed-btn').forEach(btn => btn.classList.remove('active'));
  const speed = timeMgr.paused ? 0 : timeMgr.speed;
  document.querySelector(`.speed-btn[data-speed="${speed}"]`)?.classList.add('active');
  ui.markMarketDirty();
  vehicleUI.markDirty();
  renderCidStarterQuest();
  ui.toast('Game loaded.', 'good');
});

function showMilestone(id) {
  const milestone = MILESTONES.find(item => item.id === id);
  if (milestone) ui.showDialogue(milestone);
}

bus.subscribe('dialogue:choice', ({ next }) => {
  if (next) showMilestone(next);
});

ui.init();
renderCidStarterQuest();
loop.start();

setTimeout(() => showMilestone('intro_01'), 300);

console.log('%cOumzy loaded', 'color:#b5891c;font-weight:bold;font-size:14px');
console.log('Cities:', [...cities.keys()].join(', '));
console.log('Goods:', Object.keys(GOODS).length);
