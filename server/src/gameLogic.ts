import { v4 as uuidv4 } from 'uuid';
import { ALL_CARDS, shuffleDeck } from './cards';
import {
  CardDef,
  ClientGameState,
  CreatureInPlay,
  GamePhase,
  PlayerState,
  ServerGameState,
  ServerPlayerState,
} from './types';

export class GameRoom {
  public serverState: ServerGameState;
  private socketIds: [string, string];
  public cpuPlayerIndex: 0 | 1 | null = null;
  public cpuTimerId: ReturnType<typeof setTimeout> | undefined;

  constructor(
    gameId: string,
    player0Id: string, player0Name: string,
    player1Id: string, player1Name: string,
    socketId0: string, socketId1: string,
    deckOverride?: CardDef[],
  ) {
    this.socketIds = [socketId0, socketId1];

    // Use custom deck if provided, otherwise shuffle standard cards
    const shuffled = deckOverride ?? shuffleDeck(ALL_CARDS);
    const p0Cards = shuffled.slice(0, 10);
    const p1Cards = shuffled.slice(10, 20);

    const player0: ServerPlayerState = {
      id: player0Id,
      name: player0Name,
      hand: p0Cards.slice(0, 5),
      deck: p0Cards.slice(5),
      inPlay: [],
      mindbugsRemaining: 2,
      life: 3,
    };

    const player1: ServerPlayerState = {
      id: player1Id,
      name: player1Name,
      hand: p1Cards.slice(0, 5),
      deck: p1Cards.slice(5),
      inPlay: [],
      mindbugsRemaining: 2,
      life: 3,
    };

    this.serverState = {
      gameId,
      phase: 'PLAYER_TURN',
      players: [player0, player1],
      activePlayerIndex: 0,
      lastEvent: `Game started! ${player0Name} goes first.`,
    };
  }

  getSocketId(playerIndex: 0 | 1): string {
    return this.socketIds[playerIndex];
  }

  getClientState(playerIndex: 0 | 1): ClientGameState {
    const s = this.serverState;
    const players: [PlayerState, PlayerState] = [
      {
        id: s.players[0].id,
        name: s.players[0].name,
        handCount: s.players[0].hand.length,
        hand: playerIndex === 0 ? s.players[0].hand : undefined,
        inPlay: s.players[0].inPlay,
        deckCount: s.players[0].deck.length,
        mindbugsRemaining: s.players[0].mindbugsRemaining,
        life: s.players[0].life,
      },
      {
        id: s.players[1].id,
        name: s.players[1].name,
        handCount: s.players[1].hand.length,
        hand: playerIndex === 1 ? s.players[1].hand : undefined,
        inPlay: s.players[1].inPlay,
        deckCount: s.players[1].deck.length,
        mindbugsRemaining: s.players[1].mindbugsRemaining,
        life: s.players[1].life,
      },
    ];

    return {
      gameId: s.gameId,
      phase: s.phase,
      players,
      activePlayerIndex: s.activePlayerIndex,
      pendingCard: s.pendingCard
        ? { card: s.pendingCard.card, playedByIndex: s.pendingCard.playedByIndex }
        : undefined,
      pendingAttack: s.pendingAttack,
      frenzyCreatureInstanceId: s.frenzyCreatureInstanceId,
      abilityTargetPrompt: s.abilityTargetPrompt
        ? {
            effect: s.abilityTargetPrompt.effect,
            forPlayerIndex: s.abilityTargetPrompt.forPlayerIndex,
            eligibleTargets: s.abilityTargetPrompt.eligibleTargets,
          }
        : undefined,
      lastEvent: s.lastEvent,
      winner: s.winner,
      winnerName: s.winnerName,
    };
  }

  private drawCard(playerIndex: 0 | 1): void {
    const player = this.serverState.players[playerIndex];
    if (player.deck.length > 0) {
      const card = player.deck.shift()!;
      player.hand.push(card);
    }
  }

  private drawUpToFive(playerIndex: 0 | 1): void {
    const player = this.serverState.players[playerIndex];
    while (player.hand.length < 5 && player.deck.length > 0) {
      this.drawCard(playerIndex);
    }
  }

  private getAllCreaturesInPlay(): CreatureInPlay[] {
    return [
      ...this.serverState.players[0].inPlay,
      ...this.serverState.players[1].inPlay,
    ];
  }

  private findCreatureByInstanceId(instanceId: string): { creature: CreatureInPlay; ownerIndex: 0 | 1 } | null {
    for (let i = 0; i <= 1; i++) {
      const idx = i as 0 | 1;
      const creature = this.serverState.players[idx].inPlay.find(c => c.instanceId === instanceId);
      if (creature) return { creature, ownerIndex: idx };
    }
    return null;
  }

  private removeCreatureFromPlay(instanceId: string): CreatureInPlay | null {
    for (let i = 0; i <= 1; i++) {
      const idx = i as 0 | 1;
      const player = this.serverState.players[idx];
      const index = player.inPlay.findIndex(c => c.instanceId === instanceId);
      if (index !== -1) {
        const [creature] = player.inPlay.splice(index, 1);
        return creature;
      }
    }
    return null;
  }

  private defeatCreature(creature: CreatureInPlay): void {
    const ownerIndex = creature.controllerIndex;
    this.removeCreatureFromPlay(creature.instanceId);

    if (creature.ability?.trigger === 'DEFEATED') {
      const effect = creature.ability.effect;
      if (effect === 'DRAW_CARD') {
        this.drawCard(ownerIndex);
        this.serverState.lastEvent += ` ${creature.name}'s DEFEATED ability: drew a card.`;
      } else if (effect === 'GAIN_LIFE') {
        this.serverState.players[ownerIndex].life += 1;
        this.serverState.lastEvent += ` ${creature.name}'s DEFEATED ability: gained 1 life.`;
      } else if (effect === 'RETURN_TO_HAND') {
        // Return the card to owner's hand
        const cardDef: CardDef = {
          id: creature.cardId,
          name: creature.name,
          power: creature.power,
          keywords: creature.keywords,
          ability: creature.ability,
        };
        this.serverState.players[ownerIndex].hand.push(cardDef);
        this.serverState.lastEvent += ` ${creature.name}'s DEFEATED ability: returned to hand.`;
      }
    }
  }

  private checkWinCondition(): boolean {
    const s = this.serverState;
    for (let i = 0; i <= 1; i++) {
      const idx = i as 0 | 1;
      if (s.players[idx].life <= 0) {
        const winnerIndex = (1 - idx) as 0 | 1;
        s.phase = 'GAME_OVER';
        s.winner = s.players[winnerIndex].id;
        s.winnerName = s.players[winnerIndex].name;
        s.lastEvent = `${s.players[winnerIndex].name} wins! ${s.players[idx].name} has been defeated.`;
        return true;
      }
    }
    return false;
  }

  private endTurnAfterAction(): void {
    const s = this.serverState;
    s.frenzyCreatureInstanceId = undefined;
    s.pendingAttack = undefined;
    this.drawUpToFive(s.activePlayerIndex);
    s.activePlayerIndex = (1 - s.activePlayerIndex) as 0 | 1;
    s.phase = 'PLAYER_TURN';
  }

  private resolveCombat(attackerInstanceId: string, blockerInstanceId: string | null): void {
    const s = this.serverState;
    const attackerData = this.findCreatureByInstanceId(attackerInstanceId);
    if (!attackerData) return;

    const attacker = attackerData.creature;
    const attackerOwnerIndex = attackerData.ownerIndex;
    const defenderIndex = (1 - attackerOwnerIndex) as 0 | 1;

    if (!blockerInstanceId) {
      // Direct hit to defender
      s.players[defenderIndex].life -= 1;
      s.lastEvent = `${attacker.name} attacked directly! ${s.players[defenderIndex].name} takes 1 damage (${s.players[defenderIndex].life} life remaining).`;

      if (this.checkWinCondition()) return;

      if (attacker.keywords.includes('FRENZY')) {
        s.frenzyCreatureInstanceId = attacker.instanceId;
        s.phase = 'FRENZY_ATTACK';
        s.lastEvent += ` FRENZY: ${attacker.name} can attack again!`;
      } else {
        this.endTurnAfterAction();
      }
      return;
    }

    const blockerData = this.findCreatureByInstanceId(blockerInstanceId);
    if (!blockerData) return;
    const blocker = blockerData.creature;

    s.lastEvent = `${attacker.name} (${attacker.power}) attacks ${blocker.name} (${blocker.power}).`;

    let attackerDefeated = false;
    let blockerDefeated = false;

    if (attacker.power > blocker.power) {
      blockerDefeated = true;
    } else if (blocker.power > attacker.power) {
      attackerDefeated = true;
    } else {
      attackerDefeated = true;
      blockerDefeated = true;
    }

    // POISONOUS: if attacker is poisonous and blocker survives → blocker also defeated
    if (attacker.keywords.includes('POISONOUS') && !blockerDefeated) {
      blockerDefeated = true;
      s.lastEvent += ` POISONOUS: ${blocker.name} is poisoned!`;
    }
    // POISONOUS: if blocker is poisonous and attacker survives → attacker also defeated
    if (blocker.keywords.includes('POISONOUS') && !attackerDefeated) {
      attackerDefeated = true;
      s.lastEvent += ` POISONOUS: ${attacker.name} is poisoned!`;
    }

    // TOUGH handling for blocker
    if (blockerDefeated && blocker.keywords.includes('TOUGH')) {
      if (!blocker.isDamaged) {
        blocker.isDamaged = true;
        blockerDefeated = false;
        s.lastEvent += ` TOUGH: ${blocker.name} survives first hit (now damaged)!`;
      }
    }
    // TOUGH handling for attacker
    if (attackerDefeated && attacker.keywords.includes('TOUGH')) {
      if (!attacker.isDamaged) {
        attacker.isDamaged = true;
        attackerDefeated = false;
        s.lastEvent += ` TOUGH: ${attacker.name} survives first hit (now damaged)!`;
      }
    }

    if (blockerDefeated) {
      this.defeatCreature(blocker);
      s.lastEvent += ` ${blocker.name} is defeated!`;
    }
    if (attackerDefeated) {
      this.defeatCreature(attacker);
      s.lastEvent += ` ${attacker.name} is defeated!`;
    }

    if (this.checkWinCondition()) return;

    // FRENZY: if attacker survived, it can attack again
    if (!attackerDefeated && attacker.keywords.includes('FRENZY')) {
      s.frenzyCreatureInstanceId = attacker.instanceId;
      s.phase = 'FRENZY_ATTACK';
      s.lastEvent += ` FRENZY: ${attacker.name} can attack again!`;
    } else {
      this.endTurnAfterAction();
    }
  }

  private triggerPlayAbility(creature: CreatureInPlay, playerIndex: 0 | 1): boolean {
    const s = this.serverState;
    if (!creature.ability || creature.ability.trigger !== 'PLAY') return false;

    const effect = creature.ability.effect;

    if (effect === 'DRAW_CARD') {
      this.drawCard(playerIndex);
      s.lastEvent += ` ${creature.name}'s PLAY ability: drew a card.`;
      return false; // No targeting needed
    } else if (effect === 'GAIN_LIFE') {
      s.players[playerIndex].life += 1;
      s.lastEvent += ` ${creature.name}'s PLAY ability: gained 1 life.`;
      return false;
    } else if (effect === 'DIRECT_DAMAGE') {
      const opponentIndex = (1 - playerIndex) as 0 | 1;
      s.players[opponentIndex].life -= 1;
      s.lastEvent += ` ${creature.name}'s PLAY ability: dealt 1 damage to opponent.`;
      return false;
    } else if (effect === 'DAMAGE_CREATURE') {
      // Need to pick a target
      const allCreatures = this.getAllCreaturesInPlay();
      if (allCreatures.length === 0) {
        s.lastEvent += ` ${creature.name}'s PLAY ability: no targets available.`;
        return false;
      }
      s.phase = 'ABILITY_TARGET';
      s.abilityTargetPrompt = {
        effect: 'DAMAGE_CREATURE',
        forPlayerIndex: playerIndex,
        eligibleTargets: allCreatures.map(c => c.instanceId),
        pendingCreature: creature,
      };
      s.lastEvent += ` ${creature.name}'s PLAY ability: choose a target creature to damage.`;
      return true; // Waiting for target
    } else if (effect === 'COPY_CREATURE') {
      // Need to pick a target (any creature in play except self)
      const allCreatures = this.getAllCreaturesInPlay().filter(c => c.instanceId !== creature.instanceId);
      if (allCreatures.length === 0) {
        s.lastEvent += ` ${creature.name}'s PLAY ability: no creatures to copy.`;
        return false;
      }
      s.phase = 'ABILITY_TARGET';
      s.abilityTargetPrompt = {
        effect: 'COPY_CREATURE',
        forPlayerIndex: playerIndex,
        eligibleTargets: allCreatures.map(c => c.instanceId),
        pendingCreature: creature,
      };
      s.lastEvent += ` ${creature.name}'s PLAY ability: choose a creature to copy.`;
      return true; // Waiting for target
    } else if (effect === 'WIPE_WEAK') {
      const allCreatures = this.getAllCreaturesInPlay();
      const weak = allCreatures.filter(c => c.power <= 4);
      for (const c of weak) {
        this.defeatCreature(c);
      }
      s.lastEvent += ` ${creature.name}'s PLAY ability: defeated all creatures with power 4 or less (${weak.length} creatures).`;
      return false;
    }

    return false;
  }

  playCard(playerIndex: 0 | 1, handIndex: number): string | null {
    const s = this.serverState;

    if (s.phase !== 'PLAYER_TURN') {
      return 'Not in player turn phase.';
    }
    if (s.activePlayerIndex !== playerIndex) {
      return 'Not your turn.';
    }

    const player = s.players[playerIndex];
    if (handIndex < 0 || handIndex >= player.hand.length) {
      return 'Invalid hand index.';
    }

    const card = player.hand[handIndex];
    player.hand.splice(handIndex, 1);

    // Create creature instance
    const creature: CreatureInPlay = {
      instanceId: uuidv4(),
      cardId: card.id,
      name: card.name,
      power: card.power,
      keywords: [...card.keywords],
      ability: card.ability,
      isDamaged: false,
      controllerIndex: playerIndex,
    };

    s.lastEvent = `${player.name} played ${card.name} (Power: ${card.power}).`;

    // Check if opponent has mindbugs
    const opponentIndex = (1 - playerIndex) as 0 | 1;
    const opponent = s.players[opponentIndex];

    if (opponent.mindbugsRemaining > 0) {
      // Mindbug window
      s.phase = 'MINDBUG_WINDOW';
      s.pendingCard = {
        card: creature,
        playedByIndex: playerIndex,
        opponentResponded: false,
      };
      s.lastEvent += ` Waiting for ${opponent.name} to decide on Mindbug...`;
    } else {
      // No mindbug available, put card into play immediately
      player.inPlay.push(creature);
      const needsTarget = this.triggerPlayAbility(creature, playerIndex);
      if (!needsTarget) {
        if (!this.checkWinCondition()) this.endTurnAfterAction();
      }
    }

    return null;
  }

  respondToMindbug(playerIndex: 0 | 1, use: boolean): string | null {
    const s = this.serverState;

    if (s.phase !== 'MINDBUG_WINDOW') {
      return 'Not in mindbug window phase.';
    }

    if (!s.pendingCard) {
      return 'No pending card.';
    }

    const playedByIndex = s.pendingCard.playedByIndex;
    const opponentIndex = (1 - playedByIndex) as 0 | 1;

    // Only the opponent of the active player can respond
    if (playerIndex !== opponentIndex) {
      return 'You cannot respond to your own played card.';
    }

    if (s.players[playerIndex].mindbugsRemaining <= 0) {
      return 'No mindbugs remaining.';
    }

    const pendingCard = s.pendingCard;
    s.pendingCard = undefined;

    if (s.mindbugTimer) { clearTimeout(s.mindbugTimer); s.mindbugTimer = undefined; }

    if (use) {
      // Steal the card
      s.players[playerIndex].mindbugsRemaining -= 1;
      const creature = { ...pendingCard.card, controllerIndex: playerIndex };
      s.players[playerIndex].inPlay.push(creature);
      s.lastEvent = `${s.players[playerIndex].name} used a Mindbug! ${creature.name} now belongs to ${s.players[playerIndex].name}!`;

      // Trigger PLAY ability for the new controller
      const needsTarget = this.triggerPlayAbility(creature, playerIndex);
      if (!needsTarget) {
        if (!this.checkWinCondition()) this.endTurnAfterAction();
      }
    } else {
      // Pass on mindbug - card goes to original player
      const creature = pendingCard.card;
      s.players[playedByIndex].inPlay.push(creature);
      s.lastEvent = `${s.players[opponentIndex].name} passed on Mindbug. ${creature.name} enters play for ${s.players[playedByIndex].name}.`;

      const needsTarget = this.triggerPlayAbility(creature, playedByIndex);
      if (!needsTarget) {
        if (!this.checkWinCondition()) this.endTurnAfterAction();
      }
    }

    return null;
  }

  setMindbugTimer(callback: () => void): void {
    const s = this.serverState;
    if (s.mindbugTimer) {
      clearTimeout(s.mindbugTimer);
    }
    s.mindbugTimer = setTimeout(callback, 15000);
  }

  clearMindbugTimer(): void {
    const s = this.serverState;
    if (s.mindbugTimer) {
      clearTimeout(s.mindbugTimer);
      s.mindbugTimer = undefined;
    }
  }

  autoPassMindbug(): void {
    const s = this.serverState;
    if (s.phase !== 'MINDBUG_WINDOW' || !s.pendingCard) return;

    const pendingCard = s.pendingCard;
    const playedByIndex = pendingCard.playedByIndex;
    const opponentIndex = (1 - playedByIndex) as 0 | 1;
    s.pendingCard = undefined;
    s.mindbugTimer = undefined;

    const creature = pendingCard.card;
    s.players[playedByIndex].inPlay.push(creature);
    s.lastEvent = `${s.players[opponentIndex].name} did not respond in time. ${creature.name} enters play for ${s.players[playedByIndex].name}.`;

    const needsTarget = this.triggerPlayAbility(creature, playedByIndex);
    if (!needsTarget) {
      if (!this.checkWinCondition()) this.endTurnAfterAction();
    }
  }

  declareAttack(playerIndex: 0 | 1, instanceId: string): string | null {
    const s = this.serverState;

    const validPhases: GamePhase[] = ['PLAYER_TURN', 'FRENZY_ATTACK'];
    if (!validPhases.includes(s.phase)) {
      return 'Cannot attack in current phase.';
    }
    if (s.activePlayerIndex !== playerIndex) {
      return 'Not your turn.';
    }

    // For FRENZY_ATTACK, only the frenzy creature can attack
    if (s.phase === 'FRENZY_ATTACK') {
      if (s.frenzyCreatureInstanceId !== instanceId) {
        return 'Only the frenzy creature can attack again.';
      }
    }

    const attackerData = this.findCreatureByInstanceId(instanceId);
    if (!attackerData || attackerData.ownerIndex !== playerIndex) {
      return 'Creature not found or not yours.';
    }

    const attacker = attackerData.creature;
    const defenderIndex = (1 - playerIndex) as 0 | 1;

    // Trigger ATTACK abilities
    if (attacker.ability?.trigger === 'ATTACK') {
      if (attacker.ability.effect === 'DIRECT_DAMAGE') {
        s.players[defenderIndex].life -= 1;
        s.lastEvent = `${attacker.name} ATTACK ability: dealt 1 damage to ${s.players[defenderIndex].name}!`;
        if (this.checkWinCondition()) return null;
      }
    }

    const defenderCreatures = s.players[defenderIndex].inPlay;

    // HUNTER mechanic: if attacker is HUNTER and defender has creatures, attacker must pick a blocker
    if (attacker.keywords.includes('HUNTER') && defenderCreatures.length > 0) {
      // HUNTER: attacker forces a specific blocker - we need the attacker to choose
      // Transition to phase where we need to pick forced blocker
      s.phase = 'ABILITY_TARGET';
      s.abilityTargetPrompt = {
        effect: 'DAMAGE_CREATURE', // Reusing this phase for HUNTER blocker selection
        forPlayerIndex: playerIndex,
        eligibleTargets: defenderCreatures.map(c => c.instanceId),
        pendingCreature: attacker,
      };
      s.pendingAttack = {
        attackerInstanceId: instanceId,
        attackerIndex: playerIndex,
      };
      s.lastEvent = `${attacker.name} (HUNTER) attacks! ${s.players[playerIndex].name}, choose which creature must block.`;
      return null;
    }

    // SNEAKY mechanic: can only be blocked by SNEAKY creatures
    const hasSneaky = attacker.keywords.includes('SNEAKY');
    const validBlockers = defenderCreatures.filter(c =>
      !hasSneaky || c.keywords.includes('SNEAKY')
    );

    if (validBlockers.length === 0) {
      // No valid blockers → unblocked attack
      s.lastEvent = `${attacker.name} attacks unblocked!${hasSneaky ? ' (SNEAKY: opponent has no SNEAKY creatures to block)' : ''}`;
      this.resolveCombat(instanceId, null);
    } else {
      // Defender must choose a blocker (or take the hit)
      s.phase = 'CHOOSE_BLOCKER';
      s.pendingAttack = {
        attackerInstanceId: instanceId,
        attackerIndex: playerIndex,
      };
      s.lastEvent = `${attacker.name} attacks! ${s.players[defenderIndex].name}, choose a blocker or take the hit.`;
    }

    return null;
  }

  selectHunterTarget(playerIndex: 0 | 1, targetInstanceId: string): string | null {
    // This is called when a HUNTER attacker chooses which creature must block
    const s = this.serverState;

    if (s.phase !== 'ABILITY_TARGET') {
      return 'Not in ability target phase.';
    }

    if (!s.abilityTargetPrompt) {
      return 'No ability target prompt.';
    }

    if (s.abilityTargetPrompt.forPlayerIndex !== playerIndex) {
      return 'Not your turn to select a target.';
    }

    if (!s.pendingAttack) {
      return 'No pending attack.';
    }

    const attackerInstanceId = s.pendingAttack.attackerInstanceId;
    const attackerData = this.findCreatureByInstanceId(attackerInstanceId);
    if (!attackerData) return 'Attacker not found.';

    if (!s.abilityTargetPrompt.eligibleTargets.includes(targetInstanceId)) {
      return 'Invalid target.';
    }

    // Set forced blocker
    s.pendingAttack.forcedBlockerInstanceId = targetInstanceId;
    s.abilityTargetPrompt = undefined;

    const defenderIndex = (1 - playerIndex) as 0 | 1;
    const targetData = this.findCreatureByInstanceId(targetInstanceId);
    if (!targetData) return 'Target not found.';

    s.phase = 'CHOOSE_BLOCKER';
    s.lastEvent = `${attackerData.creature.name} (HUNTER) forces ${targetData.creature.name} to block! ${s.players[defenderIndex].name} must block with ${targetData.creature.name}.`;

    return null;
  }

  declareBlock(playerIndex: 0 | 1, blockerInstanceId: string | null): string | null {
    const s = this.serverState;

    if (s.phase !== 'CHOOSE_BLOCKER') {
      return 'Not in choose blocker phase.';
    }

    if (!s.pendingAttack) {
      return 'No pending attack.';
    }

    const attackerIndex = s.pendingAttack.attackerIndex;
    const defenderIndex = (1 - attackerIndex) as 0 | 1;

    if (playerIndex !== defenderIndex) {
      return 'You are not the defender.';
    }

    const attackerInstanceId = s.pendingAttack.attackerInstanceId;
    const forcedBlockerInstanceId = s.pendingAttack.forcedBlockerInstanceId;

    // If there's a forced blocker (HUNTER), must use it
    if (forcedBlockerInstanceId) {
      if (blockerInstanceId !== forcedBlockerInstanceId) {
        return `HUNTER forces you to block with the chosen creature.`;
      }
    }

    const attackerData = this.findCreatureByInstanceId(attackerInstanceId);
    if (!attackerData) return 'Attacker not found.';
    const attacker = attackerData.creature;

    if (blockerInstanceId) {
      const blockerData = this.findCreatureByInstanceId(blockerInstanceId);
      if (!blockerData || blockerData.ownerIndex !== defenderIndex) {
        return 'Invalid blocker.';
      }

      // SNEAKY check
      if (attacker.keywords.includes('SNEAKY') && !blockerData.creature.keywords.includes('SNEAKY')) {
        return 'SNEAKY creatures can only be blocked by SNEAKY creatures.';
      }
    }

    s.pendingAttack = undefined;

    if (!blockerInstanceId) {
      s.lastEvent = `${s.players[defenderIndex].name} chose not to block!`;
    }

    this.resolveCombat(attackerInstanceId, blockerInstanceId);
    return null;
  }

  selectAbilityTarget(playerIndex: 0 | 1, targetInstanceId: string): string | null {
    const s = this.serverState;

    if (s.phase !== 'ABILITY_TARGET') {
      return 'Not in ability target phase.';
    }

    if (!s.abilityTargetPrompt) {
      return 'No ability target prompt.';
    }

    if (s.abilityTargetPrompt.forPlayerIndex !== playerIndex) {
      return 'Not your turn to select a target.';
    }

    // Check if this is HUNTER blocker selection (handled separately)
    if (s.pendingAttack && s.pendingAttack.attackerIndex === playerIndex) {
      return this.selectHunterTarget(playerIndex, targetInstanceId);
    }

    if (!s.abilityTargetPrompt.eligibleTargets.includes(targetInstanceId)) {
      return 'Invalid target.';
    }

    const effect = s.abilityTargetPrompt.effect;
    const targetData = this.findCreatureByInstanceId(targetInstanceId);
    if (!targetData) return 'Target not found.';

    const target = targetData.creature;
    const promptCopy = s.abilityTargetPrompt;
    s.abilityTargetPrompt = undefined;

    if (effect === 'DAMAGE_CREATURE') {
      // Check TOUGH
      if (target.keywords.includes('TOUGH') && !target.isDamaged) {
        target.isDamaged = true;
        s.lastEvent = `Ability: ${target.name} takes damage (TOUGH: now damaged).`;
      } else {
        s.lastEvent = `Ability: ${target.name} is defeated!`;
        this.defeatCreature(target);
      }
    } else if (effect === 'COPY_CREATURE') {
      // The pendingCreature (Mimic Jelly) copies the target
      // We need to find the Mimic Jelly in play
      // The jelly should be the most recently added creature for the current player
      // Find it by looking for the creature that triggered COPY_CREATURE
      const _pendingCreature = promptCopy?.pendingCreature;
      const jelly = s.players[playerIndex].inPlay.find(
        c => c.ability?.effect === 'COPY_CREATURE' || c.cardId === 'mimic-jelly'
      );

      if (jelly) {
        jelly.power = target.power;
        jelly.keywords = [...target.keywords];
        jelly.ability = target.ability ? { ...target.ability } : undefined;
        jelly.name = `${target.name} (Copy)`;
        s.lastEvent = `Mimic Jelly copies ${target.name}! Now has power ${target.power}.`;
      } else {
        s.lastEvent = `Mimic Jelly ability: could not find Jelly in play.`;
      }
    }

    if (this.checkWinCondition()) return null;
    this.endTurnAfterAction();
    return null;
  }

  endTurn(playerIndex: 0 | 1): string | null {
    const s = this.serverState;

    if (s.phase !== 'PLAYER_TURN') {
      return 'Not in player turn phase.';
    }
    if (s.activePlayerIndex !== playerIndex) {
      return 'Not your turn.';
    }

    s.lastEvent = `${s.players[playerIndex].name} ends their turn.`;
    this.endTurnAfterAction();
    return null;
  }

  // ─── CPU AI ───────────────────────────────────────────────────────────────

  cpuNeedsToAct(): boolean {
    const s = this.serverState;
    const cpu = this.cpuPlayerIndex;
    if (cpu === null) return false;
    if (s.phase === 'GAME_OVER' || s.phase === 'WAITING') return false;
    const human = (1 - cpu) as 0 | 1;
    switch (s.phase) {
      case 'PLAYER_TURN':    return s.activePlayerIndex === cpu;
      case 'FRENZY_ATTACK':  return s.activePlayerIndex === cpu;
      case 'MINDBUG_WINDOW': return s.pendingCard?.playedByIndex === human;
      case 'CHOOSE_BLOCKER': return s.pendingAttack?.attackerIndex === human;
      case 'ABILITY_TARGET': return s.abilityTargetPrompt?.forPlayerIndex === cpu;
      default: return false;
    }
  }

  performCpuAction(): void {
    const s = this.serverState;
    const cpu = this.cpuPlayerIndex!;
    const human = (1 - cpu) as 0 | 1;

    switch (s.phase) {
      case 'PLAYER_TURN':
        if (s.activePlayerIndex === cpu) this.cpuTakeTurn();
        break;
      case 'FRENZY_ATTACK':
        if (s.activePlayerIndex === cpu) {
          if (s.frenzyCreatureInstanceId) this.declareAttack(cpu, s.frenzyCreatureInstanceId);
          else this.endTurnAfterAction();
        }
        break;
      case 'MINDBUG_WINDOW':
        if (s.pendingCard?.playedByIndex === human) {
          const steal = this.cpuShouldUseMindBug(s.pendingCard.card);
          this.respondToMindbug(cpu, steal);
        }
        break;
      case 'CHOOSE_BLOCKER':
        if (s.pendingAttack?.attackerIndex === human) this.cpuChooseBlock();
        break;
      case 'ABILITY_TARGET':
        if (s.abilityTargetPrompt?.forPlayerIndex === cpu) this.cpuSelectAbilityTarget();
        break;
    }
  }

  private cpuTakeTurn(): void {
    const cpu = this.cpuPlayerIndex!;
    const human = (1 - cpu) as 0 | 1;
    const s = this.serverState;

    const attacker = this.cpuFindBestAttacker(s.players[cpu].inPlay, s.players[human].inPlay);
    if (attacker) {
      this.declareAttack(cpu, attacker.instanceId);
      return;
    }
    if (s.players[cpu].hand.length > 0) {
      this.playCard(cpu, this.cpuBestCardToPlay(s.players[cpu].hand));
      return;
    }
    this.endTurn(cpu);
  }

  private cpuFindBestAttacker(mine: CreatureInPlay[], theirs: CreatureInPlay[]): CreatureInPlay | null {
    if (mine.length === 0) return null;
    if (theirs.length === 0) return [...mine].sort((a, b) => b.power - a.power)[0];

    // SNEAKY unblocked attack
    const theirSneaky = theirs.filter(c => c.keywords.includes('SNEAKY'));
    const mySneaky = mine.filter(c => c.keywords.includes('SNEAKY'));
    if (mySneaky.length > 0 && theirSneaky.length === 0) {
      return [...mySneaky].sort((a, b) => b.power - a.power)[0];
    }

    let best: CreatureInPlay | null = null;
    let bestScore = 0;
    for (const att of mine) {
      const dominated = theirs.some(b => this.cpuBeats(b, att));
      let score = dominated ? -1 : (theirs.some(b => this.cpuBeats(att, b)) ? 3 : 1);
      if (att.keywords.includes('FRENZY')) score += 1;
      if (att.keywords.includes('HUNTER') && theirs.length > 0) score += 1;
      if (score > bestScore) { bestScore = score; best = att; }
    }
    return best;
  }

  // Returns true if `att` defeats `def` without being defeated
  private cpuBeats(att: CreatureInPlay, def: CreatureInPlay): boolean {
    if (def.keywords.includes('POISONOUS')) return false; // attacker gets poisoned if it survives
    if (att.keywords.includes('POISONOUS') && !def.keywords.includes('POISONOUS')) return true;
    const defPow = def.keywords.includes('TOUGH') && !def.isDamaged ? def.power + 0.5 : def.power;
    return att.power > defPow;
  }

  private cpuBestCardToPlay(hand: CardDef[]): number {
    let best = 0, bestScore = -Infinity;
    for (let i = 0; i < hand.length; i++) {
      const c = hand[i];
      let score = c.power;
      if (c.ability?.effect === 'WIPE_WEAK') score += 4;
      if (c.ability?.effect === 'DAMAGE_CREATURE') score += 2;
      if (c.ability?.effect === 'DRAW_CARD') score += 1;
      if (c.keywords.includes('POISONOUS')) score += 2;
      if (c.keywords.includes('FRENZY')) score += 1;
      if (c.keywords.includes('HUNTER')) score += 1;
      if (c.keywords.includes('TOUGH')) score += 1.5;
      if (score > bestScore) { bestScore = score; best = i; }
    }
    return best;
  }

  private cpuShouldUseMindBug(card: CreatureInPlay): boolean {
    const cpu = this.cpuPlayerIndex!;
    if (this.serverState.players[cpu].mindbugsRemaining <= 0) return false;
    if (card.power >= 8) return true;
    if (card.power >= 7 && (card.keywords.length > 0 || card.ability)) return true;
    if (card.ability?.effect === 'WIPE_WEAK') return true;
    if (card.ability?.effect === 'DAMAGE_CREATURE' && card.power >= 6) return true;
    const strong = card.keywords.filter(k => ['POISONOUS', 'FRENZY', 'HUNTER'].includes(k));
    return strong.length >= 2 && card.power >= 5;
  }

  private cpuChooseBlock(): void {
    const cpu = this.cpuPlayerIndex!;
    const human = (1 - cpu) as 0 | 1;
    const s = this.serverState;
    if (!s.pendingAttack) return;

    const forcedId = s.pendingAttack.forcedBlockerInstanceId;
    if (forcedId) { this.declareBlock(cpu, forcedId); return; }

    const atkData = this.findCreatureByInstanceId(s.pendingAttack.attackerInstanceId);
    if (!atkData) { this.declareBlock(cpu, null); return; }
    const atk = atkData.creature;
    const valid = atk.keywords.includes('SNEAKY')
      ? s.players[cpu].inPlay.filter(c => c.keywords.includes('SNEAKY'))
      : s.players[cpu].inPlay;

    if (valid.length === 0) { this.declareBlock(cpu, null); return; }

    // Must block to survive
    if (s.players[cpu].life <= 1) {
      const weakest = [...valid].sort((a, b) => a.power - b.power)[0];
      this.declareBlock(cpu, weakest.instanceId);
      return;
    }
    // Block with weakest winning blocker
    const winning = valid.filter(b => this.cpuBeats(b, atk));
    if (winning.length > 0) {
      const weakest = [...winning].sort((a, b) => a.power - b.power)[0];
      this.declareBlock(cpu, weakest.instanceId);
      return;
    }
    this.declareBlock(cpu, null);
  }

  private cpuSelectAbilityTarget(): void {
    const cpu = this.cpuPlayerIndex!;
    const human = (1 - cpu) as 0 | 1;
    const s = this.serverState;
    const prompt = s.abilityTargetPrompt;
    if (!prompt || prompt.eligibleTargets.length === 0) return;

    const resolve = (id: string) => this.selectAbilityTarget(cpu, id);
    const creatures = (ids: string[]) =>
      ids.map(id => ({ id, d: this.findCreatureByInstanceId(id) })).filter(x => !!x.d) as
        { id: string; d: { creature: CreatureInPlay; ownerIndex: 0 | 1 } }[];

    // HUNTER: choose which enemy creature must block
    if (s.pendingAttack?.attackerIndex === cpu) {
      const atkData = this.findCreatureByInstanceId(s.pendingAttack.attackerInstanceId);
      const all = creatures(prompt.eligibleTargets);
      const beatable = atkData ? all.filter(x => this.cpuBeats(atkData.creature, x.d.creature)) : [];
      const pick = beatable.length > 0
        ? beatable.sort((a, b) => b.d.creature.power - a.d.creature.power)[0]
        : all.sort((a, b) => a.d.creature.power - b.d.creature.power)[0];
      resolve(pick.id);
      return;
    }

    if (prompt.effect === 'DAMAGE_CREATURE') {
      const enemies = creatures(prompt.eligibleTargets).filter(x => x.d.ownerIndex === human);
      const pick = enemies.length > 0
        ? enemies.sort((a, b) => b.d.creature.power - a.d.creature.power)[0].id
        : prompt.eligibleTargets[0];
      resolve(pick);
      return;
    }

    if (prompt.effect === 'COPY_CREATURE') {
      const all = creatures(prompt.eligibleTargets);
      const pick = all.length > 0
        ? all.sort((a, b) => b.d.creature.power - a.d.creature.power)[0].id
        : prompt.eligibleTargets[0];
      resolve(pick);
      return;
    }

    resolve(prompt.eligibleTargets[0]);
  }
}
