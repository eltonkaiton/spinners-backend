import express from "express";
import mongoose from "mongoose";

const router = express.Router();

// Example Mongoose Models (adjust names if different)
import Order from "../models/Order.js";
import User from "../models/User.js";
import Product from "../models/Product.js";

/**
 * 🧾 GET /api/finance/orders
 * Fetch all orders/bookings for finance dashboard
 */
router.get("/orders", async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("userId", "full_name email")
      .populate("productId", "name")
      .sort({ createdAt: -1 });

    res.json({ success: true, bookings: orders });
  } catch (error) {
    console.error("❌ Error fetching finance orders:", error.message);
    res.status(500).json({ success: false, error: "Failed to fetch orders" });
  }
});

/**
 * ✅ PUT /api/finance/approve/:id
 * Approve a payment
 */
router.put("/approve/:id", async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, error: "Order not found" });

    order.paymentStatus = "approved";
    await order.save();

    res.json({ success: true, message: "Payment approved" });
  } catch (error) {
    console.error("❌ Approve error:", error.message);
    res.status(500).json({ success: false, error: "Failed to approve payment" });
  }
});

/**
 * ❌ PUT /api/finance/reject/:id
 * Reject a payment
 */
router.put("/reject/:id", async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ success: false, error: "Order not found" });

    order.paymentStatus = "rejected";
    await order.save();

    res.json({ success: true, message: "Payment rejected" });
  } catch (error) {
    console.error("❌ Reject error:", error.message);
    res.status(500).json({ success: false, error: "Failed to reject payment" });
  }
});

/**
 * 📊 GET /api/finance/report
 * Generate a simple finance summary report
 */
router.get("/report", async (req, res) => {
  try {
    const orders = await Order.find();

    // Aggregate data for report
    const totalPayments = orders.reduce((sum, o) => sum + (o.totalPrice || 0), 0);
    const totalApproved = orders.filter((o) => o.paymentStatus === "approved").length;
    const totalRejected = orders.filter((o) => o.paymentStatus === "rejected").length;

    const report = [
      {
        user: "All Users",
        totalPayments,
        totalApproved,
        totalRejected,
      },
    ];

    res.json({ success: true, report });
  } catch (error) {
    console.error("❌ Report error:", error.message);
    res.status(500).json({ success: false, error: "Failed to generate report" });
  }
});

export default router;
