import mongoose from "mongoose";

const ArtisanSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  bio: String,
  location: String,
  shopName: String,
  verified: { type: Boolean, default: false },
  documents: [String], // urls to certification images
  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Artisan", ArtisanSchema);
