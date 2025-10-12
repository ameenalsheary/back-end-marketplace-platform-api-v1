const cors = require("cors");
const compression = require("compression");
const rateLimit = require("express-rate-limit");
const hpp = require("hpp");
const mongoSanitize = require("express-mongo-sanitize");
const xss = require("xss-clean");
const helmet = require("helmet");

function addSecurityMiddlewares(app) {
  // Set security HTTP headers
  app.use(helmet());

  // // Prepear origins
  const origins = process.env.ALLOWED_ORIGINS.split(",");

  // Prepear CORS options
  const corsOptions = {
    origin(origin, callback) {
      if (!origin || origins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
    optionsSuccessStatus: 200, // Some legacy browsers choke on 204
  };

  // Enable CORS (Cross-Origin Resource Sharing) with specific frontend URL
  app.use(cors(corsOptions));

  // Handle preflight requests (OPTIONS) for all routes
  app.options("*", cors(corsOptions));

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
