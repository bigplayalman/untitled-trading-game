/**
 * milestones.js
 * Story-driven progression milestones and intro dialogue.
 */

export const MILESTONES = [
  {
    id:    'intro_01',
    title: 'A Strange New World',
    text:  'You open your eyes in an unfamiliar town square. The smell of coal smoke and machine oil fills the air. A kind merchant notices your confusion...',
    speaker: 'Merchant Bram',
    portrait: '🧔',
    choices: [
      { text: 'Where... am I?', next: 'intro_02' },
    ],
  },
  {
    id:    'intro_02',
    title: 'Welcome to Cogsworth Landing',
    text:  '"You\'re in Cogsworth Landing, traveller. Looks like you\'ve nothing to your name. Here - take 50 gold. A person needs coin to survive in Ironveil. Start small: buy low, sell high. The market\'s just there."',
    speaker: 'Merchant Bram',
    portrait: '🧔',
    choices: [
      { text: 'Thank you. I\'ll make something of myself.', next: null, action: 'close' },
    ],
  },
];

export const TIER_UP_DIALOGUES = {
  1: {
    speaker: 'Merchant Bram',
    portrait: '🧔',
    text: 'Word travels fast in these parts. They\'re calling you a Merchant now. Buy yourself a proper wagon - you\'ll need the capacity.',
  },
  2: {
    speaker: 'Guild Master Helia',
    portrait: '👩‍🔬',
    text: 'The Ironveil Manufacturers\' Guild has taken notice of your operations. You now have the right to build production facilities in any city that will have you.',
  },
  3: {
    speaker: 'Countess Vera',
    portrait: '👑',
    text: 'A Magnate! Few reach such heights. The nobility acknowledge your wealth. Your trade routes now qualify for Ducal Protection - fewer bandit troubles.',
  },
  4: {
    speaker: 'Emperor\'s Herald',
    portrait: '📜',
    text: 'By Imperial Decree, you are appointed Governor of your chosen territory. The people look to you for leadership as well as commerce.',
  },
  5: {
    speaker: 'The Kingdom',
    portrait: '👑',
    text: 'From nothing, you have built a kingdom. The Ironveil Empire bows to your wealth and influence. Your story is just beginning.',
  },
};
