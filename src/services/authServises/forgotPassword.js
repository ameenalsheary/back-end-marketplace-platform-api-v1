const crypto = require("crypto");

const asyncHandler = require("express-async-handler");
const bcrypt = require("bcryptjs");

const userModel = require("../../models/userModel");
const ApiError = require("../../utils/apiErrore");
const sendEmail = require("../../utils/sendEmail");
const createToken = require("../../utils/createToken");
const { userPropertysPrivate } = require("../../utils/propertysPrivate");

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
  const message = `
    <div
      style="
        font-family: Arial, Helvetica, sans-serif;
        color: #333;
        max-width: 600px;
        margin: 0 auto;
        padding: 30px 20px;
        text-align: center;
      "
    >
      <h1
        style="margin: 0 0 16px 0; font-size: 24px; font-weight: 600; color: #222"
      >
        Hi ${user.firstName} ${user.lastName},
      </h1>

      <p style="margin: 0 0 20px 0; font-size: 16px; line-height: 1.5; color: #555">
        We received a request to reset the password for your
        <strong>E-shop Account</strong>. Please use the following verification code
        to proceed:
      </p>

      <div
        style="
          background: #f8f9fa;
          border: 1px solid #e0e0e0;
          border-radius: 6px;
          padding: 16px;
          display: inline-block;
          margin-bottom: 24px;
        "
      >
        <h2
          style="
            margin: 0;
            font-size: 28px;
            font-weight: 700;
            letter-spacing: 2px;
            color: #2c7be5;
            color: #ff6a2f;
          "
        >
          ${resetCode}
        </h2>
      </div>

      <p style="margin: 0 0 20px 0; font-size: 15px; color: #555">
        Enter this code in the verification page to complete the password reset
        process.
      </p>

      <p style="margin: 0; font-size: 14px; color: #777; line-height: 1.5">
        <strong>Note:</strong> This code will expire in 10 minutes. If you didn’t
        request this, please ignore this email or contact support.
      </p>
    </div>
  `;

  try {
    await sendEmail({
      email: user.email,
      subject: "This code will expire in 10 minutes.",
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
