import { useEffect, useState } from 'react';
import socket from './socket';
import { ClientGameState } from './types';
import Lobby from './components/Lobby';
import GameBoard from './components/GameBoard';

type AppPhase = 'lobby' | 'game';

interface RoomInfo {
  roomId: string;
  playerIndex: 0 | 1;
  playerId: string;
}

function App() {
  const [appPhase, setAppPhase] = useState<AppPhase>('lobby');
  const [roomInfo, setRoomInfo] = useState<RoomInfo | null>(null);
  const [gameState, setGameState] = useState<ClientGameState | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    socket.connect();

    socket.on('room_joined', (data: RoomInfo) => {
      setRoomInfo(data);
    });

    socket.on('game_started', ({ state }: { state: ClientGameState }) => {
      setGameState(state);
      setAppPhase('game');
    });

    socket.on('game_update', ({ state }: { state: ClientGameState }) => {
      setGameState(state);
      if (state.phase !== 'WAITING') {
        setAppPhase('game');
      }
    });

    socket.on('error', ({ message }: { message: string }) => {
      setError(message);
      setTimeout(() => setError(null), 4000);
    });

    return () => {
      socket.off('room_joined');
      socket.off('game_started');
      socket.off('game_update');
      socket.off('error');
      socket.disconnect();
    };
  }, []);

  const handleJoinRoom = (playerName: string, roomId: string) => {
    setError(null);
    socket.emit('join_room', { roomId, playerName });
  };

  const handleVsCpu = (playerName: string) => {
    setError(null);
    socket.emit('join_vs_cpu', { playerName });
  };

  const handlePlayAgain = () => {
    setAppPhase('lobby');
    setRoomInfo(null);
    setGameState(null);
  };

  if (appPhase === 'lobby') {
    return <Lobby onJoinRoom={handleJoinRoom} onVsCpu={handleVsCpu} error={error} />;
  }

  if (appPhase === 'game' && gameState && roomInfo) {
    return (
      <GameBoard
        gameState={gameState}
        playerIndex={roomInfo.playerIndex}
        playerId={roomInfo.playerId}
        error={error}
        onPlayAgain={handlePlayAgain}
      />
    );
  }

  return <div className="loading">Connecting to server</div>;
}

export default App;
