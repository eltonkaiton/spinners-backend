// models/User.js
import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const UserSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required:true, unique:true },
  password: { type: String, required: true },
  phone: String,
  role: { 
    type: String, 
    enum: ["customer","artisan","admin","finance","supervisor","driver","supplier"], 
    default: "customer" 
  },
  status: { 
    type: String, 
    enum: ["active","pending","suspended","rejected"], // ✅ Add 'rejected'
    default:"active" 
  },
  createdAt: { type: Date, default: Date.now }
});

UserSchema.pre("save", async function(next){
  if(!this.isModified("password")) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

UserSchema.methods.comparePassword = function(candidate){
  return bcrypt.compare(candidate, this.password);
};

export default mongoose.model("User", UserSchema);//user schema 