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


export default router;
