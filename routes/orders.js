// ./routes/orders.js
import express from "express";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import User from "../models/User.js";

const router = express.Router();

/* ======================================================
   🔐 VERIFY JWT TOKEN
====================================================== */
const verifyToken = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "Access denied. No token provided.",
      });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "secretkey");
    req.user = {
      ...decoded,
      id: decoded.id.toString(), // normalize as string
    };
    next();
  } catch (error) {
    console.error("❌ Invalid token:", error.message);
    res.status(403).json({
      success: false,
      message: "Invalid or expired token.",
    });
  }
};

/* ======================================================
   🛒 CREATE NEW ORDER
====================================================== */
router.post("/", verifyToken, async (req, res) => {
  try {
    const {
      userId,
      productId,
      quantity,
      totalPrice,
      paymentMethod,
      paymentTiming,
      paymentCode,
      deliveryAddress,
    } = req.body;

    if (!userId || !productId || !quantity || !totalPrice) {
      return res.status(400).json({
        success: false,
        message: "Missing required order fields.",
      });
    }

    let paymentStatus = "pending";
    let orderStatus = "pending";

    if (paymentTiming === "beforeDelivery" && paymentCode) {
      paymentStatus = "paid"; // waiting for finance approval
    }

    const order = new Order({
      userId,
      productId,
      quantity,
      totalPrice,
      paymentMethod,
      paymentTiming,
      paymentCode: paymentCode || null,
      deliveryAddress: deliveryAddress || "",
      paymentStatus,
      orderStatus,
    });

    await order.save();

    await order.populate([
      { path: "userId", select: "fullName email" },
      { path: "productId", select: "name price image artisanName category" },
    ]);

    res.status(201).json({
      success: true,
      message: "Order created successfully",
      order,
    });
  } catch (error) {
    console.error("❌ Error creating order:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create order.",
      error: error.message,
    });
  }
});

/* ======================================================
   👤 GET ORDERS FOR A SPECIFIC USER
====================================================== */
router.get("/user/:id", verifyToken, async (req, res) => {
  const { id } = req.params;

  // Compare strings for safety
  if (req.user.id !== id.toString() && !["admin", "finance"].includes(req.user.role)) {
    return res.status(403).json({ success: false, message: "Access denied." });
  }

  try {
    const orders = await Order.find({ userId: id })
      .populate("userId", "fullName email")
      .populate("productId", "name price image artisanName category")
      .populate("driverId", "fullName email")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: orders.length, orders });
  } catch (error) {
    console.error("❌ Fetch user orders error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch user orders.",
      error: error.message,
    });
  }
});

/* ======================================================
   🧑‍✈️ GET USERS WITH ROLE DRIVER
====================================================== */
router.get("/drivers/list", verifyToken, async (req, res) => {
  try {
    const drivers = await User.find({ role: "driver" }).select("fullName email");
    res.status(200).json({ success: true, users: drivers });
  } catch (error) {
    console.error("❌ Fetch drivers error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch drivers.",
      error: error.message,
    });
  }
});

/* ======================================================
   🚚 GET DRIVER’S ASSIGNED ORDERS
====================================================== */
router.get("/driver", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "driver") {
      return res.status(403).json({ success: false, message: "Access denied. Driver only." });
    }

    const driverId = req.user.id;
    const driverObjectId = new mongoose.Types.ObjectId(driverId);

    const orders = await Order.find({
      $or: [{ driverId: driverObjectId }, { driverId }],
    })
      .populate("userId", "fullName email")
      .populate("productId", "name price image artisanName category")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: orders.length, orders });
  } catch (error) {
    console.error("❌ Driver fetch orders error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch driver orders.",
      error: error.message,
    });
  }
});

/* ======================================================
   🧾 GET ALL ORDERS (ADMIN / ARTISAN / PUBLIC)
====================================================== */
router.get("/", async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("userId", "fullName email")
      .populate("productId", "name price image artisanName category")
      .populate("driverId", "fullName email")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: orders.length, orders });
  } catch (error) {
    console.error("❌ Fetch orders error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch orders.",
      error: error.message,
    });
  }
});

/* ======================================================
   👤 GET SINGLE ORDER BY ID
====================================================== */
router.get("/:id", async (req, res) => {
  const { id } = req.params;

  try {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: "Invalid order ID." });
    }

    const order = await Order.findById(id)
      .populate("userId", "fullName email")
      .populate("productId", "name price image artisanName category")
      .populate("driverId", "fullName email");

    if (!order)
      return res.status(404).json({ success: false, message: "Order not found." });

    res.json({ success: true, order });
  } catch (error) {
    console.error("❌ Fetch single order error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch order.",
      error: error.message,
    });
  }
});

/* ======================================================
   🏷️ ASSIGN DRIVER TO ORDER
====================================================== */
router.put("/assign-driver/:id", verifyToken, async (req, res) => {
  try {
    const { driverId } = req.body;

    const driver = await User.findById(driverId);
    if (!driver || driver.role !== "driver") {
      return res.status(400).json({ success: false, message: "Invalid driver ID." });
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      { driverId: new mongoose.Types.ObjectId(driverId) },
      { new: true }
    )
      .populate("userId", "fullName email")
      .populate("productId", "name price image artisanName category")
      .populate("driverId", "fullName email");

    if (!updatedOrder)
      return res.status(404).json({ success: false, message: "Order not found." });

    res.json({
      success: true,
      message: "Driver assigned successfully.",
      order: updatedOrder,
    });
  } catch (error) {
    console.error("❌ Assign driver error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to assign driver.",
      error: error.message,
    });
  }
});

/* ======================================================
   🔄 UPDATE ORDER STATUS
====================================================== */
router.put("/update-status/:id", verifyToken, async (req, res) => {
  try {
    const { status } = req.body;

    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      { orderStatus: status },
      { new: true }
    );

    if (!updatedOrder)
      return res.status(404).json({ success: false, message: "Order not found." });

    res.json({ success: true, order: updatedOrder });
  } catch (err) {
    console.error("❌ Update order status error:", err);
    res.status(500).json({ success: false, message: "Server error." });
  }
});

/* ======================================================
   💰 UPDATE PAYMENT STATUS
====================================================== */
router.put("/update-payment-status/:id", verifyToken, async (req, res) => {
  try {
    const { paymentStatus } = req.body;
    const validStatuses = ["pending", "approved", "rejected"];
    if (!validStatuses.includes(paymentStatus)) {
      return res.status(400).json({
        success: false,
        message: `Invalid payment status. Use one of: ${validStatuses.join(", ")}`,
      });
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      req.params.id,
      { paymentStatus },
      { new: true }
    );

    if (!updatedOrder)
      return res.status(404).json({ success: false, message: "Order not found." });

    res.json({
      success: true,
      message: `Payment status updated to '${paymentStatus}'`,
      order: updatedOrder,
    });
  } catch (error) {
    console.error("❌ Update payment status error:", error.message);
    res.status(500).json({
      success: false,
      message: "Failed to update payment status.",
      error: error.message,
    });
  }
});

/* ======================================================
   🧾 SUPERVISOR - GET ALL ORDERS
====================================================== */
router.get("/supervisor", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "supervisor") {
      return res.status(403).json({ success: false, message: "Access denied. Supervisor only." });
    }

    let orders = await Order.find()
      .populate("userId", "fullName email")
      .populate("productId", "name price image artisanName category")
      .populate("driverId", "fullName email")
      .sort({ createdAt: -1 });

    // Ensure valid ObjectId references
    orders = orders.filter(
      (o) =>
        o.userId &&
        o.productId &&
        mongoose.Types.ObjectId.isValid(o.userId._id) &&
        mongoose.Types.ObjectId.isValid(o.productId._id)
    );

    res.status(200).json({ success: true, count: orders.length, orders });
  } catch (error) {
    console.error("❌ Supervisor fetch orders error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch supervisor orders.",
      error: error.message,
    });
  }
});

// PUT /api/orders/:id/mark-received
router.put("/:id/mark-received", async (req, res) => {
  try {
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { orderStatus: "Received" },
      { new: true }
    );
    if (!order) return res.status(404).json({ success: false, message: "Order not found" });
    res.json({ success: true, order });
  } catch (err) {
    console.error("❌ Mark as received error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// PUT /api/orders/:id/mark-complete
router.put("/:id/mark-complete", async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // Optional: restrict access to supervisors only
    if (req.user && req.user.role !== "supervisor") {
      return res.status(403).json({ success: false, message: "Access denied. Supervisor only." });
    }

    // ✅ Use lowercase value as per schema
    order.orderStatus = "completed";
    await order.save();

    res.json({ success: true, message: "Order marked as complete", order });
  } catch (err) {
    console.error("❌ Mark as complete error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});





export default router;
