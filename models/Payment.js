// Payment.js
const PaymentSchema = new mongoose.Schema({
  order: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
  method: String, // mpesa, card
  providerTxnId: String,
  amount: Number,
  status: { type: String, enum:["initiated","success","failed"], default:"initiated" },
  meta: Object,
  createdAt: { type: Date, default: Date.now }
});
export default mongoose.model("Payment", PaymentSchema);
