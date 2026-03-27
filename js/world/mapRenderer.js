/**
 * mapRenderer.js
 * Renders the world map on a canvas element.
 *
 * Interaction modes:
 *   normal      — click city to visit, click vehicle to open map panel
 *   dispatching — a vehicle is selected; connected cities glow as targets;
 *                 click a target city to dispatch the vehicle
 */

import { buildAdjacency, CONNECTIONS, shortestPath } from './worldMap.js';

const CITY_RADIUS          = 12;
const CITY_SELECTED_RADIUS = 16;
const VEHICLE_HIT_RADIUS   = 14;
const CONNECTION_COLOR     = 'rgba(181,137,28,0.35)';
const CONNECTION_WIDTH     = 2;
const LABEL_FONT           = '11px "Courier New", monospace';
const BG_COLOR             = '#0d1117';
const GRID_COLOR           = 'rgba(255,255,255,0.03)';
const NPC_VISIBILITY_RADIUS = 90;

export class MapRenderer {
  constructor(canvas, cities, state, bus) {
    this._canvas     = canvas;
    this._ctx        = canvas.getContext('2d');
    this._cities     = cities;
    this._state      = state;
    this._bus        = bus;
    this._vehicleMgr = null;
    this._npcTradeMgr = null;

    this._selected   = null;   // selected city id (normal mode)
    this._selectedVehicleId = null;
    this._hovered    = null;   // hovered city id
    this._hoveredVehicle = null; // hovered vehicle id

    // Dispatch mode state
    this._dispatchMode    = false;
    this._dispatchVehicle = null;  // Vehicle instance being dispatched
    this._dispatchTargets = new Set(); // city ids that are valid destinations

    this._tooltip = document.getElementById('map-tooltip');

    this._resizeObserver = new ResizeObserver(() => this._resize());
    this._resizeObserver.observe(canvas.parentElement);
    this._resize();

    canvas.addEventListener('mousemove', this._onMouseMove.bind(this));
    canvas.addEventListener('mouseleave', this._onMouseLeave.bind(this));
    canvas.addEventListener('click',     this._onClick.bind(this));
    canvas.addEventListener('contextmenu', this._onContextMenu.bind(this));
  }

  _resize() {
    const parent = this._canvas.parentElement;
    this._canvas.width  = parent.clientWidth;
    this._canvas.height = parent.clientHeight;
  }

  setVehicleManager(mgr) { this._vehicleMgr = mgr; }
  setNpcTradeManager(mgr) { this._npcTradeMgr = mgr; }
  setSelected(cityId)    { this._selected = cityId; }
  setSelectedVehicle(vehicleId) { this._selectedVehicleId = vehicleId; }

  // ── Dispatch mode ─────────────────────────────────────────────

  /**
   * Enter dispatch mode for a vehicle.
   * Connected cities will be highlighted as dispatch targets.
   */
  enterDispatchMode(vehicle) {
    this._dispatchMode    = true;
    this._dispatchVehicle = vehicle;
    this._dispatchTargets = new Set(
      CONNECTIONS
        .filter(c => c.from === vehicle.currentCityId || c.to === vehicle.currentCityId)
        .map(c => c.from === vehicle.currentCityId ? c.to : c.from)
        .filter(id => id !== vehicle.currentCityId) // exclude self
    );
    this._canvas.style.cursor = 'crosshair';
  }

  exitDispatchMode() {
    this._dispatchMode    = false;
    this._dispatchVehicle = null;
    this._dispatchTargets = new Set();
    this._canvas.style.cursor = 'default';
  }

  // ── Render ────────────────────────────────────────────────────

  render() {
    const ctx = this._ctx;
    const W   = this._canvas.width;
    const H   = this._canvas.height;
    if (W === 0 || H === 0) return;

    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 60) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
    for (let y = 0; y < H; y += 60) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

    // Connections
    ctx.setLineDash([6, 4]);
    for (const conn of CONNECTIONS) {
      const c1 = this._cities.get(conn.from);
      const c2 = this._cities.get(conn.to);
      if (!c1 || !c2) continue;
      const p1 = this._toScreen(c1.x, c1.y, W, H);
      const p2 = this._toScreen(c2.x, c2.y, W, H);

      // In dispatch mode, highlight valid route connections
      const isTarget = this._dispatchMode &&
        ((conn.from === this._dispatchVehicle?.currentCityId && this._dispatchTargets.has(conn.to)) ||
         (conn.to   === this._dispatchVehicle?.currentCityId && this._dispatchTargets.has(conn.from)));

      ctx.strokeStyle = isTarget ? 'rgba(95,202,95,0.7)' : CONNECTION_COLOR;
      ctx.lineWidth   = isTarget ? 2.5 : CONNECTION_WIDTH;
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();

      // Distance label
      const mx = (p1.x + p2.x) / 2;
      const my = (p1.y + p2.y) / 2;
      ctx.fillStyle = isTarget ? 'rgba(95,202,95,0.8)' : 'rgba(181,137,28,0.5)';
      ctx.font = '9px "Courier New"';
      ctx.textAlign = 'center';
      ctx.fillText(`${conn.distance}km`, mx, my - 4);
    }
    ctx.setLineDash([]);

    // Idle vehicles (drawn before cities so cities appear on top)
    if (this._vehicleMgr) {
      for (const vehicle of this._vehicleMgr.vehicles) {
        if (!vehicle.isTravelling) {
          this._drawIdleVehicleDot(ctx, vehicle, W, H);
        }
      }
    }

    // Travelling vehicles
    if (this._vehicleMgr) {
      for (const vehicle of this._vehicleMgr.getTravelling()) {
        this._drawVehicle(ctx, vehicle, W, H);
      }
    }

    if (this._npcTradeMgr) {
      for (const vehicle of this._npcTradeMgr.vehicles) {
        if (!vehicle.isTravelling && this._canSeeNpcVehicle(vehicle, W, H)) {
          this._drawNpcIdleVehicleDot(ctx, vehicle, W, H);
        }
      }
      for (const vehicle of this._npcTradeMgr.getTravelling()) {
        if (this._canSeeNpcVehicle(vehicle, W, H)) {
          this._drawNpcVehicle(ctx, vehicle, W, H);
        }
      }
    }

    // Cities (drawn on top of vehicle dots)
    for (const [id, city] of this._cities) {
      this._drawCity(ctx, city, id, W, H);
    }

    // Dispatch mode instruction overlay
    if (this._dispatchMode && this._dispatchVehicle) {
      ctx.fillStyle = 'rgba(95,202,95,0.85)';
      ctx.font = 'bold 12px "Courier New"';
      ctx.textAlign = 'center';
      ctx.shadowColor = 'rgba(0,0,0,0.9)';
      ctx.shadowBlur  = 4;
      ctx.fillText(
        `Dispatching ${this._dispatchVehicle.name} — click a destination`,
        W / 2, 22
      );
      ctx.shadowBlur = 0;

      // ESC hint
      ctx.fillStyle = 'rgba(200,184,138,0.5)';
      ctx.font = '10px "Courier New"';
      ctx.fillText('(press Escape or click elsewhere to cancel)', W / 2, 38);
    }
  }

  _drawCity(ctx, city, id, W, H) {
    const pos        = this._toScreen(city.x, city.y, W, H);
    const isSelected = id === this._selected;
    const isHovered  = id === this._hovered;
    const isPlayer   = id === this._state.player.currentCityId;
    const isTarget   = this._dispatchMode && this._dispatchTargets.has(id);
    const isOrigin   = this._dispatchMode && id === this._dispatchVehicle?.currentCityId;
    const r = isSelected ? CITY_SELECTED_RADIUS : CITY_RADIUS;

    // Target city pulse ring in dispatch mode
    if (isTarget) {
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r + 8, 0, Math.PI * 2);
      const grd = ctx.createRadialGradient(pos.x, pos.y, r, pos.x, pos.y, r + 8);
      grd.addColorStop(0, 'rgba(95,202,95,0.5)');
      grd.addColorStop(1, 'transparent');
      ctx.fillStyle = grd;
      ctx.fill();
    }

    // Origin city pulse in dispatch mode
    if (isOrigin) {
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r + 8, 0, Math.PI * 2);
      const grd = ctx.createRadialGradient(pos.x, pos.y, r, pos.x, pos.y, r + 8);
      grd.addColorStop(0, 'rgba(255,230,100,0.5)');
      grd.addColorStop(1, 'transparent');
      ctx.fillStyle = grd;
      ctx.fill();
    }

    // Normal selected/player glow
    if (!isTarget && !isOrigin && (isSelected || isPlayer)) {
      ctx.beginPath();
      ctx.arc(pos.x, pos.y, r + 6, 0, Math.PI * 2);
      const grd = ctx.createRadialGradient(pos.x, pos.y, r, pos.x, pos.y, r + 6);
      grd.addColorStop(0, isPlayer ? 'rgba(255,230,100,0.4)' : 'rgba(181,137,28,0.3)');
      grd.addColorStop(1, 'transparent');
      ctx.fillStyle = grd;
      ctx.fill();
    }

    // City circle
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
    if (isTarget) {
      ctx.fillStyle   = '#2a5a2a';
      ctx.strokeStyle = '#5fca5f';
      ctx.lineWidth   = 2;
    } else if (isHovered) {
      ctx.fillStyle   = '#ffffff';
      ctx.strokeStyle = 'rgba(255,255,255,0.8)';
      ctx.lineWidth   = 1;
    } else {
      ctx.fillStyle   = city.color;
      ctx.strokeStyle = isSelected ? '#ffffff' : 'rgba(255,255,255,0.4)';
      ctx.lineWidth   = isSelected ? 2 : 1;
    }
    ctx.fill();
    ctx.stroke();

    // Player marker
    if (isPlayer) {
      ctx.font = '12px serif'; ctx.textAlign = 'center';
      ctx.fillText('⚔', pos.x, pos.y + 4);
    }

    // City name
    ctx.fillStyle   = isTarget ? '#5fca5f' : (isSelected ? '#ffe680' : '#c8b88a');
    ctx.font        = (isSelected || isTarget) ? `bold ${LABEL_FONT}` : LABEL_FONT;
    ctx.textAlign   = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur  = 3;
    ctx.fillText(city.name, pos.x, pos.y + r + 14);
    ctx.shadowBlur  = 0;

    // Population dots
    const pop      = city.population;
    const popDots  = pop < 2000 ? '●' : pop < 5000 ? '●●' : '●●●';
    ctx.fillStyle  = 'rgba(200,184,138,0.5)';
    ctx.font       = '8px monospace';
    ctx.fillText(popDots, pos.x, pos.y + r + 24);
  }

  /** Draw a small marker for idle vehicles docked at a city */
  _drawIdleVehicleDot(ctx, vehicle, W, H) {
    const city = this._cities.get(vehicle.currentCityId);
    if (!city) return;

    const pos     = this._toScreen(city.x, city.y, W, H);
    const isSelected = vehicle.id === this._dispatchVehicle?.id || vehicle.id === this._selectedVehicleId;
    const isHovered  = vehicle.id === this._hoveredVehicle;

    // Small offset so multiple vehicles at the same city don't all stack
    const vehicles = this._vehicleMgr.getVehiclesAt(vehicle.currentCityId);
    const idx      = vehicles.indexOf(vehicle);
    const offsetX  = (idx - (vehicles.length - 1) / 2) * 16;
    const vx       = pos.x + offsetX;
    const vy       = pos.y - CITY_RADIUS - 16;

    // Glow if selected or hovered
    if (isSelected || isHovered) {
      ctx.beginPath();
      ctx.arc(vx, vy, 10, 0, Math.PI * 2);
      ctx.fillStyle = isSelected ? 'rgba(255,230,100,0.4)' : 'rgba(255,255,255,0.2)';
      ctx.fill();
    }

    // Icon
    ctx.font      = '14px serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.9)';
    ctx.shadowBlur  = 3;
    ctx.fillText(vehicle.icon, vx, vy + 5);
    ctx.shadowBlur  = 0;
  }

  _drawVehicle(ctx, vehicle, W, H) {
    const from = this._cities.get(vehicle.fromCityId);
    const to   = this._cities.get(vehicle.toCityId);
    if (!from || !to) return;

    const p1 = this._toScreen(from.x, from.y, W, H);
    const p2 = this._toScreen(to.x,   to.y,   W, H);
    const t  = vehicle.progress ?? 0;
    const x  = p1.x + (p2.x - p1.x) * t;
    const y  = p1.y + (p2.y - p1.y) * t;

    const isHovered = vehicle.id === this._hoveredVehicle;
    const isSelected = vehicle.id === this._selectedVehicleId;

    // Glow
    ctx.beginPath();
    ctx.arc(x, y, (isHovered || isSelected) ? 12 : 9, 0, Math.PI * 2);
    ctx.fillStyle = isSelected
      ? 'rgba(95,202,95,0.35)'
      : isHovered ? 'rgba(255,230,100,0.35)' : 'rgba(255,230,100,0.2)';
    ctx.fill();

    // Dot
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle   = '#ffe680';
    ctx.strokeStyle = '#b5891c';
    ctx.lineWidth   = 1.5;
    ctx.fill();
    ctx.stroke();

    // Icon
    ctx.font = '12px serif'; ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 3;
    ctx.fillText(vehicle.icon ?? '🚂', x, y - 10);
    ctx.shadowBlur = 0;

    // Name
    ctx.fillStyle = 'rgba(255,230,100,0.8)';
    ctx.font = '9px "Courier New"';
    ctx.fillText(vehicle.name, x, y + 18);
  }

  _drawNpcIdleVehicleDot(ctx, vehicle, W, H) {
    const city = this._cities.get(vehicle.currentCityId);
    if (!city) return;

    const pos = this._toScreen(city.x, city.y, W, H);
    const vehicles = this._npcTradeMgr?.getVehiclesAt(city.id) ?? [];
    const idx = vehicles.indexOf(vehicle);
    const offsetX = (idx - (vehicles.length - 1) / 2) * 8;
    const vx = pos.x + offsetX;
    const vy = pos.y + CITY_RADIUS + 10;

    ctx.beginPath();
    ctx.arc(vx, vy, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(120,190,255,0.78)';
    ctx.fill();
  }

  _drawNpcVehicle(ctx, vehicle, W, H) {
    const from = this._cities.get(vehicle.fromCityId);
    const to = this._cities.get(vehicle.toCityId);
    if (!from || !to) return;

    const p1 = this._toScreen(from.x, from.y, W, H);
    const p2 = this._toScreen(to.x, to.y, W, H);
    const t = vehicle.progress ?? 0;
    const x = p1.x + (p2.x - p1.x) * t;
    const y = p1.y + (p2.y - p1.y) * t;

    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(120,190,255,0.92)';
    ctx.fill();
  }

  _canSeeNpcVehicle(vehicle, W, H) {
    const npcPos = this._getVehicleScreenPosition(vehicle, W, H, this._npcTradeMgr);
    if (!npcPos) return false;

    const presenceCityIds = this._getPlayerPresenceCityIds();
    if (!vehicle.isTravelling && presenceCityIds.has(vehicle.currentCityId)) {
      return true;
    }

    for (const cityId of presenceCityIds) {
      const city = this._cities.get(cityId);
      if (!city) continue;
      const pos = this._toScreen(city.x, city.y, W, H);
      if (this._distance(npcPos, pos) <= NPC_VISIBILITY_RADIUS) return true;
    }

    if (!this._vehicleMgr) return false;
    for (const playerVehicle of this._vehicleMgr.vehicles) {
      const playerPos = this._getVehicleScreenPosition(playerVehicle, W, H, this._vehicleMgr);
      if (playerPos && this._distance(npcPos, playerPos) <= NPC_VISIBILITY_RADIUS) {
        return true;
      }
    }

    return false;
  }

  _getPlayerPresenceCityIds() {
    const presence = new Set([this._state.player.currentCityId]);

    if (this._vehicleMgr) {
      for (const vehicle of this._vehicleMgr.vehicles) {
        if (vehicle.currentCityId) presence.add(vehicle.currentCityId);
      }
    }

    for (const [cityId, city] of this._cities) {
      if ((city.playerBuildings?.length ?? 0) > 0) presence.add(cityId);
    }

    return presence;
  }

  _getVehicleScreenPosition(vehicle, W, H, manager) {
    if (!vehicle) return null;

    if (vehicle.isTravelling) {
      const from = this._cities.get(vehicle.fromCityId);
      const to = this._cities.get(vehicle.toCityId);
      if (!from || !to) return null;
      const p1 = this._toScreen(from.x, from.y, W, H);
      const p2 = this._toScreen(to.x, to.y, W, H);
      const t = vehicle.progress ?? 0;
      return {
        x: p1.x + (p2.x - p1.x) * t,
        y: p1.y + (p2.y - p1.y) * t,
      };
    }

    const city = this._cities.get(vehicle.currentCityId);
    if (!city) return null;
    const pos = this._toScreen(city.x, city.y, W, H);
    const vehicles = manager?.getVehiclesAt(vehicle.currentCityId) ?? [];
    const idx = vehicles.indexOf(vehicle);
    const spacing = manager === this._npcTradeMgr ? 8 : 16;
    const yOffset = manager === this._npcTradeMgr ? CITY_RADIUS + 10 : -CITY_RADIUS - 16;
    return {
      x: pos.x + (idx - (vehicles.length - 1) / 2) * spacing,
      y: pos.y + yOffset,
    };
  }

  _distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  // ── Hit testing ───────────────────────────────────────────────

  _getCityAt(mx, my) {
    const W = this._canvas.width, H = this._canvas.height;
    for (const [id, city] of this._cities) {
      const pos = this._toScreen(city.x, city.y, W, H);
      const dx = mx - pos.x, dy = my - pos.y;
      if (Math.sqrt(dx*dx + dy*dy) <= CITY_SELECTED_RADIUS + 4) return id;
    }
    return null;
  }

  /** Returns the vehicle (idle or travelling) nearest to the click, within hit radius */
  _getVehicleAt(mx, my) {
    if (!this._vehicleMgr) return null;
    const W = this._canvas.width, H = this._canvas.height;

    // Check travelling vehicles first
    for (const v of this._vehicleMgr.getTravelling()) {
      const from = this._cities.get(v.fromCityId);
      const to   = this._cities.get(v.toCityId);
      if (!from || !to) continue;
      const p1 = this._toScreen(from.x, from.y, W, H);
      const p2 = this._toScreen(to.x,   to.y,   W, H);
      const x  = p1.x + (p2.x - p1.x) * (v.progress ?? 0);
      const y  = p1.y + (p2.y - p1.y) * (v.progress ?? 0);
      const dx = mx - x, dy = my - y;
      if (Math.sqrt(dx*dx + dy*dy) <= VEHICLE_HIT_RADIUS) return v;
    }

    // Check idle vehicles
    for (const v of this._vehicleMgr.vehicles) {
      if (v.isTravelling) continue;
      const city = this._cities.get(v.currentCityId);
      if (!city) continue;
      const pos = this._toScreen(city.x, city.y, W, H);
      const vehicles = this._vehicleMgr.getVehiclesAt(v.currentCityId);
      const idx = vehicles.indexOf(v);
      const offsetX = (idx - (vehicles.length - 1) / 2) * 16;
      const vx = pos.x + offsetX;
      const vy = pos.y - CITY_RADIUS - 16;
      const dx = mx - vx, dy = my - vy;
      if (Math.sqrt(dx*dx + dy*dy) <= VEHICLE_HIT_RADIUS) return v;
    }

    return null;
  }

  // ── Mouse events ──────────────────────────────────────────────

  _onMouseMove(e) {
    const rect = this._canvas.getBoundingClientRect();
    const mx   = e.clientX - rect.left;
    const my   = e.clientY - rect.top;

    const cityId  = this._getCityAt(mx, my);
    const vehicle = cityId ? null : this._getVehicleAt(mx, my);

    this._hovered        = cityId;
    this._hoveredVehicle = vehicle?.id ?? null;

    // Cursor
    if (this._dispatchMode) {
      this._canvas.style.cursor = (cityId && this._dispatchTargets.has(cityId)) ? 'pointer' : 'crosshair';
    } else {
      this._canvas.style.cursor = (cityId || vehicle) ? 'pointer' : 'default';
    }

    // Tooltip
    if (cityId) {
      const city   = this._cities.get(cityId);
      const docked = this._vehicleMgr?.getVehiclesAt(cityId) ?? [];
      const npcPresence = this._npcTradeMgr?.getCityPresence(cityId) ?? null;
      let tip = `<strong>${city.name}</strong><br>Pop: ${city.population.toLocaleString()}<br>Wealth: ${city.wealth.toLocaleString()}g`;
      if (docked.length > 0) {
        tip += `<br><span style="color:#ffe680">🚂 ${docked.map(v => v.name).join(', ')}</span>`;
      }
      const canSeeCityNpcTrade = npcPresence && this._getPlayerPresenceCityIds().has(cityId);
      if (canSeeCityNpcTrade && npcPresence.merchants > 0) {
        tip += `<br><span style="color:#78beff">NPC trade: ${npcPresence.merchants} firms • ${npcPresence.dockedVehicles} docked • ${npcPresence.movingVehicles} moving</span>`;
      }
      if (!this._dispatchMode && this._selectedVehicleId) {
        const selectedVehicle = this._vehicleMgr?.getVehicle(this._selectedVehicleId);
        if (selectedVehicle?.isIdle && selectedVehicle.currentCityId !== cityId) {
          const route = shortestPath(buildAdjacency(), selectedVehicle.currentCityId, cityId);
          if (route) {
            tip += `<br><span style="color:#5fca5f">Right-click to send ${selectedVehicle.name} here (${route.totalDistance}km)</span>`;
          }
        }
      }
      if (this._dispatchMode && this._dispatchTargets.has(cityId)) {
        const dist = CONNECTIONS.find(
          c => (c.from === this._dispatchVehicle.currentCityId && c.to === cityId) ||
               (c.to   === this._dispatchVehicle.currentCityId && c.from === cityId)
        )?.distance ?? 0;
        const eta  = dist / this._dispatchVehicle.speed;
        const etaStr = eta >= 1 ? `${Math.floor(eta)}h ${Math.floor((eta%1)*60)}m` : `${Math.floor(eta*60)}m`;
        tip += `<br><span style="color:#5fca5f">▶ Dispatch here — ${dist}km (${etaStr})</span>`;
      }
      this._tooltip.innerHTML = tip;
      this._tooltip.classList.remove('hidden');
      this._tooltip.style.left = (mx + 14) + 'px';
      this._tooltip.style.top  = (my - 10) + 'px';
    } else if (vehicle) {
      let tip = `<strong>${vehicle.icon} ${vehicle.name}</strong><br>`;
      if (vehicle.isTravelling) {
        const dest = this._cities.get(vehicle.toCityId)?.name ?? vehicle.toCityId;
        tip += `En route to ${dest}<br>ETA: ${vehicle.getEtaString()}`;
      } else {
        const loc = this._cities.get(vehicle.currentCityId)?.name ?? vehicle.currentCityId;
        tip += `Idle at ${loc}<br>${vehicle.transportUsed}/${vehicle.capacity} wt loaded`;
        tip += `<br><span style="color:#ffe680">Click to select/manage • Right-click city to move</span>`;
      }
      this._tooltip.innerHTML = tip;
      this._tooltip.classList.remove('hidden');
      this._tooltip.style.left = (mx + 14) + 'px';
      this._tooltip.style.top  = (my - 10) + 'px';
    } else {
      this._tooltip.classList.add('hidden');
    }
  }

  _onMouseLeave() {
    this._hovered        = null;
    this._hoveredVehicle = null;
    this._tooltip.classList.add('hidden');
    this._canvas.style.cursor = 'default';
  }

  _onClick(e) {
    const rect    = this._canvas.getBoundingClientRect();
    const mx      = e.clientX - rect.left;
    const my      = e.clientY - rect.top;
    const cityId  = this._getCityAt(mx, my);
    const vehicle = cityId ? null : this._getVehicleAt(mx, my);

    if (this._dispatchMode) {
      if (cityId && this._dispatchTargets.has(cityId)) {
        // Dispatch to this city
        this._bus.publish('map:dispatchVehicle', {
          vehicleId: this._dispatchVehicle.id,
          toCityId:  cityId,
        });
        this.exitDispatchMode();
      } else {
        // Clicked elsewhere — cancel
        this.exitDispatchMode();
        this._bus.publish('map:dispatchCancelled', {});
      }
      return;
    }

    if (vehicle) {
      // Vehicle clicked — open map panel
      this._selectedVehicleId = vehicle.id;
      this._bus.publish('map:vehicleClick', { vehicleId: vehicle.id });
      return;
    }

    if (cityId) {
      this._selected = cityId;
      this._bus.publish('map:cityClick', { cityId });
    }
  }

  _onContextMenu(e) {
    e.preventDefault();

    if (this._dispatchMode) return;

    const selectedVehicle = this._vehicleMgr?.getVehicle(this._selectedVehicleId);
    if (!selectedVehicle || !selectedVehicle.isIdle) return;

    const rect   = this._canvas.getBoundingClientRect();
    const mx     = e.clientX - rect.left;
    const my     = e.clientY - rect.top;
    const cityId = this._getCityAt(mx, my);
    if (!cityId || cityId === selectedVehicle.currentCityId) return;

    this._bus.publish('map:dispatchVehicle', {
      vehicleId: selectedVehicle.id,
      toCityId: cityId,
    });
  }

  _toScreen(nx, ny, W, H) {
    return { x: nx * W, y: ny * H };
  }
}
