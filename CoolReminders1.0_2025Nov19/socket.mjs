/* socket.mjs */
/* Socket.IO bootstrap and helpers shared across the app */

import { Server as SocketIOServer } from 'socket.io';
import { info } from './routes/utils/log.mjs';

let ioInstance = null;

/*
  initSocket

  Creates and configures a Socket.IO server that shares the Express
  session, then joins each authenticated socket into a user specific
  room named `user:<userId>` so the rest of the app can emit events
  to all connections for that user.
*/
export function initSocket(server, sessionMiddleware) {
  const io = new SocketIOServer(server);

  /* share express-session with socket.io */
  io.use((socket, next) => {
    sessionMiddleware(socket.request, {}, next);
  });

  io.on('connection', (socket) => {
    const sess = socket.request.session;
    const user = sess?.user;
    if (!user) {
      info('SOCKET connect without user', socket.id);
      return;
    }

    const userId = user._id;
    info('SOCKET connect', socket.id, 'user', user.username);
    socket.join(`user:${userId}`);
  });

  ioInstance = io;
  return io;
}

/*
  getIO

  Returns the shared Socket.IO server instance created by initSocket.

  Throws an error if initSocket has not been called yet. This is useful
  when you need access to the raw io object in other modules but want
  a guard that prevents accidental use before initialization.
*/
export function getIO() {
  if (!ioInstance) {
    throw new Error('Socket.IO not initialized. Call initSocket(server, sessionMiddleware) first.');
  }
  return ioInstance;
}

/*
  emitToUser

  Broadcasts a Socket.IO event to all active sockets that belong to a
  specific user.

  - Looks up the shared io instance.
  - Targets the per user room created in initSocket: `user:<userId>`.
  - Emits the given event name and payload to every socket in that room.

  This lets the rest of the app trigger live updates (task created,
  list renamed, logout, and so on) for a user regardless of how many
  tabs or devices they have open.
*/
export function emitToUser(userId, event, payload) {
  if (!ioInstance) return;
  getIO().to(`user:${userId}`).emit(event, payload);
}
