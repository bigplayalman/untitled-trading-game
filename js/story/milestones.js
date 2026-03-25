/**
 * milestones.js
 * Story-driven progression milestones and intro dialogue.
 */

export const MILESTONES = [
  {
    id: 'intro_01',
    title: 'A Strange Awakening',
    text: 'You wake in a dimly lit room, your body aching beneath rough blankets. Bandages wrap your arms and ribs. An old man sits beside the bed, watching quietly as your eyes adjust to the lantern glow.',
    speaker: 'Old Peddler',
    portrait: 'P',
    choices: [
      { text: 'Try to sit up.', next: 'intro_02' },
    ],
  },
  {
    id: 'intro_02',
    title: 'By The River',
    text: 'The old man begins speaking in a language you have never heard before, yet somehow every word is clear. "Easy now. I found you by the river, dressed in strange clothes, unconscious and barely clinging to life. You were covered in bruises and cuts. I carried you here, tended your wounds, and let you recover in my lodge by the edge of town."',
    speaker: 'Old Peddler',
    portrait: 'P',
    choices: [
      { text: 'Listen carefully.', next: 'intro_03' },
    ],
  },
  {
    id: 'intro_03',
    title: 'A Simple Peddler',
    text: '"I am but a simple peddler," the old man says with a weary smile. "I move raw goods between two neighboring towns. Nothing grand, but enough to make a living." He studies your face for a moment, then asks softly, "Tell me... what is your name?"',
    speaker: 'Old Peddler',
    portrait: 'P',
    choices: [
      { text: 'Try to answer.', next: null, action: 'name' },
    ],
  },
];

export const TIER_UP_DIALOGUES = {
  1: {
    speaker: 'Old Peddler',
    portrait: 'P',
    text: 'You have outgrown a peddler\'s beginnings. Folk are starting to call you a true merchant now.',
  },
  2: {
    speaker: 'Guild Master Helia',
    portrait: 'H',
    text: 'The Ironveil Manufacturers\' Guild has taken notice of your operations. You now have the right to build production facilities in any city that will have you.',
  },
  3: {
    speaker: 'Countess Vera',
    portrait: 'V',
    text: 'A Magnate. Few rise so far, so quickly. Even the nobility now track the movement of your caravans.',
  },
  4: {
    speaker: 'Emperor\'s Herald',
    portrait: 'E',
    text: 'By Imperial decree, you are recognized as Governor. Commerce has made you more than wealthy. It has made you important.',
  },
  5: {
    speaker: 'The Kingdom',
    portrait: 'K',
    text: 'From a nameless stranger at death\'s door, you have become a power that can shape the fate of kingdoms.',
  },
};
