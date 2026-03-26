/**
 * stateManager.js
 * Central event bus + game state container.
 */

import { INITIAL_STATE, TIER_NAMES } from '../data/player.js';

export class EventBus {
  constructor() {
    this._listeners = {};
  }

  subscribe(event, callback) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(callback);
    return () => {
      this._listeners[event] = this._listeners[event].filter(cb => cb !== callback);
    };
  }

  publish(event, data) {
    if (!this._listeners[event]) return;
    for (const cb of this._listeners[event]) {
      try {
        cb(data);
      } catch (error) {
        console.error(`EventBus error on ${event}:`, error);
      }
    }
  }
}

export function createInitialState() {
  return JSON.parse(JSON.stringify(INITIAL_STATE));
}

export { TIER_NAMES };
