export type Keyword = 'FRENZY' | 'HUNTER' | 'POISONOUS' | 'SNEAKY' | 'TOUGH';

export interface Expansions {
  kotEnabled: boolean;
}
export type AbilityTrigger = 'PLAY' | 'ATTACK' | 'DEFEATED';
export type AbilityEffect =
  | 'DRAW_CARD'
  | 'GAIN_LIFE'
  | 'DIRECT_DAMAGE'
  | 'RETURN_TO_HAND'
  | 'DAMAGE_CREATURE'
  | 'COPY_CREATURE'
  | 'WIPE_WEAK';

export interface CardAbility {
  trigger: AbilityTrigger;
  effect: AbilityEffect;
  description: string;
}

export interface CardDef {
  id: string;
  name: string;
  power: number;
  keywords: Keyword[];
  ability?: CardAbility;
}

export interface CreatureInPlay {
  instanceId: string;
  cardId: string;
  name: string;
  power: number;
  keywords: Keyword[];
  ability?: CardAbility;
  isDamaged: boolean;
  controllerIndex: 0 | 1;
}

export type GamePhase =
  | 'WAITING'
  | 'PLAYER_TURN'
  | 'MINDBUG_WINDOW'
  | 'CHOOSE_BLOCKER'
  | 'FRENZY_ATTACK'
  | 'ABILITY_TARGET'
  | 'GAME_OVER';

export interface PlayerState {
  id: string;
  name: string;
  handCount: number;
  hand?: CardDef[];
  inPlay: CreatureInPlay[];
  deckCount: number;
  mindbugsRemaining: number;
  life: number;
}

export interface ClientGameState {
  gameId: string;
  phase: GamePhase;
  players: [PlayerState, PlayerState];
  activePlayerIndex: 0 | 1;
  pendingCard?: {
    card: CreatureInPlay;
    playedByIndex: 0 | 1;
  };
  pendingAttack?: {
    attackerInstanceId: string;
    attackerIndex: 0 | 1;
    forcedBlockerInstanceId?: string;
  };
  frenzyCreatureInstanceId?: string;
  abilityTargetPrompt?: {
    effect: AbilityEffect;
    forPlayerIndex: 0 | 1;
    eligibleTargets: string[];
  };
  lastEvent: string;
  winner?: string;
  winnerName?: string;
}
