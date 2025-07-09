const cors = require("cors");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const hpp = require("hpp");
const mongoSanitize = require("express-mongo-sanitize");
const xss = require("xss-clean");

function addSecurityMiddlewares(app) {
  // Enable CORS (Cross-Origin Resource Sharing) with specific frontend URL
  app.use(
    cors({
      origin: [process.env.FRONT_END_BASE_URL],
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE"],
    })
  );

  // Handle preflight requests (OPTIONS) for all routes
  app.options(
    "*",
    cors({
      origin: [process.env.FRONT_END_BASE_URL],
      credentials: true,
      methods: ["GET", "POST", "PUT", "DELETE"],
    })
  );

  // Compress all responses to reduce size
  app.use(compression());

  // Sanitize incoming data to prevent NoSQL injection
  app.use(mongoSanitize());

  // Sanitize user input to prevent XSS attacks
  app.use(xss());

  // Protect against HTTP Parameter Pollution attacks
  app.use(hpp());

  // Rate limiting for production environment only
  if (process.env.MODE_ENV !== "development") {
    const limiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // Max 100 requests per IP in 15 minutes
      message: {
        status: "fail",
        message: "Too many requests, please try again later.",
      },
    });
    // Apply rate limiting to all API routes
    app.use("/api", limiter);
  }

  console.log("Security middlewares added successfully.");
}

module.exports = addSecurityMiddlewares;
