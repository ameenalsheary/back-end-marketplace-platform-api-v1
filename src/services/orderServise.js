const  mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");
const ApiError = require("../utils/apiErrore");

const cartModel = require("../models/cartModel");
const orderModel = require("../models/orderModel");
const { getAll } = require("./handlersFactory");
const { calcTotalCartPrice } = require("../utils/shoppingCartProcessing");
const cartQueue = require("../redisBullMqQueues/cartQueue");

// @desc    Create a cash order
// @route   POST /api/v1/orders/createcashorder
// @access  Pravite
exports.createCashOrder = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const { phoneNumber, country, state, city, street, postalCode } = req.body;

  // Fetch the shopping cart from the database
  const shoppingCart = await cartModel.findOne({ user: userId });
  if (!shoppingCart) {
    return next(new ApiError(`No shopping cart for this user.`, 404));
  }

  // Check if the shopping cart is empty
  if (shoppingCart.cartItems.length === 0) {
    return next(new ApiError(`Shopping cart is empty.`, 400));
  }

  // Extract job IDs for Redis BullMQ to remove later
  const jobIds = shoppingCart.cartItems.map((cartItem) => cartItem.idOfRedisBullMqJob);

  // Start a Mongoose session to allow for transactions
  const session = await mongoose.startSession();
  session.startTransaction();

  let order;
  try {
    // Create order
    order = (await orderModel.create(
      [
        {
          user: shoppingCart.user,
          orderItems: shoppingCart.cartItems,
          taxPrice: shoppingCart.taxPrice,
          shippingPrice: shoppingCart.shippingPrice,
          totalPrice: shoppingCart.totalPrice,
          couponName: shoppingCart.couponName,
          couponDiscount: shoppingCart.couponDiscount,
          totalPriceAfterDiscount: shoppingCart.totalPriceAfterDiscount,
          paymentMethod: "cash_on_delivery",
          phoneNumber,
          shippingAddress: {
            country,
            state,
            city,
            street,
            postalCode,
          },
        },
      ],
      { session }
    ))[0]; // Access the first element of the array

    // Clear shopping cart items
    shoppingCart.cartItems = [];

    // Calculate and update the total cart price
    await calcTotalCartPrice(shoppingCart, session);

    // Commit the transaction to save all changes to the database
    await session.commitTransaction();
  } catch (error) {
    // If an error occurs, abort the transaction to prevent any changes from being saved
    await session.abortTransaction();
    return next(new ApiError("Something went wrong. Please try again.", 500));
  } finally {
    // End the session whether the transaction succeeds or fails
    session.endSession();
  }

  // Remove redis bullmq jobs of items
  if (jobIds.length > 0) {
    await Promise.all(
      jobIds.map(async (jobId) => {
        const job = await cartQueue.getJob(jobId);
        if (job) await job.remove();
      })
    );
  }

  // Send a success response with order details
  res.status(200).json({
    status: "Success",
    message: "Order created successfully.",
    numOfOrderItems: order.orderItems.length,
    data: order,
  });
});

// @desc    Get my orders
// @route   POST /api/v1/orders
// @access  Pravite
exports.filterOrders = asyncHandler(async (req, _, next) => {
  req.filterObj = { user: req.user._id };
  next();
});

exports.getMyOrders = getAll(orderModel);
