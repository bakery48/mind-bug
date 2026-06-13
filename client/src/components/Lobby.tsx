import { useState } from 'react';
import { CardDef } from '../types';
import CardBuilder from './CardBuilder';

interface LobbyProps {
  onJoinRoom: (playerName: string, roomId: string, customCards: CardDef[]) => void;
  onVsCpu: (playerName: string, customCards: CardDef[]) => void;
  error: string | null;
}

function generateRoomId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

export default function Lobby({ onJoinRoom, onVsCpu, error }: LobbyProps) {
  const [playerName, setPlayerName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [mode, setMode] = useState<'select' | 'online'>('select');
  const [showBuilder, setShowBuilder] = useState(false);
  const [customCards, setCustomCards] = useState<CardDef[]>([]);

  const nameOk = playerName.trim().length > 0;

  const addCard = (card: CardDef) => setCustomCards(prev => [...prev, card]);
  const removeCard = (id: string) => setCustomCards(prev => prev.filter(c => c.id !== id));

  const cardCountLabel = customCards.length > 0
    ? ` (${customCards.length}枚)`
    : '';

  if (mode === 'online') {
    const handleOnlineSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      if (!nameOk) return;
      const finalRoomId = roomId.trim() || generateRoomId();
      onJoinRoom(playerName.trim(), finalRoomId.toUpperCase(), customCards);
    };
    return (
      <div className="lobby">
        <div className="lobby-container" style={{ maxWidth: 480 }}>
          <h1 className="lobby-title">Mindbug</h1>
          <p className="lobby-subtitle">Online Multiplayer</p>
          <form className="lobby-form" onSubmit={handleOnlineSubmit}>
            <div className="form-group">
              <label className="form-label">Room ID</label>
              <input
                className="form-input"
                type="text"
                value={roomId}
                onChange={e => setRoomId(e.target.value.toUpperCase())}
                placeholder="Enter room ID or leave blank..."
                maxLength={10}
              />
              <span className="room-hint">空欄で新しいルームを作成。相手に ID を教えて参加してもらう。</span>
            </div>
            {error && <div className="lobby-error">{error}</div>}
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" className="btn" onClick={() => setMode('select')}>← Back</button>
              <button type="button" className="btn" onClick={() => setRoomId(generateRoomId())}>🎲 Generate</button>
              <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>Enter Game</button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="lobby">
      <div className="lobby-container" style={{ maxWidth: showBuilder ? 900 : 480, transition: 'max-width 0.3s' }}>
        <h1 className="lobby-title">Mindbug</h1>
        <p className="lobby-subtitle">First Contact</p>

        {/* Name input */}
        <div className="form-group">
          <label className="form-label">Your Name</label>
          <input
            className="form-input"
            type="text"
            value={playerName}
            onChange={e => setPlayerName(e.target.value)}
            placeholder="Enter your name..."
            maxLength={20}
            autoFocus
          />
        </div>

        {/* Card builder toggle */}
        <button
          type="button"
          className={`btn cb-toggle-lobby ${showBuilder ? 'active' : ''}`}
          onClick={() => setShowBuilder(v => !v)}
          style={{ width: '100%', marginBottom: 8 }}
        >
          🃏 カード作成{cardCountLabel} {showBuilder ? '▲' : '▼'}
        </button>

        {/* Card builder panel */}
        {showBuilder && (
          <div className="cb-panel">
            <CardBuilder cards={customCards} onAdd={addCard} onRemove={removeCard} maxCards={10} />
            {customCards.length > 0 && (
              <p className="cb-deck-note">
                ✓ {customCards.length}枚の自作カードがデッキに追加されます（デッキの標準カードと入れ替わります）
              </p>
            )}
          </div>
        )}

        {error && <div className="lobby-error">{error}</div>}

        {/* Mode buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
          <button
            className="btn btn-primary"
            disabled={!nameOk}
            onClick={() => nameOk && onVsCpu(playerName.trim(), customCards)}
          >
            🤖 vs CPU（練習）
          </button>
          <button
            className="btn"
            disabled={!nameOk}
            onClick={() => nameOk && setMode('online')}
          >
            🌐 オンライン対戦
          </button>
        </div>

        <div style={{ marginTop: 20, padding: 14, background: 'rgba(0,0,0,0.3)', borderRadius: 8, fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
          <strong style={{ color: 'var(--text-accent)', fontFamily: 'Cinzel, serif', fontSize: '0.78rem' }}>HOW TO PLAY</strong><br />
          Two players share a deck of 48 creatures. Each turn: play a card, attack, or pass.
          Use <span style={{ color: 'var(--purple)' }}>Mindbugs</span> to steal opponent's cards!
          Reduce opponent's life to <span style={{ color: 'var(--red)' }}>0</span> to win.
        </div>
      </div>
    </div>
  );
}
