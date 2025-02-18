const mongoose = require("mongoose");

// Define Order Item Schema (similar to Cart Item Schema)
const orderItemSchema = new mongoose.Schema(
  {
    product: {
      type: mongoose.Schema.ObjectId,
      ref: "Product",
      required: [true, "Product ID is required."],
    },
    quantity: {
      type: Number,
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
  },
  { timestamps: true }
);

// Define Order Schema
const orderSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: [true, "User ID is required."],
    },
    orderItems: [orderItemSchema], // Use the defined order item schema
    pricing: {
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
      totalPriceAfterDiscount: {
        type: Number,
        min: [0, "Total price after discount must be at least 0."],
      },
    },
    coupon: {
      couponId: {
        type: String,
        trim: true,
      },
      couponCode: {
        type: String,
        trim: true,
        minlength: [3, "Coupon code must be at least 3 characters."],
        maxlength: [32, "Coupon code cannot exceed 32 characters."],
      },
      couponDiscount: {
        type: Number,
        min: [0, "Coupon discount must be at least 0."],
        max: [100, "Coupon discount cannot exceed 100."],
      },
      discountedAmount: {
        type: Number,
        min: [0, "Discounted amount must be at least 0."],
      },
    },
    paymentMethod: {
      type: String,
      required: [true, "Payment method is required."],
      enum: ["credit_card", "cash_on_delivery"],
    },
    paymentStatus: {
      type: String,
      required: [true, "Payment status is required."],
      enum: ["pending", "completed", "failed"],
      default: "pending",
    },
    paidAt: { type: Date },
    orderStatus: {
      type: String,
      required: [true, "Order status is required."],
      enum: ["processing", "shipped", "delivered", "cancelled"],
      default: "processing",
    },
    deliveredAt: { type: Date },
    phone: {
      type: String,
      required: [true, "Phone is required."],
      trim: true,
      match: [
        /^\+?\d{8,15}$/,
        "Phone must be between 8 and 15 digits and may include a country code (e.g., +123456789).",
      ],
    },
    shippingAddress: {
      country: {
        type: String,
        trim: true,
        required: [true, "Country is required."],
        minlength: [2, "Country name must be at least 2 characters."],
        maxlength: [50, "Country name cannot exceed 50 characters."],
      },
      state: {
        type: String,
        trim: true,
        required: [true, "State is required."],
        minlength: [2, "State name must be at least 2 characters."],
        maxlength: [50, "State name cannot exceed 50 characters."],
      },
      city: {
        type: String,
        trim: true,
        required: [true, "City is required."],
        minlength: [2, "City name must be at least 2 characters."],
        maxlength: [50, "City name cannot exceed 50 characters."],
      },
      street: {
        type: String,
        trim: true,
        required: [true, "Street address is required."],
        minlength: [5, "Street address must be at least 5 characters."],
        maxlength: [100, "Street address cannot exceed 100 characters."],
      },
      postalCode: {
        type: String,
        trim: true,
        required: [true, "Postal code is required."],
        match: [/^\d{4,10}$/, "Postal code must be between 4 and 10 digits."],
      },
    },
  },
  { timestamps: true }
);

orderSchema.pre(/^find/, function (next) {
  this.populate({
    path: "orderItems.product",
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

module.exports = mongoose.model("Order", orderSchema);
