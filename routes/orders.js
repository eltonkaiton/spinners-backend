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
   🛒 CREATE NEW ORDER (UPDATED FOR INVENTORY ORDERS)
====================================================== */
router.post("/", verifyToken, async (req, res) => {
  try {
    const {
      productId,
      quantity,
      totalPrice,
      paymentMethod,
      paymentTiming,
      paymentCode,
      deliveryAddress,
      supplierId, // For inventory orders
      artisanId,  // For inventory orders
      orderType = "customer", // "customer" or "inventory"
    } = req.body;

    // Validate required fields based on order type
    if (orderType === "inventory") {
      // Inventory order validation
      if (!productId || !quantity || !supplierId) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields for inventory order: productId, quantity, supplierId",
        });
      }
    } else {
      // Customer order validation
      if (!productId || !quantity || !totalPrice) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields for customer order: productId, quantity, totalPrice",
        });
      }
    }

    let paymentStatus = "pending";
    let orderStatus = "pending";

    if (paymentTiming === "beforeDelivery" && paymentCode) {
      paymentStatus = "paid";
    }

    // Build order data
    const orderData = {
      createdBy: req.user.id,
      productId,
      quantity,
      paymentMethod: paymentMethod || "cash",
      paymentTiming: paymentTiming || "afterDelivery",
      paymentCode: paymentCode || null,
      deliveryAddress: deliveryAddress || "",
      paymentStatus,
      orderStatus,
      orderType,
    };

    // Add fields based on order type
    if (orderType === "inventory") {
      orderData.supplierId = supplierId;
      orderData.artisanId = artisanId || req.user.id;
      orderData.totalPrice = totalPrice || 0;
    } else {
      orderData.userId = req.body.userId || req.user.id;
      orderData.totalPrice = totalPrice;
    }

    const order = new Order(orderData);
    await order.save();

    // Enhanced population for different order types
    const populatePaths = [
      { path: "productId", select: "name price image artisanName category" },
    ];

    if (orderType === "inventory") {
      populatePaths.push(
        { path: "supplierId", select: "fullName email phone" },
        { path: "artisanId", select: "fullName email phone" }
      );
    } else {
      populatePaths.push(
        { path: "userId", select: "fullName email" }
      );
    }

    populatePaths.push({ path: "driverId", select: "fullName email" });

    await order.populate(populatePaths);

    res.status(201).json({
      success: true,
      message: `${
        orderType === "inventory" ? "Inventory" : "Customer"
      } order created successfully`,
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
   🎨 GET ARTISAN'S INVENTORY ORDERS (NEW ENDPOINT)
====================================================== */
router.get("/artisan/inventory-orders", verifyToken, async (req, res) => {
  try {
    const orders = await Order.find({ 
      artisanId: req.user.id,
      orderType: "inventory"
    })
      .populate("productId", "name price category")
      .populate("supplierId", "fullName email phone")
      .populate("driverId", "fullName email")
      .sort({ createdAt: -1 });

    res.status(200).json({ 
      success: true, 
      count: orders.length, 
      orders 
    });
  } catch (error) {
    console.error("❌ Fetch artisan inventory orders error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch inventory orders.",
      error: error.message,
    });
  }
});

/* ======================================================
   👥 GET SUPPLIERS FOR ARTISANS (NEW ENDPOINT)
====================================================== */
router.get("/suppliers/for-artisan", verifyToken, async (req, res) => {
  try {
    // Allow artisans to view suppliers
    if (!["artisan", "admin", "supervisor"].includes(req.user.role)) {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied. Artisans, admins, and supervisors only." 
      });
    }

    const suppliers = await User.find({ role: "supplier" })
      .select("fullName email phone businessName address");

    res.status(200).json({ 
      success: true, 
      count: suppliers.length, 
      suppliers 
    });
  } catch (error) {
    console.error("❌ Fetch suppliers error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch suppliers.",
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
   🚚 GET DRIVER'S ASSIGNED ORDERS
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
      .populate("supplierId", "fullName email")
      .populate("artisanId", "fullName email")
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
      .populate("supplierId", "fullName email")
      .populate("artisanId", "fullName email")
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
   💰 UPDATE PAYMENT STATUS (FIXED)
====================================================== */
router.put("/update-payment-status/:id", verifyToken, async (req, res) => {
  try {
    const { paymentStatus } = req.body;
    const validStatuses = ["pending", "approved", "rejected", "paid", "received"]; // ✅ ADDED "paid"
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
      .populate("supplierId", "fullName email")
      .populate("artisanId", "fullName email")
      .populate("driverId", "fullName email")
      .sort({ createdAt: -1 });

    // Ensure valid ObjectId references
    orders = orders.filter(
      (o) =>
        o.productId &&
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
      { orderStatus: "received" },
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
router.put("/:id/mark-complete", verifyToken, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // Optional: restrict access to supervisors only
    if (req.user && req.user.role !== "supervisor") {
      return res.status(403).json({ success: false, message: "Access denied. Supervisor only." });
    }

    order.orderStatus = "completed";
    await order.save();

    res.json({ success: true, message: "Order marked as complete", order });
  } catch (err) {
    console.error("❌ Mark as complete error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

/* ======================================================
   👤 GET MY ORDERS (FOR ARTISANS - CUSTOMER ORDERS)
====================================================== */
router.get("/my-orders", verifyToken, async (req, res) => {
  try {
    const orders = await Order.find({ 
      createdBy: req.user.id,
      orderType: "customer" // Only customer orders
    })
      .populate("productId", "name price")
      .populate("userId", "fullName email")
      .populate("driverId", "fullName email")
      .sort({ createdAt: -1 });

    res.status(200).json({ success: true, count: orders.length, orders });
  } catch (err) {
    console.error("❌ Fetch artisan orders error:", err);
    res.status(500).json({ success: false, message: "Failed to fetch your orders", error: err.message });
  }
});
/* ======================================================
   👥 GET SUPPLIER'S ORDERS
====================================================== */
router.get("/supplier/my-orders", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "supplier") {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied. Supplier only." 
      });
    }

    const supplierId = req.user.id;

    // Find orders where supplierId matches
    const orders = await Order.find({ 
      $or: [
        { supplierId: supplierId },
        { supplierId: new mongoose.Types.ObjectId(supplierId) }
      ]
    })
      .populate("productId", "name price category")
      .populate("artisanId", "fullName email phone")
      .populate("userId", "fullName email")
      .populate("driverId", "fullName email")
      .sort({ createdAt: -1 });

    res.status(200).json({ 
      success: true, 
      count: orders.length, 
      orders 
    });
  } catch (error) {
    console.error("❌ Fetch supplier orders error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch supplier orders.",
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
   🚚 MARK ORDER AS DELIVERED (Supplier-specific)
====================================================== */
router.put("/mark-delivered/:id", verifyToken, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    // Check if user is the supplier for this order
    const isSupplier = order.supplierId?.toString() === req.user.id || 
                      order.supplierId?._id?.toString() === req.user.id;

    if (!isSupplier && req.user.role !== "admin") {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied. Only the assigned supplier can mark as delivered." 
      });
    }

    order.orderStatus = "delivered";
    order.deliveredAt = new Date();
    await order.save();

    res.json({ 
      success: true, 
      message: "Order marked as delivered", 
      order 
    });
  } catch (err) {
    console.error("❌ Mark as delivered error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Optional: Clean up the markAsDelivered function to reduce console noise
const markAsDelivered = async (orderId) => {
  try {
    setLoading(true);

    // First try the direct mark-delivered endpoint
    try {
      const response = await axios.put(
        `${API_BASE_URL}/orders/mark-delivered/${orderId}`,
        {},
        { 
          headers: { 
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json'
          } 
        }
      );
      console.log("✅ Order delivered:", response.data);
      Alert.alert("Success", "Order marked as delivered!");
      loadData();
      setShowDeliveryModal(false);
      return;
    } catch (firstError) {
      // If mark-delivered fails, silently fallback to update-status
      if (firstError.response?.status === 404) {
        console.log("🔄 Using update-status endpoint for delivery...");
        await updateOrderStatus(orderId, 'delivered');
      } else {
        throw firstError; // Re-throw other errors
      }
    }
    
  } catch (err) {
    console.error("❌ Mark as delivered error:", err);
    Alert.alert("Error", "Failed to mark order as delivered. Please try again.");
  } finally {
    setLoading(false);
  }
};


/* ======================================================
   💰 FINANCE - GET ALL INVENTORY ORDERS
====================================================== */
router.get("/finance/inventory-orders", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "finance") {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied. Finance only." 
      });
    }

    const orders = await Order.find({ 
      orderType: "inventory"
    })
      .populate("productId", "name price category")
      .populate("supplierId", "fullName email phone businessName")
      .populate("artisanId", "fullName email phone")
      .populate("driverId", "fullName email")
      .sort({ createdAt: -1 });

    res.status(200).json({ 
      success: true, 
      count: orders.length, 
      orders 
    });
  } catch (error) {
    console.error("❌ Finance fetch inventory orders error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch inventory orders.",
      error: error.message,
    });
  }
});

/* ======================================================
   💰 FINANCE - APPROVE INVENTORY ORDER
====================================================== */
router.put("/finance/:id/approve", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "finance") {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied. Finance only." 
      });
    }

    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: "Order not found." 
      });
    }

    if (order.orderType !== "inventory") {
      return res.status(400).json({ 
        success: false, 
        message: "Only inventory orders can be approved through this endpoint." 
      });
    }

    order.orderStatus = "approved";
    order.paymentStatus = "approved";
    await order.save();

    // Populate the updated order
    await order.populate([
      { path: "productId", select: "name price category" },
      { path: "supplierId", select: "fullName email phone" },
      { path: "artisanId", select: "fullName email phone" }
    ]);

    res.status(200).json({
      success: true,
      message: "Inventory order approved successfully!",
      order
    });
  } catch (error) {
    console.error("❌ Finance approve order error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to approve order.",
      error: error.message,
    });
  }
});

/* ======================================================
   💰 FINANCE - REJECT INVENTORY ORDER
====================================================== */
router.put("/finance/:id/reject", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "finance") {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied. Finance only." 
      });
    }

    const { reason } = req.body;
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: "Order not found." 
      });
    }

    if (order.orderType !== "inventory") {
      return res.status(400).json({ 
        success: false, 
        message: "Only inventory orders can be rejected through this endpoint." 
      });
    }

    order.orderStatus = "rejected";
    order.paymentStatus = "rejected";
    order.notes = reason || "Rejected by finance department";
    await order.save();

    // Populate the updated order
    await order.populate([
      { path: "productId", select: "name price category" },
      { path: "supplierId", select: "fullName email phone" },
      { path: "artisanId", select: "fullName email phone" }
    ]);

    res.status(200).json({
      success: true,
      message: "Inventory order rejected successfully!",
      order
    });
  } catch (error) {
    console.error("❌ Finance reject order error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reject order.",
      error: error.message,
    });
  }
});

/* ======================================================
   💰 FINANCE - PROCESS PAYMENT FOR INVENTORY ORDER
====================================================== */
router.post("/finance/:id/payment", verifyToken, async (req, res) => {
  try {
    if (req.user.role !== "finance") {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied. Finance only." 
      });
    }

    const { amount, paymentMethod, notes } = req.body;
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: "Order not found." 
      });
    }

    if (order.orderType !== "inventory") {
      return res.status(400).json({ 
        success: false, 
        message: "Only inventory orders can be processed through this endpoint." 
      });
    }

    // Update order status and payment information
    order.paymentStatus = "paid";
    order.orderStatus = "completed";
    order.paymentMethod = paymentMethod || order.paymentMethod;
    order.notes = notes || order.notes;
    
    if (amount && amount > 0) {
      order.totalPrice = amount;
    }

    await order.save();

    // Populate the updated order
    await order.populate([
      { path: "productId", select: "name price category" },
      { path: "supplierId", select: "fullName email phone" },
      { path: "artisanId", select: "fullName email phone" }
    ]);

    res.status(200).json({
      success: true,
      message: "Payment processed successfully!",
      order
    });
  } catch (error) {
    console.error("❌ Finance process payment error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process payment.",
      error: error.message,
    });
  }
});

/* ======================================================
   📦 MARK INVENTORY ORDER AS RECEIVED (Artisan-specific)
====================================================== */
router.put("/mark-received/:id", verifyToken, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: "Order not found." 
      });
    }

    // Check if the order is an inventory order
    if (order.orderType !== "inventory") {
      return res.status(400).json({ 
        success: false, 
        message: "Only inventory orders can be marked as received." 
      });
    }

    // Check if user is the artisan who placed this order
    const isArtisan = order.artisanId?.toString() === req.user.id || 
                     order.artisanId?._id?.toString() === req.user.id ||
                     order.createdBy?.toString() === req.user.id;

    if (!isArtisan && req.user.role !== "admin") {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied. Only the artisan who placed this order can mark it as received." 
      });
    }

    // Check if order is in a state that can be marked as received
    const validPreviousStatuses = ['delivered', 'shipped', 'completed'];
    if (!validPreviousStatuses.includes(order.orderStatus?.toLowerCase())) {
      return res.status(400).json({ 
        success: false, 
        message: `Order must be delivered or shipped before marking as received. Current status: ${order.orderStatus}` 
      });
    }

    // Update order status
    order.orderStatus = "received";
    order.receivedAt = new Date();
    
    // If payment timing is after delivery, update payment status
    if (order.paymentTiming === "afterDelivery") {
      order.paymentStatus = "paid";
    }

    await order.save();

    // Populate the updated order for response
    await order.populate([
      { path: "productId", select: "name price category" },
      { path: "supplierId", select: "fullName email phone" },
      { path: "artisanId", select: "fullName email phone" }
    ]);

    res.status(200).json({
      success: true,
      message: "Order marked as received successfully!",
      order
    });

  } catch (error) {
    console.error("❌ Mark as received error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to mark order as received.",
      error: error.message,
    });
  }
});

/* ======================================================
   🔄 UPDATE ORDER STATUS (Enhanced for inventory orders)
====================================================== */
router.put("/update-status/:id", verifyToken, async (req, res) => {
  try {
    const { status } = req.body;
    
    if (!status) {
      return res.status(400).json({
        success: false,
        message: "Status is required."
      });
    }

    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: "Order not found." 
      });
    }

    // Check permissions based on order type and user role
    if (order.orderType === "inventory") {
      // For inventory orders, check if user is artisan, supplier, or admin
      const isArtisan = order.artisanId?.toString() === req.user.id || 
                       order.artisanId?._id?.toString() === req.user.id;
      const isSupplier = order.supplierId?.toString() === req.user.id || 
                        order.supplierId?._id?.toString() === req.user.id;
      
      if (!isArtisan && !isSupplier && !["admin", "supervisor", "finance"].includes(req.user.role)) {
        return res.status(403).json({ 
          success: false, 
          message: "Access denied. Only the artisan, supplier, or authorized staff can update inventory order status." 
        });
      }

      // Special handling for "received" status
      if (status.toLowerCase() === "received") {
        const validPreviousStatuses = ['delivered', 'shipped', 'completed'];
        if (!validPreviousStatuses.includes(order.orderStatus?.toLowerCase())) {
          return res.status(400).json({ 
            success: false, 
            message: `Order must be delivered or shipped before marking as received. Current status: ${order.orderStatus}` 
          });
        }
        
        // Only allow artisans to mark as received
        if (!isArtisan && req.user.role !== "admin") {
          return res.status(403).json({ 
            success: false, 
            message: "Only the artisan can mark inventory orders as received." 
          });
        }
      }
    }

    // Update order status
    order.orderStatus = status;
    
    // Auto-update timestamps for certain statuses
    if (status.toLowerCase() === "received") {
      order.receivedAt = new Date();
    } else if (status.toLowerCase() === "delivered") {
      order.deliveredAt = new Date();
    } else if (status.toLowerCase() === "completed") {
      order.completedAt = new Date();
    }

    await order.save();

    // Populate the updated order
    await order.populate([
      { path: "productId", select: "name price category" },
      { path: "supplierId", select: "fullName email phone" },
      { path: "artisanId", select: "fullName email phone" },
      { path: "userId", select: "fullName email" }
    ]);

    res.status(200).json({
      success: true,
      message: `Order status updated to '${status}' successfully!`,
      order
    });

  } catch (error) {
    console.error("❌ Update order status error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update order status.",
      error: error.message,
    });
  }
});

/* ======================================================
   💰 SUPPLIER - SUBMIT PAYMENT AMOUNT FOR ORDER
====================================================== */
router.put("/:id/payment", verifyToken, async (req, res) => {
  try {
    const { amount, notes, paymentStatus = "pending" } = req.body;
    
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid payment amount"
      });
    }

    const order = await Order.findById(req.params.id);
    
    if (!order) {
      return res.status(404).json({ 
        success: false, 
        message: "Order not found." 
      });
    }

    // Check if user is the supplier for this order
    const isSupplier = order.supplierId?.toString() === req.user.id || 
                      order.supplierId?._id?.toString() === req.user.id;

    if (!isSupplier && req.user.role !== "admin") {
      return res.status(403).json({ 
        success: false, 
        message: "Access denied. Only the assigned supplier can submit payment amounts." 
      });
    }

    // Check if order is in a state that can have payment submitted
    const validStatuses = ['delivered', 'received', 'completed'];
    if (!validStatuses.includes(order.orderStatus?.toLowerCase())) {
      return res.status(400).json({ 
        success: false, 
        message: `Payment can only be submitted for delivered, received, or completed orders. Current status: ${order.orderStatus}` 
      });
    }

    // Update order with payment information
    order.totalPrice = parseFloat(amount);
    order.paymentStatus = paymentStatus;
    order.notes = notes || order.notes;
    order.updatedAt = new Date();

    await order.save();

    // Populate the updated order
    await order.populate([
      { path: "productId", select: "name price category" },
      { path: "supplierId", select: "fullName email phone" },
      { path: "artisanId", select: "fullName email phone" }
    ]);

    res.status(200).json({
      success: true,
      message: "Payment amount submitted successfully! Waiting for finance approval.",
      order
    });

  } catch (error) {
    console.error("❌ Submit payment error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to submit payment amount.",
      error: error.message,
    });
  }
});
export default router;