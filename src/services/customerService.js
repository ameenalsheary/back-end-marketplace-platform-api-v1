const crypto = require("crypto");

const mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");
const bcrypt = require("bcryptjs");

const userModel = require("../models/userModel");
const favoriteModel = require("../models/favoriteModel");
const s3Client = require("../config/s3Client");
const { getAll } = require("./handlersFactory");
const createToken = require("../utils/createToken");
const sendEmail = require("../utils/sendEmail");
const ApiError = require("../utils/apiErrore");
const fireBaseAdmin = require("../config/firebaseAdmin");
const { userPropertysPrivate } = require("../utils/propertysPrivate");
const { verificationEmailTemplate } = require("../utils/mailTemplates");
const {
  extractFilePathsFromS3Urls,
  deleteS3Objects,
} = require("../utils/s3Utils");

// @desc Get customer details
// @route GET /api/v1/customer
// @access Private
exports.getCustomerDetails = asyncHandler(async (req, res) => {
  const id = req.user._id;
  const document = await userModel.findById(id);
  const user = userPropertysPrivate(document);
  res.status(200).json({ data: user });
});

// @desc Update customer details
// @route PUT /api/v1/customer
// @access Private
exports.updateCustomerDetails = asyncHandler(async (req, res, next) => {
  const userId = req.user._id;
  const body = req.body;

  // Start a database transaction session
  const session = await mongoose.startSession();
  session.startTransaction();

  let user;
  try {
    // Update user data
    user = await userModel.findByIdAndUpdate(
      userId,
      {
        $set: {
          firstName: body.firstName,
          lastName: body.lastName,
          slug: body.slug,
          profileImage: body.profileImage,
          profileCoverImage: body.profileCoverImage,
        }
      },
      { new: true, session } // Return updated document and use session
    );

    // Prepare URLs of old images to delete (if new ones were provided)
    let URLs = [
      body.profileImage ? req.user.profileImage : "",
      body.profileCoverImage ? req.user.profileCoverImage : "",
    ];

    // Delete old images from S3
    const awsBuckName = process.env.AWS_BUCKET_NAME;
    const keys = extractFilePathsFromS3Urls(URLs);
    await deleteS3Objects(keys, awsBuckName, s3Client);

    // Commit the transaction if everything succeeded
    await session.commitTransaction();
  } catch (error) {
    // If error occurs, abort the transaction
    await session.abortTransaction();
    return next(new ApiError("Something went wrong. Please Try again.", 500));
  } finally {
    // End the session in all cases
    session.endSession();
  }

  // Return updated user data (with private properties filtered)
  const privateUser = userPropertysPrivate(user);
  res.status(200).json({ data: privateUser });
});

// @desc Email verification
// @route GET /api/v1/customer/verify-email
// @access Private
exports.emailVerification = asyncHandler(async (req, res, next) => {
  // 1) Get user by email
  const user = await userModel.findOne({ email: req.user.email });

  // 2) Check if email is already verified
  if (user.emailVerification) {
    return res.status(200).json({
      status: "Verified",
      message: "Your email has already been verified.",
    });
  }

  // 3) Check if the verification code is still valid
  if (user.emailVerificationCodeExpires) {
    if (new Date(user.emailVerificationCodeExpires) > new Date()) {
      return res.status(200).json({
        status: "Code_sent",
        message: "Verification code already sent to your email.",
      });
    }
  }

  // 4) Generate a new verification code
  const emailVerificationCode = Math.floor(
    100000 + Math.random() * 900000
  ).toString();
  // Hash verification code
  const hashedEmailVerificationCode = crypto
    .createHash("sha256")
    .update(emailVerificationCode)
    .digest("hex");

  // 5) Update user with new verification code and expiration time
  await userModel.findByIdAndUpdate(user._id, {
    $set: {
      emailVerificationCode: hashedEmailVerificationCode,
      emailVerificationCodeExpires: Date.now() + 10 * 60 * 1000, // 10 minutes
      emailVerification: false,
    },
  });

  // 6) Send the verification code via email
  const message = verificationEmailTemplate(`${user.firstName} ${user.lastName}`, emailVerificationCode);

  try {
    await sendEmail({
      email: user.email,
      subject: "Email Verification Code",
      message,
    });
  } catch (err) {
    // If email sending fails, clear the verification code and expiration time
    await userModel.findByIdAndUpdate(user._id, {
      $unset: {
        emailVerificationCode: 1,
        emailVerificationCodeExpires: 1,
      },
    });

    return next(
      new ApiError("Error sending email. Please try again later.", 500)
    );
  }

  // 7) Send response to client
  res.status(200).json({
    status: "Code_sent",
    message: "Verification code sent to your email.",
  });
});

// @desc Verify customer email
// @route POST /api/v1/customer/verify-email
// @access Private
exports.verifyEmail = asyncHandler(async (req, res, next) => {
  // 1) Get user by email
  const user = await userModel.findOne({ email: req.user.email });

  // 2) Check if email is already verified
  if (user.emailVerification) {
    return res.status(200).json({
      status: "Verified",
      message: "Your email has already been verified.",
    });
  }

  // 3) Hash the provided email verification code
  const hashedEmailVerificationCode = crypto
    .createHash("sha256")
    .update(req.body.emailVerificationCode)
    .digest("hex");

  // 4) Check if the provided code matches and is not expired
  if (
    user.emailVerificationCode !== hashedEmailVerificationCode ||
    new Date() > new Date(user.emailVerificationCodeExpires)
  ) {
    return next(
      new ApiError("Email verification code invalid or expired.", 400)
    );
  }

  // 5) Mark email as verified and clear verification code and expiration time
  await userModel.findByIdAndUpdate(user._id, {
    $set: {
      emailVerification: true,
    },
    $unset: {
      emailVerificationCode: 1,
      emailVerificationCodeExpires: 1,
    },
  });

  // 6) Send success response
  res.status(200).json({
    status: "Verified",
    message: "Your email has been verified.",
  });
});

// @desc Add customer's phone number
// @route POST /api/v1/customer/add-phone-number
// @access Private
exports.addPhoneNumber = asyncHandler(async (req, res, next) => {
  // Get user ID from authenticated request and ID token from request body
  const { _id: userId } = req.user;
  const { idToken } = req.body;

  let decodedToken;
  try {
    // Verify the Firebase ID token
    decodedToken = await fireBaseAdmin.auth().verifyIdToken(idToken);
    // Check if token is valid and contains a phone number
    if (!decodedToken?.phone_number) {
      return next(new ApiError("Invalid ID token or missing phone number.", 401));
    }
  } catch (error) {
    // If verification fails, return an error
    return next(new ApiError("Failed to verify ID token.", 401));
  }

  // Find the user in database
  const user = await userModel.findById(userId);

  // Check if phone number already exists in user's account
  const phoneExists = user.phoneNumbers.some(
    item => item.phone_number === decodedToken.phone_number
  );

  // If phone number exists, return info without adding again
  if (phoneExists) {
    return res.status(200).json({
      status: "Success",
      message: "This phone number already exists in your account.",
      data: userPropertysPrivate(user),
    });
  }

  // Prepare new phone number data to add
  const phoneNumberData = {
    user_id: decodedToken.uid,         // Firebase UID
    phone_number: decodedToken.phone_number,  // Verified phone number
    isVerified: true,                  // Mark as verified
  };

  // Add new phone number to user's account
  const updatedUser = await userModel.findByIdAndUpdate(
    userId,
    {
      $addToSet: { phoneNumbers: phoneNumberData }  // Safely add to array
    },
    { new: true }  // Return updated document
  );

  // Return success response with updated user data
  res.status(201).json({
    status: "Success",
    message: "Phone number added successfully.",
    data: userPropertysPrivate(updatedUser)
  });
});

// @desc Get customer favorites
// @route GET /api/v1/customer/favorites
// @access Private
exports.createFilterObj = (req, _, next) => {
  req.filterObj = {
    userId: req.user._id,
  };
  next();
};

exports.getCustomerFavorites = getAll(favoriteModel);

// @desc Add product to customer favorites
// @route POST /api/v1/customer/favorites
// @access Private
exports.addProductToCustomerFavorites = asyncHandler(async (req, res) => {
  const productId = req.body.productId;

  const favorite = await favoriteModel.create({
    userId: req.user._id,
    productId,
  });

  res.status(200).json({
    data: favorite,
  });
});

// @desc Delete product from customer favorites
// @route DELETE /api/v1/customer/favorites/:productId
// @access Private
exports.removeProductFromCustomerFavorites = asyncHandler(async (req, res, next) => {
  const productId = req.params.productId;

  const favorite = await favoriteModel.findOneAndDelete({
    userId: req.user._id,
    productId,
  });

  if (!favorite) {
    return next(
      new ApiError(`No favorite product for this ID ${productId}.`, 404)
    );
  }

  res.status(200).json({
    data: favorite,
  });
});

// @desc Get customer addresses list
// @route GET /api/v1/customer/addresses
// @access Private
exports.getCustomerAddressesList = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const user = await userModel.findById(userId);

  const addressesList = user.addressesList.reverse();
  res.status(200).json({
    status: "Success",
    message: "Your addresses list retrieved successfully.",
    data: addressesList,
  });
});

// @desc Add address to customer addresses list
// @route POST /api/v1/customer/addresses
// @access Private
exports.addAddressToCustomerAddressesList = asyncHandler(async (req, res) => {
  const userId = req.user._id;

  const user = await userModel.findById(userId);
  const addressesList = user.addressesList;
  const MAX_ADDRESSES = 8;

  // If length of addressesList is equal to MAX_ADDRESSES delete the oldest address
  if (addressesList.length === MAX_ADDRESSES) {
    const oldestAddressId = user.addressesList[0]._id;
    await userModel.findByIdAndUpdate(userId, {
      $pull: { addressesList: { _id: oldestAddressId } },
    });
  }

  // Add new address to addressesList
  const newAddress = req.body;
  const updatedUser = await userModel.findByIdAndUpdate(
    userId,
    {
      $addToSet: { addressesList: newAddress },
    },
    { new: true }
  );

  const newAddressesList = updatedUser.addressesList.reverse();
  res.status(200).json({
    status: "Success",
    message: "Address added successfully to your addresses list.",
    data: newAddressesList,
  });
});

// @desc Delete address from customer addresses list
// @route DELETE /api/v1/customer/addresses/:addressId
// @access Private
exports.deleteAddressFromCustomerAddressesList = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const user = await userModel.findByIdAndUpdate(
    userId,
    {
      $pull: { addressesList: { _id: req.params.addressId } },
    },
    { new: true }
  );

  const newAddressesList = user.addressesList.reverse();
  res.status(200).json({
    status: "Success",
    message: "Address deleted successfully from your addresses list.",
    data: newAddressesList,
  });
});

// @desc Change customer password
// @route PUT /api/v1/customer/change-password
// @access Private
exports.changeCustomerPassword = asyncHandler(async (req, res, next) => {
  const id = req.user._id;
  const userCheck = await userModel.findById(id);

  // Check user exist
  if (!userCheck) {
    return next(new ApiError(`No user for this ID ${id}.`, 404));
  }

  const isCorrectPassword = await bcrypt.compare(
    req.body.currentPassword,
    userCheck.password
  );

  if (!isCorrectPassword) {
    return next(new ApiError("The current password is incorrect.", 401));
  }

  const document = await userModel.findByIdAndUpdate(
    id,
    {
      password: await bcrypt.hash(req.body.newPassword, 12),
      passwordChangedAt: Date.now(),
    },
    {
      new: true,
    }
  );

  const user = userPropertysPrivate(document);

  const token = createToken(user._id);

  res.status(200).json({ data: user, token: token });
});

// @desc Change customer email
// @route PUT /api/v1/customer/change-email
// @access Private
exports.changeCustomerEmail = asyncHandler(async (req, res, next) => {
  const id = req.user._id;
  const userCheck = await userModel.findById(id);

  if (!(await bcrypt.compare(req.body.password, userCheck.password))) {
    return next(new ApiError("The password is incorrect.", 401));
  }

  const document = await userModel.findByIdAndUpdate(
    id,
    {
      email: req.body.newEmail,
      emailVerification: false,
      emailVerificationCode: null,
      emailVerificationCodeExpires: null,
    },
    {
      new: true,
    }
  );

  const user = userPropertysPrivate(document);

  res.status(200).json({ date: user });
});
