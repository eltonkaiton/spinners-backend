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
      enum: ["paid", "pending", "approved", "rejected"], 
      default: "pending" 
    },
    orderStatus: { 
      type: String, 
      enum: [
        "pending", "processing", "approved", "rejected", 
        "cancelled", "completed", "delivered", "received"
      ], 
      default: "pending" 
    },
    notes: { type: String }, // Added for order notes
  },
  { timestamps: true }
);

export default mongoose.model("Order", OrderSchema);