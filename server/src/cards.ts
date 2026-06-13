import { CardDef } from './types';

export const ALL_CARDS: CardDef[] = [
  // Power 1-2
  { id: 'angry-toad', name: 'Angry Toad', power: 1, keywords: ['POISONOUS'] },
  { id: 'honey-bee', name: 'Honey Bee', power: 2, keywords: ['POISONOUS'] },
  { id: 'dino-kite', name: 'Dino Kite', power: 2, keywords: ['FRENZY', 'SNEAKY'] },

  // Power 3
  { id: 'bunny-botcher', name: 'Bunny Botcher', power: 3, keywords: ['POISONOUS', 'FRENZY'] },
  { id: 'croc-nurse', name: 'Croc Nurse', power: 3, keywords: ['TOUGH'] },
  { id: 'gentle-gorilla', name: 'Gentle Gorilla', power: 3, keywords: ['TOUGH', 'FRENZY'] },
  { id: 'grumpy-owl', name: 'Grumpy Owl', power: 3, keywords: ['SNEAKY'] },
  { id: 'mind-puppet', name: 'Mind Puppet', power: 3, keywords: ['SNEAKY', 'POISONOUS'] },

  // Power 4
  { id: 'cat-bug', name: 'Cat Bug', power: 4, keywords: ['FRENZY'] },
  { id: 'centaur-scout', name: 'Centaur Scout', power: 4, keywords: ['SNEAKY', 'HUNTER'] },
  { id: 'cobra-chicken', name: 'Cobra Chicken', power: 4, keywords: ['POISONOUS', 'SNEAKY'] },
  { id: 'gnome-rider', name: 'Gnome Rider', power: 4, keywords: ['HUNTER'] },
  {
    id: 'golden-steed',
    name: 'Golden Steed',
    power: 4,
    keywords: ['FRENZY'],
    ability: { trigger: 'PLAY', effect: 'DRAW_CARD', description: 'PLAY: Draw a card.' },
  },
  {
    id: 'mimic-jelly',
    name: 'Mimic Jelly',
    power: 4,
    keywords: [],
    ability: {
      trigger: 'PLAY',
      effect: 'COPY_CREATURE',
      description: 'PLAY: Become a copy of any creature in play.',
    },
  },

  // Power 5
  { id: 'chameleon-sniper', name: 'Chameleon Sniper', power: 5, keywords: ['SNEAKY'] },
  {
    id: 'death-cat',
    name: 'Death Cat',
    power: 5,
    keywords: [],
    ability: { trigger: 'DEFEATED', effect: 'GAIN_LIFE', description: 'DEFEATED: Gain 1 life.' },
  },
  { id: 'elephant-mouse', name: 'Elephant Mouse', power: 5, keywords: ['HUNTER'] },
  {
    id: 'fire-dancer',
    name: 'Fire Dancer',
    power: 5,
    keywords: [],
    ability: {
      trigger: 'ATTACK',
      effect: 'DIRECT_DAMAGE',
      description: 'ATTACK: Deal 1 damage to the opponent.',
    },
  },
  { id: 'hunter-mantis', name: 'Hunter Mantis', power: 5, keywords: ['HUNTER', 'FRENZY'] },
  { id: 'king-cobra', name: 'King Cobra', power: 5, keywords: ['POISONOUS', 'HUNTER'] },
  { id: 'shadow-slayer', name: 'Shadow Slayer', power: 5, keywords: ['SNEAKY', 'FRENZY'] },
  {
    id: 'spell-weaver',
    name: 'Spell Weaver',
    power: 5,
    keywords: [],
    ability: { trigger: 'PLAY', effect: 'DRAW_CARD', description: 'PLAY: Draw a card.' },
  },

  // Power 6
  {
    id: 'bomber-cat',
    name: 'Bomber Cat',
    power: 6,
    keywords: [],
    ability: {
      trigger: 'DEFEATED',
      effect: 'DRAW_CARD',
      description: 'DEFEATED: Draw a card.',
    },
  },
  {
    id: 'cave-gator',
    name: 'Cave Gator',
    power: 6,
    keywords: [],
    ability: {
      trigger: 'DEFEATED',
      effect: 'DRAW_CARD',
      description: 'DEFEATED: Draw a card.',
    },
  },
  { id: 'enchanted-feline', name: 'Enchanted Feline', power: 6, keywords: ['FRENZY'] },
  { id: 'giga-ant', name: 'Giga Ant', power: 6, keywords: ['HUNTER', 'FRENZY'] },
  { id: 'hell-hound', name: 'Hell Hound', power: 6, keywords: ['FRENZY'] },
  { id: 'horn-snapper', name: 'Horn Snapper', power: 6, keywords: ['TOUGH'] },
  { id: 'lava-lynx', name: 'Lava Lynx', power: 6, keywords: ['FRENZY', 'SNEAKY'] },
  { id: 'octopus-assassin', name: 'Octopus Assassin', power: 6, keywords: ['SNEAKY', 'HUNTER'] },

  // Power 7
  {
    id: 'bee-bear',
    name: 'Bee Bear',
    power: 7,
    keywords: [],
    ability: {
      trigger: 'PLAY',
      effect: 'DAMAGE_CREATURE',
      description: 'PLAY: Deal 1 damage to a target creature.',
    },
  },
  {
    id: 'deathstroke-mosquito',
    name: 'Deathstroke Mosquito',
    power: 7,
    keywords: ['POISONOUS', 'FRENZY'],
  },
  { id: 'flying-croc', name: 'Flying Croc', power: 7, keywords: ['SNEAKY'] },
  { id: 'hippo-dancer', name: 'Hippo Dancer', power: 7, keywords: ['TOUGH'] },
  {
    id: 'mother-phoenix',
    name: 'Mother Phoenix',
    power: 7,
    keywords: [],
    ability: {
      trigger: 'DEFEATED',
      effect: 'RETURN_TO_HAND',
      description: "DEFEATED: Return to controller's hand.",
    },
  },
  { id: 'sabertooth', name: 'Sabertooth', power: 7, keywords: ['FRENZY', 'HUNTER'] },

  // Power 8
  { id: 'crystal-golem', name: 'Crystal Golem', power: 8, keywords: ['TOUGH'] },
  { id: 'dark-demon', name: 'Dark Demon', power: 8, keywords: ['SNEAKY', 'FRENZY'] },
  { id: 'mosquito-beast', name: 'Mosquito Beast', power: 8, keywords: ['POISONOUS'] },
  { id: 'rock-bear', name: 'Rock Bear', power: 8, keywords: ['TOUGH', 'HUNTER'] },
  { id: 'spike-rhino', name: 'Spike Rhino', power: 8, keywords: ['FRENZY'] },

  // Power 9
  { id: 'battle-croc', name: 'Battle Croc', power: 9, keywords: ['TOUGH', 'HUNTER'] },
  {
    id: 'fungi-giant',
    name: 'Fungi Giant',
    power: 9,
    keywords: [],
    ability: {
      trigger: 'PLAY',
      effect: 'WIPE_WEAK',
      description: 'PLAY: Defeat all creatures with power 4 or less.',
    },
  },
  { id: 'komodo-tyrant', name: 'Komodo Tyrant', power: 9, keywords: ['POISONOUS'] },
  { id: 'polar-bear-king', name: 'Polar Bear King', power: 9, keywords: ['TOUGH'] },

  // Power 10
  { id: 'ant-titan', name: 'Ant Titan', power: 10, keywords: ['FRENZY'] },
  { id: 'ram-giant', name: 'Ram Giant', power: 10, keywords: ['HUNTER'] },
  { id: 'void-dragon', name: 'Void Dragon', power: 10, keywords: ['TOUGH', 'FRENZY'] },
];

export function shuffleDeck(cards: CardDef[]): CardDef[] {
  const deck = [...cards];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

export function getCardById(id: string): CardDef | undefined {
  return ALL_CARDS.find((c) => c.id === id);
}
