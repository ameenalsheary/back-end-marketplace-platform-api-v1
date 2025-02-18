const express = require("express");
const morgan = require("morgan");
const dotenv = require("dotenv");

// Load environment variables
dotenv.config();

const dbConection = require(`./config/database`);
const addSecurityMiddlewares = require("./middlewares/securityMiddleware");
const mountRoutes = require("./routes");
const ApiError = require("./utils/apiErrore");
const globalError = require("./middlewares/erroreMiddleware");
const { handleStripeWebhook } = require("./services/orderServise");

// Initialize Express app
const app = express();

// Database connection
dbConection();

// Checkout webhook
app.post(
  "/webhook",
  express.raw({ type: "application/json" }),
  handleStripeWebhook
);

// Apply security-related middlewares (e.g., CORS, Helmet)
addSecurityMiddlewares(app);

// Middleware to parse JSON payloads with size restriction
app.use(express.json({ limit: "20kb" }));

// Enable detailed request logging in development mode using Morgan
if (process.env.MODE_ENV === `development`) {
  app.use(morgan("tiny")); // Logs HTTP requests in a concise format
  console.log(`Mode: ${process.env.MODE_ENV}`); // Log the current environment mode
}

// Mount application routes
mountRoutes(app);

// Handle undefined routes by responding
app.all(`*`, (req, _, next) => {
  next(new ApiError(`Can't find this rout: ${req.originalUrl}.`, 404));
});

// Global error handling middleware
app.use(globalError);

module.exports = app;
