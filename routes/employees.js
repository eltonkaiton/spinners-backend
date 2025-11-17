import express from "express";
import bcrypt from "bcryptjs";
import Employee from "../models/Employee.js";

const router = express.Router();

// ➕ Add Employee
router.post("/add", async (req, res) => {
  try {
    const { fullName, email, phone, password, role } = req.body;

    // Validate required fields
    if (!fullName || !email || !password) {
      return res.status(400).json({ error: "All required fields must be filled" });
    }

    // Check for existing email
    const existing = await Employee.findOne({ email });
    if (existing) {
      return res.status(409).json({ error: "Email already exists" });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create new employee
    const newEmployee = new Employee({
      fullName,
      email,
      phone,
      password: hashedPassword,
      role: role || "employee",
    });

    await newEmployee.save();
    res.status(201).json({ message: "Employee added successfully", employee: newEmployee });
  } catch (error) {
    console.error("Error adding employee:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// 🧾 Get All Employees
router.get("/", async (req, res) => {
  try {
    const employees = await Employee.find().sort({ createdAt: -1 });
    res.json(employees);
  } catch (error) {
    console.error("Error fetching employees:", error);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
