import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';

const router = express.Router();

// ================================
// LOGIN (Admin, Artisan, Finance, or Customer)
// ================================
router.post('/login', async (req, res) => {
  try {
    let { email, password } = req.body;

    // Check for missing fields
    if (!email || !password) {
      console.log('❌ Login failed: Missing email or password');
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Normalize email
    email = email.trim().toLowerCase();

    // Find user by email
    const user = await User.findOne({ email });
    if (!user) {
      console.log(`❌ Login failed: No user found with email "${email}"`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Allowed roles
    const allowedRoles = ['admin', 'artisan', 'finance', 'customer', 'supervisor', 'driver', 'supplier'];
    if (!allowedRoles.includes(user.role)) {
      console.log(`🚫 Login failed: User "${email}" is not authorized (role: ${user.role})`);
      return res.status(403).json({ error: 'Access denied. Unauthorized role.' });
    }

    // Check if user account is active (trim and lowercase to avoid mismatch)
    if (String(user.status).trim().toLowerCase() !== 'active') {
      console.log(`🚫 Login failed: User "${email}" status is "${user.status}"`);
      return res.status(403).json({ error: `Access denied. User status is "${user.status}"` });
    }

    // Validate password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      console.log(`❌ Login failed: Password mismatch for user "${email}"`);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate JWT token
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET || 'secretkey',
      { expiresIn: '1d' }
    );

    console.log(`✅ Login success for user "${email}" (role: ${user.role})`);

    // Return response
    res.json({
      success: true,
      message: 'Login successful',
      token,
      user: {
        id: user._id,
        full_name: user.full_name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        status: user.status,
      },
    });

  } catch (err) {
    console.error('❌ Server error during login:', err);
    res.status(500).json({ error: 'Server error during login' });
  }
});

export default router;
