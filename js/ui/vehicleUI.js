/**
 * vehicleUI.js
 * Handles all vehicle-related UI:
 *   - Fleet sidebar list (all vehicles, live status)
 *   - Vehicles tab inside city view (vehicles at this city)
 *   - Vehicle detail panel (load/unload cargo, dispatch)
 *   - Vehicle shop (buy new vehicles)
 */

import { GOODS }         from '../economy/goods.js';
import { VEHICLE_TYPES } from '../player/vehicles.js';
import { CONNECTIONS }   from '../world/worldMap.js';

export class VehicleUI {
  /**
   * @param {object}         state
   * @param {VehicleManager} vehicleMgr
   * @param {Map}            cities
   * @param {Player}         player
   * @param {EventBus}       bus
   */
  constructor(state, vehicleMgr, cities, player, bus) {
    this._state      = state;
    this._mgr        = vehicleMgr;
    this._cities     = cities;
    this._player     = player;
    this._bus        = bus;

    this._selectedVehicleId = null;
    this._currentCityId     = null;

    this._fleetListEl   = document.getElementById('fleet-list');
    this._vehiclesTab   = document.getElementById('tab-vehicles');
    this._detailPanel   = document.getElementById('vehicle-detail-panel');

    this._dirty = true;

    this._bindBusEvents();
  }

  _bindBusEvents() {
    this._bus.subscribe('vehicle:purchased',     () => { this._dirty = true; });
    this._bus.subscribe('vehicle:dispatched',    () => { this._dirty = true; });
    this._bus.subscribe('vehicle:arrived',       () => { this._dirty = true; });
    this._bus.subscribe('vehicle:cargoChanged',  () => { this._dirty = true; });
    this._bus.subscribe('player:travel',         ({ to }) => {
      this._currentCityId = to;
      this._dirty = true;
    });
  }

  markDirty() { this._dirty = true; }

  /** Called from main render loop — only repaints when dirty */
  render() {
    if (!this._dirty) return;
    this._dirty = false;
    this._renderFleetSidebar();
    if (this._vehiclesTab && !this._vehiclesTab.classList.contains('hidden')) {
      this._renderVehiclesTab(this._currentCityId);
    }
  }

  // ── Fleet Sidebar ────────────────────────────────────────────

  _renderFleetSidebar() {
    const vehicles = this._mgr.vehicles;
    if (vehicles.length === 0) {
      this._fleetListEl.innerHTML = '<li class="empty-msg">No vehicles yet.</li>';
      return;
    }

    const items = vehicles.map(v => {
      let statusText, statusClass;
      if (v.isTravelling) {
        const dest = this._cities.get(v.toCityId)?.name ?? v.toCityId;
        statusText  = `→ ${dest} (${v.getEtaString()})`;
        statusClass = 'status-travelling';
      } else if (v.hasArrived) {
        statusText  = `Arrived at ${this._cities.get(v.currentCityId)?.name ?? v.currentCityId}`;
        statusClass = 'status-arrived';
      } else {
        const city = this._cities.get(v.currentCityId)?.name ?? v.currentCityId;
        statusText  = `Idle at ${city}`;
        statusClass = 'status-idle';
      }

      const isSelected = v.id === this._selectedVehicleId;
      const cargoCount = Object.values(v.cargo).reduce((s, q) => s + q, 0);

      return `<li class="fleet-item ${isSelected ? 'fleet-item-active' : ''}" data-vid="${v.id}">
        <span class="fleet-icon">${v.icon}</span>
        <div class="fleet-info">
          <div class="fleet-name">${v.name}</div>
          <div class="fleet-status ${statusClass}">${statusText}</div>
          ${cargoCount > 0 ? `<div class="fleet-cargo">Cargo: ${cargoCount}/${v.capacity}</div>` : ''}
        </div>
      </li>`;
    }).join('');

    this._fleetListEl.innerHTML = items;

    this._fleetListEl.querySelectorAll('.fleet-item').forEach(li => {
      li.addEventListener('click', () => {
        this._selectedVehicleId = li.dataset.vid;
        this._dirty = true;
        // Navigate to vehicle's city if needed
        const v = this._mgr.vehicles.find(v => v.id === li.dataset.vid);
        if (v && !v.isTravelling) {
          this._bus.publish('ui:citySelected', { cityId: v.currentCityId });
        }
      });
    });
  }

  // ── Vehicles Tab (inside city view) ──────────────────────────

  renderVehiclesTabForCity(cityId) {
    this._currentCityId = cityId;
    this._renderVehiclesTab(cityId);
  }

  _renderVehiclesTab(cityId) {
    if (!this._vehiclesTab || !cityId) return;

    const vehiclesHere = this._mgr.getVehiclesAt(cityId);
    const transitWaiting = this._mgr.hasTransitAt(cityId);

    let html = '';

    // Transit cargo collection notice
    if (transitWaiting) {
      html += `<div class="transit-notice">
        <span>📦 Cargo waiting for collection!</span>
        <button class="menu-btn" id="btn-collect-transit">Collect All</button>
      </div>`;
    }

    // Vehicles at this city
    if (vehiclesHere.length === 0) {
      html += '<p class="empty-msg">No vehicles here right now.</p>';
    } else {
      for (const v of vehiclesHere) {
        const isSelected = v.id === this._selectedVehicleId;
        html += this._renderVehicleCard(v, cityId, isSelected);
      }
    }

    // Vehicle shop
    html += this._renderVehicleShop();

    this._vehiclesTab.innerHTML = html;

    // Collect transit button
    const collectBtn = document.getElementById('btn-collect-transit');
    if (collectBtn) {
      collectBtn.addEventListener('click', () => {
        const collected = this._mgr.collectTransit(cityId);
        if (collected.length > 0) {
          const summary = collected.map(c => `${c.qty}x ${c.goodName}`).join(', ');
          this._bus.publish('ui:toast', { message: `Collected: ${summary}`, type: 'good' });
        }
        this._dirty = true;
      });
    }

    // Vehicle card expand/collapse
    this._vehiclesTab.querySelectorAll('.vehicle-card-header').forEach(el => {
      el.addEventListener('click', () => {
        const vid = el.dataset.vid;
        this._selectedVehicleId = (this._selectedVehicleId === vid) ? null : vid;
        this._dirty = true;
      });
    });

    // Load cargo buttons
    this._vehiclesTab.querySelectorAll('.btn-load').forEach(btn => {
      btn.addEventListener('click', () => {
        const vid    = btn.dataset.vid;
        const goodId = btn.dataset.good;
        const qty    = parseInt(document.getElementById(`load-qty-${vid}-${goodId}`)?.value ?? 1);
        const result = this._mgr.loadCargo(vid, goodId, qty);
        this._bus.publish('ui:toast', { message: result.message, type: result.ok ? 'good' : 'bad' });
        this._dirty = true;
      });
    });

    // Unload cargo buttons
    this._vehiclesTab.querySelectorAll('.btn-unload').forEach(btn => {
      btn.addEventListener('click', () => {
        const vid    = btn.dataset.vid;
        const goodId = btn.dataset.good;
        const qty    = parseInt(document.getElementById(`unload-qty-${vid}-${goodId}`)?.value ?? 1);
        const result = this._mgr.unloadCargo(vid, goodId, qty);
        this._bus.publish('ui:toast', { message: result.message, type: result.ok ? 'good' : 'bad' });
        this._dirty = true;
      });
    });

    // Dispatch buttons
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

    // Buy vehicle buttons
    this._vehiclesTab.querySelectorAll('.btn-buy-vehicle').forEach(btn => {
      btn.addEventListener('click', () => {
        const typeId = btn.dataset.type;
        const result = this._mgr.purchase(typeId);
        this._bus.publish('ui:toast', { message: result.message, type: result.ok ? 'good' : 'bad' });
        this._dirty = true;
      });
    });
  }

  _renderVehicleCard(v, cityId, expanded) {
    const cargoUsed = v.cargoUsed;
    const cargoFree = v.cargoFree;

    let expandedContent = '';
    if (expanded) {
      // Load section: show player inventory items
      const playerInv = this._state.player.inventory;
      const invEntries = Object.entries(playerInv).filter(([, q]) => q > 0);

      let loadRows = invEntries.length === 0
        ? '<p class="empty-msg">Nothing in your inventory to load.</p>'
        : invEntries.map(([goodId, qty]) => {
            const good = GOODS[goodId];
            return `<div class="cargo-row">
              <span>${good?.icon ?? ''} ${good?.name ?? goodId} (${qty} avail)</span>
              <input type="number" id="load-qty-${v.id}-${goodId}" class="cargo-qty-input" value="1" min="1" max="${qty}">
              <button class="menu-btn btn-load" data-vid="${v.id}" data-good="${goodId}">Load</button>
            </div>`;
          }).join('');

      // Unload section: show vehicle cargo
      const cargoEntries = Object.entries(v.cargo).filter(([, q]) => q > 0);
      let unloadRows = cargoEntries.length === 0
        ? '<p class="empty-msg">Vehicle is empty.</p>'
        : cargoEntries.map(([goodId, qty]) => {
            const good = GOODS[goodId];
            return `<div class="cargo-row">
              <span>${good?.icon ?? ''} ${good?.name ?? goodId} (${qty} on board)</span>
              <input type="number" id="unload-qty-${v.id}-${goodId}" class="cargo-qty-input" value="${qty}" min="1" max="${qty}">
              <button class="menu-btn btn-unload" data-vid="${v.id}" data-good="${goodId}">Unload</button>
            </div>`;
          }).join('');

      // Dispatch section: connected cities
      const connectedCities = this._getConnectedCities(cityId);
      const destOptions = connectedCities.map(({ cityId: cid, distance }) => {
        const city = this._cities.get(cid);
        if (!city) return '';
        const speed   = v.speed;
        const etaHrs  = distance / speed;
        const etaStr  = etaHrs >= 1
          ? `${Math.floor(etaHrs)}h ${Math.floor((etaHrs % 1) * 60)}m`
          : `${Math.floor(etaHrs * 60)}m`;
        return `<option value="${cid}">${city.name} — ${distance}km (ETA: ${etaStr})</option>`;
      }).join('');

      const canDispatch = cargoEntries.length > 0 || true; // allow empty dispatch

      expandedContent = `
        <div class="vehicle-expanded">
          <div class="cargo-section">
            <div class="cargo-header">
              <span>Cargo: ${cargoUsed}/${v.capacity} units</span>
              <div class="cargo-bar-wrap"><div class="cargo-bar" style="width:${Math.round(cargoUsed/v.capacity*100)}%"></div></div>
            </div>

            <div class="cargo-subsection">
              <h5>Load from Inventory</h5>
              ${loadRows}
            </div>

            <div class="cargo-subsection">
              <h5>Unload to Inventory</h5>
              ${unloadRows}
            </div>
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
            <span class="vehicle-card-sub">${v.capacity} cap • ${v.speed} km/h</span>
          </div>
          <span class="vehicle-card-cargo">${cargoUsed}/${v.capacity}</span>
          <span class="vehicle-card-chevron">${expanded ? '▲' : '▼'}</span>
        </div>
        ${expandedContent}
      </div>`;
  }

  _renderVehicleShop() {
    const tier = this._state.player.tier;
    const gold = this._state.player.gold;

    const shopItems = Object.values(VEHICLE_TYPES).map(def => {
      const locked     = tier < def.minTier;
      const affordable = gold >= def.cost;
      const btnClass   = locked ? 'disabled' : (affordable ? '' : 'disabled');
      const btnTitle   = locked
        ? `Requires Tier ${def.minTier}`
        : (!affordable ? `Need ${def.cost}g` : `Buy for ${def.cost}g`);

      return `<div class="shop-item ${locked ? 'shop-locked' : ''}">
        <span class="shop-icon">${def.icon}</span>
        <div class="shop-info">
          <span class="shop-name">${def.name}</span>
          <span class="shop-desc">${def.description}</span>
          <span class="shop-stats">${def.speed} km/h • ${def.capacity} capacity</span>
        </div>
        <button class="menu-btn btn-buy-vehicle ${btnClass}"
          data-type="${def.id}"
          ${locked || !affordable ? 'disabled' : ''}>
          ${def.cost === 0 ? 'Free' : btnTitle}
        </button>
      </div>`;
    }).join('');

    return `<div class="vehicle-shop">
      <h4 class="shop-header">Vehicle Shop</h4>
      ${shopItems}
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
