/**
 * cityQuests.js
 * City-specific quest definitions.
 *
 * Each quest grants reputation at a specific city on completion.
 * Wiring (goal tracking, completion detection, reward delivery)
 * is implemented in a future session.
 *
 * Quest shape:
 * {
 *   id:      string      - unique quest identifier
 *   title:   string      - short display name
 *   desc:    string      - player-facing description
 *   minRep:  number      - reputation required to unlock this quest
 *   goal: {
 *     type:   'sell' | 'buy' | 'visit'
 *     goodId: string     - good involved (if applicable)
 *     qty:    number     - quantity required
 *   },
 *   reward: {
 *     rep:   number      - reputation gained at this city on completion
 *     gold:  number      - (optional) gold reward
 *   }
 * }
 */

export const CITY_QUESTS = {
  cogsworth: [
    {
      id:     'cogs_q1',
      title:  'Supply the Mill',
      desc:   'Sell 20 Wheat to Cogsworth Landing. The mill is running low.',
      minRep: 0,
      goal:   { type: 'sell', goodId: 'wheat', qty: 20 },
      reward: { rep: 20, gold: 0 },
    },
    {
      id:     'cogs_q2',
      title:  'Iron for the Smithy',
      desc:   'Bring 10 Iron Ore to Cogsworth. The local smith needs raw material.',
      minRep: 20,
      goal:   { type: 'sell', goodId: 'iron_ore', qty: 10 },
      reward: { rep: 25, gold: 50 },
    },
    {
      id:     'cogs_q3',
      title:  'Clothe the Workers',
      desc:   'Deliver 15 Cloth to Cogsworth Landing.',
      minRep: 40,
      goal:   { type: 'sell', goodId: 'cloth', qty: 15 },
      reward: { rep: 30, gold: 100 },
    },
  ],

  ironhaven: [
    {
      id:     'iron_q1',
      title:  'Feed the Miners',
      desc:   'Sell 30 Bread to Ironhaven. The miners are hungry.',
      minRep: 0,
      goal:   { type: 'sell', goodId: 'bread', qty: 30 },
      reward: { rep: 20, gold: 0 },
    },
    {
      id:     'iron_q2',
      title:  'Tools of the Trade',
      desc:   'Bring 10 Tools to Ironhaven.',
      minRep: 20,
      goal:   { type: 'sell', goodId: 'tools', qty: 10 },
      reward: { rep: 25, gold: 80 },
    },
  ],

  verdania: [
    {
      id:     'verd_q1',
      title:  'Harvest Tools',
      desc:   'Deliver 8 Tools to Verdania for the harvest season.',
      minRep: 0,
      goal:   { type: 'sell', goodId: 'tools', qty: 8 },
      reward: { rep: 20, gold: 0 },
    },
    {
      id:     'verd_q2',
      title:  'Cloth for the Tailors',
      desc:   'Bring 20 Cloth to Verdania.',
      minRep: 20,
      goal:   { type: 'sell', goodId: 'cloth', qty: 20 },
      reward: { rep: 25, gold: 60 },
    },
  ],

  steamport: [
    {
      id:     'steam_q1',
      title:  'Capital Demands',
      desc:   'Deliver 5 Fine Garments to Steamport Royal.',
      minRep: 0,
      goal:   { type: 'sell', goodId: 'fine_garments', qty: 5 },
      reward: { rep: 25, gold: 0 },
    },
    {
      id:     'steam_q2',
      title:  'Imperial Machinery',
      desc:   'Bring 3 Enchanted Mechanisms to the capital.',
      minRep: 40,
      goal:   { type: 'sell', goodId: 'enchanted_mechanisms', qty: 3 },
      reward: { rep: 30, gold: 200 },
    },
  ],

  crystaldeep: [
    {
      id:     'crys_q1',
      title:  'Sustain the Colony',
      desc:   'Sell 15 Bread to Crystaldeep. Supply lines are thin.',
      minRep: 0,
      goal:   { type: 'sell', goodId: 'bread', qty: 15 },
      reward: { rep: 20, gold: 0 },
    },
    {
      id:     'crys_q2',
      title:  'Mining Equipment',
      desc:   'Deliver 6 Tools to the crystal miners.',
      minRep: 20,
      goal:   { type: 'sell', goodId: 'tools', qty: 6 },
      reward: { rep: 25, gold: 120 },
    },
  ],

  millhurst: [
    {
      id:     'mill_q1',
      title:  'Raw Material Run',
      desc:   'Bring 20 Iron Ore to Millhurst\'s foundries.',
      minRep: 0,
      goal:   { type: 'sell', goodId: 'iron_ore', qty: 20 },
      reward: { rep: 20, gold: 0 },
    },
    {
      id:     'mill_q2',
      title:  'Crystal Shipment',
      desc:   'Deliver 5 Mana Crystals to Millhurst\'s alchemists.',
      minRep: 20,
      goal:   { type: 'sell', goodId: 'mana_crystals', qty: 5 },
      reward: { rep: 30, gold: 150 },
    },
  ],

  windhollow: [
    {
      id:     'wind_q1',
      title:  'Airship Fuel',
      desc:   'Sell 25 Coal to Windhollow for the airship engines.',
      minRep: 0,
      goal:   { type: 'sell', goodId: 'coal', qty: 25 },
      reward: { rep: 20, gold: 0 },
    },
    {
      id:     'wind_q2',
      title:  'Steam Parts',
      desc:   'Bring 4 Steam Cores to Windhollow.',
      minRep: 20,
      goal:   { type: 'sell', goodId: 'steam_cores', qty: 4 },
      reward: { rep: 25, gold: 100 },
    },
  ],
};
