/**
 * uiManager.js
 * Central UI controller.
 *
 * The player has no personal inventory. All goods travel via vehicles.
 * The market tab shows prices and city stock for reference only.
 * Buying and selling happen in the Vehicles tab.
 */

import { GOODS }                              from '../economy/goods.js';
import { TIER_NAMES }                         from '../engine/stateManager.js';
import { getRepForCity, getRepTier,
         getRepProgress, canBuy }             from '../player/reputation.js';

export class UIManager {
  constructor(state, cities, market, timeManager, player, bus) {
    this._state  = state;
    this._cities = cities;
    this._market = market;
    this._time   = timeManager;
    this._player = player;
    this._bus    = bus;

    this._currentView   = 'map';
    this._currentCityId = null;
    this._marketDirty   = false;
    this._lastGold      = -1;
    this._lastTier      = -1;
    this._lastDate      = '';
    this._lastDockedHash = '';
    this._lastRepHash    = '';

    this._vehicleUI  = null;
    this._vehicleMgr = null;

    this._els = {
      gold:            document.getElementById('ui-gold'),
      tier:            document.getElementById('ui-tier'),
      date:            document.getElementById('ui-date'),
      cityList:        document.getElementById('city-list'),
      mapView:         document.getElementById('map-view'),
      cityView:        document.getElementById('city-view'),
      cityName:        document.getElementById('city-name'),
      cityDesc:        document.getElementById('city-description'),
      cityPop:         document.getElementById('city-pop'),
      cityWealth:      document.getElementById('city-wealth'),
      marketBody:      document.getElementById('market-body'),
      dockedVehicles:  document.getElementById('docked-vehicles'),
      cityRepTier:     document.getElementById('city-rep-tier'),
      cityRepBar:      document.getElementById('city-rep-bar'),
      cityRepVal:      document.getElementById('city-rep-val'),
      notifications:   document.getElementById('notifications'),
      questTitle:      document.getElementById('quest-title'),
      questText:       document.getElementById('quest-text'),
      questProgress:   document.getElementById('quest-progress'),
      buildingsGrid:   document.getElementById('buildings-grid'),
      dialogue:        document.getElementById('dialogue-overlay'),
      dialogueSpeaker: document.getElementById('dialogue-speaker'),
      dialogueText:    document.getElementById('dialogue-text'),
      dialogueChoices: document.getElementById('dialogue-choices'),
      dialoguePortrait:document.getElementById('dialogue-portrait'),
      toastContainer:  document.getElementById('toast-container'),
    };

    this._bindEvents();
  }

  setVehicleUI(vehicleUI)   { this._vehicleUI  = vehicleUI; }
  setVehicleManager(mgr)    { this._vehicleMgr = mgr; }

  _bindEvents() {
    // Speed buttons
    document.querySelectorAll('.speed-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const speed = parseInt(btn.dataset.speed);
        this._time.setSpeed(speed);
        document.querySelectorAll('.speed-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // Back to map
    document.getElementById('btn-back-map').addEventListener('click', () => this.showMap());

    // Tab switching
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
        document.getElementById('tab-' + btn.dataset.tab).classList.remove('hidden');

        if (btn.dataset.tab === 'buildings' && this._currentCityId) {
          this._renderBuildings(this._currentCityId);
        }
        if (btn.dataset.tab === 'vehicles' && this._currentCityId && this._vehicleUI) {
          this._vehicleUI.renderVehiclesTabForCity(this._currentCityId);
        }
        if (btn.dataset.tab === 'market') {
          this._marketDirty = true;
        }
      });
    });

    // Save / Load
    document.getElementById('btn-save').addEventListener('click', () => this._bus.publish('ui:save', {}));
    document.getElementById('btn-load').addEventListener('click', () => this._bus.publish('ui:load', {}));

    // City click from map
    this._bus.subscribe('map:cityClick', ({ cityId }) => this.showCity(cityId));

    // Reactive updates
    this._bus.subscribe('market:buy',    () => { this._refreshTopBar(); this._marketDirty = true; });
    this._bus.subscribe('market:sell',   () => { this._refreshTopBar(); this._marketDirty = true; });
    this._bus.subscribe('player:tierUp', ({ tierName }) => this.toast(`Tier up! You are now a ${tierName}!`, 'good'));
    this._bus.subscribe('save:success',  () => this.toast('Game saved.', 'good'));
    this._bus.subscribe('save:failed',   () => this.toast('Save failed!', 'bad'));
    this._bus.subscribe('ui:toast',      ({ message, type }) => this.toast(message, type ?? 'info'));
    this._bus.subscribe('vehicle:arrived',    () => { this._lastDockedHash = ''; });
    this._bus.subscribe('vehicle:dispatched', () => { this._lastDockedHash = ''; });
    this._bus.subscribe('vehicle:purchased',  () => { this._lastDockedHash = ''; });

    // Reputation events — refresh market and rep display
    this._bus.subscribe('reputation:gained', ({ cityId }) => {
      if (cityId === this._currentCityId) {
        this._marketDirty = true;
        this._lastRepHash = '';
        if (this._vehicleUI) this._vehicleUI.markDirty();
      }
    });
  }

  /** Called every render frame */
  render() {
    this._refreshTopBar();
    this._refreshDockedVehicles();
    if (this._vehicleUI) this._vehicleUI.render();
    if (this._currentView === 'city' && this._currentCityId) {
      if (this._marketDirty) {
        this._refreshMarket(this._currentCityId);
        this._marketDirty = false;
      }
      this._refreshCityRep(this._currentCityId);
      const city = this._cities.get(this._currentCityId);
      if (city) {
        this._els.cityPop.textContent    = city.population.toLocaleString();
        this._els.cityWealth.textContent = city.wealth.toLocaleString() + 'g';
      }
    }
  }

  markMarketDirty() { this._marketDirty = true; }

  // ── City Reputation Display ──────────────────────────────────

  _refreshCityRep(cityId) {
    if (!this._els.cityRepTier || !cityId) return;

    const rep     = getRepForCity(this._state, cityId);
    const tier    = getRepTier(rep);
    const progress = getRepProgress(rep);
    const hash    = `${cityId}:${Math.floor(rep)}`;
    if (hash === this._lastRepHash) return;
    this._lastRepHash = hash;

    this._els.cityRepTier.textContent      = tier.name;
    this._els.cityRepTier.style.color      = tier.color;
    this._els.cityRepBar.style.width       = progress + '%';
    this._els.cityRepBar.style.background  = tier.color;
    this._els.cityRepVal.textContent       = Math.floor(rep) + '/100';
  }

  // ── Top Bar ──────────────────────────────────────────────────

  _refreshTopBar() {
    const gold = Math.floor(this._state.player.gold);
    const tier = this._state.player.tier;
    const date = this._time.getDateString();
    if (gold !== this._lastGold) { this._els.gold.textContent = gold.toLocaleString() + 'g'; this._lastGold = gold; }
    if (tier !== this._lastTier) { this._els.tier.textContent = TIER_NAMES[tier]; this._lastTier = tier; }
    if (date !== this._lastDate) { this._els.date.textContent = date; this._lastDate = date; }
  }

  // ── Docked vehicles footer bar ───────────────────────────────

  _refreshDockedVehicles() {
    if (!this._els.dockedVehicles || !this._vehicleMgr) return;
    const cityId = this._state.player.currentCityId;
    const docked = this._vehicleMgr.getVehiclesAt(cityId);

    // Quick hash to avoid unnecessary repaints
    const hash = docked.map(v => `${v.id}:${v.transportUsed}`).join(',');
    if (hash === this._lastDockedHash) return;
    this._lastDockedHash = hash;

    if (docked.length === 0) {
      this._els.dockedVehicles.innerHTML = '<span class="empty-msg">No vehicles docked here — go to Vehicles tab to dispatch one.</span>';
      return;
    }

    const html = docked.map(v => {
      const pct = Math.round(v.transportUsed / v.capacity * 100);
      return `<div class="docked-vehicle" data-vid="${v.id}" title="Click to manage">
        <span class="docked-icon">${v.icon}</span>
        <div class="docked-info">
          <span class="docked-name">${v.name}</span>
          <div class="docked-bar-wrap">
            <div class="docked-bar" style="width:${pct}%"></div>
          </div>
          <span class="docked-cap">${v.transportUsed}/${v.capacity} wt</span>
        </div>
      </div>`;
    }).join('');

    this._els.dockedVehicles.innerHTML = html;

    // Click docked vehicle → open Vehicles tab with that vehicle expanded
    this._els.dockedVehicles.querySelectorAll('.docked-vehicle').forEach(el => {
      el.addEventListener('click', () => {
        if (this._vehicleUI) {
          this._vehicleUI._selectedVehicleId = el.dataset.vid;
          this._vehicleUI.markDirty();
        }
        // Switch to vehicles tab
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelector('.tab-btn[data-tab="vehicles"]')?.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
        document.getElementById('tab-vehicles')?.classList.remove('hidden');
        if (this._vehicleUI && this._currentCityId) {
          this._vehicleUI.renderVehiclesTabForCity(this._currentCityId);
        }
      });
    });
  }

  // ── Market (price reference only) ───────────────────────────

  _refreshMarket(cityId) {
    const city = this._cities.get(cityId);
    if (!city) return;

    const rep = getRepForCity(this._state, cityId);

    const rows = Object.values(GOODS).map(good => {
      const price      = city.getBuyPrice(good.id);
      const sellPrice  = city.getSellPrice(good.id);
      const stock      = city.inventory[good.id] ?? 0;
      const trend      = city.priceEngine.getTrend(good.id);
      const priceClass = city.priceEngine.getPriceClass(good.id);
      const trendIcon  = trend === 'up' ? '▲' : trend === 'down' ? '▼' : '─';

      const buyCheck  = canBuy(rep, good);
      const locked    = !buyCheck.ok;
      const rowClass  = locked ? 'market-row-locked' : '';

      let accessCell;
      if (locked) {
        accessCell = `<td class="access-locked">🔒 ${buyCheck.minRep} rep<br><small>${buyCheck.tierName}</small></td>`;
      } else {
        accessCell = `<td class="access-ok">✓</td>`;
      }

      return `<tr class="${rowClass}">
        <td>${good.icon} ${good.name}</td>
        <td><span class="cat-badge cat-${good.category}">${good.category}</span></td>
        <td class="price-${priceClass}">${price}g
          <small style="color:var(--text-dim)">(sell: ${sellPrice}g)</small>
        </td>
        <td>${stock}</td>
        <td><span class="wt-badge">${good.weight} wt</span></td>
        <td class="trend-${trend}">${trendIcon}</td>
        ${accessCell}
      </tr>`;
    }).join('');

    this._els.marketBody.innerHTML = rows;
  }

  // ── Buildings ────────────────────────────────────────────────

  _renderBuildings(cityId) {
    const city = this._cities.get(cityId);
    if (!city) return;
    let html = city.playerBuildings.length === 0
      ? '<p style="color:var(--text-dim);font-size:12px;">No buildings owned here yet.<br>Become a Manufacturer (Tier 2) to build facilities.</p>'
      : city.playerBuildings.map(b =>
          `<div class="building-card"><h4>${b.name}</h4><p>${b.description}</p><p class="build-cost">Level ${b.level}</p></div>`
        ).join('');
    this._els.buildingsGrid.innerHTML = html;
  }

  // ── View switching ───────────────────────────────────────────

  showMap() {
    this._currentView   = 'map';
    this._currentCityId = null;
    this._els.mapView.classList.remove('hidden');
    this._els.cityView.classList.add('hidden');
    this._refreshCityList();
  }

  showCity(cityId) {
    const city = this._cities.get(cityId);
    if (!city) return;
    this._currentView   = 'city';
    this._currentCityId = cityId;

    this._els.mapView.classList.add('hidden');
    this._els.cityView.classList.remove('hidden');

    this._els.cityName.textContent   = city.name;
    this._els.cityDesc.textContent   = city.description;
    this._els.cityPop.textContent    = city.population.toLocaleString();
    this._els.cityWealth.textContent = city.wealth.toLocaleString() + 'g';

    // Reset to market tab
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.tab-btn[data-tab="market"]').classList.add('active');
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById('tab-market').classList.remove('hidden');

    this._marketDirty = true;
    this._lastDockedHash = '';
    this._lastRepHash    = '';
    if (this._vehicleUI) this._vehicleUI.markDirty();
    this._refreshCityList(cityId);
    this._player.travelTo(cityId);
  }

  _refreshCityList(activeCityId) {
    const items = [];
    for (const [id, city] of this._cities) {
      const isActive = id === activeCityId;
      items.push(`<li class="city-list-item ${isActive ? 'active' : ''}" data-city="${id}">
        <div class="city-li-name">${city.name}</div>
        <div class="city-li-sub">Pop: ${city.population.toLocaleString()}</div>
      </li>`);
    }
    this._els.cityList.innerHTML = items.join('');
    this._els.cityList.querySelectorAll('li').forEach(li => {
      li.addEventListener('click', () => {
        this.showCity(li.dataset.city);
        this._bus.publish('ui:citySelected', { cityId: li.dataset.city });
      });
    });
  }

  // ── Notifications / Journal ──────────────────────────────────

  addNotification(text, type = 'info') {
    const el = document.createElement('div');
    el.className = `notif-entry notif-${type}`;
    el.textContent = text;
    this._els.notifications.prepend(el);
    while (this._els.notifications.children.length > 20) {
      this._els.notifications.lastChild.remove();
    }
  }

  toast(message, type = 'info') {
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = message;
    this._els.toastContainer.prepend(el);
    setTimeout(() => el.remove(), 3000);
  }

  // ── Dialogue ─────────────────────────────────────────────────

  showDialogue(milestone) {
    this._els.dialogueSpeaker.textContent  = milestone.speaker;
    this._els.dialogueText.textContent     = milestone.text;
    this._els.dialoguePortrait.textContent = milestone.portrait ?? '🗣️';
    this._els.dialogue.classList.remove('hidden');
    this._els.dialogueChoices.innerHTML = '';

    for (const choice of (milestone.choices ?? [])) {
      const btn = document.createElement('button');
      btn.className   = 'dialogue-choice';
      btn.textContent = choice.text;
      btn.addEventListener('click', () => {
        if (choice.action === 'close' || !choice.next) {
          this._els.dialogue.classList.add('hidden');
          this._bus.publish('dialogue:closed', { milestoneId: milestone.id });
        } else {
          this._bus.publish('dialogue:choice', { next: choice.next });
        }
      });
      this._els.dialogueChoices.appendChild(btn);
    }
    this._time.setSpeed(0);
  }

  setQuestDisplay(title, text, goals) {
    this._els.questTitle.textContent  = title;
    this._els.questText.textContent   = text;
    this._els.questProgress.innerHTML = goals.map(g =>
      `<div class="quest-goal ${g.done ? 'done' : ''}">${g.label}</div>`
    ).join('');
  }

  init() {
    this._refreshCityList();
    this._refreshTopBar();
    this.setQuestDisplay(
      'A Strange New World',
      'You have arrived in Oumzy with nothing. Use your vehicle to trade.',
      [
        { label: 'Earn 50g from trading', done: false },
        { label: 'Visit 3 different cities', done: false },
      ]
    );
  }
}
