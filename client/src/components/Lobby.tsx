import { useState } from 'react';

interface LobbyProps {
  onJoinRoom: (playerName: string, roomId: string) => void;
  error: string | null;
}

function generateRoomId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export default function Lobby({ onJoinRoom, error }: LobbyProps) {
  const [playerName, setPlayerName] = useState('');
  const [roomId, setRoomId] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) return;
    const finalRoomId = roomId.trim() || generateRoomId();
    onJoinRoom(playerName.trim(), finalRoomId.toUpperCase());
  };

  const handleGenerateRoom = () => {
    setRoomId(generateRoomId());
  };

  return (
    <div className="lobby">
      <div className="lobby-container">
        <h1 className="lobby-title">Mindbug</h1>
        <p className="lobby-subtitle">First Contact — Online Multiplayer</p>

        <form className="lobby-form" onSubmit={handleSubmit}>
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
            <span className="room-hint">
              Leave blank to create a new room, or enter an existing room ID to join.
            </span>
          </div>

          {error && <div className="lobby-error">{error}</div>}

          <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
            <button
              type="button"
              className="btn"
              onClick={handleGenerateRoom}
              style={{ flex: '0 0 auto' }}
            >
              🎲 Generate
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!playerName.trim()}
              style={{ flex: '1' }}
            >
              Enter Game
            </button>
          </div>
        </form>

        <div style={{ marginTop: '24px', padding: '16px', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.6' }}>
          <strong style={{ color: 'var(--text-accent)', fontFamily: 'Cinzel, serif', fontSize: '0.8rem' }}>HOW TO PLAY</strong>
          <br />
          Two players share a deck of 48 creatures. Each turn: play a card, attack, or pass.
          Use <span style={{ color: 'var(--purple)' }}>Mindbugs</span> to steal opponent's cards!
          Reduce opponent's life to <span style={{ color: 'var(--red)' }}>0</span> to win.
        </div>
      </div>
    </div>
  );
}
