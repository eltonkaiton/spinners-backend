// models/Order.js
import mongoose from "mongoose";

const OrderSchema = new mongoose.Schema(
  {
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    userId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User", 
      required: function() { 
        return this.orderType === "customer"; 
      } 
    },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    
    // New fields for inventory orders
    orderType: {
      type: String,
      enum: ["customer", "inventory"],
      default: "customer"
    },
    supplierId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: function() {
        return this.orderType === "inventory";
      }
    },
    artisanId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: function() {
        return this.orderType === "inventory";
      }
    },
    
    quantity: { type: Number, required: true },
    totalPrice: { type: Number, required: true },
    paymentMethod: { type: String, required: true },
    paymentTiming: { 
      type: String, 
      enum: ["beforeDelivery", "afterDelivery"], 
      required: true 
    },
    paymentCode: { type: String },
    deliveryAddress: { type: String },
    paymentStatus: { 
      type: String, 
      enum: ["paid", "pending", "approved", "rejected", "received"], 
      default: "pending" 
    },
    orderStatus: { 
      type: String, 
      enum: [
        "pending", "processing", "approved", "rejected", 
        "cancelled", "completed", "delivered", "received",
        "shipped", "in_progress"
      ], 
      default: "pending" 
    },
    notes: { type: String }, // Added for order notes

    // New timestamp fields for order lifecycle tracking
    receivedAt: { 
      type: Date, 
      default: null 
    },    // When artisan receives the order
    deliveredAt: { 
      type: Date, 
      default: null 
    },   // When supplier delivers the order
    completedAt: { 
      type: Date, 
      default: null 
    },   // When order is completed
    shippedAt: { 
      type: Date, 
      default: null 
    },    // When order is shipped
    approvedAt: { 
      type: Date, 
      default: null 
    },   // When order is approved
    rejectedAt: { 
      type: Date, 
      default: null 
    },   // When order is rejected
  },
  { 
    timestamps: true 
  }
);

// Index for better query performance
OrderSchema.index({ orderType: 1, orderStatus: 1 });
OrderSchema.index({ artisanId: 1, orderType: 1 });
OrderSchema.index({ supplierId: 1, orderType: 1 });
OrderSchema.index({ createdBy: 1 });
OrderSchema.index({ receivedAt: 1 });
OrderSchema.index({ deliveredAt: 1 });

export default mongoose.model("Order", OrderSchema);