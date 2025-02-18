const mongoose = require("mongoose");
const { ObjectId } = mongoose.Types;

const appSettingsModel = require("../models/appSettingsModel");

// Handle items of cart if products updated or deleted
exports.handleItemsOfCartIfProductsUpdatedOrDeleted = function (cart) {
  if (cart.cartItems.length === 0) return cart;

  cart.cartItems = cart.cartItems.filter((item) => {
    // Remove the item if the product no longer exists (e.g., deleted)
    if (!item.product) return false;

    // If the product is referenced by an ObjectId, assume it's valid
    if (item.product instanceof ObjectId) return true;

    // Ensure the product is a non-null object
    if (typeof item.product === "object" && item.product !== null) {
      // Update the item's color if it exists and has changed
      if (item.product.color && item.color !== item.product.color) {
        item.color = item.product.color;
      }

      // Handle cases where the product has no sizes
      if (item.product.sizes.length === 0) {
        // Update item price if product price has change
        if (item.price !== item.product.price) {
          item.price = item.product.price;
        }
      }
      // Handle cases where the product has sizes
      else if (item.product.sizes.length > 0) {
        // Find the size the user has selected.
        const matchingSize = item.product.sizes.find(
          (size) => size.size.toUpperCase() === item.size.toUpperCase()
        );

        if (matchingSize) {
          // Update item price if product price has change
          if (item.price !== matchingSize.price) item.price = matchingSize.price;
        } else {
          // Remove the item from cart
          return false;
        }
      }
    }

    // Keep the item in the cart if it passes all checks
    return true;
  });

  return cart;
}

exports.calcTotalCartPrice = async (cart, session) => {
  // Check if there are items in the cart
  if (cart.cartItems?.length > 0) {
    // Fetch app settings or provide default values
    const { taxPrice = 0, shippingPrice = 0 } = (await appSettingsModel.findOne({})) || {};

    // Calculate total price for items in the cart
    let totalPrice = cart.cartItems.reduce((total, item) => {
      const itemTotalPrice = item.price * item.quantity;
      item.totalPrice = parseFloat(itemTotalPrice.toFixed(2)); // Ensure it's stored as a number, not a string
      return total + itemTotalPrice;
    }, 0);

    // Add tax and shipping prices
    cart.pricing.taxPrice = taxPrice;
    cart.pricing.shippingPrice = shippingPrice;
    totalPrice += taxPrice + shippingPrice;
    cart.pricing.totalPrice = parseFloat(totalPrice.toFixed(2));

    // Apply discount if a coupon is used
    if (cart.coupon?.couponCode && cart.coupon?.couponDiscount) {
      const discountAmount = (totalPrice * cart.coupon.couponDiscount) / 100;
      cart.pricing.totalPriceAfterDiscount = parseFloat((totalPrice - discountAmount).toFixed(2));
      cart.coupon.discountedAmount = parseFloat(discountAmount.toFixed(2));
    }
  } else {
    // No items in the cart, reset prices and clear coupon/job details
    cart.pricing.taxPrice = 0;
    cart.pricing.shippingPrice = 0;
    cart.pricing.totalPrice = 0;
    cart.pricing.totalPriceAfterDiscount = undefined;
    cart.coupon = undefined;
    cart.idOfRedisBullMqJob = undefined;
  }

  // Save the updated cart object
  await cart.save({ session });
};
