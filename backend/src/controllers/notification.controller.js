import Notification from '../models/Notification.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const audienceFor = (role) => ({ audience: { $in: ['all', role] } });

export const listNotifications = asyncHandler(async (req, res) => {
  const audienceFilter = audienceFor(req.user.role);
  const [notifications, unreadCount] = await Promise.all([
    Notification.find(audienceFilter).sort({ createdAt: -1 }).limit(100).lean(),
    Notification.countDocuments({
      ...audienceFilter,
      readBy: { $ne: req.user._id }
    })
  ]);
  const data = notifications.map(({ readBy = [], ...notification }) => ({
    ...notification,
    isRead: readBy.some((id) => String(id) === String(req.user._id))
  }));
  res.json({ success: true, unreadCount, data });
});

export const createNotification = asyncHandler(async (req, res) => {
  const title = typeof req.body.title === 'string' ? req.body.title.trim() : '';
  const message = typeof req.body.message === 'string' ? req.body.message.trim() : '';
  const audience = req.body.audience || 'all';
  if (!title || !message) {
    return res.status(400).json({ success: false, message: 'A title and message are required.' });
  }
  if (title.length > 120 || message.length > 2000) {
    return res.status(400).json({
      success: false,
      message: 'Titles must be 120 characters or fewer and messages must be 2,000 characters or fewer.'
    });
  }
  if (!['all', 'student', 'admin'].includes(audience)) {
    return res.status(400).json({ success: false, message: 'Choose a valid notification audience.' });
  }

  const data = await Notification.create({
    title,
    message,
    audience,
    createdBy: req.user._id
  });
  res.status(201).json({ success: true, data });
});

export const markRead = asyncHandler(async (req, res) => {
  const item = await Notification.findOneAndUpdate(
    { _id: req.params.id, ...audienceFor(req.user.role) },
    { $addToSet: { readBy: req.user._id } },
    { new: true }
  ).lean();
  if (!item) {
    return res.status(404).json({ success: false, message: 'Notification not found.' });
  }

  const { readBy = [], ...notification } = item;
  res.json({
    success: true,
    data: {
      ...notification,
      isRead: readBy.some((id) => String(id) === String(req.user._id))
    }
  });
});
