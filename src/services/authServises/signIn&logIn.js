const asyncHandler = require("express-async-handler");
const bcrypt = require("bcryptjs");

const userModel = require("../../models/userModel");
const ApiError = require("../../utils/apiErrore");
const createToken = require("../../utils/createToken");
const { userPropertysPrivate } = require("../../utils/propertysPrivate");

// @desc Sign up
// @route POST /api/v1/auth/signup
// @access Public
exports.signUp = asyncHandler(async (req, res) => {
  // Extract request body
  const { body } = req;

  // Create new user in database with request body data
  const document = await userModel.create({
    firstName: body.firstName,
    lastName: body.lastName,
    slug: body.slug,
    email: body.email,
    password: body.password,
  });
  
  // Remove sensitive data from user object
  const user = userPropertysPrivate(document);
  
  // Generate JWT token for authentication
  const token = createToken(user._id);
  
  // Return user data and token with 201 status (created)
  res.status(201).json({
    date: user,
    token: token,
  });
});

// @desc Log in
// @route POST /api/v1/auth/login
// @access Public
exports.logIn = asyncHandler(async (req, res, next) => {
  // Extract request body
  const { body } = req;

  // Find user by email
  const document = await userModel.findOne({ email: body.email });
  
  // Check if user exists and password matches
  if (!document || !(await bcrypt.compare(body.password, document.password || ""))) {
    return next(new ApiError("Invalid email or password.", 401));
  }

  // Check if user account is blocked
  if (document.userBlock) {
    return next(new ApiError("Your account has been blocked. Please contact support.", 403));
  }
  
  // Remove sensitive data from user object
  const user = userPropertysPrivate(document);
  
  // Generate JWT token for authentication
  const token = createToken(user._id);
  
  // Return user data and token with 200 status (success)
  res.status(200).json({ data: user, token });
});
