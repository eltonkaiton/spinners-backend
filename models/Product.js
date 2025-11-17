import mongoose from "mongoose";

const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: { type: String, required: false },
  category: { type: String, required: true },
  artisanName: { type: String, required: true },
  price: { type: Number, required: true },
  quantity: { type: Number, default: 0 },
  image: { type: String, default: "" },
  currency: { type: String, default: "KES" },
  createdAt: { type: Date, default: Date.now },
});

// ✅ Prevent model overwrite error during hot reloads (Nodemon, etc.)
export default mongoose.models.Product || mongoose.model("Product", ProductSchema);
