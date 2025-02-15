const mongoose = require("mongoose");

// Define Cart Item Schema
const cartItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.ObjectId,
      ref: "Product",
      required: [true, "Product ID is required."],
    },
    quantity: {
      type: Number,
      default: 1,
      required: [true, "Product quantity is required."],
      min: [1, "Product quantity must be at least 1."],
    },
    size: {
      type: String,
      trim: true,
      minlength: [1, "Product size must be at least 1 character."],
      maxlength: [8, "Product size cannot exceed 8 characters."],
    },
    color: {
      type: String,
      trim: true,
      minlength: [3, "Product color name must be at least 3 characters."],
      maxlength: [32, "Product color name cannot exceed 32 characters."],
    },
    price: {
      type: Number,
      required: [true, "Product price is required."],
      min: [0, "Product price must be at least 0."],
    },
    totalPrice: {
      type: Number,
      default: 0,
      min: [0, "Total price must be at least 0."],
    },
    idOfRedisBullMqJob: {
      type: String,
      required: true,
      trim: true,
    },
  },
  { timestamps: true }
);

// Define Cart Schema
const cartSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: [true, "User ID is required."],
      index: true, // Index for better performance on queries
    },
    cartItems: [cartItemSchema], // Use the defined cart item schema
    taxPrice: {
      type: Number,
      default: 0,
      min: [0, "Tax price must be at least 0."],
    },
    shippingPrice: {
      type: Number,
      default: 0,
      min: [0, "Shipping price must be at least 0."],
    },
    totalPrice: {
      type: Number,
      default: 0,
      min: [0, "Total price must be at least 0."],
    },
    couponName: {
      type: String,
      trim: true,
      minlength: [3, "Coupon name must be at least 3 characters."],
      maxlength: [32, "Coupon name cannot exceed 32 characters."],
    },
    couponId: {
      type: String,
      trim: true
    },
    couponDiscount: {
      type: Number,
      min: [0, "Coupon discount must be at least 0."],
      max: [100, "Coupon discount cannot exceed 100."],
    },
    totalPriceAfterDiscount: {
      type: Number,
      min: [0, "Total price after discount must be at least 0."],
    },
  },
  { timestamps: true }
);

cartSchema.pre(/^find/, function (next) {
  this.populate({
    path: "cartItems.product",
    select: [
      "title",
      "price",
      "priceBeforeDiscount",
      "discountPercent",
      "imageCover",
      "quantity",
      "color",
      "sizes",
    ].join(" "), // Join fields into a single string
  });
  next();
});

module.exports = mongoose.model("Cart", cartSchema);
