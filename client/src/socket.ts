import { io, Socket } from 'socket.io-client';

const SOCKET_URL = import.meta.env.PROD
  ? window.location.origin
  : 'http://localhost:3001';

export const socket: Socket = io(SOCKET_URL, {
  autoConnect: false,
});

export default socket;
