import express from 'express';
import mongoose from 'mongoose';
import { authMiddleware } from '../middleware/authMiddleware.js'; 

const router = express.Router();

// Mock Chat Model (replace with your actual model)
const Chat = mongoose.models.Chat || mongoose.model('Chat', new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  messages: [{
    text: {
      type: String,
      required: true,
      trim: true
    },
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    type: {
      type: String,
      enum: ['message', 'system'],
      default: 'message'
    },
    status: {
      type: String,
      enum: ['sending', 'sent', 'delivered', 'read'],
      default: 'sent'
    }
  }],
  lastMessage: String,
  lastMessageAt: {
    type: Date,
    default: Date.now
  },
  unreadCount: {
    type: Number,
    default: 0
  }
}));

// Get chat history between two users
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { participant1, participant2 } = req.query;
    
    if (!participant1 || !participant2) {
      return res.status(400).json({ error: 'Both participant IDs are required' });
    }

    // Verify the authenticated user is one of the participants
    if (req.user.id !== participant1 && req.user.id !== participant2) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied. You can only access your own chats.' 
      });
    }

    // For demo purposes, return mock data
    // In production, you would query your actual database
    const mockMessages = [
      {
        _id: '1',
        text: "Hello! I'm here to help you. What can I assist you with today?",
        senderId: participant2,
        senderName: 'Support Team',
        senderRole: 'support',
        timestamp: new Date(Date.now() - 300000).toISOString(),
        type: 'received',
        status: 'sent'
      }
    ];

    res.json({
      success: true,
      messages: mockMessages
    });
  } catch (error) {
    console.error('Get chat error:', error);
    res.status(500).json({ error: 'Failed to fetch chat history' });
  }
});

// Get latest messages
router.get('/latest', authMiddleware, async (req, res) => {
  try {
    const { participant1, participant2, lastMessageId } = req.query;
    
    if (!participant1 || !participant2) {
      return res.status(400).json({ error: 'Both participant IDs are required' });
    }

    // Verify the authenticated user is one of the participants
    if (req.user.id !== participant1 && req.user.id !== participant2) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied. You can only access your own chats.' 
      });
    }

    // For demo, return empty array (no new messages)
    res.json({
      success: true,
      newMessages: []
    });
  } catch (error) {
    console.error('Get latest messages error:', error);
    res.status(500).json({ error: 'Failed to fetch latest messages' });
  }
});

// Send a message
router.post('/send', authMiddleware, async (req, res) => {
  try {
    const { senderId, receiverId, text, timestamp } = req.body;

    if (!senderId || !receiverId || !text) {
      return res.status(400).json({ error: 'Sender ID, receiver ID, and text are required' });
    }

    // Verify the authenticated user is the sender
    if (req.user.id !== senderId) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied. You can only send messages as yourself.' 
      });
    }

    // Create message object
    const messageData = {
      _id: new mongoose.Types.ObjectId().toString(),
      text: text.trim(),
      senderId: senderId,
      senderName: req.user.fullName || 'You',
      senderRole: req.user.role,
      receiverId: receiverId,
      receiverName: 'Support', // This would come from user data in real app
      receiverRole: 'support',
      timestamp: timestamp || new Date().toISOString(),
      type: 'sent',
      status: 'sent'
    };

    // In a real app, you would save to database here
    // await Chat.findOneAndUpdate(
    //   { participants: { $all: [senderId, receiverId] } },
    //   { $push: { messages: messageData } },
    //   { upsert: true, new: true }
    // );

    res.json({
      success: true,
      message: messageData
    });

  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// Get user's chat list
router.get('/user/:userId', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;

    // Verify the authenticated user is accessing their own chats
    if (req.user.id !== userId) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied. You can only access your own chat list.' 
      });
    }

    // Mock chat list for demo
    const mockChats = [
      {
        chatId: '1',
        participant: {
          _id: 'support_artisan',
          name: 'Artisan Support',
          role: 'artisan',
          online: true,
          lastSeen: new Date()
        },
        lastMessage: 'Hello! How can I help you with custom orders?',
        lastMessageAt: new Date(),
        unreadCount: 0,
        messageCount: 5
      },
      {
        chatId: '2',
        participant: {
          _id: 'support_finance',
          name: 'Finance Department',
          role: 'finance',
          online: false,
          lastSeen: new Date(Date.now() - 30 * 60 * 1000)
        },
        lastMessage: 'We can help with payment issues',
        lastMessageAt: new Date(Date.now() - 60 * 60 * 1000),
        unreadCount: 0,
        messageCount: 3
      },
      {
        chatId: '3',
        participant: {
          _id: 'support_inventory',
          name: 'Inventory Team',
          role: 'inventory',
          online: true,
          lastSeen: new Date()
        },
        lastMessage: 'Let me check the stock for you',
        lastMessageAt: new Date(Date.now() - 15 * 60 * 1000),
        unreadCount: 1,
        messageCount: 2
      }
    ];

    res.json({
      success: true,
      chats: mockChats
    });
  } catch (error) {
    console.error('Get user chats error:', error);
    res.status(500).json({ error: 'Failed to fetch user chats' });
  }
});

// Mark messages as read
router.put('/:chatId/read', authMiddleware, async (req, res) => {
  try {
    const { chatId } = req.params;
    const { userId } = req.body;

    // Verify the authenticated user is the one marking messages as read
    if (req.user.id !== userId) {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied. You can only mark your own messages as read.' 
      });
    }

    // In real app, you would update the chat document
    // await Chat.findByIdAndUpdate(chatId, { unreadCount: 0 });

    res.json({
      success: true,
      message: 'Messages marked as read'
    });
  } catch (error) {
    console.error('Mark as read error:', error);
    res.status(500).json({ error: 'Failed to mark messages as read' });
  }
});

// Delete a chat (admin or participant only)
router.delete('/:chatId', authMiddleware, async (req, res) => {
  try {
    const { chatId } = req.params;

    // In real app, you would check if user is participant or admin
    // const chat = await Chat.findById(chatId);
    // if (!chat.participants.includes(req.user.id) && req.user.role !== 'admin') {
    //   return res.status(403).json({ error: 'Access denied' });
    // }

    // await Chat.findByIdAndDelete(chatId);

    res.json({
      success: true,
      message: 'Chat deleted successfully'
    });
  } catch (error) {
    console.error('Delete chat error:', error);
    res.status(500).json({ error: 'Failed to delete chat' });
  }
});

// Get all chats (admin only)
router.get('/admin/all', authMiddleware, async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied. Admin role required.' 
      });
    }

    // Mock admin data
    const mockChats = [
      {
        chatId: '1',
        participants: ['user1', 'support_artisan'],
        lastMessage: 'Hello! How can I help you?',
        lastMessageAt: new Date(),
        messageCount: 5,
        unreadCount: 0
      },
      {
        chatId: '2',
        participants: ['user2', 'support_finance'],
        lastMessage: 'Payment issue resolved',
        lastMessageAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        messageCount: 8,
        unreadCount: 1
      }
    ];

    res.json({
      success: true,
      chats: mockChats,
      total: mockChats.length
    });
  } catch (error) {
    console.error('Get all chats error:', error);
    res.status(500).json({ error: 'Failed to fetch all chats' });
  }
});

export { router };