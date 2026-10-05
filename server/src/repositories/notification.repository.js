import Notification from '../models/Notification.js';
import BaseRepository from './baseRepository.js';

class NotificationRepository extends BaseRepository {
  constructor() {
    super(Notification);
  }

  async findForRecipient(recipientId, organizationId, { unreadOnly = false, limit = 50 } = {}) {
    const filter = { recipientId, organizationId };
    if (unreadOnly) filter.read = false;
    return Notification.find(filter).sort({ createdAt: -1 }).limit(limit);
  }

  async countUnread(recipientId, organizationId) {
    return Notification.countDocuments({ recipientId, organizationId, read: false });
  }

  async markAllRead(recipientId, organizationId) {
    return Notification.updateMany(
      { recipientId, organizationId, read: false },
      { read: true, readAt: new Date() }
    );
  }
}

export default new NotificationRepository();
