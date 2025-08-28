const  mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const ApiError = require("../utils/apiErrore");
const cartModel = require("../models/cartModel");
const orderModel = require("../models/orderModel");
const productModel = require("../models/productModel");
const userModel = require("../models/userModel");
const { getAll, getOne } = require("./handlersFactory");
const {
  calculateAndUpdateCartPricing,
  filterAndUpdateCartItems,
  removeRedisBullMQJob,
  expireStripeSession
} = require("../utils/shoppingCartUtilitiesfunctions");

// Update the sold quantity of the products
const updateSoldQuantity = async (cart, productModel, session) => {
  const bulkOps = cart.cartItems.map((cartItem) => {
      return {
          updateOne: {
              filter: { _id: cartItem.product._id },
              update: { $inc: { sold: cartItem.quantity } }, // Increment the sold quantity
              timestamps: false, // Disable automatic timestamps
          },
      };
  });

  await productModel.bulkWrite(bulkOps, { session });
};

// Add address if it doesn't exist in the user's addresses list and manage the limit
const addAddressIfUniqueAndManageLimit = async (model, userId, address) => {
  const { country, state, city, street, postalCode } = address;

  // Step 1: Find the user by their ID
  const user = await model.findById(userId);

  // Step 2: Check if the address already exists in the user's addresses list
  const exists = user.addressesList.some((addr) => {
    return (
      addr.country === country &&
      addr.state === state &&
      addr.city === city &&
      addr.street === street &&
      addr.postalCode === postalCode
    );
  });

  // Step 3: If the address is new, proceed to add it
  if (!exists) {
    const MAX_ADDRESSES = 8;

    // Step 4: If the user has reached the max number of saved addresses, remove the oldest one
    if (user.addressesList.length >= MAX_ADDRESSES) {
      const oldestAddressId = user.addressesList[0]._id;
      await model.findByIdAndUpdate(userId, {
        $pull: { addressesList: { _id: oldestAddressId } },
      });
    }

    // Step 5: Add the new address to the addresses list
    await model.findByIdAndUpdate(
      userId,
      {
        $push: { addressesList: address },
      },
      { new: true }
    );
  }
};

// @desc    Get customer orders
// @route   POST /api/v1/customer/orders
// @access  Pravite
exports.filterOrders = asyncHandler(async (req, _, next) => {
  req.filterObj = { user: req.user._id };

  req.query = {
    ...req.query,
    fields: [
      "pricing",
      "coupon",
      "paymentMethod",
      "paymentStatus",
      "paidAt",
      "orderStatus",
      "deliveredAt",
    ].join(" "), // Join fields into a single string
  };

  next();
});

exports.getCustomerOrders = getAll(orderModel);

// @desc    Get customer order by ID
// @route   GET /api/v1/customer/orders/:id
// @access  Private
exports.getCustomerOrder = getOne(orderModel, {
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

// @desc    Customer create a cash order
// @route   POST /api/v1/customer/orders/cash-on-delivery
// @access  Pravite
exports.customerCreateCashOrder = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const { phone, country, state, city, street, postalCode } = req.body;
  const address = { country, state, city, street, postalCode };

  // Fetch the shopping cart from the database
  const cart = await cartModel.findOne({ user: userId });
  if (!cart) {
    return next(new ApiError(`No shopping cart for this user.`, 404));
  }

  // Start a Mongoose session to allow for transactions
  const session = await mongoose.startSession();
  session.startTransaction();

  let order;
  let redisBullMQJobId;
  let stripeCheckOutSessionId;

  try {
    // Handle items of cart if products updated or deleted
    filterAndUpdateCartItems(cart);

    // Calculate and update the total cart price
    await calculateAndUpdateCartPricing(cart, session);

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
          shippingAddress: address
        },
      ],
      { session }
    ))[0]; // Access the first element of the array

    // Update the sold quantity of the products
    await updateSoldQuantity(cart, productModel, session);

    // Add address if it doesn't exist in the user's addresses list and manage the limit
    addAddressIfUniqueAndManageLimit(userModel, userId, address);

    // Clear shopping cart items
    cart.cartItems = [];

    // Add ID of Redis BullMQ job to redisBullMQJobId to remove job later
    if (cart?.idOfRedisBullMqJob) {
      redisBullMQJobId = cart?.idOfRedisBullMqJob;
    }

    // Add Stripe checkout session ID to atripeCheckOutSessionId to expire session later
    if (cart?.idOfStripeCheckoutSession) {
      stripeCheckOutSessionId = cart.idOfStripeCheckoutSession;
      cart.idOfStripeCheckoutSession = undefined;
    }

    // Calculate and update the total cart price
    await calculateAndUpdateCartPricing(cart, session);

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
  await removeRedisBullMQJob(redisBullMQJobId);

  // Expire Stripe session if exists
  await expireStripeSession(stripeCheckOutSessionId);

  // Send a success response with order details
  res.status(200).json({
    status: "Success",
    message: "Order created successfully.",
    numOfOrderItems: order.orderItems.length,
    data: order,
  });
});

// @desc    Customer create Stripe Checkout Session
// @route   POST /api/v1/customer/orders/stripe-checkout-session
// @access  Private
exports.customerCreateStripeCheckoutSession = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const { phone, country, state, city, street, postalCode } = req.body;

  // Fetch the shopping cart from the database
  const cart = await cartModel.findOne({ user: userId });
  if (!cart) {
    return next(new ApiError(`No shopping cart for this user.`, 404));
  }

  // Check if the shopping cart is empty
  if (cart.cartItems.length === 0) {
    return next(new ApiError(`Shopping cart is empty.`, 400));
  }

  // Handle items of cart if products updated or deleted
  filterAndUpdateCartItems(cart);

  // Calculate and update the total cart price
  await calculateAndUpdateCartPricing(cart);

  // Check if the shopping cart is empty
  if (cart.cartItems.length === 0) {
    return next(new ApiError(`Shopping cart is empty.`, 400));
  }

  // Expire Stripe session if exists
  await expireStripeSession(cart?.idOfStripeCheckoutSession);

  // Create line items for Stripe Checkout Session
  const lineItems = cart.cartItems.map((item) => ({
    price_data: {
      currency: 'usd',
      product_data: {
        name: item.product.title,
        description: `Size: ${item.size || 'N/A'}, Color: ${item.color || 'N/A'}`,
        metadata: {
          productId: item.product._id.toString(),
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
  if (cart.pricing.taxPrice > 0) {
    lineItems.push({
      price_data: {
        currency: 'usd',
        product_data: {
          name: 'Tax',
        },
        unit_amount: Math.round(cart.pricing.taxPrice * 100), // Convert to cents
      },
      quantity: 1,
    });
  }

  // Add shipping as line item (optional)
  if (cart.pricing.shippingPrice > 0) {
    lineItems.push({
      price_data: {
        currency: 'usd',
        product_data: {
          name: 'Shipping',
        },
        unit_amount: Math.round(cart.pricing.shippingPrice * 100), // Convert to cents
      },
      quantity: 1,
    });
  }

  const customer_email = req.user.email;
  const promotion_code = cart.coupon?.couponId;

  // Create a Stripe Checkout Session
  const checkoutSession = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: lineItems,
    mode: 'payment',
    discounts: [{ promotion_code }],
    success_url: `${req.protocol}://${req.get('host')}/api/v1/orders`,
    cancel_url: `${req.protocol}://${req.get('host')}/api/v1/cart`,
    customer_email,
    metadata: {
      cartId: cart._id.toString(),
      userId: userId.toString(),
      phone,
      shippingAddress: JSON.stringify({
        country,
        state,
        city,
        street,
        postalCode,
      }),
    },
  });

  // Add Stripe Checkout Session ID to shopping cart
  cart.idOfStripeCheckoutSession = checkoutSession.id;
  await cart.save();

  // Send the session ID to the frontend
  res.status(200).json({
    status: "Success",
    message: "Stripe checkout session created successfully.",
    sessionID: checkoutSession.id,
    sessionURL: checkoutSession.url,
  });
});

// @desc    Handle Stripe Webhook
// @route   POST /api/v1/orders/webhook
// @access  Public (Stripe will call this endpoint)
exports.handleStripeWebhook = asyncHandler(async (req, res, next) => {
  const sig = req.headers["stripe-signature"];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET_KEY;

  let event;

  try {
    // Verify the webhook signature
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    // If the signature verification fails, return an error
    return next(new ApiError(`Webhook Error: ${err.message}`, 400));
  }

  // Handle the event
  switch (event.type) {
    case "checkout.session.completed":
      const paymentIntentSucceeded = event.data.object;

      // Extract metadata from the session
      const cartId = paymentIntentSucceeded.metadata.cartId;
      const userId = paymentIntentSucceeded.metadata.userId;
      const phone = paymentIntentSucceeded.metadata.phone;
      const shippingAddress = JSON.parse(paymentIntentSucceeded.metadata.shippingAddress);

      // Fetch the shopping cart from the database
      const cart = await cartModel.findById(cartId);
      if (!cart) {
        return next(new ApiError(`No shopping cart for this ID: ${cartId}.`, 404));
      }

      // Start a Mongoose session to allow for transactions
      const session = await mongoose.startSession();
      session.startTransaction();

      try {
        // Create order
        (
          await orderModel.create(
            [
              {
                user: userId,
                orderItems: cart.cartItems,
                pricing: cart.pricing,
                coupon: cart.coupon,
                paymentMethod: "credit_card",
                paymentStatus: "completed",
                paidAt: new Date(),
                phone,
                shippingAddress,
              },
            ],
            { session }
          )
        )[0]; // Access the first element of the array

        // Update the sold quantity of the products
        await updateSoldQuantity(cart, productModel, session);

        // Add address if it doesn't exist in the user's addresses list and manage the limit
        addAddressIfUniqueAndManageLimit(userModel, userId, shippingAddress);

        // Clear shopping cart items
        cart.cartItems = [];

        // Remove Redis BullMQ job
        await removeRedisBullMQJob(cart?.idOfRedisBullMqJob);

        // Calculate and update the total cart price
        await calculateAndUpdateCartPricing(cart, session);

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

      console.log("Checkout session completed:", session.id);
      break;

    case "checkout.session.expired":
      // Handle expired sessions if needed
      console.log("Checkout session expired:", event.data.object.id);
      break;

    case "payment_intent.succeeded":
      // Handle successful payments if needed
      console.log("Payment succeeded:", event.data.object.id);
      break;

    case "payment_intent.payment_failed":
      // Handle failed payments if needed
      console.log("Payment failed:", event.data.object.id);
      break;

    default:
      // Handle other event types
      console.log(`Unhandled event type: ${event.type}`);
  }

  // Return a response to acknowledge receipt of the event
  res.status(200).json({ received: true });
});
