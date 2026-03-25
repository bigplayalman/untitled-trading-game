/**
 * vehicleUI.js
 * All vehicle-related UI:
 *   - Fleet sidebar (all vehicles, live status)
 *   - Vehicles tab in city view (vehicles docked here)
 *     - Buy goods from city market directly into vehicle
 *     - Sell goods from vehicle to city market
 *     - Dispatch to another city
 *   - Vehicle shop
 */

import { GOODS }                                from '../economy/goods.js';
import { VEHICLE_TYPES }                        from '../player/vehicles.js';
import { CONNECTIONS }                          from '../world/worldMap.js';
import { canBuy, canSell, getRepForCity,
         gainFromTrade, getRepTier }             from '../player/reputation.js';

export class VehicleUI {
  /**
   * @param {object}         state
   * @param {VehicleManager} vehicleMgr
   * @param {Market}         market
   * @param {Map}            cities
   * @param {Player}         player
   * @param {EventBus}       bus
   */
  constructor(state, vehicleMgr, market, cities, player, bus) {
    this._state     = state;
    this._mgr       = vehicleMgr;
    this._market    = market;
    this._cities    = cities;
    this._player    = player;
    this._bus       = bus;

    this._selectedVehicleId = null;
    this._currentCityId     = null;

    this._fleetListEl = document.getElementById('fleet-list');
    this._vehiclesTab = document.getElementById('tab-vehicles');

    this._dirty = true;
    this._bindBusEvents();
  }

  _bindBusEvents() {
    this._bus.subscribe('vehicle:purchased',        () => { this._dirty = true; });
    this._bus.subscribe('vehicle:dispatched',       () => { this._dirty = true; });
    this._bus.subscribe('vehicle:arrived',          () => { this._dirty = true; });
    this._bus.subscribe('vehicle:transportChanged', () => { this._dirty = true; });
    this._bus.subscribe('market:buy',               () => { this._dirty = true; });
    this._bus.subscribe('market:sell',              () => { this._dirty = true; });
    this._bus.subscribe('player:travel', ({ to }) => {
      this._currentCityId = to;
      this._dirty = true;
    });
  }

  markDirty() { this._dirty = true; }
  getSelectedVehicleId() { return this._selectedVehicleId; }
  setSelectedVehicleId(vehicleId) {
    this._selectedVehicleId = vehicleId;
    this._dirty = true;
  }

  render() {
    if (!this._dirty) return;
    this._dirty = false;
    this._renderFleetSidebar();
    if (this._vehiclesTab && !this._vehiclesTab.classList.contains('hidden')) {
      this._renderVehiclesTab(this._currentCityId);
    }
  }

  // ── Fleet Sidebar ─────────────────────────────────────────────

  _renderFleetSidebar() {
    const vehicles = this._mgr.vehicles;
    if (vehicles.length === 0) {
      this._fleetListEl.innerHTML = '<li class="empty-msg">No vehicles.</li>';
      return;
    }

    const html = vehicles.map(v => {
      let statusText, statusClass;
      if (v.isTravelling) {
        const dest = this._cities.get(v.toCityId)?.name ?? v.toCityId;
        statusText  = `→ ${dest} (${v.getEtaString()})`;
        statusClass = 'status-travelling';
      } else {
        const city = this._cities.get(v.currentCityId)?.name ?? v.currentCityId;
        statusText  = `Idle at ${city}`;
        statusClass = 'status-idle';
      }

      const used = v.transportUsed;
      const isSelected = v.id === this._selectedVehicleId;

      return `<li class="fleet-item ${isSelected ? 'fleet-item-active' : ''}" data-vid="${v.id}">
        <span class="fleet-icon">${v.icon}</span>
        <div class="fleet-info">
          <div class="fleet-name">${v.name}</div>
          <div class="fleet-status ${statusClass}">${statusText}</div>
          ${used > 0 ? `<div class="fleet-transport">${used}/${v.capacity} wt</div>` : ''}
        </div>
      </li>`;
    }).join('');

    this._fleetListEl.innerHTML = html;

    this._fleetListEl.querySelectorAll('.fleet-item').forEach(li => {
      li.addEventListener('click', () => {
        this._selectedVehicleId = li.dataset.vid;
        this._dirty = true;
        const v = this._mgr.getVehicle(li.dataset.vid);
        if (v && !v.isTravelling) {
          this._bus.publish('ui:citySelected', { cityId: v.currentCityId });
          this._bus.publish('map:cityClick', { cityId: v.currentCityId });
        }
      });
    });
  }

  // ── Vehicles Tab ──────────────────────────────────────────────

  renderVehiclesTabForCity(cityId) {
    this._currentCityId = cityId;
    this._renderVehiclesTab(cityId);
  }

  _renderVehiclesTab(cityId) {
    if (!this._vehiclesTab || !cityId) return;

    const vehiclesHere = this._mgr.getVehiclesAt(cityId);
    let html = '';

    if (vehiclesHere.length === 0) {
      html += '<p class="empty-msg" style="margin-bottom:10px">No vehicles docked here. Dispatch one to this city to start trading.</p>';
    } else {
      for (const v of vehiclesHere) {
        html += this._renderVehicleCard(v, cityId, v.id === this._selectedVehicleId);
      }
    }

    html += this._renderVehicleShop();
    this._vehiclesTab.innerHTML = html;
    this._bindVehicleTabEvents(cityId);
  }

  _renderVehicleCard(v, cityId, expanded) {
    const used = v.transportUsed;
    const pct  = Math.round(used / v.capacity * 100);

    let expandedContent = '';
    if (expanded) {
      const city = this._cities.get(cityId);

      // ── Buy section (city market → vehicle) ──────────────────
      const rep = getRepForCity(this._state, cityId);

      const buyRows = Object.values(GOODS).map(good => {
        const stock      = city?.inventory[good.id] ?? 0;
        const price      = city?.getBuyPrice(good.id) ?? good.basePrice;
        const buyCheck   = canBuy(rep, good);
        const locked     = !buyCheck.ok;
        const canLoad    = v.maxLoadable(good.id);
        const maxQty     = Math.min(stock, canLoad);

        if (locked) {
          // Show dimmed locked row — player can see what they're working towards
          return `<div class="transport-row transport-row-locked">
            <span class="tr-good">🔒 ${good.icon} ${good.name}
              <span class="tr-meta">Requires ${buyCheck.minRep} rep (${buyCheck.tierName}) • ${good.weight}wt</span>
            </span>
            <input type="number" class="transport-qty-input" value="1" disabled>
            <button class="buy-btn" disabled>Locked</button>
          </div>`;
        }

        if (stock === 0) return ''; // skip out-of-stock unlocked goods
        return `<div class="transport-row">
          <span class="tr-good">${good.icon} ${good.name}
            <span class="tr-meta">${stock} in stock • ${price}g • ${good.weight}wt each</span>
          </span>
          <input type="number" id="buy-qty-${v.id}-${good.id}"
            class="transport-qty-input" value="1" min="1" max="${maxQty}"
            ${maxQty === 0 ? 'disabled' : ''}>
          <button class="buy-btn btn-vbuy" data-vid="${v.id}" data-good="${good.id}"
            ${maxQty === 0 ? 'disabled' : ''}>Buy</button>
        </div>`;
      }).join('');

      // ── Sell section (vehicle → city market) ─────────────────
      const transportEntries = Object.entries(v.transport).filter(([, q]) => q > 0);
      const sellRows = transportEntries.length === 0
        ? '<p class="empty-msg">Vehicle transport is empty.</p>'
        : transportEntries.map(([goodId, qty]) => {
            const good       = GOODS[goodId];
            const sellPrice  = city?.getSellPrice(goodId) ?? good?.basePrice ?? 0;
            const sellCheck  = canSell(rep, good ?? {});
            const sellLocked = !sellCheck.ok;

            // Rep gain preview for sells
            const priceRatio  = sellPrice / (good?.basePrice || 1);
            const repGain     = gainFromTrade(good?.category ?? 'raw', priceRatio, true);
            const repGainStr  = `+${repGain.toFixed(1)} rep`;
            const demandHigh  = priceRatio > 1.3;
            const repGainClass = demandHigh ? 'rep-gain-high' : 'rep-gain';

            if (sellLocked) {
              return `<div class="transport-row transport-row-locked">
                <span class="tr-good">🔒 ${good?.icon ?? ''} ${good?.name ?? goodId}
                  <span class="tr-meta">${qty} on board • Requires ${sellCheck.minRepSell} rep to sell here</span>
                </span>
                <input type="number" class="transport-qty-input" value="${qty}" disabled>
                <button class="sell-btn" disabled>Locked</button>
              </div>`;
            }

            return `<div class="transport-row">
              <span class="tr-good">${good?.icon ?? ''} ${good?.name ?? goodId}
                <span class="tr-meta">${qty} on board • ${sellPrice}g each • ${good?.weight ?? 1}wt
                  <span class="${repGainClass}">${repGainStr}${demandHigh ? ' ▲' : ''}</span>
                </span>
              </span>
              <input type="number" id="sell-qty-${v.id}-${goodId}"
                class="transport-qty-input" value="${qty}" min="1" max="${qty}">
              <button class="sell-btn btn-vsell" data-vid="${v.id}" data-good="${goodId}">Sell</button>
            </div>`;
          }).join('');

      // ── Dispatch section ──────────────────────────────────────
      const connectedCities = this._getConnectedCities(cityId);
      const destOptions = connectedCities.map(({ cityId: cid, distance }) => {
        const c      = this._cities.get(cid);
        if (!c) return '';
        const etaHrs = distance / v.speed;
        const etaStr = etaHrs >= 1
          ? `${Math.floor(etaHrs)}h ${Math.floor((etaHrs % 1) * 60)}m`
          : `${Math.floor(etaHrs * 60)}m`;
        return `<option value="${cid}">${c.name} — ${distance}km (ETA: ${etaStr})</option>`;
      }).join('');

      expandedContent = `
        <div class="vehicle-expanded">
          <div class="transport-capacity-bar">
            <span>Transport: ${used}/${v.capacity} wt</span>
            <div class="transport-bar-wrap">
              <div class="transport-bar" style="width:${pct}%"></div>
            </div>
            <span>${v.capacity - used} wt free</span>
          </div>

          <div class="transport-subsection">
            <h5>Buy into ${v.name}</h5>
            ${buyRows || '<p class="empty-msg">Nothing in stock.</p>'}
          </div>

          <div class="transport-subsection">
            <h5>Sell from ${v.name}</h5>
            ${sellRows}
          </div>

          <div class="dispatch-section">
            <h5>Dispatch</h5>
            ${connectedCities.length === 0
              ? '<p class="empty-msg">No connected cities.</p>'
              : `<div class="dispatch-controls">
                  <select id="dispatch-dest-${v.id}" class="dispatch-select">
                    <option value="">— Select destination —</option>
                    ${destOptions}
                  </select>
                  <button class="menu-btn btn-dispatch" data-vid="${v.id}">Send ➜</button>
                </div>`
            }
          </div>
        </div>`;
    }

    return `
      <div class="vehicle-card ${expanded ? 'vehicle-card-expanded' : ''}">
        <div class="vehicle-card-header" data-vid="${v.id}">
          <span class="vehicle-card-icon">${v.icon}</span>
          <div class="vehicle-card-info">
            <span class="vehicle-card-name">${v.name}</span>
            <span class="vehicle-card-sub">${v.capacity} wt cap • ${v.speed} km/h</span>
          </div>
          <span class="vehicle-card-transport">${used}/${v.capacity} wt</span>
          <span class="vehicle-card-chevron">${expanded ? '▲' : '▼'}</span>
        </div>
        ${expandedContent}
      </div>`;
  }

  _bindVehicleTabEvents(cityId) {
    if (!this._vehiclesTab) return;

    // Expand/collapse cards
    this._vehiclesTab.querySelectorAll('.vehicle-card-header').forEach(el => {
      el.addEventListener('click', () => {
        const vid = el.dataset.vid;
        this._selectedVehicleId = (this._selectedVehicleId === vid) ? null : vid;
        this._dirty = true;
      });
    });

    // Buy into vehicle
    this._vehiclesTab.querySelectorAll('.btn-vbuy').forEach(btn => {
      btn.addEventListener('click', () => {
        const vid    = btn.dataset.vid;
        const goodId = btn.dataset.good;
        const qty    = parseInt(document.getElementById(`buy-qty-${vid}-${goodId}`)?.value ?? 1);
        const v      = this._mgr.getVehicle(vid);
        if (!v) return;
        const result = this._market.buy(cityId, goodId, qty, v);
        this._bus.publish('ui:toast', { message: result.message, type: result.ok ? 'good' : 'bad' });
        if (result.ok) {
          this._mgr._syncState();
          this._dirty = true;
        }
      });
    });

    // Sell from vehicle
    this._vehiclesTab.querySelectorAll('.btn-vsell').forEach(btn => {
      btn.addEventListener('click', () => {
        const vid    = btn.dataset.vid;
        const goodId = btn.dataset.good;
        const qty    = parseInt(document.getElementById(`sell-qty-${vid}-${goodId}`)?.value ?? 1);
        const v      = this._mgr.getVehicle(vid);
        if (!v) return;
        const result = this._market.sell(cityId, goodId, qty, v);
        this._bus.publish('ui:toast', { message: result.message, type: result.ok ? 'good' : 'bad' });
        if (result.ok) {
          this._mgr._syncState();
          this._dirty = true;
        }
      });
    });

    // Dispatch
    this._vehiclesTab.querySelectorAll('.btn-dispatch').forEach(btn => {
      btn.addEventListener('click', () => {
        const vid      = btn.dataset.vid;
        const select   = document.getElementById(`dispatch-dest-${vid}`);
        const toCityId = select?.value;
        if (!toCityId) return;
        const result = this._mgr.dispatch(vid, toCityId);
        this._bus.publish('ui:toast', { message: result.message, type: result.ok ? 'good' : 'bad' });
        this._dirty = true;
      });
    });

    // Buy vehicle from shop
    this._vehiclesTab.querySelectorAll('.btn-buy-vehicle').forEach(btn => {
      btn.addEventListener('click', () => {
        const typeId = btn.dataset.type;
        const result = this._mgr.purchase(typeId);
        this._bus.publish('ui:toast', { message: result.message, type: result.ok ? 'good' : 'bad' });
        this._dirty = true;
      });
    });
  }

  _renderVehicleShop() {
    const tier = this._state.player.tier;
    const gold = this._state.player.gold;

    const items = Object.values(VEHICLE_TYPES).map(def => {
      const locked     = tier < def.minTier;
      const affordable = gold >= def.cost;
      const btnLabel   = locked
        ? `Tier ${def.minTier} required`
        : def.cost === 0 ? 'Free' : `${def.cost}g`;

      return `<div class="shop-item ${locked ? 'shop-locked' : ''}">
        <span class="shop-icon">${def.icon}</span>
        <div class="shop-info">
          <span class="shop-name">${def.name}</span>
          <span class="shop-desc">${def.description}</span>
          <span class="shop-stats">${def.speed} km/h • ${def.capacity} wt capacity</span>
        </div>
        <button class="menu-btn btn-buy-vehicle"
          data-type="${def.id}"
          ${locked || (!affordable && def.cost > 0) ? 'disabled' : ''}>
          ${btnLabel}
        </button>
      </div>`;
    }).join('');

    return `<div class="vehicle-shop">
      <h4 class="shop-header">Vehicle Shop</h4>
      ${items}
    </div>`;
  }

  _getConnectedCities(cityId) {
    return CONNECTIONS
      .filter(c => c.from === cityId || c.to === cityId)
      .map(c => ({
        cityId:   c.from === cityId ? c.to : c.from,
        distance: c.distance,
      }));
  }
}
