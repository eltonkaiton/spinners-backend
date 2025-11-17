// db.js or database.js
const mongoose = require('mongoose');
require('dotenv').config(); // Load .env variables

const uri = process.env.MONGO_URI;

mongoose.connect(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('Connected to MongoDB database ✅'))
.catch(err => console.error('Database connection failed:', err));

module.exports = mongoose;
