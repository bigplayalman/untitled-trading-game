/**
 * main.js
 * Entry point. Initialises all systems and starts the game loop.
 */

import { GameLoop }          from './engine/gameLoop.js';
import { TimeManager }       from './engine/timeManager.js';
import { EventBus, createInitialState } from './engine/stateManager.js';
import { SaveLoad }          from './engine/saveLoad.js';

import { GOODS }             from './economy/goods.js';
import { City }              from './economy/city.js';
import { Market }            from './economy/market.js';

import { CITY_DEFS }         from './world/cities.js';
import { buildAdjacency }    from './world/worldMap.js';
import { MapRenderer }       from './world/mapRenderer.js';

import { Player }            from './player/player.js';
import { UIManager }         from './ui/uiManager.js';
import { MILESTONES, TIER_UP_DIALOGUES } from './story/milestones.js';

// ── 1. Create core systems ──────────────────────────────────────
const bus   = new EventBus();
const state = createInitialState();

const timeMgr = new TimeManager(bus);

// ── 2. Build cities ─────────────────────────────────────────────
const cities = new Map();
for (const def of CITY_DEFS) {
  cities.set(def.id, new City(def));
}

const adjacency = buildAdjacency();

// ── 3. Create game systems ───────────────────────────────────────
const market  = new Market(state, cities, bus);
const player  = new Player(state, bus);
const saveLoad = new SaveLoad(state, timeMgr, cities, bus);

// ── 4. UI ────────────────────────────────────────────────────────
const ui = new UIManager(state, cities, market, timeMgr, player, bus);

// ── 5. Map renderer ──────────────────────────────────────────────
const canvas = document.getElementById('game-map');
const mapRenderer = new MapRenderer(canvas, cities, state, bus);

// ── 6. Game Loop systems ─────────────────────────────────────────

/**
 * Economy system: advances city simulations each tick.
 * Uses game-hours from TimeManager.
 */
const economySystem = {
  update(realDeltaMs) {
    // Convert real delta to game hours elapsed
    const gameHours = (realDeltaMs / 1000) * timeMgr.speed;
    for (const city of cities.values()) {
      city.tick(gameHours);
    }
    timeMgr.update(realDeltaMs);
  },
};

/** Render system: redraws map and UI every frame */
const renderSystem = {
  render() {
    mapRenderer.render();
    ui.render();
  },
};

const loop = new GameLoop();
loop.register(economySystem);
loop.register(renderSystem);

// ── 7. Event wiring ──────────────────────────────────────────────

// City clicked on map -> UI navigates to city view
bus.subscribe('map:cityClick', ({ cityId }) => {
  mapRenderer.setSelected(cityId);
});

// UI city selected from left panel -> update map selected state
bus.subscribe('ui:citySelected', ({ cityId }) => {
  mapRenderer.setSelected(cityId);
});

// Day change events
timeMgr.onDay(dateObj => {
  state.stats.daysSurvived++;
  player.checkTierUp();
  saveLoad.checkAutoSave(dateObj);
});

// Tier up event
bus.subscribe('player:tierUp', ({ tier, tierName }) => {
  const dlg = TIER_UP_DIALOGUES[tier];
  if (dlg) ui.showDialogue({ ...dlg, choices: [{ text: 'Excellent!', action: 'close' }] });
});

// Dialogue closed -> resume at speed 1
bus.subscribe('dialogue:closed', () => {
  timeMgr.setSpeed(1);
  document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.speed-btn[data-speed="1"]').classList.add('active');
});

// Market events -> journal
bus.subscribe('market:buy', ({ goodId, qty, cost }) => {
  const good = GOODS[goodId];
  ui.addNotification(`Bought ${qty}x ${good?.name} for ${cost}g`, 'info');
});

bus.subscribe('market:sell', ({ goodId, qty, earned }) => {
  const good = GOODS[goodId];
  ui.addNotification(`Sold ${qty}x ${good?.name} for ${earned}g`, 'good');
});

// Save / Load
bus.subscribe('ui:save', () => saveLoad.save());
bus.subscribe('ui:load', () => {
  const data = saveLoad.load();
  if (!data) {
    ui.toast('No save found.', 'bad');
    return;
  }
  // Restore state
  Object.assign(state, data.state);
  timeMgr.load(data.time);
  for (const [id, cityData] of Object.entries(data.cities ?? {})) {
    cities.get(id)?.loadSave(cityData);
  }
  // Sync speed button UI
  document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
  const activeSpeed = timeMgr.paused ? 0 : timeMgr.speed;
  document.querySelector(`.speed-btn[data-speed="${activeSpeed}"]`)?.classList.add('active');
  ui.toast('Game loaded.', 'good');
});

// ── 8. Intro dialogue ────────────────────────────────────────────
let currentMilestoneIdx = 0;

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

// Show intro after a short delay so the first render frame completes
setTimeout(() => {
  showMilestone('intro_01');
}, 300);

console.log('%c⚙ Ironveil Chronicles loaded', 'color:#b5891c;font-weight:bold;font-size:14px');
console.log('Cities:', [...cities.keys()].join(', '));
console.log('Goods:', Object.keys(GOODS).length);
