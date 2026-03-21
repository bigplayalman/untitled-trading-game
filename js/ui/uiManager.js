/**
 * uiManager.js
 * Central UI controller. Manages view switching, top bar, city list,
 * and delegates to sub-UI modules.
 */

import { GOODS } from '../economy/goods.js';
import { TIER_NAMES } from '../engine/stateManager.js';

export class UIManager {
  constructor(state, cities, market, timeManager, player, bus) {
    this._state   = state;
    this._cities  = cities;
    this._market  = market;
    this._time    = timeManager;
    this._player  = player;
    this._bus     = bus;

    this._currentView   = 'map';
    this._currentCityId = null;

    this._els = {
      gold:         document.getElementById('ui-gold'),
      tier:         document.getElementById('ui-tier'),
      date:         document.getElementById('ui-date'),
      cityList:     document.getElementById('city-list'),
      mapView:      document.getElementById('map-view'),
      cityView:     document.getElementById('city-view'),
      cityName:     document.getElementById('city-name'),
      cityDesc:     document.getElementById('city-description'),
      cityPop:      document.getElementById('city-pop'),
      cityWealth:   document.getElementById('city-wealth'),
      marketBody:   document.getElementById('market-body'),
      tradeQty:     document.getElementById('trade-qty'),
      inventory:    document.getElementById('player-inventory'),
      notifications:document.getElementById('notifications'),
      questTitle:   document.getElementById('quest-title'),
      questText:    document.getElementById('quest-text'),
      questProgress:document.getElementById('quest-progress'),
      buildingsGrid:document.getElementById('buildings-grid'),
      dialogue:     document.getElementById('dialogue-overlay'),
      dialogueSpeaker: document.getElementById('dialogue-speaker'),
      dialogueText:    document.getElementById('dialogue-text'),
      dialogueChoices: document.getElementById('dialogue-choices'),
      dialoguePortrait:document.getElementById('dialogue-portrait'),
      toastContainer:  document.getElementById('toast-container'),
    };

    this._bindEvents();
  }

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

    // Back to map button
    document.getElementById('btn-back-map').addEventListener('click', () => {
      this.showMap();
    });

    // Tab buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
        document.getElementById('tab-' + btn.dataset.tab).classList.remove('hidden');
        if (btn.dataset.tab === 'buildings' && this._currentCityId) {
          this._renderBuildings(this._currentCityId);
        }
      });
    });

    // Save / Load
    document.getElementById('btn-save').addEventListener('click', () => {
      this._bus.publish('ui:save', {});
    });
    document.getElementById('btn-load').addEventListener('click', () => {
      this._bus.publish('ui:load', {});
    });

    // City click from map
    this._bus.subscribe('map:cityClick', ({ cityId }) => {
      this.showCity(cityId);
    });

    // Market transactions
    this._els.marketBody.addEventListener('click', e => {
      const btn = e.target.closest('button');
      if (!btn) return;
      const goodId = btn.dataset.good;
      const action = btn.dataset.action;
      const qty    = parseInt(this._els.tradeQty.value) || 1;
      if (!goodId || !action || !this._currentCityId) return;

      let result;
      if (action === 'buy') {
        result = this._market.buy(this._currentCityId, goodId, qty);
      } else {
        result = this._market.sell(this._currentCityId, goodId, qty);
      }
      this.toast(result.message, result.ok ? 'good' : 'bad');
      if (result.ok) this._refreshMarket(this._currentCityId);
    });

    // Bus events for reactive updates
    this._bus.subscribe('market:buy',  () => this._refreshTopBar());
    this._bus.subscribe('market:sell', () => this._refreshTopBar());
    this._bus.subscribe('player:tierUp', ({ tierName }) => {
      this.toast(`Tier up! You are now a ${tierName}!`, 'good');
    });
    this._bus.subscribe('save:success', () => this.toast('Game saved.', 'good'));
    this._bus.subscribe('save:failed',  () => this.toast('Save failed!', 'bad'));
  }

  /** Called every render frame */
  render() {
    this._refreshTopBar();
    this._refreshInventory();
    if (this._currentView === 'city' && this._currentCityId) {
      this._refreshMarket(this._currentCityId);
      const city = this._cities.get(this._currentCityId);
      if (city) {
        this._els.cityPop.textContent    = city.population.toLocaleString();
        this._els.cityWealth.textContent = city.wealth.toLocaleString() + 'g';
      }
    }
  }

  _refreshTopBar() {
    this._els.gold.textContent = Math.floor(this._state.player.gold).toLocaleString() + 'g';
    this._els.tier.textContent = TIER_NAMES[this._state.player.tier];
    this._els.date.textContent = this._time.getDateString();
  }

  _refreshInventory() {
    const inv = this._state.player.inventory;
    const cargo = this._player.getCargoUsed();
    const cap   = this._player.getCargoCapacity();

    let html = `<span class="inventory-item"><span class="item-qty">Cargo: ${cargo}/${cap}</span></span>`;

    const entries = Object.entries(inv).filter(([, qty]) => qty > 0);
    if (entries.length === 0) {
      html += '<span class="empty-msg">Empty</span>';
    } else {
      for (const [id, qty] of entries) {
        const good = GOODS[id];
        if (!good) continue;
        html += `<span class="inventory-item">${good.icon} <span class="item-qty">${qty}</span> ${good.name}</span>`;
      }
    }
    this._els.inventory.innerHTML = html;
  }

  _refreshMarket(cityId) {
    const city = this._cities.get(cityId);
    if (!city) return;

    const rows = Object.values(GOODS).map(good => {
      const price     = city.getBuyPrice(good.id);
      const sellPrice = city.getSellPrice(good.id);
      const stock     = city.inventory[good.id] ?? 0;
      const trend     = city.priceEngine.getTrend(good.id);
      const priceClass= city.priceEngine.getPriceClass(good.id);
      const owned     = this._state.player.inventory[good.id] ?? 0;

      const trendIcon = trend === 'up' ? '▲' : trend === 'down' ? '▼' : '─';
      const trendCls  = `trend-${trend}`;
      const priceCls  = `price-${priceClass}`;

      return `<tr>
        <td>${good.icon} ${good.name}</td>
        <td><span class="cat-badge cat-${good.category}">${good.category}</span></td>
        <td class="${priceCls}">${price}g <small style="color:var(--text-dim)">(sell:${sellPrice}g)</small></td>
        <td>${stock}</td>
        <td class="${trendCls}">${trendIcon}</td>
        <td><button class="buy-btn" data-good="${good.id}" data-action="buy" ${stock === 0 ? 'disabled' : ''}>Buy</button></td>
        <td><button class="sell-btn" data-good="${good.id}" data-action="sell" ${owned === 0 ? 'disabled' : ''}>Sell</button></td>
      </tr>`;
    }).join('');

    this._els.marketBody.innerHTML = rows;
  }

  _renderBuildings(cityId) {
    const city = this._cities.get(cityId);
    if (!city) return;

    // Show player buildings + available buildings to build
    let html = '';
    if (city.playerBuildings.length === 0) {
      html = '<p style="color:var(--text-dim);font-size:12px;">No buildings owned here yet.<br>Become a Manufacturer (Tier 2) to build facilities.</p>';
    } else {
      for (const b of city.playerBuildings) {
        html += `<div class="building-card"><h4>${b.name}</h4><p>${b.description}</p><p class="build-cost">Level ${b.level}</p></div>`;
      }
    }
    this._els.buildingsGrid.innerHTML = html;
  }

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

    this._els.cityName.textContent = city.name;
    this._els.cityDesc.textContent = city.description;
    this._els.cityPop.textContent  = city.population.toLocaleString();
    this._els.cityWealth.textContent = city.wealth.toLocaleString() + 'g';

    // Reset to market tab
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.tab-btn[data-tab="market"]').classList.add('active');
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById('tab-market').classList.remove('hidden');

    this._refreshMarket(cityId);
    this._refreshCityList(cityId);

    // Player travels here
    this._player.travelTo(cityId);
  }

  _refreshCityList(activeCityId) {
    const items = [];
    for (const [id, city] of this._cities) {
      const isActive = id === activeCityId;
      items.push(`
        <li class="city-list-item ${isActive ? 'active' : ''}" data-city="${id}">
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

  /** Add a line to the journal */
  addNotification(text, type = 'info') {
    const el  = document.createElement('div');
    el.className = `notif-entry notif-${type}`;
    el.textContent = text;
    this._els.notifications.prepend(el);
    // Keep max 20 entries
    while (this._els.notifications.children.length > 20) {
      this._els.notifications.lastChild.remove();
    }
  }

  /** Show a floating toast */
  toast(message, type = 'info') {
    const el = document.createElement('div');
    el.className = `toast toast-${type}`;
    el.textContent = message;
    this._els.toastContainer.prepend(el);
    setTimeout(() => el.remove(), 3000);
  }

  /** Show dialogue box */
  showDialogue(milestone) {
    this._els.dialogueSpeaker.textContent = milestone.speaker;
    this._els.dialogueText.textContent    = milestone.text;
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

    this._time.setSpeed(0); // Pause during dialogue
  }

  setQuestDisplay(title, text, goals) {
    this._els.questTitle.textContent = title;
    this._els.questText.textContent  = text;
    this._els.questProgress.innerHTML = goals.map(g =>
      `<div class="quest-goal ${g.done ? 'done' : ''}">${g.label}</div>`
    ).join('');
  }

  init() {
    this._refreshCityList();
    this._refreshTopBar();
    this._refreshInventory();
    this.setQuestDisplay(
      'A Strange New World',
      'You have arrived in Ironveil with nothing. Trade to survive.',
      [
        { label: 'Earn 50g from trading', done: false },
        { label: 'Visit 3 different cities', done: false },
      ]
    );
  }
}
