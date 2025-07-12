const express = require("express");
const cookieParser = require("cookie-parser");
const morgan = require("morgan");
const passport = require('passport');
const dotenv = require("dotenv");

// Initialize environment variables
dotenv.config();

const dbConection = require(`./config/database`);
const addSecurityMiddlewares = require("./middlewares/securityMiddleware");
const googleStrategy = require("./config/googleStrategy");
const mountRoutes = require("./routes");
const ApiError = require("./utils/apiErrore");
const globalError = require("./middlewares/erroreMiddleware");
const { handleStripeWebhook } = require("./services/orderServise");

const app = express();

dbConection(); // Connect to database

// Stripe webhook endpoint (needs raw body for verification)
app.post(
  "/webhook",
  express.raw({ type: "application/json" }), // Get raw body for webhook
  handleStripeWebhook
);

// Parse cookies from incoming requests
app.use(cookieParser());

// Initialize passport for authentication
app.use(passport.initialize());

// Configure Google OAuth strategy
passport.use(googleStrategy);

// Add security middlewares (CORS, rate limiting, etc.)
addSecurityMiddlewares(app);

// Parse JSON requests with size limit
app.use(express.json({ limit: "20kb" }));

// Development-only middlewares
if (process.env.MODE_ENV === `development`) {
  app.use(morgan("tiny")); // Log HTTP requests in development
  console.log(`Mode: ${process.env.MODE_ENV}`); // Show current environment
}

// Mount all application routes
mountRoutes(app);

// Handle 404 (Not Found) for all undefined routes
app.all(`*`, (req, _, next) => {
  next(new ApiError(`Can't find this rout: ${req.originalUrl}.`, 404));
});

// Use global error handler
app.use(globalError);

module.exports = app; // Export the express application
