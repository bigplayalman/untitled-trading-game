# Oumzy — Agent Reference

Steampunk isekai browser trading simulation. Vanilla HTML/CSS/JS (ES modules), no build step.
Open `index.html` directly in a browser to run. Deployed via Docker + nginx on Coolify.

---

## Project Structure

```
gaming/
├── index.html              Entry point, full game layout
├── css/
│   ├── main.css            Grid layout, all component styles, CSS variables
│   └── steampunk.css       Theme styles (buttons, speed controls, badges)
├── js/
│   ├── main.js             Entry point — instantiates all systems, wires events, starts loop
│   ├── engine/
│   │   ├── gameLoop.js     Fixed-timestep rAF loop (200ms ticks). register(system) API
│   │   ├── timeManager.js  In-game calendar (day/month/year), speed 0/1/2/5x, onDay/onMonth hooks
│   │   ├── stateManager.js EventBus (subscribe/publish) + createInitialState()
│   │   └── saveLoad.js     localStorage save/load, auto-save every 5 days
│   ├── economy/
│   │   ├── goods.js        16 goods (6 raw/6 processed/4 finished), 10 recipes, minReputation/minRepSell
│   │   ├── priceEngine.js  Supply/demand pricing, EMA smoothing, price history, trend detection
│   │   ├── city.js         City class: tick(), naturalProduction, dailyConsumption, priceEngine
│   │   └── market.js       buy(cityId, goodId, qty, vehicle) / sell(...) — reputation-gated
│   ├── world/
│   │   ├── cities.js       7 city definitions (id, name, x/y, production, consumption, startInventory)
│   │   ├── worldMap.js     CONNECTIONS array, buildAdjacency(), Dijkstra, getDirectDistance()
│   │   └── mapRenderer.js  Canvas map: cities, vehicles, dispatch mode, hit-testing, tooltips
│   ├── player/
│   │   ├── player.js       Player state helpers, travelTo(), checkTierUp()
│   │   ├── vehicles.js     Vehicle class + VEHICLE_TYPES. Transport is weight-based
│   │   ├── vehicleManager.js Fleet: purchase(), dispatch(), load(), unload(), tick()
│   │   └── reputation.js   REP_TIERS, canBuy/canSell, gainFromTrade, addRep, getSellBonus
│   ├── story/
│   │   ├── milestones.js   Intro dialogue chain + tier-up dialogue text
│   │   └── cityQuests.js   Quest definitions per city (stub — not yet wired)
│   └── ui/
│       ├── uiManager.js    Top bar, city view, market table, docked vehicles footer, dialogues
│       ├── vehicleUI.js    Vehicles tab: buy/sell from vehicle, transport display, shop
│       └── mapPanel.js     Floating map panel for vehicle control + dispatch UI
├── Dockerfile              nginx:1.27-alpine serving static files on port 80
├── nginx.conf              SPA config, gzip, /healthz endpoint, security headers
└── docker-compose.yml      Local dev: port 8080
```

---

## Core Concepts

### No Player Inventory
The player has **no personal carrying capacity**. All goods must be bought into a vehicle's transport
bay and sold from it. `state.player` has: `gold`, `reputation`, `currentCityId`, `tier`.

### Transport is Weight-Based
Vehicle capacity is in **weight units (wt)**. Each good has a `weight` field:
- Raw goods: 2–4 wt (heavy — iron ore=4, timber=4, coal=3, wheat/cotton=2)
- Processed: 1–2 wt (steel/lumber/steam_cores=2, rest=1)
- Finished: 1 wt (all finished goods are compact)

Vehicle capacities: Hand Cart=30wt, Horse Wagon=80wt, Steam Wagon=150wt, Airship=300wt.

### Reputation System (per city)
`state.player.reputation = { cityId: 0-100 }`. Cogsworth starts at 10, others at 0.

Tiers: Stranger(0) → Acquaintance(20) → Known Trader(40) → Trusted Merchant(60) → City Partner(80)

- **Buy gate**: `good.minReputation` — processed needs 20, finished needs 40/60/80
- **Sell gate**: `good.minRepSell` — half of buy threshold
- **Rep gain on buy**: base gain by category (raw=0.3, processed=0.5, finished=0.8)
- **Rep gain on sell**: base × demand multiplier (priceRatio>2 → 2×, >1.3 → 1.5×, neutral → 1×, surplus → 0.5×)
- **Sell price bonus**: rep≥80→+10%, ≥60→+6%, ≥40→+3%

### Economy Simulation
Cities run independently every game tick. Each day:
1. Natural production adds goods to city inventory
2. Daily consumption removes goods
3. `priceEngine.recalculate()` updates prices based on stock/demand ratio

Prices use EMA smoothing (alpha=0.08). Floor=20% of base, ceiling=500%.

### Game Loop
`GameLoop.register(system)` — system must have `update(realDeltaMs)` and/or `render()`.
Economy runs at fixed 200ms ticks. Render runs every rAF frame.
Time advances: 1 real second = 1 game hour at 1× speed.

### Event Bus
All cross-system communication via `EventBus`. Key events:

| Event | Payload | Published by |
|-------|---------|-------------|
| `map:cityClick` | `{ cityId }` | mapRenderer |
| `map:vehicleClick` | `{ vehicleId }` | mapRenderer |
| `map:dispatchVehicle` | `{ vehicleId, toCityId }` | mapRenderer |
| `market:buy` | `{ cityId, goodId, qty, cost, vehicleId, repGain }` | market |
| `market:sell` | `{ cityId, goodId, qty, earned, bonusEarned, repGain, priceRatio }` | market |
| `vehicle:purchased` | `{ vehicleId, typeId, cityId, starter? }` | vehicleManager |
| `vehicle:dispatched` | `{ vehicleId, vehicleName, from, to, eta }` | vehicleManager |
| `vehicle:arrived` | `{ vehicleId, vehicleName, cityId, cityName, hasGoods }` | vehicleManager |
| `vehicle:transportChanged` | `{ vehicleId }` | vehicleManager |
| `reputation:gained` | `{ cityId, amount, newRep, tierName }` | reputation.js |
| `reputation:tierUp` | `{ cityId, tier, tierName, color }` | reputation.js |
| `player:tierUp` | `{ tier, tierName }` | player |
| `player:travel` | `{ from, to }` | player |
| `time:dayChange` | `{ day, month, year, totalDays }` | timeManager |
| `ui:toast` | `{ message, type }` | any UI module |
| `ui:save` / `ui:load` | `{}` | uiManager buttons |
| `save:success` / `save:failed` | `{}` | saveLoad |
| `dialogue:choice` | `{ next }` | uiManager |
| `dialogue:closed` | `{ milestoneId }` | uiManager |

### Map Dispatch Mode
`mapRenderer.enterDispatchMode(vehicle)` — highlights connected cities green.
Clicking a green city fires `map:dispatchVehicle`. Escape cancels and fires `map:dispatchCancelled`.
`mapPanel.js` orchestrates the full flow including panel show/hide.

---

## State Shape

```js
state = {
  player: {
    gold: 50,
    reputation: { cogsworth: 10, ironhaven: 0, verdania: 0, steamport: 0,
                  crystaldeep: 0, millhurst: 0, windhollow: 0 },
    currentCityId: 'cogsworth',
    tier: 0,  // 0=Peddler → 5=King
  },
  vehicles: [],     // serialised Vehicle objects (live instances in vehicleManager)
  routes:   [],     // reserved for future automated routes
  cities:   {},     // reserved (cities are live City instances, not stored here)
  milestones: { completed: [], active: 'intro_01' },
  flags: {},        // story/event flags
  stats: { totalGoldEarned: 0, totalTrades: 0, daysSurvived: 0 },
}
```

---

## Cities

| ID | Name | Economic Personality |
|----|------|---------------------|
| `cogsworth` | Cogsworth Landing | Balanced, home base, produces wheat/timber/cotton |
| `ironhaven` | Ironhaven | Mining — iron ore + coal; needs food/tools |
| `verdania` | Verdania | Agriculture — wheat/cotton/timber; needs tools/cloth |
| `steamport` | Steamport Royal | Capital — consumes everything, produces little |
| `crystaldeep` | Crystaldeep | Mana crystals + iron; remote, needs bread/tools |
| `millhurst` | Millhurst | Industrial — converts raw→processed; needs raw materials |
| `windhollow` | Windhollow | Airship hub — transit point, produces flour/lumber/coal |

Connections (undirected, km):
cogsworth↔ironhaven(120), cogsworth↔steamport(180), cogsworth↔verdania(150),
cogsworth↔millhurst(200), ironhaven↔steamport(160), steamport↔windhollow(140),
steamport↔millhurst(220), verdania↔windhollow(130), windhollow↔crystaldeep(110),
millhurst↔crystaldeep(250)

---

## Goods Quick Reference

| ID | Name | Cat | Base Price | Weight | minRep | minRepSell |
|----|------|-----|-----------|--------|--------|-----------|
| iron_ore | Iron Ore | raw | 8g | 4wt | 0 | 0 |
| coal | Coal | raw | 6g | 3wt | 0 | 0 |
| timber | Timber | raw | 7g | 4wt | 0 | 0 |
| wheat | Wheat | raw | 4g | 2wt | 0 | 0 |
| cotton | Cotton | raw | 5g | 2wt | 0 | 0 |
| mana_crystals | Mana Crystals | raw | 30g | 1wt | 0 | 0 |
| steel | Steel | processed | 22g | 2wt | 20 | 10 |
| lumber | Lumber | processed | 14g | 2wt | 20 | 10 |
| flour | Flour | processed | 9g | 1wt | 20 | 10 |
| cloth | Cloth | processed | 12g | 1wt | 20 | 10 |
| steam_cores | Steam Cores | processed | 35g | 2wt | 20 | 10 |
| alchemical_compounds | Alchemical Compounds | processed | 40g | 1wt | 20 | 10 |
| tools | Tools | finished | 28g | 1wt | 40 | 20 |
| bread | Bread | finished | 12g | 1wt | 40 | 20 |
| fine_garments | Fine Garments | finished | 45g | 1wt | 60 | 30 |
| enchanted_mechanisms | Enchanted Mechanisms | finished | 120g | 1wt | 80 | 40 |

---

## Player Progression Tiers (Global)

Based on `state.stats.totalGoldEarned`:

| Tier | Name | Gold Required |
|------|------|--------------|
| 0 | Peddler | start |
| 1 | Merchant | 500g |
| 2 | Manufacturer | 5,000g |
| 3 | Magnate | 25,000g |
| 4 | Governor | 100,000g |
| 5 | King | 500,000g |

---

## What Is Not Yet Implemented

- **Production buildings** — `js/production/` directory exists but is empty. Recipes are defined in `goods.js`. City class has `playerBuildings = []` stub.
- **City quest wiring** — `cityQuests.js` has full quest definitions but no tracking/completion logic
- **Automated trade routes** — `state.routes = []` placeholder. Dijkstra pathfinding is built but unused
- **Random events** — no event system (bandits, storms, windfalls)
- **Cargo upgrades** — vehicle capacity is fixed; no upgrade shop
- **Reputation decay** — rep only goes up; no decay from neglect
- **Multiplayer** — single-player only; architecture is state-based and could be synced to a server

---

## Deployment

```bash
# Local dev
docker compose up --build   # → http://localhost:8080

# Coolify
# Push to GitHub → Coolify auto-deploys
# Build Pack: Dockerfile | Port: 80 | Health Check: /healthz
```

Save data lives in `localStorage` key `ironveil_save_v1` (JSON, versioned).

---

## Coding Conventions

- **No framework, no build step** — pure ES modules with `type="module"` in index.html
- **Data-driven** — goods, recipes, cities, milestones are plain JS objects, easy to extend
- **Dirty-flag rendering** — UI elements only update when data changes (hash-based or explicit dirty flags)
- **EventBus for cross-system comms** — never import UI from engine or engine from UI directly
- **All capacity in weight units** — never raw item counts for transport
- **CSS variables** in `main.css` `:root` — always use vars, never hardcode colours
- **Save format** — version field on save payload; check version on load before hydrating
