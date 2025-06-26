const crypto = require("crypto");

const asyncHandler = require("express-async-handler");
const bcrypt = require("bcryptjs");

const userModel = require("../../models/userModel");
const ApiError = require("../../utils/apiErrore");
const sendEmail = require("../../utils/sendEmail");
const createToken = require("../../utils/createToken");
const { userPropertysPrivate } = require("../../utils/propertysPrivate");
const { forgotPasswordTemplate } = require("../../utils/mailTemplates");

// @desc    Forgot password
// @route   POST /api/v1/auth/forgotPassword
// @access  Public
exports.forgotPassword = asyncHandler(async (req, res, next) => {
  const { email } = req.body;

  // Get user by email
  const user = await userModel.findOne({ email });
  if (!user) {
    return next(new ApiError(`No user found with email: ${email}.`, 404));
  }

  // Check user if block
  if (user.userBlock) {
    return next(
      new ApiError(
        "Your account has been blocked. Please contact support for further assistance.",
        401
      )
    );
  }

  // Check if the verification code is still valid
  if (user.passwordResetExpires) {
    if (new Date(user.passwordResetExpires) > new Date()) {
      return res.status(200).json({
        status: "Success",
        message: "Password reset code already sent to your email.",
      });
    }
  }

  // Generate hash reset random 6 digits and save it in db
  const resetCode = Math.floor(100000 + Math.random() * 900000).toString();
  const hashedResetCode = crypto
    .createHash("sha256")
    .update(resetCode)
    .digest("hex");

  await userModel.findByIdAndUpdate(user._id, {
    $set: {
      passwordResetCode: hashedResetCode,
      passwordResetExpires: Date.now() + 10 * 60 * 1000, // 10 minutes
    },
  });

  // Send the reset code via email
  const message = forgotPasswordTemplate(`${user.firstName} ${user.lastName}`, resetCode);

  try {
    await sendEmail({
      email: user.email,
      subject: "Password Reset Code",
      message,
    });

    res.status(200).json({
      status: "Success",
      message: "Password reset code sent to your email.",
    });
  } catch (error) {
    // Revert reset code details if email sending fails
    await userModel.findByIdAndUpdate(user._id, {
      $unset: {
        passwordResetCode: 1,
        passwordResetExpires: 1,
      },
    });

    return next(
      new ApiError("Error sending email. Please try again later.", 500)
    );
  }
});

// @desc    Password reset code
// @route   POST /api/v1/auth/passwordResetCode
// @access  Public
exports.passwordResetCode = asyncHandler(async (req, res, next) => {
  const { passwordResetCode, newPassword } = req.body;

  // Hash the reset code
  const hashedResetCode = crypto
    .createHash("sha256")
    .update(passwordResetCode)
    .digest("hex");

  // Find user based on the hashed reset code and check if it has not expired
  const user = await userModel.findOne({
    passwordResetCode: hashedResetCode,
    passwordResetExpires: { $gt: Date.now() },
  });

  // Check if user exist
  if (!user) {
    return next(new ApiError("Password reset code invalid or expired.", 400));
  }

  // Check user if block
  if (user.userBlock) {
    return next(
      new ApiError(
        "Your account has been blocked. Please contact support for further assistance.",
        401
      )
    );
  }

  // Update user's password and reset fields
  await userModel.updateOne(
    { email: user.email },
    {
      $set: {
        password: await bcrypt.hash(newPassword, 12),
        passwordChangedAt: Date.now(),
      },
      $unset: {
        passwordResetCode: 1,
        passwordResetExpires: 1,
      },
    }
  );

  // Generate token
  const token = createToken(user._id);

  // Respond with user data and token
  res.status(200).json({
    data: userPropertysPrivate(user),
    token,
  });
});
