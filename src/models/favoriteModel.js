const mongoose = require("mongoose");

const favoriteSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.ObjectId,
      ref: "User",
      required: [true, "User ID is required."],
    },
    productId: {
      type: mongoose.Schema.ObjectId,
      ref: "Product",
      required: [true, "Product ID is required."],
    },
  },
  { timestamps: true }
);

favoriteSchema.virtual("productId.isFavorite").get(function () {
  return true;
});

favoriteSchema.set("toJSON", { virtuals: true });

favoriteSchema.pre("find", function (next) {
  if (this.getOptions().disableAutoPopulate) {
    return next();
  }

  this.populate({
    path: "productId",
    select:
      "title price priceBeforeDiscount discountPercent imageCover size quantity sizes sold ratingsAverage ratingsQuantity",
  });
  next();
});

module.exports = mongoose.model("Favorite", favoriteSchema);
