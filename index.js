import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";

// Import route modules
import adminRoutes from "./routes/admin.js";
import userRoutes from "./routes/users.js";
import employeeRoutes from "./routes/employees.js";
import authRoutes from "./routes/auth.js";
import inventoryRoutes from "./routes/inventory.js";
import orderRoutes from "./routes/orders.js";
import financeRoutes from "./routes/financeRoutes.js";

// Load environment variables
dotenv.config();

const app = express();

// ===========================
// 🔧 MIDDLEWARE
// ===========================
app.use(cors());
app.use(express.json({ limit: "10mb" }));

// ===========================
// 🚏 ROUTES
// ===========================
app.use("/api/admin", adminRoutes);
app.use("/api/users", userRoutes);
app.use("/api/employees", employeeRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/finance", financeRoutes);

// ===========================
// 🧪 TEST ROUTE
// ===========================
app.get("/", (req, res) => {
  res.send("🎯 API Running with MongoDB Atlas connection");
});

// ===========================
// 💾 DATABASE CONNECTION (Atlas only)
// ===========================
const mongoURI = process.env.MONGO_URI;

if (!mongoURI) {
  console.error("❌ Missing MONGO_URI in .env file — cannot start without Atlas connection.");
  process.exit(1);
}

const connectDB = async () => {
  try {
    await mongoose.connect(mongoURI);
    console.log(`✅ MongoDB Atlas connected: ${mongoose.connection.name}`);
  } catch (error) {
    console.error("❌ MongoDB Atlas connection error:", error.message);
    process.exit(1);
  }
};

connectDB();

// ===========================
// ⚠️ GLOBAL ERROR HANDLER
// ===========================
app.use((err, req, res, next) => {
  console.error("🔥 Global Error:", err.stack);

  const status = err.status || 500;
  res.status(status).json({
    success: false,
    message: err.message || "Internal Server Error",
    error: process.env.NODE_ENV === "development" ? err.stack : undefined,
  });
});

// ===========================
// 🚀 START SERVER
// ===========================
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
