import { Server } from 'socket.io';
import env from '../config/env.js';
import logger from '../config/logger.js';
import { verifyAccessToken } from '../utils/tokens.js';
import User from '../models/User.js';

let io;

/**
 * Every socket authenticates with the same JWT access token used for REST calls.
 * On success we join two rooms:
 *   org:<organizationId>          - broadcasts relevant to the whole tenant (e.g. device online/offline)
 *   user:<userId>                 - direct notifications to this specific user
 * A manager/HR-facing "team:<teamId>" room is joined for users who have a team,
 * so team-scoped activity updates don't have to fan out to the whole org.
 *
 * Nothing here trusts client-supplied organizationId/userId - identity comes only
 * from the verified token, mirroring the REST authenticate() middleware.
 */
export function initSocket(httpServer) {
  io = new Server(httpServer, {
    cors: {
      origin: env.CLIENT_URLS,
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const token =
        socket.handshake.auth?.token ||
        socket.handshake.headers?.authorization?.replace('Bearer ', '');
      if (!token) return next(new Error('AUTH_REQUIRED'));

      const payload = verifyAccessToken(token);
      const user = await User.findById(payload.sub);
      if (!user || ['SUSPENDED', 'DEACTIVATED', 'EXITED'].includes(user.status)) {
        return next(new Error('AUTH_INVALID'));
      }

      socket.user = {
        id: user._id.toString(),
        organizationId: user.organizationId ? user.organizationId.toString() : null,
        role: user.role,
        teamId: user.teamId ? user.teamId.toString() : null,
      };
      next();
    } catch {
      next(new Error('AUTH_INVALID'));
    }
  });

  io.on('connection', (socket) => {
    const { id, organizationId, teamId } = socket.user;
    socket.join(`user:${id}`);
    if (organizationId) socket.join(`org:${organizationId}`);
    if (teamId) socket.join(`team:${teamId}`);

    logger.debug('Socket connected', { userId: id, organizationId });

    socket.on('disconnect', () => {
      logger.debug('Socket disconnected', { userId: id });
    });
  });

  return io;
}

export function getIO() {
  if (!io) throw new Error('Socket.IO not initialized - call initSocket() first');
  return io;
}

/** Emit a notification payload directly to one user. */
export function emitToUser(userId, event, payload) {
  getIO().to(`user:${userId}`).emit(event, payload);
}

/** Emit to every connected member of an organization (e.g. device status changes). */
export function emitToOrganization(organizationId, event, payload) {
  getIO().to(`org:${organizationId}`).emit(event, payload);
}

/** Emit to a team's manager/members (e.g. team activity updates). */
export function emitToTeam(teamId, event, payload) {
  getIO().to(`team:${teamId}`).emit(event, payload);
}