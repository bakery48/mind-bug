import { io, Socket } from 'socket.io-client';

// Always use current origin so the Vite proxy (dev) or same-host server (prod)
// handles the /socket.io path — avoids direct localhost:3001 in cloud environments.
export const socket: Socket = io(window.location.origin, {
  autoConnect: false,
  path: '/socket.io',
});

export default socket;
