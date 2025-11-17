// ✅ models/Admin.js (ES Module version)

import mongoose from 'mongoose';

const AdminSchema = new mongoose.Schema({
  username: { type: String, required: true },
  email:    { type: String, required: true, unique: true },
  password: { type: String, required: true }, // hashed password
  createdAt: { type: Date, default: Date.now },
});

// ✅ Export default for ES Modules
const Admin = mongoose.model('Admin', AdminSchema);
export default Admin;
