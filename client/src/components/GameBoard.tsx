import { useEffect, useState } from 'react';
import socket from '../socket';
import { ClientGameState, CreatureInPlay } from '../types';
import CardComponent from './CardComponent';
import CreatureInPlayComponent from './CreatureInPlayComponent';
import GameLog from './GameLog';

interface GameBoardProps {
  gameState: ClientGameState;
  playerIndex: 0 | 1;
  playerId: string;
  error: string | null;
  onPlayAgain: () => void;
}

export default function GameBoard({ gameState, playerIndex, playerId, error, onPlayAgain }: GameBoardProps) {
  const [mindbugTimeLeft, setMindbugTimeLeft] = useState(15);
  const opponentIndex = (1 - playerIndex) as 0 | 1;

  const me = gameState.players[playerIndex];
  const opponent = gameState.players[opponentIndex];

  const isMyTurn = gameState.activePlayerIndex === playerIndex;
  const phase = gameState.phase;

  // Mindbug timer countdown
  useEffect(() => {
    if (phase === 'MINDBUG_WINDOW' && gameState.pendingCard?.playedByIndex !== playerIndex) {
      setMindbugTimeLeft(15);
      const interval = setInterval(() => {
        setMindbugTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [phase, gameState.pendingCard?.playedByIndex, playerIndex]);

  // --- Action handlers ---

  const handlePlayCard = (handIndex: number) => {
    socket.emit('play_card', { handIndex });
  };

  const handleDeclareAttack = (instanceId: string) => {
    socket.emit('declare_attack', { instanceId });
  };

  const handleDeclareBlock = (instanceId: string | null) => {
    socket.emit('declare_block', { instanceId });
  };

  const handleMindbugResponse = (use: boolean) => {
    socket.emit('mindbug_response', { use });
  };

  const handleSelectAbilityTarget = (instanceId: string) => {
    socket.emit('select_ability_target', { instanceId });
  };

  const handleEndTurn = () => {
    socket.emit('end_turn', {});
  };

  // --- Determine interactivity ---

  // Can I play cards from hand?
  const canPlayCards = phase === 'PLAYER_TURN' && isMyTurn;

  // Can I attack with my creatures?
  const canAttack = (phase === 'PLAYER_TURN' || phase === 'FRENZY_ATTACK') && isMyTurn;

  // Which creatures can I attack with?
  const getAttackableCreatures = (): Set<string> => {
    if (!canAttack) return new Set();
    if (phase === 'FRENZY_ATTACK' && gameState.frenzyCreatureInstanceId) {
      return new Set([gameState.frenzyCreatureInstanceId]);
    }
    return new Set(me.inPlay.map(c => c.instanceId));
  };

  const attackableCreatures = getAttackableCreatures();

  // Can I block? (opponent declared attack, I'm defender)
  const canBlock = phase === 'CHOOSE_BLOCKER' && !isMyTurn;
  const forcedBlockerId = gameState.pendingAttack?.forcedBlockerInstanceId;

  // Ability target selection
  const isAbilityTargetPhase = phase === 'ABILITY_TARGET';
  const abilityPrompt = gameState.abilityTargetPrompt;
  const isMyAbilityTarget = isAbilityTargetPhase && abilityPrompt?.forPlayerIndex === playerIndex;

  // Is it HUNTER selection (attacker selects forced blocker)?
  const isHunterSelection = isAbilityTargetPhase &&
    gameState.pendingAttack?.attackerIndex === playerIndex &&
    abilityPrompt?.forPlayerIndex === playerIndex;

  // Eligible targets
  const eligibleTargetIds = isAbilityTargetPhase && abilityPrompt
    ? new Set(abilityPrompt.eligibleTargets)
    : new Set<string>();

  // Is a creature selectable in MY play area?
  const isMyCreatureSelectable = (creature: CreatureInPlay): boolean => {
    if (canAttack && attackableCreatures.has(creature.instanceId)) return true;
    if (isMyAbilityTarget && eligibleTargetIds.has(creature.instanceId)) return true;
    if (canBlock && !forcedBlockerId && eligibleTargetIds.size === 0) {
      // Normal block - my creatures are the blockers
      return true;
    }
    return false;
  };

  // Is an opponent creature selectable?
  const isOpponentCreatureSelectable = (creature: CreatureInPlay): boolean => {
    if (canBlock) {
      if (forcedBlockerId) return false; // forced blocker is in MY area conceptually... wait
      // Actually the blocker is in defender's area (me), not opponent
      // But HUNTER forces blocker selection from OPPONENT's creatures by ATTACKER
      // So if isHunterSelection: opponent's creatures are selectable by me (attacker)
      return false;
    }
    if (isHunterSelection && eligibleTargetIds.has(creature.instanceId)) return true;
    if (isMyAbilityTarget && !isHunterSelection && eligibleTargetIds.has(creature.instanceId)) return true;
    return false;
  };

  const handleMyCreatureClick = (creature: CreatureInPlay) => {
    if (canAttack && attackableCreatures.has(creature.instanceId)) {
      handleDeclareAttack(creature.instanceId);
    } else if (canBlock && !forcedBlockerId) {
      handleDeclareBlock(creature.instanceId);
    } else if (isMyAbilityTarget && eligibleTargetIds.has(creature.instanceId)) {
      handleSelectAbilityTarget(creature.instanceId);
    }
  };

  const handleOpponentCreatureClick = (creature: CreatureInPlay) => {
    if (isHunterSelection && eligibleTargetIds.has(creature.instanceId)) {
      handleSelectAbilityTarget(creature.instanceId);
    } else if (isMyAbilityTarget && !isHunterSelection && eligibleTargetIds.has(creature.instanceId)) {
      handleSelectAbilityTarget(creature.instanceId);
    }
  };

  // Should I block with forced creature?
  const isMustBlockWithForced = canBlock && forcedBlockerId;

  // Life color helper
  const lifeColor = (life: number) => {
    if (life >= 3) return 'life-high';
    if (life === 2) return 'life-med';
    return 'life-low';
  };

  // Current phase description
  const getPhaseLabel = (): string => {
    switch (phase) {
      case 'WAITING': return 'Waiting for opponent...';
      case 'PLAYER_TURN': return isMyTurn ? 'Your Turn' : `${opponent.name}'s Turn`;
      case 'MINDBUG_WINDOW': return 'Mindbug Window';
      case 'CHOOSE_BLOCKER': return isMyTurn ? 'Opponent is choosing a blocker...' : 'Choose a Blocker';
      case 'FRENZY_ATTACK': return isMyTurn ? 'FRENZY! Attack Again' : `${opponent.name} FRENZY Attack...`;
      case 'ABILITY_TARGET': return isMyAbilityTarget ? 'Select a Target' : 'Opponent selecting target...';
      case 'GAME_OVER': return 'Game Over';
      default: return phase;
    }
  };

  // Get instruction text
  const getInstruction = (): string | null => {
    if (phase === 'PLAYER_TURN' && isMyTurn) {
      return 'Choose: Play a card from hand, attack with a creature, or End Turn.';
    }
    if (phase === 'FRENZY_ATTACK' && isMyTurn) {
      return 'Your FRENZY creature may attack again! Click it to attack, or End Turn.';
    }
    if (phase === 'CHOOSE_BLOCKER' && !isMyTurn) {
      if (forcedBlockerId) {
        const forced = me.inPlay.find(c => c.instanceId === forcedBlockerId);
        return `HUNTER forces you to block with ${forced?.name ?? 'a creature'}! Click it to block.`;
      }
      return 'Choose a creature to block with, or click "Take the Hit" to lose 1 life.';
    }
    if (isHunterSelection) {
      return `Your HUNTER creature attacks! Choose which enemy creature must block.`;
    }
    if (isMyAbilityTarget && abilityPrompt) {
      if (abilityPrompt.effect === 'DAMAGE_CREATURE') return 'Choose a creature to deal 1 damage to.';
      if (abilityPrompt.effect === 'COPY_CREATURE') return 'Choose a creature for Mimic Jelly to copy.';
    }
    return null;
  };

  const instruction = getInstruction();

  // Mindbug window logic
  const isMindBugWindow = phase === 'MINDBUG_WINDOW';
  const isMindBugOpponent = isMindBugWindow && gameState.pendingCard?.playedByIndex === playerIndex;
  const canUseMindBug = isMindBugWindow &&
    gameState.pendingCard?.playedByIndex !== playerIndex &&
    me.mindbugsRemaining > 0;

  return (
    <div className="game-board">
      {/* Opponent area */}
      <div className="player-section opponent">
        <div className="player-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span className={`player-name ${gameState.activePlayerIndex === opponentIndex ? 'active' : ''}`}>
              {gameState.activePlayerIndex === opponentIndex ? '▶ ' : ''}{opponent.name}
            </span>
            {gameState.activePlayerIndex === opponentIndex && (
              <span className={`phase-indicator phase-${phase}`}>
                {getPhaseLabel()}
              </span>
            )}
          </div>
          <div className="player-stats">
            <div className="stat-item">
              <span className="stat-icon">❤️</span>
              <span className={`stat-value ${lifeColor(opponent.life)}`}>{opponent.life}</span>
            </div>
            <div className="stat-item">
              <span className="stat-icon">🧠</span>
              <span className="stat-value mindbug-count">{opponent.mindbugsRemaining}</span>
            </div>
            <div className="stat-item">
              <span className="stat-icon">🃏</span>
              <span className="stat-value deck-count">{opponent.handCount} hand / {opponent.deckCount} deck</span>
            </div>
          </div>
        </div>

        {/* Opponent's face-down hand */}
        <div className="hand-area">
          <div className="hand-label">Hand (face-down)</div>
          {Array.from({ length: opponent.handCount }).map((_, i) => (
            <div key={i} className="card-back">🂠</div>
          ))}
          {opponent.handCount === 0 && (
            <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontStyle: 'italic' }}>Empty hand</span>
          )}
        </div>

        {/* Opponent's play area */}
        <div>
          <div className="play-area-label" style={{ paddingLeft: '8px', paddingBottom: '4px' }}>Battlefield</div>
          <div className="play-area">
            {opponent.inPlay.length === 0 ? (
              <div className="empty-play">No creatures in play</div>
            ) : (
              opponent.inPlay.map(creature => (
                <CreatureInPlayComponent
                  key={creature.instanceId}
                  creature={creature}
                  isSelectable={isOpponentCreatureSelectable(creature)}
                  isForcedBlocker={
                    phase === 'CHOOSE_BLOCKER' &&
                    !!forcedBlockerId &&
                    creature.instanceId === gameState.pendingAttack?.attackerInstanceId
                  }
                  onClick={() => handleOpponentCreatureClick(creature)}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Center panel */}
      <div className="center-panel">
        {/* Phase + instructions */}
        <div className="game-status">
          {(!gameState.activePlayerIndex || gameState.activePlayerIndex === playerIndex) ? null : null}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', justifyContent: 'center', flexWrap: 'wrap' }}>
            {isMyTurn && (
              <span className={`phase-indicator phase-${phase}`}>
                {getPhaseLabel()}
              </span>
            )}
          </div>
          {instruction && (
            <div className="selector-text" style={{ marginTop: '6px' }}>{instruction}</div>
          )}
        </div>

        {/* Action buttons */}
        <div className="action-buttons">
          {/* End turn button */}
          {(phase === 'PLAYER_TURN' || phase === 'FRENZY_ATTACK') && isMyTurn && (
            <button className="btn btn-gold" onClick={handleEndTurn}>
              End Turn
            </button>
          )}

          {/* Take the hit button (no block) */}
          {canBlock && !isMustBlockWithForced && (
            <button className="btn btn-danger" onClick={() => handleDeclareBlock(null)}>
              Take the Hit (-1 life)
            </button>
          )}

          {/* Force block with forced creature */}
          {isMustBlockWithForced && (() => {
            const forced = me.inPlay.find(c => c.instanceId === forcedBlockerId);
            return forced ? (
              <button className="btn btn-danger" onClick={() => handleDeclareBlock(forcedBlockerId!)}>
                Block with {forced.name}
              </button>
            ) : null;
          })()}
        </div>

        {/* Error display */}
        {error && (
          <div style={{ color: 'var(--red)', fontSize: '0.85rem', padding: '4px 12px', background: 'rgba(239,68,68,0.1)', borderRadius: '6px', border: '1px solid rgba(239,68,68,0.3)' }}>
            {error}
          </div>
        )}

        {/* Mindbug window for active player */}
        {isMindBugOpponent && (
          <div className="mindbug-waiting">
            🧠 Waiting for {opponent.name} to decide on Mindbug...
          </div>
        )}

        {/* Game log */}
        <GameLog lastEvent={gameState.lastEvent} />
      </div>

      {/* My play area */}
      <div className="player-section self">
        {/* My battlefield */}
        <div>
          <div className="play-area-label" style={{ paddingLeft: '8px', paddingBottom: '4px' }}>My Battlefield</div>
          <div className="play-area">
            {me.inPlay.length === 0 ? (
              <div className="empty-play">No creatures in play</div>
            ) : (
              me.inPlay.map(creature => {
                const isAttacker = gameState.pendingAttack?.attackerInstanceId === creature.instanceId;
                const isFrenzy = gameState.frenzyCreatureInstanceId === creature.instanceId;
                const selectable = isMyCreatureSelectable(creature);

                return (
                  <CreatureInPlayComponent
                    key={creature.instanceId}
                    creature={creature}
                    isSelectable={selectable}
                    isAttacker={isAttacker}
                    isFrenzyAttacker={isFrenzy && phase === 'FRENZY_ATTACK'}
                    isForcedBlocker={canBlock && !!forcedBlockerId && creature.instanceId === forcedBlockerId}
                    onClick={() => handleMyCreatureClick(creature)}
                  />
                );
              })
            )}
          </div>
        </div>

        {/* My hand */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div className="player-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className={`player-name ${isMyTurn ? 'active' : ''}`}>
                  {isMyTurn ? '▶ ' : ''}You ({me.name})
                </span>
                {isMyTurn && (
                  <span className={`phase-indicator phase-${phase}`} style={{ fontSize: '0.7rem' }}>
                    Your Turn
                  </span>
                )}
              </div>
              <div className="player-stats">
                <div className="stat-item">
                  <span className="stat-icon">❤️</span>
                  <span className={`stat-value ${lifeColor(me.life)}`}>{me.life}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-icon">🧠</span>
                  <span className="stat-value mindbug-count">{me.mindbugsRemaining}</span>
                </div>
                <div className="stat-item">
                  <span className="stat-icon">📚</span>
                  <span className="stat-value deck-count">{me.deckCount} deck</span>
                </div>
              </div>
            </div>
          </div>

          <div className="hand-area">
            <div className="hand-label">
              Hand ({me.hand?.length ?? me.handCount} cards)
              {canPlayCards && <span style={{ color: 'var(--green)', marginLeft: '8px' }}>— Click a card to play it</span>}
            </div>
            {(me.hand ?? []).map((card, i) => (
              <CardComponent
                key={`${card.id}-${i}`}
                card={card}
                isPlayable={canPlayCards}
                onClick={() => handlePlayCard(i)}
              />
            ))}
            {(me.hand?.length ?? 0) === 0 && (
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem', fontStyle: 'italic' }}>No cards in hand</span>
            )}
          </div>
        </div>
      </div>

      {/* Mindbug decision overlay */}
      {canUseMindBug && gameState.pendingCard && (
        <div className="mindbug-overlay">
          <div className="mindbug-modal">
            <div className="mindbug-title">🧠 Mindbug!</div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>
              {opponent.name} is playing a card. Use a Mindbug to steal it?
            </p>

            <div className="timer-bar-container">
              <div className="timer-bar" style={{ width: `${(mindbugTimeLeft / 15) * 100}%` }} />
            </div>
            <div className="mindbug-timer">
              Auto-pass in <span>{mindbugTimeLeft}s</span>
            </div>

            <div className="mindbug-card-preview">
              <div className="mindbug-card-name">
                <span>{gameState.pendingCard.card.name}</span>
                <span className="mindbug-card-power">⚡ {gameState.pendingCard.card.power}</span>
              </div>
              <div style={{ marginTop: '6px' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                  {gameState.pendingCard.card.keywords.map(kw => (
                    <span key={kw} className={`keyword-badge keyword-${kw}`}>{kw}</span>
                  ))}
                </div>
                {gameState.pendingCard.card.ability && (
                  <div style={{ marginTop: '6px', fontSize: '0.8rem', color: 'var(--text-accent)', fontStyle: 'italic' }}>
                    {gameState.pendingCard.card.ability.description}
                  </div>
                )}
              </div>
            </div>

            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '16px' }}>
              You have <strong style={{ color: 'var(--purple)' }}>{me.mindbugsRemaining}</strong> Mindbug{me.mindbugsRemaining !== 1 ? 's' : ''} remaining.
            </div>

            <div className="mindbug-buttons">
              <button className="btn btn-success" onClick={() => handleMindbugResponse(true)}>
                🧠 Use Mindbug! (Steal it)
              </button>
              <button className="btn" onClick={() => handleMindbugResponse(false)}>
                Pass
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Game over overlay */}
      {phase === 'GAME_OVER' && (
        <div className="game-over-overlay">
          <div className="game-over-modal">
            {gameState.winner === playerId ? (
              <>
                <div className="game-over-title win">Victory!</div>
                <div className="game-over-subtitle">You have defeated {opponent.name}!</div>
              </>
            ) : (
              <>
                <div className="game-over-title lose">Defeat</div>
                <div className="game-over-subtitle">
                  {gameState.winnerName ? `${gameState.winnerName} wins!` : 'You have been defeated.'}
                </div>
              </>
            )}
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '24px', fontStyle: 'italic' }}>
              {gameState.lastEvent}
            </div>
            <button className="btn btn-primary" onClick={onPlayAgain}>
              Play Again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
