import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import User from "../models/User.js";

async function main() {
  try {
    const [,, emailArg, newPasswordArg] = process.argv;
    if (!emailArg || !newPasswordArg) {
      console.error("Usage: node resetAdminPassword.js <email> <newPassword>");
      process.exit(1);
    }

    const email = emailArg.trim();
    const newPassword = newPasswordArg.trim();

    await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("✅ Connected to MongoDB");

    const user = await User.findOne({ email });
    if (!user) {
      console.error(`❌ No user found with email: ${email}`);
      await mongoose.disconnect();
      process.exit(1);
    }

    // Reset password (plaintext, pre-save hook will hash it)
    user.password = newPassword;
    user.status = "active";
    await user.save();
    console.log(`✅ Password reset for ${email}. Hash saved to DB.`);

    // Verification
    const savedUser = await User.findOne({ email });
    const isMatch = await savedUser.comparePassword(newPassword);
    console.log("🔍 Verification bcrypt.compare =>", isMatch ? "✅ true" : "❌ false");

    await mongoose.disconnect();
    process.exit(0);

  } catch (err) {
    console.error("❌ Script error:", err);
    try { await mongoose.disconnect(); } catch(e) {}
    process.exit(1);
  }
}

main();
