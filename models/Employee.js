import mongoose from "mongoose";

const EmployeeSchema = new mongoose.Schema({
  fullName: { type: String, required: true }, // changed from full_name to fullName
  email: { type: String, required: true, unique: true },
  phone: String,
  password: { type: String, required: true },
  role: { type: String, default: "employee" }, // default changed from "staff"
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Employee", EmployeeSchema);
