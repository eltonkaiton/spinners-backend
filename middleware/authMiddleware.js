// ./middleware/authMiddleware.js
import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) return res.status(401).json({ success: false, message: "No token provided." });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (!decoded?.id) return res.status(401).json({ success: false, message: "Invalid token." });

    const user = await User.findById(decoded.id).select("full_name email role");
    if (!user) return res.status(404).json({ success: false, message: "User not found." });

    // Ensure id is string for consistency
    req.user = {
      id: String(user._id),
      full_name: user.full_name,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error) {
    console.error("❌ Auth middleware error:", error);
    res.status(401).json({ success: false, message: "Unauthorized", error: error.message });
  }
};
