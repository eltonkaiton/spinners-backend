import express from 'express';
import mongoose from 'mongoose';

const router = express.Router();

// =============================
// PRODUCT SCHEMA & MODEL
// =============================
const productSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Product name is required'], trim: true },
    description: { type: String, trim: true },
    category: { type: String, required: [true, 'Category is required'], trim: true },
    artisanName: { type: String, required: [true, 'Artisan name is required'], trim: true },
    price: {
      type: Number,
      required: [true, 'Product price is required'],
      min: [0, 'Price must be positive'],
    },
    quantity: {
      type: Number,
      required: [true, 'Quantity is required'],
      min: [0, 'Quantity must be positive'],
    },
    image: { type: String, default: '' }, // URL or base64 string
    currency: { type: String, default: 'KES' },
  },
  { timestamps: true }
);

const Product = mongoose.model('Product', productSchema);

// =============================
// ADD NEW PRODUCT
// POST /api/inventory
// =============================
router.post('/', async (req, res) => {
  try {
    const { name, description, category, artisanName, price, quantity, image } = req.body;

    // ✅ Validate required fields
    if (!name || !category || !artisanName || !price || !quantity) {
      return res.status(400).json({
        error: 'Name, category, artisan name, price, and quantity are required.',
      });
    }

    const newProduct = new Product({
      name,
      description,
      category,
      artisanName,
      price,
      quantity,
      image,
    });

    const savedProduct = await newProduct.save();

    res.status(201).json({
      message: '✅ Product added successfully',
      product: savedProduct,
    });
  } catch (error) {
    console.error('❌ Add product error:', error);
    res.status(500).json({ error: 'Failed to add product' });
  }
});

// =============================
// GET ALL PRODUCTS
// GET /api/inventory
// =============================
router.get('/', async (req, res) => {
  try {
    const products = await Product.find().sort({ createdAt: -1 });
    res.status(200).json(products);
  } catch (error) {
    console.error('❌ Fetch products error:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// =============================
// GET SINGLE PRODUCT
// GET /api/inventory/:id
// =============================
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    const product = await Product.findById(id);
    if (!product) return res.status(404).json({ error: 'Product not found' });

    res.status(200).json(product);
  } catch (error) {
    console.error('❌ Fetch product error:', error);
    res.status(500).json({ error: 'Failed to fetch product' });
  }
});

// =============================
// UPDATE PRODUCT
// PUT /api/inventory/:id
// =============================
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    const updatedProduct = await Product.findByIdAndUpdate(id, req.body, { new: true });
    if (!updatedProduct) return res.status(404).json({ error: 'Product not found' });

    res.status(200).json({
      message: '✅ Product updated successfully',
      product: updatedProduct,
    });
  } catch (error) {
    console.error('❌ Update product error:', error);
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// =============================
// DELETE PRODUCT
// DELETE /api/inventory/:id
// =============================
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid product ID' });
    }

    const deleted = await Product.findByIdAndDelete(id);
    if (!deleted) return res.status(404).json({ error: 'Product not found' });

    res.status(200).json({ message: '🗑️ Product deleted successfully' });
  } catch (error) {
    console.error('❌ Delete product error:', error);
    res.status(500).json({ error: 'Failed to delete product' });
  }
});

export default router;
