/**
 * gameLoop.js
 * Fixed-timestep game loop using requestAnimationFrame.
 * Separates simulation update (fixed steps) from rendering (every frame).
 */

const TICK_MS = 200; // simulation step in real milliseconds

export class GameLoop {
  constructor() {
    this._systems   = [];       // { update(dt), render() }
    this._running   = false;
    this._rafId     = null;
    this._lastTime  = 0;
    this._accumulator = 0;
  }

  /** Register a system that has update(deltaGameMs) and/or render() methods */
  register(system) {
    this._systems.push(system);
    return this;
  }

  start() {
    if (this._running) return;
    this._running  = true;
    this._lastTime = performance.now();
    this._accumulator = 0;
    this._rafId = requestAnimationFrame(this._frame.bind(this));
  }

  stop() {
    this._running = false;
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  _frame(now) {
    if (!this._running) return;

    const realDt = Math.min(now - this._lastTime, 500); // cap at 500ms to avoid spiral
    this._lastTime = now;
    this._accumulator += realDt;

    // Fixed-step simulation updates
    while (this._accumulator >= TICK_MS) {
      this._accumulator -= TICK_MS;
      for (const sys of this._systems) {
        if (sys.update) sys.update(TICK_MS);
      }
    }

    // Render every frame
    for (const sys of this._systems) {
      if (sys.render) sys.render();
    }

    this._rafId = requestAnimationFrame(this._frame.bind(this));
  }
}
