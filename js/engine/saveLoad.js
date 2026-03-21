/**
 * saveLoad.js
 * Serialise / deserialise game state to localStorage.
 * Auto-saves every 5 game days.
 */

const SAVE_KEY = 'ironveil_save_v1';

export class SaveLoad {
  constructor(state, timeManager, cities, eventBus) {
    this._state   = state;
    this._time    = timeManager;
    this._cities  = cities;   // Map<id, City>
    this._bus     = eventBus;
    this._lastSaveDay = 1;
  }

  /** Auto-save check - call on each day change */
  checkAutoSave(dateObj) {
    if (dateObj.totalDays - this._lastSaveDay >= 5) {
      this.save();
      this._lastSaveDay = dateObj.totalDays;
    }
  }

  save() {
    try {
      const payload = {
        version: 1,
        time: this._time.save(),
        state: this._serializeState(),
        cities: this._serializeCities(),
        savedAt: Date.now(),
      };
      localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
      this._bus.publish('save:success', {});
      return true;
    } catch (e) {
      console.error('Save failed:', e);
      this._bus.publish('save:failed', { error: e.message });
      return false;
    }
  }

  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const payload = JSON.parse(raw);
      if (payload.version !== 1) return null;
      return payload;
    } catch (e) {
      console.error('Load failed:', e);
      return null;
    }
  }

  hasSave() {
    return !!localStorage.getItem(SAVE_KEY);
  }

  _serializeState() {
    // Deep clone the plain state object
    return JSON.parse(JSON.stringify(this._state));
  }

  _serializeCities() {
    const out = {};
    for (const [id, city] of this._cities) {
      out[id] = city.serialize();
    }
    return out;
  }
}
