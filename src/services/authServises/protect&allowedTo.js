const asyncHandler = require("express-async-handler");
const jwt = require("jsonwebtoken");

const userModel = require("../../models/userModel");
const ApiError = require("../../utils/apiErrore");

// @desc make sure the user is logged in
exports.protect = (emailVerification = false) =>
  asyncHandler(async (req, _, next) => {
    // 1) Check if token exist, if exist get
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      token = req.headers.authorization.split(" ")[1];
    }
    if (!token) {
      return next(
        new ApiError("Access denied. Please log in to access this route.", 401)
      );
    }

    // 2) Verify token (no change happens, expired token)
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

    // 3) Check if user exists
    const currentUser = await userModel.findById(decoded.userId);
    if (!currentUser) {
      return next(
        new ApiError("The user associated with this token no longer exists.", 401)
      );
    }

    // 4) Check user if verified email
    if (!emailVerification) {
      if (!currentUser.emailVerification) {
        return next(
          new ApiError("Your email is not verified. Please verify your email to proceed.", 403)
        );
      }
    }

    // 5) Check user if block
    if (currentUser.userBlock) {
      return next(
        new ApiError("Your account has been blocked. Please contact support for further assistance.", 401)
      );
    }

    // 6) Check if user change his password after token created
    if (currentUser.passwordChangedAt) {
      const passChangedTimestamp = parseInt(
        currentUser.passwordChangedAt.getTime() / 1000,
        10
      );
      // Password changed after token created (Error)
      if (passChangedTimestamp > decoded.iat) {
        return next(
          new ApiError("Your password was recently changed. Please log in again.", 401)
        );
      }
    }

    req.user = currentUser;

    next();
  });

// @desc  Authorization (User Permissions)
// ["admin", "manager"]
exports.allowedTo = (...roles) =>
  asyncHandler(async (req, _, next) => {
    // 1) access roles
    // 2) access registered user (req.user.role)

    if (!roles.includes(req.user.role)) {
      return next(
        new ApiError("You are not allowed to access this route.", 403)
      );
    }

    next();
  });

// check the token
exports.checkTheToken = async (req) => {
  let token = req.headers.authorization.split(" ")[1];
  let currentUser = {};

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY);

    currentUser = (await userModel.findById(decoded.userId)) || {};
    return currentUser;
  } catch (error) {
    return currentUser;
  }
};
