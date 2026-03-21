/**
 * cities.js
 * Definitions for all cities in the game world.
 * Each city has an economic personality:
 *   - naturalProduction: what it makes on its own each day
 *   - dailyConsumption: what its population needs each day
 *   - startInventory: initial stock levels
 *
 * Map positions (x, y) are 0-1 normalised fractions of canvas size.
 */

export const CITY_DEFS = [
  {
    id:          'cogsworth',
    name:        'Cogsworth Landing',
    description: 'A modest river town where you woke up after your isekai arrival. Balanced economy, good starting point.',
    x: 0.35, y: 0.55,
    color: '#b5891c',
    startPopulation: 2200,
    startWealth:     800,
    naturalProduction: {
      wheat:   8,
      timber:  5,
      cotton:  4,
    },
    dailyConsumption: {
      bread:   6,
      tools:   1,
      cloth:   2,
    },
    startInventory: {
      wheat:    80, timber:   60, cotton:   40,
      iron_ore: 20, coal:     15,
      flour:    30, lumber:   25, cloth:    20,
      tools:    12, bread:    40, steel:    8,
    },
  },

  {
    id:          'ironhaven',
    name:        'Ironhaven',
    description: 'A gritty mining settlement deep in the Ashridge Mountains. Rich in ore and coal, but dependent on food imports.',
    x: 0.18, y: 0.28,
    color: '#7a7a7a',
    startPopulation: 3100,
    startWealth:     1200,
    naturalProduction: {
      iron_ore: 20,
      coal:     18,
    },
    dailyConsumption: {
      bread:   10,
      tools:    3,
      timber:   4,
      cloth:    3,
    },
    startInventory: {
      iron_ore: 200, coal: 180,
      steel:    30,
      bread:    20, flour: 10,
      timber:   15, lumber: 10, cloth: 8, tools: 5,
    },
  },

  {
    id:          'verdania',
    name:        'Verdania',
    description: 'Lush agricultural heartland known for its vast wheat fields and cotton plantations. Needs manufactured goods.',
    x: 0.60, y: 0.70,
    color: '#4a9a4a',
    startPopulation: 4500,
    startWealth:     900,
    naturalProduction: {
      wheat:   30,
      cotton:  22,
      timber:  10,
    },
    dailyConsumption: {
      bread:   14,
      tools:    4,
      cloth:    5,
      steam_cores: 1,
    },
    startInventory: {
      wheat: 300, cotton: 220, timber: 100,
      flour:  50, cloth:   20, lumber:  30,
      bread:  40, tools:   10,
    },
  },

  {
    id:          'steamport',
    name:        'Steamport Royal',
    description: 'The glittering capital of the Ironveil Empire. High demand for luxury goods; everything costs more here.',
    x: 0.50, y: 0.22,
    color: '#c060c0',
    startPopulation: 18000,
    startWealth:     8000,
    naturalProduction: {
      // Capital produces very little raw - it's a consumer city
      coal: 5,
    },
    dailyConsumption: {
      bread:               25,
      fine_garments:        8,
      enchanted_mechanisms: 3,
      tools:                6,
      steam_cores:          4,
      lumber:               8,
    },
    startInventory: {
      bread: 80,  fine_garments: 30, enchanted_mechanisms: 10,
      tools: 40,  steam_cores:   15, lumber: 60,
      cloth: 50,  steel: 40,
      coal:  30,
    },
  },

  {
    id:          'crystaldeep',
    name:        'Crystaldeep',
    description: 'Remote aetheric mining colony nestled in the Violet Peaks. The only source of Mana Crystals on the continent.',
    x: 0.80, y: 0.40,
    color: '#6060e0',
    startPopulation: 900,
    startWealth:     2000,
    naturalProduction: {
      mana_crystals: 8,
      iron_ore:      5,
    },
    dailyConsumption: {
      bread:       4,
      tools:       2,
      timber:      3,
      cloth:       1,
      alchemical_compounds: 1,
    },
    startInventory: {
      mana_crystals: 60, iron_ore: 40,
      alchemical_compounds: 10,
      bread: 10, tools: 5, timber: 8, cloth: 4,
    },
  },

  {
    id:          'millhurst',
    name:        'Millhurst',
    description: 'A sprawling industrial town of furnaces and workshops. Converts raw materials into finished goods efficiently.',
    x: 0.25, y: 0.72,
    color: '#c08020',
    startPopulation: 5600,
    startWealth:     2200,
    naturalProduction: {
      // Millhurst\'s "natural production" represents its many NPC workshops
      steel:       8,
      lumber:     10,
      flour:       6,
      cloth:       6,
      steam_cores: 3,
      tools:       5,
    },
    dailyConsumption: {
      iron_ore: 16,
      coal:     14,
      timber:   10,
      wheat:     8,
      cotton:    8,
      bread:    18,
      mana_crystals: 2,
    },
    startInventory: {
      steel: 60,  lumber: 80, flour: 50,  cloth: 60,
      steam_cores: 20, tools: 40,
      iron_ore: 80, coal: 70, timber: 50, wheat: 40, cotton: 40,
      bread: 30,
    },
  },

  {
    id:          'windhollow',
    name:        'Windhollow',
    description: 'High-altitude airship hub perched on the Gale Plateaus. A vital transit point connecting all major trade routes.',
    x: 0.68, y: 0.48,
    color: '#30a0c0',
    startPopulation: 2800,
    startWealth:     1500,
    naturalProduction: {
      // Wind-powered mills make flour and lumber here
      flour:  8,
      lumber: 6,
      coal:   4,
    },
    dailyConsumption: {
      bread:               8,
      steam_cores:         3,
      fine_garments:       2,
      enchanted_mechanisms:1,
      tools:               3,
    },
    startInventory: {
      flour: 60, lumber: 50, coal: 40,
      bread: 30, steam_cores: 12, fine_garments: 10,
      enchanted_mechanisms: 5, tools: 20,
      iron_ore: 20, steel: 15,
    },
  },
];

/** Map of city id -> definition for quick lookup */
export const CITY_DEF_MAP = {};
for (const def of CITY_DEFS) {
  CITY_DEF_MAP[def.id] = def;
}
