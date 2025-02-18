const fs = require('fs');
const path = require('path');

const  mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const ApiError = require("../utils/apiErrore");
const cartModel = require("../models/cartModel");
const orderModel = require("../models/orderModel");
const { getAll } = require("./handlersFactory");
const {
  calcTotalCartPrice,
  handleItemsOfCartIfProductsUpdatedOrDeleted,
} = require("../utils/shoppingCartProcessing");
const cartQueue = require("../redisBullMqQueues/cartQueue");

// @desc    Create a cash order
// @route   POST /api/v1/orders/createcashorder
// @access  Pravite
exports.createCashOrder = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const { phone, country, state, city, street, postalCode } = req.body;

  // Fetch the shopping cart from the database
  const cart = await cartModel.findOne({ user: userId });
  if (!cart) {
    return next(new ApiError(`No shopping cart for this user.`, 404));
  }

  // Start a Mongoose session to allow for transactions
  const session = await mongoose.startSession();
  session.startTransaction();

  let order;
  let jobId;
  try {
    // Handle items of cart if products updated or deleted
    handleItemsOfCartIfProductsUpdatedOrDeleted(cart);

    // Calculate and update the total cart price
    await calcTotalCartPrice(cart, session);

    // Check if the shopping cart is empty
    if (cart.cartItems.length === 0) {
      return next(new ApiError(`Shopping cart is empty.`, 400));
    }

    // Create order
    order = (await orderModel.create(
      [
        {
          user: userId,
          orderItems: cart.cartItems,
          pricing: cart.pricing,
          coupon: cart.coupon,
          paymentMethod: "cash_on_delivery",
          phone,
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
    cart.cartItems = [];

    // Add ID of Redis BullMQ job to jobId to delete job later
    if (cart?.idOfRedisBullMqJob) {
      jobId = cart?.idOfRedisBullMqJob;
    }

    // Calculate and update the total cart price
    await calcTotalCartPrice(cart, session);

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

  // Remove Redis BullMQ job
  if (jobId) {
    const job = await cartQueue.getJob(jobId);
    if (job) await job.remove();
  }

  // Send a success response with order details
  res.status(200).json({
    status: "Success",
    message: "Order created successfully.",
    numOfOrderItems: order.orderItems.length,
    data: order,
  });
});

// @desc    Create a Stripe Checkout Session
// @route   POST /api/v1/orders/createcheckoutsession
// @access  Private
exports.createCheckoutSession = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const { phone, country, state, city, street, postalCode } = req.body;

  // Fetch the shopping cart from the database
  const cart = await cartModel.findOne({ user: userId });
  if (!cart) {
    return next(new ApiError(`No shopping cart for this user.`, 404));
  }

  // Start a Mongoose session to allow for transactions
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Handle items of cart if products updated or deleted
    handleItemsOfCartIfProductsUpdatedOrDeleted(cart);

    // Calculate and update the total cart price
    await calcTotalCartPrice(cart, session);

    // Check if the shopping cart is empty
    if (cart.cartItems.length === 0) {
      return next(new ApiError(`Shopping cart is empty.`, 400));
    }

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

  // Create line items for Stripe Checkout Session
  const lineItems = cart.cartItems.map((item) => ({
    price_data: {
      currency: 'usd',
      product_data: {
        name: item.product.title,
        description: `Size: ${item.size || 'N/A'}, Color: ${item.color || 'N/A'}`,
        metadata: {
          product: item.product._id.toString(),
          quantity: item.quantity,
          size: item.size || "N/A",
          color: item.color || "N/A",
          price: item.price,
          totalPrice: item.totalPrice,
        },
      },
      unit_amount: item.price * 100, // Convert to cents
    },
    quantity: item.quantity,
  }));

  // Add tax and shipping as line items (optional)
  if (cart.taxPrice > 0) {
    lineItems.push({
      price_data: {
        currency: 'usd',
        product_data: {
          name: 'Tax',
        },
        unit_amount: Math.round(cart.taxPrice * 100), // Convert to cents
      },
      quantity: 1,
    });
  }

  if (cart.shippingPrice > 0) {
    lineItems.push({
      price_data: {
        currency: 'usd',
        product_data: {
          name: 'Shipping',
        },
        unit_amount: Math.round(cart.shippingPrice * 100), // Convert to cents
      },
      quantity: 1,
    });
  }

  // Create a Stripe Checkout Session
  const customer_email = req.user.email;
  const promotion_code = cart.coupon?.couponId;
  const currentTime = Math.floor(Date.now() / 1000);
  const checkoutSession = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: lineItems,
    mode: 'payment',
    discounts: [{ promotion_code }],
    // success_url: `${req.protocol}://${req.get('host')}/api/v1/orders/success?session_id={CHECKOUT_SESSION_ID}`,
    success_url: `${req.protocol}://${req.get('host')}/api/v1/orders`,
    cancel_url: `${req.protocol}://${req.get('host')}/api/v1/cart`,
    customer_email,
    expires_at: currentTime + 30 * 60, // 30 minutes from now (30 minutes * 60 seconds)
    metadata: {
      userId: userId.toString(),
      phone,
      shippingAddress: JSON.stringify({
        country,
        state,
        city,
        street,
        postalCode,
      }),
      cartId: cart._id.toString(), // Save the cart ID for reference
    },
  });

  // Send the session ID to the frontend
  res.status(200).json({
    status: "Success",
    sessionId: checkoutSession,
  });
});

// @desc    Handle Stripe Webhook
// @route   POST /api/v1/orders/webhook
// @access  Public (Stripe will call this endpoint)
exports.handleStripeWebhook = asyncHandler(async (req, res, next) => {
  console.log("Stripe hook work successfully.");
  res.status(200).json({ status: "Success" });
});

// @desc    Get my orders
// @route   POST /api/v1/orders
// @access  Pravite
exports.filterOrders = asyncHandler(async (req, _, next) => {
  req.filterObj = { user: req.user._id };
  next();
});

exports.getMyOrders = getAll(orderModel);
