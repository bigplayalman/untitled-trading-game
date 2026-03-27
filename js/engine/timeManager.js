/**
 * timeManager.js
 * Manages in-game time: days, months, years.
 * Speed multiplier controls how fast game time advances.
 *
 * At speed 1x: 1 game hour = 8 real seconds  => 1 game day = 192 real seconds
 * TICK_MS = 200ms real => 0.2s real per tick
 * At 1x: 0.2 real-sec * 0.125 game-hr/real-sec = 0.025 game hours per tick
 * => 960 ticks per game day at 1x
 */

export const SPEEDS = { 0: 0, 1: 1, 2: 2, 5: 5 };

const REAL_MS_PER_GAME_HOUR_AT_1X = 8000;

export class TimeManager {
  constructor(eventBus) {
    this._bus    = eventBus;
    this._speed  = 1;
    this._paused = false;

    // Game clock
    this._hour  = 6;   // start at 6am day 1
    this._day   = 1;
    this._month = 1;
    this._year  = 1;

    this._onDayCallbacks   = [];
    this._onMonthCallbacks = [];
  }

  get speed()  { return this._paused ? 0 : this._speed; }
  get paused() { return this._paused; }
  get day()    { return this._day; }
  get month()  { return this._month; }
  get year()   { return this._year; }
  get hour()   { return this._hour; }

  setSpeed(s) {
    if (s === 0) {
      this._paused = true;
    } else {
      this._paused = false;
      this._speed  = SPEEDS[s] ?? 1;
    }
    this._bus.publish('time:speedChange', { speed: this.speed });
  }

  getGameHoursElapsed(realDeltaMs) {
    if (this._paused) return 0;
    return (realDeltaMs * this._speed) / REAL_MS_PER_GAME_HOUR_AT_1X;
  }

  /** Called every simulation tick with real delta in ms */
  update(realDeltaMs) {
    const gameHoursElapsed = this.getGameHoursElapsed(realDeltaMs);
    if (gameHoursElapsed <= 0) return;
    this._hour += gameHoursElapsed;

    while (this._hour >= 24) {
      this._hour -= 24;
      this._advanceDay();
    }
  }

  _advanceDay() {
    this._day++;
    this._bus.publish('time:dayChange', this.getDate());
    for (const cb of this._onDayCallbacks) cb(this.getDate());

    if (this._day > 30) {
      this._day = 1;
      this._month++;
      this._bus.publish('time:monthChange', this.getDate());
      for (const cb of this._onMonthCallbacks) cb(this.getDate());
    }

    if (this._month > 12) {
      this._month = 1;
      this._year++;
      this._bus.publish('time:yearChange', this.getDate());
    }
  }

  onDay(cb)   { this._onDayCallbacks.push(cb); }
  onMonth(cb) { this._onMonthCallbacks.push(cb); }

  getDate() {
    return {
      day: this._day,
      month: this._month,
      year: this._year,
      hour: Math.floor(this._hour),
      totalDays: (this._year - 1) * 360 + (this._month - 1) * 30 + this._day,
    };
  }

  getDateString() {
    const monthNames = [
      'Jan','Feb','Mar','Apr','May','Jun',
      'Jul','Aug','Sep','Oct','Nov','Dec'
    ];
    return `Day ${this._day} ${monthNames[this._month - 1]}, Year ${this._year}`;
  }

  /** Serialise for save */
  save() {
    return { hour: this._hour, day: this._day, month: this._month, year: this._year, speed: this._speed, paused: this._paused };
  }

  load(data) {
    this._hour   = data.hour   ?? 6;
    this._day    = data.day    ?? 1;
    this._month  = data.month  ?? 1;
    this._year   = data.year   ?? 1;
    this._speed  = data.speed  ?? 1;
    this._paused = data.paused ?? false;
  }
}
