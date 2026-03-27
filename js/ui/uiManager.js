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
         getRepProgress,
         gainFromTrade }                      from '../player/reputation.js';

export class UIManager {
  constructor(state, cities, market, timeManager, player, bus) {
    this._state  = state;
    this._cities = cities;
    this._market = market;
    this._time   = timeManager;
    this._player = player;
    this._bus    = bus;

    this._currentCityId = null;
    this._cityModalOpen = false;
    this._showingCityOverview = false;
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
      cargoSidebar:    document.getElementById('cargo-sidebar'),
      mapView:         document.getElementById('map-view'),
      cityModal:       document.getElementById('city-modal'),
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
      cityOverview:    document.getElementById('city-overview'),
      marketTradeBar:  document.getElementById('market-trade-bar'),
      fleetMenuPanel:  document.getElementById('fleet-menu-panel'),
      notifications:   document.getElementById('notifications'),
      buildingsGrid:   document.getElementById('buildings-grid'),
      dialogue:        document.getElementById('dialogue-overlay'),
      dialogueSpeaker: document.getElementById('dialogue-speaker'),
      dialogueText:    document.getElementById('dialogue-text'),
      dialogueChoices: document.getElementById('dialogue-choices'),
      dialoguePortrait:document.getElementById('dialogue-portrait'),
      nameOverlay:     document.getElementById('name-overlay'),
      nameForm:        document.getElementById('name-form'),
      nameInput:       document.getElementById('name-input'),
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
    document.getElementById('btn-menu-map')?.addEventListener('click', () => this.showMap());
    document.getElementById('btn-menu-fleet')?.addEventListener('click', () => this.toggleFleetMenu());

    if (this._els.cityModal) {
      this._els.cityModal.addEventListener('click', e => {
        if (e.target === this._els.cityModal) this.showMap();
      });
    }

    document.addEventListener('click', e => {
      const fleetBtn = document.getElementById('btn-menu-fleet');
      if (!this._els.fleetMenuPanel || this._els.fleetMenuPanel.classList.contains('hidden')) return;
      if (this._els.fleetMenuPanel.contains(e.target) || fleetBtn?.contains(e.target)) return;
      this.hideFleetMenu();
    });

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && this._cityModalOpen) this.showMap();
      if (e.key === 'Escape' && !this._els.fleetMenuPanel?.classList.contains('hidden')) this.hideFleetMenu();
    });

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
    this._els.nameForm?.addEventListener('submit', e => this._handleNameSubmit(e));

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
    this._bus.subscribe('vehicle:transportChanged', () => { this._lastDockedHash = ''; });

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
    this._refreshCargoSidebar();
    this._refreshDockedVehicles();
    if (this._vehicleUI) this._vehicleUI.render();
    if (this._cityModalOpen && this._currentCityId) {
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

    if (this._showingCityOverview) {
      this._renderCityOverview(cityId);
      return;
    }

    const rep = getRepForCity(this._state, cityId);
    const vehiclesHere = this._vehicleMgr?.getVehiclesAt(cityId) ?? [];
    const selectedVehicle = this._resolveMarketVehicle(cityId, vehiclesHere);

    this._renderMarketTradeBar(cityId, vehiclesHere, selectedVehicle);

    const rows = Object.values(GOODS).map(good => {
      const price      = city.getBuyPrice(good.id);
      const sellPrice  = city.getSellPrice(good.id);
      const stock      = city.inventory[good.id] ?? 0;
      const trend      = city.priceEngine.getTrend(good.id);
      const priceClass = city.priceEngine.getPriceClass(good.id);
      const trendIcon  = trend === 'up' ? '▲' : trend === 'down' ? '▼' : '─';

      const vehicleQty = selectedVehicle?.transport?.[good.id] ?? 0;
      const canLoad   = selectedVehicle ? selectedVehicle.maxLoadable(good.id) : 0;
      const buyMax    = selectedVehicle ? Math.min(stock, canLoad) : 0;
      const sellMax   = selectedVehicle ? vehicleQty : 0;

      let tradeCell = '<td class="market-holdings">No docked vehicle selected.</td>';
      if (selectedVehicle) {
        const repGain  = gainFromTrade(good.category, sellPrice / (good.basePrice || 1), true);
        const sellMeta = `${vehicleQty} on board${vehicleQty > 0 ? ` • sells for ${sellPrice}g` : ''}`;
        tradeCell = `<td>
          <div class="market-actions">
            <input type="number" id="market-qty-${good.id}" class="market-qty-input"
              value="1" min="1" max="${Math.max(buyMax, sellMax, 1)}">
            <button class="buy-btn btn-market-buy" data-good="${good.id}" ${buyMax <= 0 ? 'disabled' : ''}>Buy</button>
            <button class="sell-btn btn-market-sell" data-good="${good.id}" ${sellMax <= 0 ? 'disabled' : ''}>Sell</button>
          </div>
          <div class="market-holdings">${sellMeta}${vehicleQty > 0 ? ` • +${repGain.toFixed(1)} rep` : ''}</div>
        </td>`;
      }

      return `<tr>
        <td>${good.icon} ${good.name}</td>
        <td><span class="cat-badge cat-${good.category}">${good.category}</span></td>
        <td class="price-${priceClass}">${price}g
          <small style="color:var(--text-dim)">(sell: ${sellPrice}g)</small>
        </td>
        <td>${stock}</td>
        <td><span class="wt-badge">${good.weight} wt</span></td>
        <td class="trend-${trend}">${trendIcon}</td>
        ${tradeCell}
      </tr>`;
    }).join('');

    this._els.marketBody.innerHTML = rows;
    this._bindMarketTradeEvents(cityId, selectedVehicle?.id ?? null);
  }

  _renderMarketTradeBar(cityId, vehiclesHere, selectedVehicle) {
    if (!this._els.marketTradeBar) return;

    if (vehiclesHere.length === 0) {
      this._els.marketTradeBar.innerHTML = `
        <div class="market-trade-panel market-trade-empty">
          <div>
            <strong>No docked vehicles here</strong>
            <p>Dispatch a vehicle to ${this._cities.get(cityId)?.name ?? 'this city'} before you can trade.</p>
          </div>
        </div>
      `;
      return;
    }

    const options = vehiclesHere.map(v => {
      const selected = v.id === selectedVehicle?.id ? 'selected' : '';
      return `<option value="${v.id}" ${selected}>${v.name} • ${v.transportUsed}/${v.capacity} wt • ${v.capacity - v.transportUsed} wt free</option>`;
    }).join('');

    this._els.marketTradeBar.innerHTML = `
      <div class="market-trade-panel">
        <div>
          <strong>Trading Vehicle</strong>
          <p>All purchases load into the selected vehicle. All sales unload from it.</p>
        </div>
        <select id="market-vehicle-picker" class="market-vehicle-picker">${options}</select>
      </div>
    `;

    document.getElementById('market-vehicle-picker')?.addEventListener('change', e => {
      this._vehicleUI?.setSelectedVehicleId(e.target.value);
      this._marketDirty = true;
    });
  }

  _resolveMarketVehicle(cityId, vehiclesHere) {
    if (!vehiclesHere.length) return null;

    const selectedId = this._vehicleUI?.getSelectedVehicleId?.() ?? null;
    let selected = vehiclesHere.find(v => v.id === selectedId) ?? null;
    if (!selected) {
      selected = vehiclesHere[0];
      this._vehicleUI?.setSelectedVehicleId(selected.id);
    }
    return selected;
  }

  _bindMarketTradeEvents(cityId, vehicleId) {
    if (!vehicleId) return;

    this._els.marketBody.querySelectorAll('.btn-market-buy').forEach(btn => {
      btn.addEventListener('click', () => {
        const goodId = btn.dataset.good;
        const qty = parseInt(document.getElementById(`market-qty-${goodId}`)?.value ?? '1', 10);
        const vehicle = this._vehicleMgr?.getVehicle(vehicleId);
        if (!vehicle) return;
        const result = this._market.buy(cityId, goodId, qty, vehicle);
        this._bus.publish('ui:toast', { message: result.message, type: result.ok ? 'good' : 'bad' });
        if (result.ok) {
          this._vehicleMgr?.syncState();
          this._vehicleUI?.markDirty();
          this._marketDirty = true;
        }
      });
    });

    this._els.marketBody.querySelectorAll('.btn-market-sell').forEach(btn => {
      btn.addEventListener('click', () => {
        const goodId = btn.dataset.good;
        const qty = parseInt(document.getElementById(`market-qty-${goodId}`)?.value ?? '1', 10);
        const vehicle = this._vehicleMgr?.getVehicle(vehicleId);
        if (!vehicle) return;
        const result = this._market.sell(cityId, goodId, qty, vehicle);
        this._bus.publish('ui:toast', { message: result.message, type: result.ok ? 'good' : 'bad' });
        if (result.ok) {
          this._vehicleMgr?.syncState();
          this._vehicleUI?.markDirty();
          this._marketDirty = true;
        }
      });
    });
  }

  _renderCityOverview(cityId) {
    const city = this._cities.get(cityId);
    if (!city || !this._els.cityOverview) return;

    const topProduced = Object.entries(city.naturalProduction)
      .filter(([, qty]) => qty > 0)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    const weakProduction = Object.values(GOODS)
      .filter(good => (city.naturalProduction[good.id] ?? 0) === 0)
      .sort((a, b) => (city.dailyConsumption[b.id] ?? 0) - (city.dailyConsumption[a.id] ?? 0))
      .slice(0, 3);

    const inventoryPairs = Object.entries(city.inventory);
    const mostStocked = [...inventoryPairs]
      .sort((a, b) => b[1] - a[1])
      .filter(([, qty]) => qty > 0)
      .slice(0, 3);

    const lacking = Object.values(GOODS)
      .map(good => {
        const stock = city.inventory[good.id] ?? 0;
        const need  = city.dailyConsumption[good.id] ?? 0;
        const score = need > 0 ? stock - (need * 3) : stock;
        return { good, stock, need, score };
      })
      .sort((a, b) => a.score - b.score)
      .slice(0, 3);

    const renderChipList = (items, fallback) => {
      if (!items.length) return `<p>${fallback}</p>`;
      return `<div class="city-overview-list">${
        items.join('')
      }</div>`;
    };

    const producedHtml = renderChipList(
      topProduced.map(([goodId, qty]) => {
        const good = GOODS[goodId];
        return `<span class="city-overview-chip">${good?.icon ?? ''} ${good?.name ?? goodId} <strong>+${qty}/day</strong></span>`;
      }),
      'No standout production lines yet.'
    );

    const weakHtml = renderChipList(
      weakProduction.map(good =>
        `<span class="city-overview-chip">${good.icon} ${good.name}</span>`
      ),
      'This city produces a bit of everything.'
    );

    const stockedHtml = renderChipList(
      mostStocked.map(([goodId, qty]) => {
        const good = GOODS[goodId];
        return `<span class="city-overview-chip">${good?.icon ?? ''} ${good?.name ?? goodId} <strong>${qty} in stock</strong></span>`;
      }),
      'Warehouses are currently thin.'
    );

    const lackingHtml = renderChipList(
      lacking.map(({ good, stock, need }) =>
        `<span class="city-overview-chip">${good.icon} ${good.name} <strong>${stock} on hand${need > 0 ? `, needs ${need}/day` : ''}</strong></span>`
      ),
      'Nothing is under obvious pressure right now.'
    );

    this._els.cityOverview.innerHTML = `
      <section class="city-overview-intro">
        <h3>${city.name}</h3>
        <p>${city.description}</p>
      </section>
      <section class="city-overview-grid">
        <article class="city-overview-card">
          <h4>Strong Production</h4>
          <p>Goods this city naturally produces in the largest volume.</p>
          ${producedHtml}
        </article>
        <article class="city-overview-card">
          <h4>Weak Production</h4>
          <p>Goods this city does not naturally produce and usually depends on outside supply for.</p>
          ${weakHtml}
        </article>
        <article class="city-overview-card">
          <h4>Most Stocked</h4>
          <p>What the local market currently has the most of.</p>
          ${stockedHtml}
        </article>
        <article class="city-overview-card">
          <h4>Current Shortages</h4>
          <p>Goods that look scarce relative to local demand.</p>
          ${lackingHtml}
        </article>
      </section>
    `;
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
    this._cityModalOpen = false;
    this._currentCityId = null;
    this._showingCityOverview = false;
    this._els.cityModal?.classList.add('hidden');
    this.hideFleetMenu(false);
    this._setActiveTopMenu('map');
  }

  showCity(cityId) {
    const city = this._cities.get(cityId);
    if (!city) return;
    this._cityModalOpen = true;
    this._currentCityId = cityId;
    this.hideFleetMenu(false);
    this._setActiveTopMenu('map');

    this._els.cityModal?.classList.remove('hidden');

    const hasVehiclesHere = !!this._vehicleMgr?.getVehiclesAt(cityId).length;
    const hasBuildingsHere = (city.playerBuildings?.length ?? 0) > 0;
    this._showingCityOverview = !hasVehiclesHere && !hasBuildingsHere;

    this._els.cityName.textContent   = city.name;
    this._els.cityDesc.textContent   = city.description;
    this._els.cityPop.textContent    = city.population.toLocaleString();
    this._els.cityWealth.textContent = city.wealth.toLocaleString() + 'g';

    // Reset to market tab
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelector('.tab-btn[data-tab="market"]').classList.add('active');
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById('tab-market').classList.remove('hidden');

    document.querySelectorAll('.tab-btn[data-tab="vehicles"], .tab-btn[data-tab="buildings"]').forEach(btn => {
      btn.classList.toggle('hidden', this._showingCityOverview);
    });
    this._els.cityOverview?.classList.toggle('hidden', !this._showingCityOverview);
    this._els.marketTradeBar?.classList.toggle('hidden', this._showingCityOverview);
    document.querySelector('.market-hint')?.classList.toggle('hidden', this._showingCityOverview);
    document.getElementById('market-table')?.classList.toggle('hidden', this._showingCityOverview);

    this._marketDirty = true;
    this._lastDockedHash = '';
    this._lastRepHash    = '';
    if (this._vehicleUI) this._vehicleUI.markDirty();
    this._player.travelTo(cityId);
  }

  toggleFleetMenu() {
    if (this._els.fleetMenuPanel?.classList.contains('hidden')) {
      this._els.fleetMenuPanel.classList.remove('hidden');
      this._setActiveTopMenu('fleet');
      return;
    }
    this.hideFleetMenu();
  }

  hideFleetMenu(resetMenu = true) {
    this._els.fleetMenuPanel?.classList.add('hidden');
    if (resetMenu) this._setActiveTopMenu('map');
  }

  _setActiveTopMenu(active) {
    document.getElementById('btn-menu-map')?.classList.toggle('active', active === 'map');
    document.getElementById('btn-menu-fleet')?.classList.toggle('active', active === 'fleet');
  }

  _refreshCargoSidebar() {
    if (!this._els.cargoSidebar || !this._vehicleMgr) return;

    const vehicle = this._resolveSidebarVehicle();
    if (!vehicle) {
      this._els.cargoSidebar.innerHTML = '<p class="empty-msg">Select a vehicle from the map or fleet menu to inspect its cargo.</p>';
      return;
    }

    const currentCity = this._cities.get(vehicle.currentCityId);
    const entries = Object.entries(vehicle.transport)
      .filter(([, qty]) => qty > 0)
      .sort((a, b) => b[1] - a[1]);

    const cargoRows = entries.length === 0
      ? '<p class="empty-msg">This vessel is empty.</p>'
      : entries.map(([goodId, qty]) => {
          const good = GOODS[goodId];
          const avgCost = qty > 0 ? ((vehicle.transportCostBasis?.[goodId] ?? 0) / qty) : 0;
          const currentSell = currentCity ? currentCity.getSellPrice(goodId) : 0;
          const delta = currentCity ? currentSell - avgCost : 0;
          const deltaClass = delta > 0 ? 'num-pos' : delta < 0 ? 'num-neg' : '';
          const deltaText = currentCity
            ? `<span class="${deltaClass}">${delta >= 0 ? '+' : ''}${Math.round(delta)}g now</span>`
            : '';

          return `<div class="cargo-item">
            <div class="cargo-top">
              <span class="cargo-name">${good?.icon ?? ''} ${good?.name ?? goodId}</span>
              <span class="cargo-qty">${qty} units</span>
            </div>
            <div class="cargo-meta">
              <span>${(good?.weight ?? 1) * qty} wt</span>
              <span>Avg buy ${avgCost > 0 ? avgCost.toFixed(1) : '0.0'}g</span>
              ${deltaText}
            </div>
          </div>`;
        }).join('');

    const status = vehicle.isTravelling
      ? `En route to ${this._cities.get(vehicle.finalCityId ?? vehicle.toCityId)?.name ?? vehicle.toCityId}`
      : `Idle at ${this._cities.get(vehicle.currentCityId)?.name ?? vehicle.currentCityId}`;

    this._els.cargoSidebar.innerHTML = `
      <div class="cargo-header-card">
        <div class="cargo-vessel-name">${vehicle.icon} ${vehicle.name}</div>
        <div class="cargo-vessel-status">${status}</div>
        <div class="cargo-vessel-cap">${vehicle.transportUsed}/${vehicle.capacity} wt used</div>
      </div>
      <div class="cargo-list">${cargoRows}</div>
    `;
  }

  _resolveSidebarVehicle() {
    const selectedId = this._vehicleUI?.getSelectedVehicleId?.();
    const selected = selectedId ? this._vehicleMgr.getVehicle(selectedId) : null;
    if (selected) return selected;

    const currentCityVehicles = this._vehicleMgr.getVehiclesAt(this._player.currentCityId);
    if (currentCityVehicles.length) return currentCityVehicles[0];

    return this._vehicleMgr.vehicles[0] ?? null;
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
        if (choice.action === 'name') {
          this._showNamePrompt(milestone.id, choice.next);
        } else if (choice.action === 'close' || !choice.next) {
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

  _showNamePrompt(milestoneId, nextMilestoneId = null) {
    this._els.dialogue.classList.add('hidden');
    this._els.nameOverlay?.classList.remove('hidden');
    this._els.nameOverlay.dataset.milestoneId = milestoneId;
    this._els.nameOverlay.dataset.nextMilestoneId = nextMilestoneId ?? '';
    if (this._els.nameInput) {
      this._els.nameInput.value = this._state.player.name ?? '';
      setTimeout(() => this._els.nameInput?.focus(), 0);
    }
  }

  _handleNameSubmit(e) {
    e.preventDefault();
    const rawName = this._els.nameInput?.value ?? '';
    const name = rawName.trim().replace(/\s+/g, ' ');
    if (!name) {
      this.toast('Enter a name first.', 'bad');
      this._els.nameInput?.focus();
      return;
    }

    this._state.player.name = name;
    this._els.nameOverlay?.classList.add('hidden');
    this.toast(`You are now known as ${name}.`, 'good');
    this.addNotification(`Cid learns your name: ${name}.`, 'info');
    const nextMilestoneId = this._els.nameOverlay?.dataset.nextMilestoneId;
    if (nextMilestoneId) {
      this._bus.publish('dialogue:choice', { next: nextMilestoneId });
      return;
    }
    this._bus.publish('dialogue:closed', {
      milestoneId: this._els.nameOverlay?.dataset.milestoneId ?? 'intro_03',
      playerName: name,
    });
  }

  init() {
    this._refreshCargoSidebar();
    this._refreshTopBar();
  }
}
