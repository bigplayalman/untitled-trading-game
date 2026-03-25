/**
 * goods.js
 * Definitions for all tradeable goods and production recipes.
 *
 * Categories:
 *   raw       - Extracted from nature, no processing needed
 *   processed - Made from raw materials in basic workshops
 *   finished  - High-value end products requiring processed goods
 */

export const GOODS = {
  // ── RAW MATERIALS ─────────────────────────────────────────────
  iron_ore: {
    id: 'iron_ore',
    name: 'Iron Ore',
    category: 'raw',
    basePrice: 8,
    weight: 4,
    icon: '🪨',
    description: 'Rough ore mined from the earth. Essential for metalwork.',
  },
  coal: {
    id: 'coal',
    name: 'Coal',
    category: 'raw',
    basePrice: 6,
    weight: 3,
    icon: '🪵',
    description: 'Black rock that burns hot. Fuel for furnaces and steam engines.',
  },
  timber: {
    id: 'timber',
    name: 'Timber',
    category: 'raw',
    basePrice: 7,
    weight: 4,
    icon: '🌲',
    description: 'Felled logs from forest lumber operations.',
  },
  wheat: {
    id: 'wheat',
    name: 'Wheat',
    category: 'raw',
    basePrice: 4,
    weight: 2,
    icon: '🌾',
    description: 'Grain harvested from fertile fields.',
  },
  cotton: {
    id: 'cotton',
    name: 'Cotton',
    category: 'raw',
    basePrice: 5,
    weight: 2,
    icon: '☁️',
    description: 'Fluffy white bolls picked from cotton plants.',
  },
  mana_crystals: {
    id: 'mana_crystals',
    name: 'Mana Crystals',
    category: 'raw',
    basePrice: 30,
    weight: 1,
    icon: '💎',
    description: 'Rare crystalline formations pulsing with aetheric energy.',
  },

  // ── PROCESSED GOODS ───────────────────────────────────────────
  steel: {
    id: 'steel',
    name: 'Steel',
    category: 'processed',
    basePrice: 22,
    weight: 2,
    icon: '⚙️',
    description: 'Refined iron alloy, stronger and more versatile than raw ore.',
  },
  lumber: {
    id: 'lumber',
    name: 'Lumber',
    category: 'processed',
    basePrice: 14,
    weight: 2,
    icon: '🪚',
    description: 'Planked and seasoned wood ready for construction.',
  },
  flour: {
    id: 'flour',
    name: 'Flour',
    category: 'processed',
    basePrice: 9,
    weight: 1,
    icon: '🌀',
    description: 'Milled wheat grain, the basis of all baked goods.',
  },
  cloth: {
    id: 'cloth',
    name: 'Cloth',
    category: 'processed',
    basePrice: 12,
    weight: 1,
    icon: '🧵',
    description: 'Woven cotton fabric used in clothing and upholstery.',
  },
  steam_cores: {
    id: 'steam_cores',
    name: 'Steam Cores',
    category: 'processed',
    basePrice: 35,
    weight: 2,
    icon: '🔩',
    description: 'Precision-engineered pressure vessels. The heart of any steam device.',
  },
  alchemical_compounds: {
    id: 'alchemical_compounds',
    name: 'Alchemical Compounds',
    category: 'processed',
    basePrice: 40,
    weight: 1,
    icon: '⚗️',
    description: 'Refined crystal extracts combined with coal-distilled reagents.',
  },

  // ── FINISHED GOODS ─────────────────────────────────────────────
  tools: {
    id: 'tools',
    name: 'Tools',
    category: 'finished',
    basePrice: 28,
    weight: 1,
    icon: '🔧',
    description: 'Hammers, chisels, and hand tools. Needed by every city.',
  },
  bread: {
    id: 'bread',
    name: 'Bread',
    category: 'finished',
    basePrice: 12,
    weight: 1,
    icon: '🍞',
    description: 'Baked loaves. A staple that feeds the working class.',
  },
  fine_garments: {
    id: 'fine_garments',
    name: 'Fine Garments',
    category: 'finished',
    basePrice: 45,
    weight: 1,
    icon: '👘',
    description: 'Expertly tailored clothing for the wealthy merchant class.',
  },
  enchanted_mechanisms: {
    id: 'enchanted_mechanisms',
    name: 'Enchanted Mechanisms',
    category: 'finished',
    basePrice: 120,
    weight: 1,
    icon: '✨',
    description: 'Steam devices infused with alchemical compounds. Highly sought after.',
  },
};

/**
 * Production recipes.
 * time: in game-days to produce one batch at a basic workshop level.
 * inputs: array of { id, qty } consumed per batch
 * output: { id, qty } produced per batch
 */
export const RECIPES = [
  // Raw -> Processed
  {
    id:     'smelt_steel',
    name:   'Smelt Steel',
    inputs: [{ id: 'iron_ore', qty: 2 }, { id: 'coal', qty: 1 }],
    output: { id: 'steel', qty: 1 },
    time:   1,
    buildingType: 'foundry',
  },
  {
    id:     'saw_lumber',
    name:   'Saw Lumber',
    inputs: [{ id: 'timber', qty: 2 }],
    output: { id: 'lumber', qty: 3 },
    time:   0.5,
    buildingType: 'sawmill',
  },
  {
    id:     'mill_flour',
    name:   'Mill Flour',
    inputs: [{ id: 'wheat', qty: 3 }],
    output: { id: 'flour', qty: 2 },
    time:   0.5,
    buildingType: 'mill',
  },
  {
    id:     'weave_cloth',
    name:   'Weave Cloth',
    inputs: [{ id: 'cotton', qty: 2 }],
    output: { id: 'cloth', qty: 2 },
    time:   0.75,
    buildingType: 'loom',
  },
  {
    id:     'forge_steam_cores',
    name:   'Forge Steam Cores',
    inputs: [{ id: 'steel', qty: 2 }, { id: 'coal', qty: 1 }],
    output: { id: 'steam_cores', qty: 1 },
    time:   1.5,
    buildingType: 'foundry',
  },
  {
    id:     'refine_alchemical',
    name:   'Refine Alchemical Compounds',
    inputs: [{ id: 'mana_crystals', qty: 1 }, { id: 'coal', qty: 1 }],
    output: { id: 'alchemical_compounds', qty: 1 },
    time:   1,
    buildingType: 'alchemist',
  },
  // Processed -> Finished
  {
    id:     'craft_tools',
    name:   'Craft Tools',
    inputs: [{ id: 'steel', qty: 2 }, { id: 'lumber', qty: 1 }],
    output: { id: 'tools', qty: 3 },
    time:   1,
    buildingType: 'workshop',
  },
  {
    id:     'bake_bread',
    name:   'Bake Bread',
    inputs: [{ id: 'flour', qty: 2 }],
    output: { id: 'bread', qty: 3 },
    time:   0.25,
    buildingType: 'bakery',
  },
  {
    id:     'tailor_garments',
    name:   'Tailor Fine Garments',
    inputs: [{ id: 'cloth', qty: 3 }],
    output: { id: 'fine_garments', qty: 1 },
    time:   2,
    buildingType: 'tailor',
  },
  {
    id:     'craft_enchanted',
    name:   'Craft Enchanted Mechanisms',
    inputs: [{ id: 'steam_cores', qty: 1 }, { id: 'alchemical_compounds', qty: 1 }],
    output: { id: 'enchanted_mechanisms', qty: 1 },
    time:   3,
    buildingType: 'artificer',
  },
];

/** Quick lookup: recipe by output good ID */
export const RECIPE_BY_OUTPUT = {};
for (const r of RECIPES) {
  RECIPE_BY_OUTPUT[r.output.id] = r;
}

/** All good IDs as array */
export const GOOD_IDS = Object.keys(GOODS);
