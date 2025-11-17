// models/Order.js
import mongoose from "mongoose";

const OrderSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    driverId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, // ✅ Driver assignment
    quantity: { type: Number, required: true },
    totalPrice: { type: Number, required: true },
    paymentMethod: { type: String, required: true },
    paymentTiming: { type: String, enum: ["beforeDelivery", "afterDelivery"], required: true },
    paymentCode: { type: String },
    deliveryAddress: { type: String },
    paymentStatus: { type: String, enum: ["paid", "pending", "approved", "rejected"], default: "pending" },
    orderStatus: { 
      type: String, 
      enum: ["pending","processing","approved","rejected","cancelled","completed","delivered","received"], 
      default: "pending" 
    },
  },
  { timestamps: true }
);

export default mongoose.model("Order", OrderSchema);
