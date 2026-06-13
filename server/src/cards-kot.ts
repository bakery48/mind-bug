import { CardDef } from './types';

export const KOT_CARDS: CardDef[] = [
  // ── Power 2 ──────────────────────────────────────────
  {
    id: 'kot-baby-kaiju', name: 'ベビー怪獣', power: 2,
    keywords: ['FRENZY'],
  },
  {
    id: 'kot-mutant-rat', name: 'ミュータントラット', power: 2,
    keywords: ['POISONOUS'],
  },

  // ── Power 3 ──────────────────────────────────────────
  {
    id: 'kot-robo-imp', name: 'ロボインプ', power: 3,
    keywords: ['SNEAKY'],
  },
  {
    id: 'kot-toxic-blob', name: '毒スライム', power: 3,
    keywords: ['POISONOUS', 'SNEAKY'],
  },

  // ── Power 4 ──────────────────────────────────────────
  {
    id: 'kot-cyber-bunny', name: 'サイバーバニー', power: 4,
    keywords: ['SNEAKY', 'FRENZY'],
  },
  {
    id: 'kot-space-penguin', name: 'スペースペンギン', power: 4,
    keywords: ['SNEAKY'],
    ability: { trigger: 'PLAY', effect: 'DRAW_CARD', description: 'プレイ時: カードを1枚引く' },
  },
  {
    id: 'kot-cyber-kitty', name: 'サイバーキティ', power: 4,
    keywords: ['TOUGH'],
  },

  // ── Power 5 ──────────────────────────────────────────
  {
    id: 'kot-alienoid', name: 'エイリアノイド', power: 5,
    keywords: ['POISONOUS'],
  },
  {
    id: 'kot-boogie-woogie', name: 'ブギウギ', power: 5,
    keywords: ['FRENZY'],
    ability: { trigger: 'DEFEATED', effect: 'GAIN_LIFE', description: '破壊時: ライフを1回復する' },
  },
  {
    id: 'kot-pandakai', name: 'パンダカイ', power: 5,
    keywords: ['HUNTER'],
  },

  // ── Power 6 ──────────────────────────────────────────
  {
    id: 'kot-zombie-yeti', name: 'ゾンビイエティ', power: 6,
    keywords: ['TOUGH'],
    ability: { trigger: 'DEFEATED', effect: 'RETURN_TO_HAND', description: '破壊時: 手札に戻る' },
  },
  {
    id: 'kot-electric-eel', name: '電撃ウナギ怪獣', power: 6,
    keywords: ['POISONOUS'],
    ability: { trigger: 'ATTACK', effect: 'DIRECT_DAMAGE', description: '攻撃時: 相手に1ダメージ' },
  },
  {
    id: 'kot-captain-frenchie', name: 'キャプテン・フレンチ', power: 6,
    keywords: ['SNEAKY'],
    ability: { trigger: 'PLAY', effect: 'DRAW_CARD', description: 'プレイ時: カードを1枚引く' },
  },

  // ── Power 7 ──────────────────────────────────────────
  {
    id: 'kot-anubis', name: 'アヌビス', power: 7,
    keywords: ['HUNTER', 'SNEAKY'],
  },
  {
    id: 'kot-medusa', name: 'メデューサ', power: 7,
    keywords: ['POISONOUS', 'SNEAKY'],
  },
  {
    id: 'kot-kraken', name: 'クラーケン', power: 7,
    keywords: ['TOUGH'],
    ability: { trigger: 'PLAY', effect: 'DAMAGE_CREATURE', description: 'プレイ時: クリーチャー1体にダメージ' },
  },
  {
    id: 'kot-master-mindbug', name: 'マスターマインドバグ', power: 7,
    keywords: ['HUNTER', 'FRENZY'],
  },

  // ── Power 8 ──────────────────────────────────────────
  {
    id: 'kot-meka-dragon', name: 'メカドラゴン', power: 8,
    keywords: ['FRENZY'],
  },
  {
    id: 'kot-rampage', name: 'ランページ', power: 8,
    keywords: ['TOUGH', 'HUNTER'],
  },
  {
    id: 'kot-kong', name: 'コング', power: 8,
    keywords: ['FRENZY', 'SNEAKY'],
  },

  // ── Power 9 ──────────────────────────────────────────
  {
    id: 'kot-gigazaur', name: 'ギガザウル', power: 9,
    keywords: ['HUNTER'],
  },
  {
    id: 'kot-cthulhu', name: 'クトゥルフ', power: 9,
    keywords: ['POISONOUS'],
  },
  {
    id: 'kot-crabzilla', name: 'カニザメ怪獣', power: 9,
    keywords: ['TOUGH'],
    ability: { trigger: 'PLAY', effect: 'WIPE_WEAK', description: 'プレイ時: パワー4以下を全滅させる' },
  },

  // ── Power 10 ─────────────────────────────────────────
  {
    id: 'kot-the-king', name: 'ザ・キング', power: 10,
    keywords: ['FRENZY'],
  },
];
