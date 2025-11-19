import express from 'express';
import { authMiddleware } from '../middleware/authMiddleware.js'; 

const router = express.Router();

// Mock Notification Model (replace with your actual model)
const notifications = [];

// Send notification
router.post('/send', authMiddleware, async (req, res) => {
  try {
    const { userId, title, message, type, data } = req.body;

    if (!userId || !title || !message) {
      return res.status(400).json({ error: 'User ID, title, and message are required' });
    }

    // Create notification object
    const notification = {
      _id: Date.now().toString(),
      userId,
      title,
      message,
      type: type || 'info',
      data: data || {},
      read: false,
      createdAt: new Date().toISOString()
    };

    // Add to mock database
    notifications.push(notification);

    console.log(`Notification sent to user ${userId}: ${title} - ${message}`);

    res.json({
      success: true,
      notification: {
        _id: notification._id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        createdAt: notification.createdAt
      }
    });
  } catch (error) {
    console.error('Send notification error:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

// Get user notifications
router.get('/user/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 20, unreadOnly = false } = req.query;

    // Verify the authenticated user is accessing their own notifications
    if (req.user.id !== userId) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied. You can only view your own notifications.' 
      });
    }

    let userNotifications = notifications.filter(n => n.userId === userId);
    
    if (unreadOnly) {
      userNotifications = userNotifications.filter(n => !n.read);
    }

    // Sort by creation date (newest first) and limit
    userNotifications.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    userNotifications = userNotifications.slice(0, parseInt(limit));

    res.json({
      success: true,
      notifications: userNotifications
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Mark notification as read
router.put('/:notificationId/read', authMiddleware, async (req, res) => {
  try {
    const { notificationId } = req.params;

    const notification = notifications.find(n => n._id === notificationId);
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    // Verify the authenticated user owns this notification
    if (req.user.id !== notification.userId) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied. You can only mark your own notifications as read.' 
      });
    }

    notification.read = true;
    notification.readAt = new Date().toISOString();

    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Mark notification as read error:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Mark all notifications as read
router.put('/user/:userId/read-all', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;

    // Verify the authenticated user is accessing their own notifications
    if (req.user.id !== userId) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied. You can only mark your own notifications as read.' 
      });
    }

    notifications.forEach(notification => {
      if (notification.userId === userId && !notification.read) {
        notification.read = true;
        notification.readAt = new Date().toISOString();
      }
    });

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Mark all as read error:', error);
    res.status(500).json({ error: 'Failed to mark all notifications as read' });
  }
});

// Get all notifications (admin only)
router.get('/', authMiddleware, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied. Admin role required.' 
      });
    }

    const { limit = 50 } = req.query;
    const allNotifications = notifications
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, parseInt(limit));

    res.json({
      success: true,
      notifications: allNotifications,
      total: notifications.length
    });
  } catch (error) {
    console.error('Get all notifications error:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

export { router };