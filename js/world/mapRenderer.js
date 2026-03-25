/**
 * mapRenderer.js
 * Renders the world map on a canvas element.
 * Draws connections (roads/airways), cities, labels, and vehicle positions.
 */

import { CONNECTIONS } from './worldMap.js';

const CITY_RADIUS   = 12;
const CITY_SELECTED_RADIUS = 16;
const CONNECTION_COLOR = 'rgba(181,137,28,0.35)';
const CONNECTION_WIDTH = 2;
const LABEL_FONT    = '11px "Courier New", monospace';
const BG_COLOR      = '#0d1117';
const GRID_COLOR    = 'rgba(255,255,255,0.03)';

export class MapRenderer {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {Map<string, City>}  cities
   * @param {object}             state
   * @param {EventBus}           bus
   */
  constructor(canvas, cities, state, bus) {
    this._canvas      = canvas;
    this._ctx         = canvas.getContext('2d');
    this._cities      = cities;
    this._state       = state;
    this._bus         = bus;
    this._selected    = null;
    this._hovered     = null;
    this._tooltip     = document.getElementById('map-tooltip');
    this._vehicleMgr  = null; // injected after construction

    this._resizeObserver = new ResizeObserver(() => this._resize());
    this._resizeObserver.observe(canvas.parentElement);
    this._resize();

    // Mouse events
    canvas.addEventListener('mousemove', this._onMouseMove.bind(this));
    canvas.addEventListener('mouseleave', this._onMouseLeave.bind(this));
    canvas.addEventListener('click', this._onClick.bind(this));
  }

  _resize() {
    const parent = this._canvas.parentElement;
    this._canvas.width  = parent.clientWidth;
    this._canvas.height = parent.clientHeight;
  }

  render() {
    const ctx = this._ctx;
    const W   = this._canvas.width;
    const H   = this._canvas.height;
    if (W === 0 || H === 0) return;

    // Background
    ctx.fillStyle = BG_COLOR;
    ctx.fillRect(0, 0, W, H);

    // Subtle grid
    ctx.strokeStyle = GRID_COLOR;
    ctx.lineWidth = 1;
    const gridStep = 60;
    for (let x = 0; x < W; x += gridStep) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
    }
    for (let y = 0; y < H; y += gridStep) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }

    // Draw connections
    ctx.strokeStyle = CONNECTION_COLOR;
    ctx.lineWidth   = CONNECTION_WIDTH;
    ctx.setLineDash([6, 4]);
    for (const conn of CONNECTIONS) {
      const c1 = this._cities.get(conn.from);
      const c2 = this._cities.get(conn.to);
      if (!c1 || !c2) continue;
      const p1 = this._toScreen(c1.x, c1.y, W, H);
      const p2 = this._toScreen(c2.x, c2.y, W, H);
      ctx.beginPath();
      ctx.moveTo(p1.x, p1.y);
      ctx.lineTo(p2.x, p2.y);
      ctx.stroke();

      // Distance label midpoint
      const mx = (p1.x + p2.x) / 2;
      const my = (p1.y + p2.y) / 2;
      ctx.fillStyle = 'rgba(181,137,28,0.5)';
      ctx.font = '9px "Courier New"';
      ctx.textAlign = 'center';
      ctx.fillText(`${conn.distance}km`, mx, my - 4);
    }
    ctx.setLineDash([]);

    // Draw vehicles in transit
    if (this._vehicleMgr) {
      for (const vehicle of this._vehicleMgr.getTravelling()) {
        this._drawVehicle(ctx, vehicle, W, H);
      }
    }

    // Draw city nodes
    for (const [id, city] of this._cities) {
      this._drawCity(ctx, city, id, W, H);
    }
  }

  _drawCity(ctx, city, id, W, H) {
    const pos    = this._toScreen(city.x, city.y, W, H);
    const isSelected = id === this._selected;
    const isHovered  = id === this._hovered;
    const isPlayer   = id === this._state.player.currentCityId;
    const r = isSelected ? CITY_SELECTED_RADIUS : CITY_RADIUS;

    // Outer glow for selected/player
    if (isSelected || isPlayer) {
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
    ctx.fillStyle   = isHovered ? '#ffffff' : city.color;
    ctx.strokeStyle = isSelected ? '#ffffff' : 'rgba(255,255,255,0.4)';
    ctx.lineWidth   = isSelected ? 2 : 1;
    ctx.fill();
    ctx.stroke();

    // Player marker
    if (isPlayer) {
      ctx.font      = '12px serif';
      ctx.textAlign = 'center';
      ctx.fillText('⚔', pos.x, pos.y + 4);
    }

    // City name label
    ctx.fillStyle  = isSelected ? '#ffe680' : '#c8b88a';
    ctx.font       = isSelected ? `bold ${LABEL_FONT}` : LABEL_FONT;
    ctx.textAlign  = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur  = 3;
    ctx.fillText(city.name, pos.x, pos.y + r + 14);
    ctx.shadowBlur  = 0;

    // Population indicator (small dot count)
    const pop = city.population;
    const popClass = pop < 2000 ? '●' : pop < 5000 ? '●●' : '●●●';
    ctx.fillStyle  = 'rgba(200,184,138,0.5)';
    ctx.font       = '8px monospace';
    ctx.fillText(popClass, pos.x, pos.y + r + 24);
  }

  _drawVehicle(ctx, vehicle, W, H) {
    const from = this._cities.get(vehicle.fromCityId);
    const to   = this._cities.get(vehicle.toCityId);
    if (!from || !to) return;

    const p1 = this._toScreen(from.x, from.y, W, H);
    const p2 = this._toScreen(to.x,   to.y,   W, H);
    const t  = vehicle.progress ?? 0;

    const x = p1.x + (p2.x - p1.x) * t;
    const y = p1.y + (p2.y - p1.y) * t;

    // Glow behind vehicle
    ctx.beginPath();
    ctx.arc(x, y, 9, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,230,100,0.2)';
    ctx.fill();

    // Vehicle dot
    ctx.beginPath();
    ctx.arc(x, y, 5, 0, Math.PI * 2);
    ctx.fillStyle   = '#ffe680';
    ctx.strokeStyle = '#b5891c';
    ctx.lineWidth   = 1.5;
    ctx.fill();
    ctx.stroke();

    // Icon above dot
    ctx.font      = '12px serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur  = 3;
    ctx.fillText(vehicle.icon ?? '🚂', x, y - 10);
    ctx.shadowBlur  = 0;

    // Name label
    ctx.fillStyle = 'rgba(255,230,100,0.8)';
    ctx.font      = '9px "Courier New"';
    ctx.fillText(vehicle.name, x, y + 18);
  }

  setVehicleManager(mgr) {
    this._vehicleMgr = mgr;
  }

  _toScreen(nx, ny, W, H) {
    return { x: nx * W, y: ny * H };
  }

  _getCityAt(mouseX, mouseY) {
    const W = this._canvas.width;
    const H = this._canvas.height;
    for (const [id, city] of this._cities) {
      const pos = this._toScreen(city.x, city.y, W, H);
      const dx  = mouseX - pos.x;
      const dy  = mouseY - pos.y;
      if (Math.sqrt(dx * dx + dy * dy) <= CITY_SELECTED_RADIUS + 4) return id;
    }
    return null;
  }

  _onMouseMove(e) {
    const rect   = this._canvas.getBoundingClientRect();
    const mx     = e.clientX - rect.left;
    const my     = e.clientY - rect.top;
    const cityId = this._getCityAt(mx, my);

    this._hovered = cityId;
    this._canvas.style.cursor = cityId ? 'pointer' : 'default';

    if (cityId) {
      const city = this._cities.get(cityId);
      this._tooltip.classList.remove('hidden');
      this._tooltip.style.left = (mx + 14) + 'px';
      this._tooltip.style.top  = (my - 10) + 'px';
      this._tooltip.innerHTML =
        `<strong>${city.name}</strong><br>` +
        `Pop: ${city.population.toLocaleString()}<br>` +
        `Wealth: ${city.wealth.toLocaleString()}g`;
    } else {
      this._tooltip.classList.add('hidden');
    }
  }

  _onMouseLeave() {
    this._hovered = null;
    this._tooltip.classList.add('hidden');
    this._canvas.style.cursor = 'default';
  }

  _onClick(e) {
    const rect   = this._canvas.getBoundingClientRect();
    const cityId = this._getCityAt(e.clientX - rect.left, e.clientY - rect.top);
    if (cityId) {
      this._selected = cityId;
      this._bus.publish('map:cityClick', { cityId });
    }
  }

  setSelected(cityId) {
    this._selected = cityId;
  }
}
