const asyncHandler = require("express-async-handler");

const createToken = require("../../utils/createToken");

// Handle Google authentication callback
exports.googleAuthCallback = asyncHandler(async (req, res) => {
  // Get user data from request
  const user = req.user;

  // Create JWT token using user's ID
  const token = createToken(user._id);

  // Set the token as an HTTP-only, secure cookie
  res.cookie("JWTToken", token, {
    domain: "https://www.eshopapp.shop", // allow subdomain sharing
    httpOnly: false,       // Accessible via JavaScript
    secure: false,          // Only sent over HTTPS
    sameSite: "None",      // Allow cross-site usage
    maxAge: 90 * 24 * 60 * 60 * 1000, // Cookie expires in 90 days
  });

  // Redirect user to frontend after successful auth
  res.redirect(`${process.env.FRONT_END_BASE_URL}`);
});
