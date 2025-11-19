// ./routes/users.js
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = express.Router();

// =============================
// ADD USER (Admin only)
// =============================
router.post("/add", authMiddleware, async (req, res) => {
  try {
    // Only admins can add users
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Access denied. Admins only." });
    }

    // Destructure fields from request body
    const { fullName, email, phone, role, password } = req.body;

    // Validate required fields
    if (!fullName || !email || !password || !role) {
      return res.status(400).json({ error: "All required fields must be filled" });
    }

    // Check if email already exists
    const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
    if (existingUser) {
      return res.status(409).json({ error: "Email already in use" });
    }

    // Create new user
    const newUser = new User({
      fullName,
      email: email.toLowerCase().trim(),
      phone,
      password, // pre-save middleware will hash this
      role,
      status: "pending",
    });

    await newUser.save();

    res.status(201).json({ message: "User created successfully", user: newUser });
  } catch (error) {
    console.error("Add User Error:", error);
    res.status(500).json({ error: "Server error during user creation" });
  }
});


// =============================
// LOGIN USER
// =============================
router.post("/login", async (req, res) => {
  try {
    let { email, password } = req.body;
    if (!email || !password)
      return res.status(400).json({ error: "Email and password are required" });

    email = email.toLowerCase().trim();
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ error: "User not found" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(401).json({ error: "Invalid credentials" });

    if (user.status.trim().toLowerCase() !== "active")
      return res.status(403).json({ error: `Account ${user.status}` });

    const token = jwt.sign(
      { id: user._id.toString(), role: user.role, email: user.email },
      process.env.JWT_SECRET || "secretkey",
      { expiresIn: "1d" }
    );

    res.json({
      message: "Login successful",
      token,
      user: { id: user._id, full_name: user.full_name, email: user.email, role: user.role, status: user.status },
    });
  } catch (error) {
    console.error("Login Error:", error);
    res.status(500).json({ error: "Server error during login" });
  }
});

// =============================
// GET ALL USERS (Admin / Supervisor only)
// =============================
router.get("/", authMiddleware, async (req, res) => {
  try {
    if (!["admin", "supervisor"].includes(req.user.role)) {
      return res.status(403).json({ error: "Access denied." });
    }

    const users = await User.find().sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    console.error("Get Users Error:", error);
    res.status(500).json({ error: "Server error fetching users" });
  }
});

// =============================
// GET SINGLE USER BY ID
// =============================
router.get("/:id", authMiddleware, async (req, res) => {
  try {
    if (!["admin", "supervisor"].includes(req.user.role) && req.user.id !== req.params.id) {
      return res.status(403).json({ error: "Access denied." });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (error) {
    console.error("Get Single User Error:", error);
    res.status(500).json({ error: "Server error fetching user" });
  }
});

// =============================
// UPDATE USER BY ID
// =============================
router.put("/update/:id", authMiddleware, async (req, res) => {
  try {
    if (!["admin", "supervisor"].includes(req.user.role) && req.user.id !== req.params.id) {
      return res.status(403).json({ error: "Access denied." });
    }

    const { full_name, email, phone, role, status, password } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    user.full_name = full_name || user.full_name;
    user.email = email?.toLowerCase().trim() || user.email;
    user.phone = phone || user.phone;
    user.role = role || user.role;
    user.status = status || user.status;

    if (password) {
      user.password = await bcrypt.hash(password, 10);
    }

    await user.save();
    res.json({ message: "User updated successfully", user });
  } catch (error) {
    console.error("Update User Error:", error);
    res.status(500).json({ error: "Server error during user update" });
  }
});

// =============================
// DELETE USER BY ID (Admin only)
// =============================
router.delete("/delete/:id", authMiddleware, async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Access denied. Admin only." });
    }

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });

    res.json({ message: "User deleted successfully" });
  } catch (error) {
    console.error("Delete User Error:", error);
    res.status(500).json({ error: "Server error during user deletion" });
  }
});

// =============================
// GET USERS BY STATUS (Admin / Supervisor only)
// =============================
router.get("/status/:status", authMiddleware, async (req, res) => {
  try {
    if (!["admin", "supervisor"].includes(req.user.role)) {
      return res.status(403).json({ error: "Access denied." });
    }

    const { status } = req.params;
    const allowedStatuses = ["active", "pending", "suspended", "rejected"];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status filter" });
    }

    const users = await User.find({ status }).sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    console.error("Get Users by Status Error:", error);
    res.status(500).json({ error: "Server error fetching users by status" });
  }
});

// =============================
// UPDATE USER STATUS (Admin / Supervisor only)
// =============================
router.patch("/update-status/:id", authMiddleware, async (req, res) => {
  try {
    if (!["admin", "supervisor"].includes(req.user.role)) {
      return res.status(403).json({ error: "Access denied." });
    }

    const { status } = req.body;
    const allowedStatuses = ["active", "pending", "suspended", "rejected"];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const updated = await User.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );

    if (!updated) return res.status(404).json({ error: "User not found" });
    res.json({ message: "Status updated successfully", user: updated });
  } catch (err) {
    console.error("Update Status Error:", err);
    res.status(500).json({ error: "Server error" });
  }
});

/// GET /api/users/suppliers
router.get("/suppliers", authMiddleware, async (req, res) => {
  try {
    const suppliers = await User.find({ role: "supplier", status: "active" })
      .select("_id fullName email phone");

    res.json(suppliers);
  } catch (err) {
    console.error("❌ Supplier fetch error:", err);
    res.status(500).json({ error: "Failed to fetch suppliers" });
  }
});


// Get support users (artisans, finance, inventory, etc.)
router.get('/support', authMiddleware, async (req, res) => {
  try {
    const supportRoles = ['artisan', 'finance', 'inventory', 'admin', 'supervisor', 'supplier'];
    
    const supportUsers = await User.find({
      role: { $in: supportRoles },
      status: 'active'
    }).select('name email role online lastSeen avatar specialty');

    // Enhance with support-specific information
    const enhancedUsers = supportUsers.map(user => {
      const supportInfo = getSupportUserInfo(user.role);
      return {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        online: user.online || false,
        lastSeen: user.lastSeen || new Date(),
        avatar: user.avatar,
        description: supportInfo.description,
        expertise: supportInfo.expertise,
        responseTime: supportInfo.responseTime
      };
    });

    res.json({
      success: true,
      supportUsers: enhancedUsers
    });
  } catch (error) {
    console.error('Get support users error:', error);
    res.status(500).json({ error: 'Failed to fetch support users' });
  }
});

// Get user online status
router.get('/:userId/status', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select('online lastSeen');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      online: user.online || false,
      lastSeen: user.lastSeen
    });
  } catch (error) {
    console.error('Get user status error:', error);
    res.status(500).json({ error: 'Failed to fetch user status' });
  }
});

// Update user online status
router.put('/:userId/status', authMiddleware, async (req, res) => {
  try {
    const { userId } = req.params;
    const { online } = req.body;

    const user = await User.findByIdAndUpdate(
      userId,
      { 
        online: online,
        lastSeen: new Date()
      },
      { new: true }
    ).select('online lastSeen');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      success: true,
      online: user.online,
      lastSeen: user.lastSeen
    });
  } catch (error) {
    console.error('Update user status error:', error);
    res.status(500).json({ error: 'Failed to update user status' });
  }
});

// Helper function for support user information
function getSupportUserInfo(role) {
  const supportInfo = {
    artisan: {
      description: 'Custom orders & artisan services',
      expertise: 'Textiles, Jewelry, Crafts',
      responseTime: 'Usually replies within 1 hour'
    },
    inventory: {
      description: 'Product availability & stock queries',
      expertise: 'Stock Management, Product Availability',
      responseTime: 'Usually replies within 30 minutes'
    },
    finance: {
      description: 'Payments & billing assistance',
      expertise: 'Financial Services, Payments',
      responseTime: 'Usually replies within 2 hours'
    },
    admin: {
      description: 'Administrative support',
      expertise: 'System Administration',
      responseTime: 'Usually replies within 4 hours'
    },
    supervisor: {
      description: 'Supervisory assistance',
      expertise: 'Operations Management',
      responseTime: 'Usually replies within 1 hour'
    },
    supplier: {
      description: 'Supplier relations & orders',
      expertise: 'Supply Chain, Vendor Management',
      responseTime: 'Usually replies within 2 hours'
    }
  };

  return supportInfo[role] || {
    description: 'General support and assistance',
    expertise: 'Customer Service',
    responseTime: 'Usually replies within 1 hour'
  };
}
export default router;
