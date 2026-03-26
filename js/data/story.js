/**
 * story.js
 * Declarative story and quest data.
 */

export const CITY_QUESTS = {
  cogsworth: [
    {
      id: 'cogs_q1',
      title: 'Supply the Mill',
      desc: 'Sell 20 Wheat to Cogsworth Landing. The mill is running low.',
      minRep: 0,
      goal: { type: 'sell', goodId: 'wheat', qty: 20 },
      reward: { rep: 20, gold: 0 },
    },
    {
      id: 'cogs_q2',
      title: 'Iron for the Smithy',
      desc: 'Bring 10 Iron Ore to Cogsworth. The local smith needs raw material.',
      minRep: 20,
      goal: { type: 'sell', goodId: 'iron_ore', qty: 10 },
      reward: { rep: 25, gold: 50 },
    },
    {
      id: 'cogs_q3',
      title: 'Clothe the Workers',
      desc: 'Deliver 15 Cloth to Cogsworth Landing.',
      minRep: 40,
      goal: { type: 'sell', goodId: 'cloth', qty: 15 },
      reward: { rep: 30, gold: 100 },
    },
  ],
  ironhaven: [
    {
      id: 'iron_q1',
      title: 'Feed the Miners',
      desc: 'Sell 30 Bread to Ironhaven. The miners are hungry.',
      minRep: 0,
      goal: { type: 'sell', goodId: 'bread', qty: 30 },
      reward: { rep: 20, gold: 0 },
    },
    {
      id: 'iron_q2',
      title: 'Tools of the Trade',
      desc: 'Bring 10 Tools to Ironhaven.',
      minRep: 20,
      goal: { type: 'sell', goodId: 'tools', qty: 10 },
      reward: { rep: 25, gold: 80 },
    },
  ],
  verdania: [
    {
      id: 'verd_q1',
      title: 'Harvest Tools',
      desc: 'Deliver 8 Tools to Verdania for the harvest season.',
      minRep: 0,
      goal: { type: 'sell', goodId: 'tools', qty: 8 },
      reward: { rep: 20, gold: 0 },
    },
    {
      id: 'verd_q2',
      title: 'Cloth for the Tailors',
      desc: 'Bring 20 Cloth to Verdania.',
      minRep: 20,
      goal: { type: 'sell', goodId: 'cloth', qty: 20 },
      reward: { rep: 25, gold: 60 },
    },
  ],
  steamport: [
    {
      id: 'steam_q1',
      title: 'Capital Demands',
      desc: 'Deliver 5 Fine Garments to Steamport Royal.',
      minRep: 0,
      goal: { type: 'sell', goodId: 'fine_garments', qty: 5 },
      reward: { rep: 25, gold: 0 },
    },
    {
      id: 'steam_q2',
      title: 'Imperial Machinery',
      desc: 'Bring 3 Enchanted Mechanisms to the capital.',
      minRep: 40,
      goal: { type: 'sell', goodId: 'enchanted_mechanisms', qty: 3 },
      reward: { rep: 30, gold: 200 },
    },
  ],
  crystaldeep: [
    {
      id: 'crys_q1',
      title: 'Sustain the Colony',
      desc: 'Sell 15 Bread to Crystaldeep. Supply lines are thin.',
      minRep: 0,
      goal: { type: 'sell', goodId: 'bread', qty: 15 },
      reward: { rep: 20, gold: 0 },
    },
    {
      id: 'crys_q2',
      title: 'Mining Equipment',
      desc: 'Deliver 6 Tools to the crystal miners.',
      minRep: 20,
      goal: { type: 'sell', goodId: 'tools', qty: 6 },
      reward: { rep: 25, gold: 120 },
    },
  ],
  millhurst: [
    {
      id: 'mill_q1',
      title: 'Raw Material Run',
      desc: "Bring 20 Iron Ore to Millhurst's foundries.",
      minRep: 0,
      goal: { type: 'sell', goodId: 'iron_ore', qty: 20 },
      reward: { rep: 20, gold: 0 },
    },
    {
      id: 'mill_q2',
      title: 'Crystal Shipment',
      desc: "Deliver 5 Mana Crystals to Millhurst's alchemists.",
      minRep: 20,
      goal: { type: 'sell', goodId: 'mana_crystals', qty: 5 },
      reward: { rep: 30, gold: 150 },
    },
  ],
  windhollow: [
    {
      id: 'wind_q1',
      title: 'Airship Fuel',
      desc: 'Sell 25 Coal to Windhollow for the airship engines.',
      minRep: 0,
      goal: { type: 'sell', goodId: 'coal', qty: 25 },
      reward: { rep: 20, gold: 0 },
    },
    {
      id: 'wind_q2',
      title: 'Steam Parts',
      desc: 'Bring 4 Steam Cores to Windhollow.',
      minRep: 20,
      goal: { type: 'sell', goodId: 'steam_cores', qty: 4 },
      reward: { rep: 25, gold: 100 },
    },
  ],
};

export const MILESTONES = [
  {
    id: 'intro_01',
    title: 'A Strange Awakening',
    text: 'You wake in a dimly lit room, your body aching beneath rough blankets. Bandages wrap your arms and ribs. An old man sits beside the bed, watching quietly as your eyes adjust to the lantern glow.',
    speaker: 'Cid',
    portrait: 'C',
    choices: [{ text: 'Try to sit up.', next: 'intro_02' }],
  },
  {
    id: 'intro_02',
    title: 'By The River',
    text: 'The old man begins speaking in a language you have never heard before, yet somehow every word is clear. "Easy now. I found you by the river, dressed in strange clothes, unconscious and barely clinging to life. You were covered in bruises and cuts. I carried you here, tended your wounds, and let you recover in my lodge by the edge of town."',
    speaker: 'Cid',
    portrait: 'C',
    choices: [{ text: 'Listen carefully.', next: 'intro_03' }],
  },
  {
    id: 'intro_03',
    title: 'A Simple Peddler',
    text: '"I am but a simple peddler," the old man says with a weary smile. "Mostly grain. Wheat, flour, and whatever else simple folk can afford to move between neighboring towns. Nothing grand, but enough to keep soup in the pot." He studies your face for a moment, then asks softly, "Tell me... what is your name?"',
    speaker: 'Cid',
    portrait: 'C',
    choices: [{ text: 'Try to answer.', next: 'intro_04', action: 'name' }],
  },
  {
    id: 'intro_04',
    title: 'Weeks Later',
    text: 'A couple of weeks pass. Your wounds close, the bruises fade, and strength returns to your limbs. More than returns. You feel far stronger than you can ever recall, though your past remains a blank wall in your mind. Only your name remains with you.',
    speaker: 'Narration',
    portrait: 'N',
    choices: [{ text: 'Ask about your belongings.', next: 'intro_05' }],
  },
  {
    id: 'intro_05',
    title: 'The Strange Clothes',
    text: 'Cid lowers his eyes. "Your old clothes were ruined," he says. "A local merchant heard of your state and offered a healing potion and fresh bandages in exchange for them. I agreed... reluctantly. I hope you can forgive me." You thank him anyway. He saved your life. You would have done the same.',
    speaker: 'Cid',
    portrait: 'C',
    choices: [{ text: 'Learn more of this land.', next: 'intro_06' }],
  },
  {
    id: 'intro_06',
    title: 'This World',
    text: 'You learn that alchemy and magic are both real. Alchemical craft is expensive and mostly reserved for the rich. Magic is the guarded privilege of the nobility. Life for simple people is hard, but roads have improved, peace holds more often than not, and commerce has begun to spread. In that space a new kind of power has risen: the merchants.',
    speaker: 'Narration',
    portrait: 'N',
    choices: [{ text: 'Keep listening.', next: 'intro_07' }],
  },
  {
    id: 'intro_07',
    title: "Cid's Lodge",
    text: 'You feel you should take care of Cid. Until your strength returns, you clean his lodge, cook meals, and run errands around town. The locals are wary of you at first, but they slowly get used to your face and begin paying you small coins for simple jobs.',
    speaker: 'Narration',
    portrait: 'N',
    choices: [{ text: 'Another morning begins.', next: 'intro_08' }],
  },
  {
    id: 'intro_08',
    title: 'The Crash',
    text: 'One morning you wake to a loud bang outside the lodge. You rush to the door and find Cid collapsed on the ground, a bushel of grain scattered around him. Looming above him is an angry merchant, red-faced with fury. "You will pay for this damaged merchandise," he snarls, "or I will bar you from doing any business with the guild."',
    speaker: 'Narration',
    portrait: 'N',
    choices: [{ text: 'Step between them.', next: 'intro_09' }],
  },
  {
    id: 'intro_09',
    title: 'Take The Road',
    text: 'Cid struggles to his feet, ashamed and breathing hard. Later, inside the lodge, he presses his old trade papers into your hands. "I am too old for this road now," he admits. "If you are willing, take my grain run, settle this mess with the guild, and earn your place properly. You have the strength for it. More than strength, I think."',
    speaker: 'Cid',
    portrait: 'C',
    choices: [{ text: "I'll do it.", next: null, action: 'close' }],
  },
];

export const TIER_UP_DIALOGUES = {
  2: {
    speaker: 'Guild Master Helia',
    portrait: 'H',
    text: "The Ironveil Manufacturers' Guild has taken notice of your operations. You now have the right to build production facilities in any city that will have you.",
  },
  3: {
    speaker: 'Countess Vera',
    portrait: 'V',
    text: 'A Magnate. Few rise so far, so quickly. Even the nobility now track the movement of your caravans.',
  },
  4: {
    speaker: "Emperor's Herald",
    portrait: 'E',
    text: 'By Imperial decree, you are recognized as Governor. Commerce has made you more than wealthy. It has made you important.',
  },
  5: {
    speaker: 'The Kingdom',
    portrait: 'K',
    text: "From a nameless stranger at death's door, you have become a power that can shape the fate of kingdoms.",
  },
};
