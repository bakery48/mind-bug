import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { GameRoom } from './gameLogic';
import { ALL_CARDS, shuffleDeck } from './cards';
import { KOT_CARDS } from './cards-kot';
import { CardDef, Expansions } from './types';

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = createServer(app);

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
});

interface WaitingPlayer {
  socketId: string;
  playerId: string;
  playerName: string;
  customDeck?: CardDef[];
  expansions: Expansions;
}

// ─── Card builder cost rules (must match client) ─────────────────────────────
const CARD_BUDGET = 6;
const KW_COSTS: Record<string, number> = {
  FRENZY: 2, HUNTER: 2, SNEAKY: 2, TOUGH: 2, POISONOUS: 3,
};
const ABILITY_COSTS: Record<string, number> = {
  DRAW_CARD: 1, GAIN_LIFE: 1, RETURN_TO_HAND: 1,
  DIRECT_DAMAGE: 2, DAMAGE_CREATURE: 2, COPY_CREATURE: 2,
  WIPE_WEAK: 3,
};

function calcCardCost(keywords: string[], abilityEffect?: string): number {
  const kwCost = keywords.reduce((s, k) => s + (KW_COSTS[k] ?? 0), 0);
  const abCost = abilityEffect ? (ABILITY_COSTS[abilityEffect] ?? 0) : 0;
  return kwCost + abCost;
}

function buildBasePool(expansions: Expansions): CardDef[] {
  const pool = [...ALL_CARDS];
  if (expansions.kotEnabled) pool.push(...KOT_CARDS);
  return pool;
}

function buildDeck(customCards?: CardDef[], expansions: Expansions = { kotEnabled: false }): CardDef[] {
  const basePool = buildBasePool(expansions);
  if (!customCards || customCards.length === 0) return shuffleDeck(basePool);
  const ts = Date.now();
  const valid: CardDef[] = [];
  for (let i = 0; i < Math.min(customCards.length, 20); i++) {
    const c = customCards[i];
    const kws = (c.keywords ?? []).filter(k => k in KW_COSTS);
    const abilityEffect = c.ability?.effect;
    const cost = calcCardCost(kws, abilityEffect);
    if (cost > CARD_BUDGET) {
      console.warn(`Custom card "${c.name}" rejected: cost ${cost} > budget ${CARD_BUDGET}`);
      continue;
    }
    valid.push({
      id: `custom-${i}-${ts}`,
      name: (c.name ?? '').trim().slice(0, 28) || `Custom ${i + 1}`,
      power: Math.max(1, Math.min(10, c.power ?? 5)),
      keywords: kws as CardDef['keywords'],
      ability: c.ability,
    });
  }
  if (valid.length === 0) return shuffleDeck(basePool);
  const standard = shuffleDeck(basePool);
  return shuffleDeck([...valid, ...standard.slice(valid.length)]);
}

// roomId → waiting player
const waitingRooms = new Map<string, WaitingPlayer>();
// roomId → GameRoom
const gameRooms = new Map<string, GameRoom>();
// socketId → { roomId, playerIndex }
const socketToGame = new Map<string, { roomId: string; playerIndex: 0 | 1 }>();

function broadcastGameState(room: GameRoom, roomId: string) {
  if (room.cpuPlayerIndex !== null) {
    // CPU game: only send state to the human player
    const humanIndex = (1 - room.cpuPlayerIndex) as 0 | 1;
    io.to(room.getSocketId(humanIndex)).emit('game_update', { state: room.getClientState(humanIndex) });
  } else {
    io.to(room.getSocketId(0)).emit('game_update', { state: room.getClientState(0) });
    io.to(room.getSocketId(1)).emit('game_update', { state: room.getClientState(1) });
  }
}

function scheduleCpuAction(room: GameRoom, roomId: string, baseDelay = 900) {
  if (room.cpuPlayerIndex === null) return;
  if (room.serverState.phase === 'GAME_OVER') return;
  if (!room.cpuNeedsToAct()) return;

  if (room.cpuTimerId) { clearTimeout(room.cpuTimerId); }

  const jitter = Math.floor(Math.random() * 350);
  room.cpuTimerId = setTimeout(() => {
    room.cpuTimerId = undefined;
    if (!gameRooms.has(roomId)) return;
    if (!room.cpuNeedsToAct()) return;

    room.performCpuAction();
    broadcastGameState(room, roomId);

    // Chain: e.g. FRENZY → CPU needs to act again; otherwise no-op
    scheduleCpuAction(room, roomId, 750);
  }, baseDelay + jitter);
}

io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  socket.on('join_vs_cpu', ({ playerName, customCards, expansions }: { playerName: string; customCards?: CardDef[]; expansions?: Expansions }) => {
    if (!playerName) { socket.emit('error', { message: 'Player name required.' }); return; }

    const playerId = uuidv4();
    const roomId = uuidv4();
    const gameId = uuidv4();

    const deck = buildDeck(customCards, expansions ?? { kotEnabled: false });
    const room = new GameRoom(
      gameId,
      playerId, playerName,
      'cpu', 'CPU',
      socket.id, 'cpu-no-socket',
      deck,
    );
    room.cpuPlayerIndex = 1;

    gameRooms.set(roomId, room);
    socketToGame.set(socket.id, { roomId, playerIndex: 0 });

    socket.emit('room_joined', { roomId, playerIndex: 0, playerId });
    socket.emit('game_started', { state: room.getClientState(0) });

    console.log(`CPU game started in room ${roomId}: ${playerName} vs CPU`);
    // Human goes first (player 0), no immediate CPU action needed
  });

  socket.on('join_room', ({ roomId, playerName, customCards, expansions }: { roomId: string; playerName: string; customCards?: CardDef[]; expansions?: Expansions }) => {
    if (!roomId || !playerName) {
      socket.emit('error', { message: 'Room ID and player name are required.' });
      return;
    }

    const playerId = uuidv4();
    const resolvedExpansions: Expansions = expansions ?? { kotEnabled: false };

    // Check if a game is already running in this room
    if (gameRooms.has(roomId)) {
      socket.emit('error', { message: 'Game already in progress in this room.' });
      return;
    }

    const waiting = waitingRooms.get(roomId);

    if (!waiting) {
      // First player - wait for opponent (store their custom cards for deck building)
      waitingRooms.set(roomId, {
        socketId: socket.id,
        playerId,
        playerName,
        customDeck: customCards && customCards.length > 0 ? buildDeck(customCards, resolvedExpansions) : undefined,
        expansions: resolvedExpansions,
      });
      socket.join(roomId);
      socket.emit('room_joined', { roomId, playerIndex: 0, playerId });
      socket.emit('game_update', {
        state: {
          gameId: '',
          phase: 'WAITING',
          players: [
            { id: playerId, name: playerName, handCount: 0, inPlay: [], deckCount: 0, mindbugsRemaining: 2, life: 3 },
            { id: '', name: 'Waiting for opponent...', handCount: 0, inPlay: [], deckCount: 0, mindbugsRemaining: 2, life: 3 },
          ],
          activePlayerIndex: 0,
          lastEvent: `Waiting for opponent to join room: ${roomId}`,
        },
      });
    } else {
      // Second player - start game
      waitingRooms.delete(roomId);
      socket.join(roomId);

      const gameId = uuidv4();
      // Use first player's custom deck if they had one, otherwise base pool
      const gameDeck = waiting.customDeck ?? shuffleDeck(buildBasePool(waiting.expansions));
      const room = new GameRoom(
        gameId,
        waiting.playerId, waiting.playerName,
        playerId, playerName,
        waiting.socketId, socket.id,
        gameDeck,
      );

      gameRooms.set(roomId, room);
      socketToGame.set(waiting.socketId, { roomId, playerIndex: 0 });
      socketToGame.set(socket.id, { roomId, playerIndex: 1 });

      // Notify both players
      io.to(waiting.socketId).emit('room_joined', { roomId, playerIndex: 0, playerId: waiting.playerId });
      socket.emit('room_joined', { roomId, playerIndex: 1, playerId });

      // Send initial game state
      io.to(waiting.socketId).emit('game_started', { state: room.getClientState(0) });
      socket.emit('game_started', { state: room.getClientState(1) });

      console.log(`Game started in room ${roomId}: ${waiting.playerName} vs ${playerName}`);
    }
  });

  socket.on('play_card', ({ handIndex }: { handIndex: number }) => {
    const gameInfo = socketToGame.get(socket.id);
    if (!gameInfo) {
      socket.emit('error', { message: 'Not in a game.' });
      return;
    }

    const { roomId, playerIndex } = gameInfo;
    const room = gameRooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Game not found.' });
      return;
    }

    const error = room.playCard(playerIndex, handIndex);
    if (error) {
      socket.emit('error', { message: error });
      return;
    }

    // Mindbug window: CPU responds automatically; human games use 15s timer
    if (room.serverState.phase === 'MINDBUG_WINDOW') {
      if (room.cpuPlayerIndex !== null) {
        scheduleCpuAction(room, roomId, 1200);
      } else {
        room.setMindbugTimer(() => {
          room.autoPassMindbug();
          broadcastGameState(room, roomId);
        });
      }
    }

    broadcastGameState(room, roomId);
    scheduleCpuAction(room, roomId);
  });

  socket.on('mindbug_response', ({ use }: { use: boolean }) => {
    const gameInfo = socketToGame.get(socket.id);
    if (!gameInfo) {
      socket.emit('error', { message: 'Not in a game.' });
      return;
    }

    const { roomId, playerIndex } = gameInfo;
    const room = gameRooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Game not found.' });
      return;
    }

    room.clearMindbugTimer();
    const error = room.respondToMindbug(playerIndex, use);
    if (error) {
      socket.emit('error', { message: error });
      return;
    }

    broadcastGameState(room, roomId);
    scheduleCpuAction(room, roomId);
  });

  socket.on('declare_attack', ({ instanceId }: { instanceId: string }) => {
    const gameInfo = socketToGame.get(socket.id);
    if (!gameInfo) {
      socket.emit('error', { message: 'Not in a game.' });
      return;
    }

    const { roomId, playerIndex } = gameInfo;
    const room = gameRooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Game not found.' });
      return;
    }

    const error = room.declareAttack(playerIndex, instanceId);
    if (error) {
      socket.emit('error', { message: error });
      return;
    }

    broadcastGameState(room, roomId);
    scheduleCpuAction(room, roomId);
  });

  socket.on('declare_block', ({ instanceId }: { instanceId: string | null }) => {
    const gameInfo = socketToGame.get(socket.id);
    if (!gameInfo) {
      socket.emit('error', { message: 'Not in a game.' });
      return;
    }

    const { roomId, playerIndex } = gameInfo;
    const room = gameRooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Game not found.' });
      return;
    }

    const error = room.declareBlock(playerIndex, instanceId);
    if (error) {
      socket.emit('error', { message: error });
      return;
    }

    broadcastGameState(room, roomId);
    scheduleCpuAction(room, roomId);
  });

  socket.on('select_ability_target', ({ instanceId }: { instanceId: string }) => {
    const gameInfo = socketToGame.get(socket.id);
    if (!gameInfo) {
      socket.emit('error', { message: 'Not in a game.' });
      return;
    }

    const { roomId, playerIndex } = gameInfo;
    const room = gameRooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Game not found.' });
      return;
    }

    const error = room.selectAbilityTarget(playerIndex, instanceId);

    if (error) {
      socket.emit('error', { message: error });
      return;
    }

    broadcastGameState(room, roomId);
    scheduleCpuAction(room, roomId);
  });

  socket.on('end_turn', () => {
    const gameInfo = socketToGame.get(socket.id);
    if (!gameInfo) {
      socket.emit('error', { message: 'Not in a game.' });
      return;
    }

    const { roomId, playerIndex } = gameInfo;
    const room = gameRooms.get(roomId);
    if (!room) {
      socket.emit('error', { message: 'Game not found.' });
      return;
    }

    const error = room.endTurn(playerIndex);
    if (error) {
      socket.emit('error', { message: error });
      return;
    }

    broadcastGameState(room, roomId);
    scheduleCpuAction(room, roomId);
  });

  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);

    // Remove from waiting rooms
    for (const [roomId, waiting] of waitingRooms.entries()) {
      if (waiting.socketId === socket.id) {
        waitingRooms.delete(roomId);
        break;
      }
    }

    // Notify opponent if in a game
    const gameInfo = socketToGame.get(socket.id);
    if (gameInfo) {
      const { roomId, playerIndex } = gameInfo;
      const room = gameRooms.get(roomId);
      if (room) {
        if (room.cpuPlayerIndex !== null) {
          // CPU game - just clean up
          if (room.cpuTimerId) clearTimeout(room.cpuTimerId);
        } else {
          // Notify human opponent
          const opponentIndex = (1 - playerIndex) as 0 | 1;
          const opponentState = room.getClientState(opponentIndex);
          opponentState.phase = 'GAME_OVER';
          opponentState.lastEvent = `${room.serverState.players[playerIndex].name} disconnected. You win!`;
          opponentState.winner = room.serverState.players[opponentIndex].id;
          opponentState.winnerName = room.serverState.players[opponentIndex].name;
          io.to(room.getSocketId(opponentIndex)).emit('game_update', { state: opponentState });
        }
        gameRooms.delete(roomId);
      }
      socketToGame.delete(socket.id);
    }
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
