/**
 * mapPanel.js
 * The floating vehicle control panel that appears on the map
 * when the player clicks a vehicle or a city with docked vehicles.
 *
 * From here the player can:
 *   - See vehicle transport summary
 *   - Click "Dispatch" to enter dispatch mode (connected cities highlight)
 *   - Click "Visit City" to navigate to the city view
 *   - See ETA progress for travelling vehicles
 */

import { GOODS } from '../economy/goods.js';

export class MapPanel {
  /**
   * @param {VehicleManager} vehicleMgr
   * @param {MapRenderer}    mapRenderer
   * @param {Map}            cities
   * @param {EventBus}       bus
   */
  constructor(vehicleMgr, mapRenderer, cities, bus) {
    this._mgr         = vehicleMgr;
    this._renderer    = mapRenderer;
    this._cities      = cities;
    this._bus         = bus;

    this._currentVehicleId = null;
    this._panel   = document.getElementById('map-vehicle-panel');
    this._icon    = document.getElementById('mvp-icon');
    this._name    = document.getElementById('mvp-name');
    this._status  = document.getElementById('mvp-status');
    this._transLabel = document.getElementById('mvp-transport-label');
    this._transWrap  = document.getElementById('mvp-transport-wrap');
    this._transBar   = document.getElementById('mvp-transport-bar');
    this._body    = document.getElementById('mvp-body');
    this._closeBtn = document.getElementById('mvp-close');

    this._closeBtn.addEventListener('click', () => this.hide());

    // Keyboard: Escape cancels dispatch mode / closes panel
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        if (this._renderer._dispatchMode) {
          this._renderer.exitDispatchMode();
          this._bus.publish('map:dispatchCancelled', {});
        } else {
          this.hide();
        }
      }
    });

    // Bus events
    this._bus.subscribe('map:vehicleClick', ({ vehicleId }) => {
      this.showVehicle(vehicleId);
    });

    this._bus.subscribe('map:dispatchVehicle', ({ vehicleId, toCityId }) => {
      const result = this._mgr.dispatch(vehicleId, toCityId);
      this._bus.publish('ui:toast', { message: result.message, type: result.ok ? 'good' : 'bad' });
      if (result.ok) this.hide();
    });

    this._bus.subscribe('map:dispatchCancelled', () => {
      // Re-show the panel after cancelled dispatch
      if (this._currentVehicleId) this.showVehicle(this._currentVehicleId);
    });

    this._bus.subscribe('vehicle:dispatched', ({ vehicleId }) => {
      if (vehicleId === this._currentVehicleId) this.hide();
    });

    this._bus.subscribe('vehicle:arrived', ({ vehicleId }) => {
      if (vehicleId === this._currentVehicleId) this._refresh();
    });
  }

  showVehicle(vehicleId) {
    const v = this._mgr.getVehicle(vehicleId);
    if (!v) return;
    this._currentVehicleId = vehicleId;
    this._render(v);
    this._panel.classList.remove('hidden');
  }

  hide() {
    this._panel.classList.add('hidden');
    this._currentVehicleId = null;
    this._renderer.exitDispatchMode();
  }

  _refresh() {
    if (!this._currentVehicleId) return;
    const v = this._mgr.getVehicle(this._currentVehicleId);
    if (v) this._render(v);
    else   this.hide();
  }

  _render(v) {
    const cityName = this._cities.get(v.currentCityId)?.name ?? v.currentCityId;

    // Header
    this._icon.textContent = v.icon;
    this._name.textContent = v.name;

    if (v.isTravelling) {
      const dest = this._cities.get(v.toCityId)?.name ?? v.toCityId;
      this._status.textContent = `En route to ${dest}`;
    } else {
      this._status.textContent = `Idle at ${cityName}`;
    }

    // Transport bar
    const used = v.transportUsed;
    const pct  = v.capacity > 0 ? Math.round(used / v.capacity * 100) : 0;
    this._transLabel.textContent = `${used}/${v.capacity} wt`;
    this._transBar.style.width   = pct + '%';

    // Body
    if (v.isTravelling) {
      this._renderTravelling(v);
    } else {
      this._renderIdle(v, cityName);
    }
  }

  _renderIdle(v, cityName) {
    // Transport summary
    const transportEntries = Object.entries(v.transport).filter(([, q]) => q > 0);
    let transportHtml = '';
    if (transportEntries.length === 0) {
      transportHtml = '<span style="color:var(--text-dim);font-size:11px">Empty</span>';
    } else {
      transportHtml = transportEntries.map(([goodId, qty]) => {
        const good = GOODS[goodId];
        return `<span class="mvp-good-chip">${good?.icon ?? ''} ${qty} ${good?.name ?? goodId}</span>`;
      }).join('');
    }

    this._body.innerHTML = `
      <div>
        <div class="mvp-section-label">Transport</div>
        <div class="mvp-transport-summary">${transportHtml}</div>
      </div>
      <div class="mvp-action-row">
        <button class="mvp-dispatch-btn" id="mvp-btn-dispatch">
          ▶ Dispatch Vehicle
        </button>
        <button class="mvp-visit-btn" id="mvp-btn-visit">
          Visit ${cityName}
        </button>
      </div>
    `;

    document.getElementById('mvp-btn-dispatch').addEventListener('click', () => {
      this._panel.classList.add('hidden'); // hide panel while picking target
      this._renderer.enterDispatchMode(v);
    });

    document.getElementById('mvp-btn-visit').addEventListener('click', () => {
      this.hide();
      this._bus.publish('map:cityClick', { cityId: v.currentCityId });
    });
  }

  _renderTravelling(v) {
    const dest      = this._cities.get(v.toCityId)?.name ?? v.toCityId;
    const etaStr    = v.getEtaString();
    const progress  = Math.round(v.progress * 100);

    // Transport summary
    const transportEntries = Object.entries(v.transport).filter(([, q]) => q > 0);
    let transportHtml = transportEntries.length === 0
      ? '<span style="color:var(--text-dim);font-size:11px">Empty</span>'
      : transportEntries.map(([goodId, qty]) => {
          const good = GOODS[goodId];
          return `<span class="mvp-good-chip">${good?.icon ?? ''} ${qty} ${good?.name ?? goodId}</span>`;
        }).join('');

    this._body.innerHTML = `
      <div>
        <div class="mvp-section-label">Transport</div>
        <div class="mvp-transport-summary">${transportHtml}</div>
      </div>
      <div class="mvp-travelling-info">
        Heading to <strong>${dest}</strong><br>
        ETA: <strong>${etaStr || 'Arriving...'}</strong>
        <div class="mvp-eta-bar-wrap">
          <div class="mvp-eta-bar" style="width:${progress}%"></div>
        </div>
      </div>
    `;
  }

  /** Call from render loop to keep ETA updated while travelling */
  tick() {
    if (!this._currentVehicleId || this._panel.classList.contains('hidden')) return;
    const v = this._mgr.getVehicle(this._currentVehicleId);
    if (!v) return;
    if (v.isTravelling) this._render(v); // re-render to update ETA bar
  }
}
