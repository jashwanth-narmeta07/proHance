import notificationRepository from '../repositories/notification.repository.js';
import ApiError from '../utils/ApiError.js';
import { emitToUser } from '../sockets/index.js';

/**
 * Every notification is persisted first (so it survives even if the
 * recipient isn't connected) and then pushed over Socket.IO if they are.
 * This is the single choke point Section 17 describes: backend creates ->
 * notification saved -> Socket.IO delivers -> dashboard updates.
 */
export async function notify(
  organizationId,
  { recipientId, type, title, message, relatedEntityType, relatedEntityId }
) {
  const notification = await notificationRepository.createInOrg(
    { recipientId, type, title, message, relatedEntityType, relatedEntityId },
    organizationId
  );

  emitToUser(recipientId.toString(), 'notification:new', {
    id: notification._id,
    type: notification.type,
    title: notification.title,
    message: notification.message,
    relatedEntityType: notification.relatedEntityType,
    relatedEntityId: notification.relatedEntityId,
    createdAt: notification.createdAt,
  });

  return notification;
}

export async function listMyNotifications(requestingUser, { unreadOnly } = {}) {
  return notificationRepository.findForRecipient(requestingUser.id, requestingUser.organizationId, {
    unreadOnly: unreadOnly === 'true' || unreadOnly === true,
  });
}

export async function getUnreadCount(requestingUser) {
  return notificationRepository.countUnread(requestingUser.id, requestingUser.organizationId);
}

export async function markRead(requestingUser, notificationId) {
  const notification = await notificationRepository.findByIdInOrg(notificationId, requestingUser.organizationId);
  if (!notification) throw ApiError.notFound('Notification not found');
  if (notification.recipientId.toString() !== requestingUser.id) {
    throw ApiError.forbidden('This notification does not belong to you');
  }
  notification.read = true;
  notification.readAt = new Date();
  await notification.save();
  return notification;
}

export async function markAllRead(requestingUser) {
  await notificationRepository.markAllRead(requestingUser.id, requestingUser.organizationId);
}
