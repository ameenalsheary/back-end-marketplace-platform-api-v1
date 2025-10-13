const crypto = require("crypto");

const asyncHandler = require("express-async-handler");
const bcrypt = require("bcryptjs");

const userModel = require("../../models/userModel");
const ApiError = require("../../utils/apiErrore");
const createToken = require("../../utils/createToken");
const { userPropertysPrivate } = require("../../utils/propertysPrivate");
const { signInTemplate } = require("../../utils/mailTemplates");
const sendEmail = require("../../utils/sendEmail");

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
    return next(new ApiError("Account blocked. Contact support.", 403));
  }

  // Remove sensitive data from user object
  const user = userPropertysPrivate(document);

  // Generate JWT token for authentication
  const token = createToken(user._id);

  // Return user data and token with 200 status (success)
  res.status(200).json({ data: user, token });
});

function generateSixDigitCode() {
  const array = new Uint32Array(1);
  crypto.getRandomValues(array);
  return ((array[0] % 900000) + 100000).toString();
}

// @desc Sign in
// @route POST /api/v1/auth/signin
// @access Public
exports.signIn = asyncHandler(async (req, res, next) => {
  // Extract email from request body
  const email = req.body.email;

  // Check if user already exists in database
  const userExist = await userModel.findOne({ email });

  // Check if user account is blocked
  if (userExist?.userBlock) {
    return next(new ApiError("Account blocked. Contact support.", 403));
  }

  // If user exists and has an unexpired verification code, return early
  if (userExist?.signInVerificationCodeExpires) {
    if (new Date(userExist.signInVerificationCodeExpires) > new Date()) {
      return res.status(200).json({
        status: "Success",
        message: "We sent a verification code to",
        email: userExist.email,
      });
    }
  }

  // Generate new verification code and hash it for security
  const verificationCode = generateSixDigitCode();
  const hashVerificationCode = crypto.createHash("sha256").update(verificationCode).digest("hex");
  const codeExpires = Date.now() + 5 * 60 * 1000; // 5 minutes expiration

  let user;
  // Create new user if doesn't exist, otherwise update existing user
  if (!userExist) {
    user = await userModel.create({
      firstName: "User",
      lastName: "Private",
      slug: "User-Private",
      email: email,
      signInVerificationCode: hashVerificationCode,
      signInVerificationCodeExpires: codeExpires,
    });
  } else {
    user = await userModel.findByIdAndUpdate(userExist._id, {
      $set: {
        signInVerificationCode: hashVerificationCode,
        signInVerificationCodeExpires: codeExpires,
      },
    });
  }

  // Generate email template with verification code
  const message = signInTemplate(verificationCode);

  try {
    // Send verification email
    await sendEmail({
      email: user.email,
      subject: "Sign-In Verification Code",
      message,
    });
  } catch (error) {
    // If email fails, clean up the verification data from database
    await userModel.findByIdAndUpdate(user._id, {
      $unset: {
        signInVerificationCode: 1,
        signInVerificationCodeExpires: 1,
      },
    });

    // Return error response
    return next(
      new ApiError("Error sending email. Please try again later.", 500)
    );
  }

  // Return success response
  res.status(200).json({
    status: "Success",
    message: "We sent a verification code to",
    email: user.email,
  });
});

// @desc Verify sign in
// @route POST /api/v1/auth/verifysignin
// @access Public
exports.verifySignIn = asyncHandler(async (req, res, next) => {
  // Extract email and verification code from request body
  const { email, verificationCode } = req.body;

  // Find user by email in database
  const user = await userModel.findOne({ email });

  // Hash the provided verification code for comparison
  const hashVerificationCode = crypto.createHash("sha256").update(verificationCode).digest("hex");

  // Check if verification code matches and hasn't expired
  if (
    user?.signInVerificationCode !== hashVerificationCode ||
    new Date() > user?.signInVerificationCodeExpires
  ) {
    return next(
      new ApiError("Sign-in verification code invalid or expired.", 400)
    );
  }

  // If user's email hasn't been verified before, mark it as verified
  if (!user.emailVerification) {
    await userModel.findByIdAndUpdate(user._id, {
      $set: {
        emailVerification: true,
      },
      $unset: {
        signInVerificationCode: 1,
        signInVerificationCodeExpires: 1,
      },
    });
  } else {
    // If email was already verified, just remove the verification code fields
    await userModel.findByIdAndUpdate(user._id, {
      $unset: {
        signInVerificationCode: 1,
        signInVerificationCodeExpires: 1,
      },
    });
  }

  // Create JWT token for authenticated session
  const token = createToken(user._id);

  // Set JWT token as HTTP-only cookie for security
  res.cookie("accessToken", token, {
    httpOnly: true, // Prevents client-side JavaScript access
    secure: process.env.MODE_ENV === "production", // HTTPS only in production
    sameSite: process.env.MODE_ENV === "production" ? "None" : "Lax", // Cross-site requests allowed
    domain: process.env.ALLOWED_ORIGINS.split(",")[0],
    path: "/",
    maxAge: 90 * 24 * 60 * 60 * 1000, // 90 days expiration
  });

  // Send success response
  res.status(200).json({
    status: "Success",
    message: "Signed in successfully.",
  });
});

// @desc Log out user
// @route POST /api/v1/auth/logout
// @access Public
exports.logOut = asyncHandler(async (_, res) => {
  // Clear JWT cookie by setting it to empty and expired
  res.cookie("accessToken", "", {
    httpOnly: true,
    secure: process.env.MODE_ENV === "production",
    sameSite: process.env.MODE_ENV === "production" ? "None" : "Lax",
    domain: process.env.ALLOWED_ORIGINS.split(",")[0],
    path: "/",
    expires: new Date(0), // Expire immediately
  });

  // Return success response
  res.status(200).json({
    status: "Success",
    message: "Logged out successfully.",
  });
});
