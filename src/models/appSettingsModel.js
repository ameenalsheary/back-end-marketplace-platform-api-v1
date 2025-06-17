const mongoose = require("mongoose");

const appSettingsSchema = new mongoose.Schema(
  {
    taxPrice: {
      required: [true, "Tax price is required."],
      type: Number,
      default: 0,
      min: 0,
    },
    shippingPrice: {
      required: [true, "Shipping price is required."],
      type: Number,
      default: 0,
      min: 0,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("AppSettings", appSettingsSchema);
