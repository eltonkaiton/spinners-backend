import express from "express";
import Product from "../models/Product.js";

const router = express.Router();

// GET all products
router.get("/", async (req, res) => {
  try {
    const products = await Product.find().populate("artisan", "name email"); // populate artisan info
    res.json(products);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// ADD a new product
router.post("/add", async (req, res) => {
  try {
    const { artisan, title, description, price, currency, images, category, stock } = req.body;

    if (!artisan || !title || price === undefined) {
      return res.status(400).json({ message: "Please provide artisan, title, and price" });
    }

    const newProduct = new Product({
      artisan,
      title,
      description,
      price,
      currency: currency || "KES",
      images: images || [],
      category,
      stock: stock || 0,
    });

    await newProduct.save();
    res.json({ message: "Product added successfully", product: newProduct });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// UPDATE a product
router.put("/update/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const updatedData = req.body;
    const updatedProduct = await Product.findByIdAndUpdate(id, updatedData, { new: true });
    res.json({ message: "Product updated successfully", product: updatedProduct });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE a product
router.delete("/delete/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await Product.findByIdAndDelete(id);
    res.json({ message: "Product deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
