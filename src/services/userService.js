const mongoose = require("mongoose");
const sharp = require("sharp");
const asyncHandler = require("express-async-handler");
const { v4: uuidv4 } = require("uuid");

const s3Client = require('../config/s3Client');
const userModel = require("../models/userModel");
const favoriteModel = require("../models/favoriteModel");
const reviewModel = require("../models/reviewModel");
const cartModel = require("../models/cartModel");
const orderModel = require("../models/orderModel");
const ApiError = require("../utils/apiErrore");
const {getAll, createOne } = require("./handlersFactory");
const { uploadMultipleImages } = require("../middlewares/uploadImageMiddleware");
const { userPropertysPrivate } = require("../utils/propertysPrivate");
const {
  uploadFileToS3,
  extractFilePathsFromS3Urls,
  deleteS3Objects,
} = require("../utils/s3Utils");

const awsBuckName = process.env.AWS_BUCKET_NAME;

// Upload multiple images
exports.uploadUserImages = uploadMultipleImages([
  {
    name: "profileImage",
    maxCount: 1,
  },
  {
    name: "profileCoverImage",
    maxCount: 1,
  },
]);

// Images processing
exports.resizeUserImages = asyncHandler(async (req, res, next) => {
  // Set image format to JPEG
  const imageFormat = 'jpeg';

  // Check if profile image was uploaded
  if (req.files.profileImage) {

    // Process image: resize to 400x400 and convert to JPEG
    const buffer = await sharp(req.files.profileImage[0].buffer)
      .resize(400, 400)
      .toFormat(imageFormat)
      .jpeg({ quality: 100 })
      .toBuffer();

    // Generate unique filename for the image
    const profileImageName = `user-${uuidv4()}-${Date.now()}.${imageFormat}`;

    // Upload image to AWS S3 bucket
    await uploadFileToS3({
      awsBuckName: awsBuckName,
      key: `users/${profileImageName}`,
      body: buffer,
      contentType: `image/${imageFormat}`,
    }, s3Client);

    // Add profile image filename to request body
    req.body.profileImage = profileImageName;
  } else {
    delete req.body.profileImage; // Remove if not uploaded
  }

  // Check if cover image was uploaded
  if (req.files.profileCoverImage) {

    // Process image: convert to JPEG (no resizing for cover image)
    const buffer = await sharp(req.files.profileCoverImage[0].buffer)
      .toFormat(imageFormat)
      .jpeg({ quality: 100 })
      .toBuffer();

    // Generate unique filename for the cover image
    const profileCoverImageName = `user-${uuidv4()}-${Date.now()}.${imageFormat}`;

    // Upload cover image to AWS S3 bucket
    await uploadFileToS3({
      awsBuckName: awsBuckName,
      key: `users/${profileCoverImageName}`,
      body: buffer,
      contentType: `image/${imageFormat}`,
    }, s3Client);

    // Add cover image filename to request body
    req.body.profileCoverImage = profileCoverImageName;
  } else {
    delete req.body.profileCoverImage; // Remove if not uploaded
  }

  // Move to next middleware
  next();
});

// @desc    Get list of users
// @route   GET /api/v1/users
// @access  Private admin
exports.getUsers = getAll(userModel, `User`);

// @desc    Get user by ID
// @route   GET /api/v1/users/:id
// @access  Private
// Export a function to get user details
exports.getUser = asyncHandler(async (req, res, next) => {
  // Extract user ID from request parameters
  const { id: userId } = req.params;

  // Find user in database by ID
  const user = await userModel.findById(userId);
  
  // If user not found, return error
  if (!user) {
    return next(new ApiError(`No user for this ID ${userId}.`, 404));
  };

  // Remove sensitive data from user object
  const privateUser = userPropertysPrivate(user);
  
  // Return the sanitized user data with 200 status
  res.status(200).json({ data: privateUser });
});

// @desc    Create user
// @route   POST /api/v1/users
// @access  Private
exports.createUser = createOne(userModel);

// @desc    Update user by ID
// @route   PUT /api/v1/users/:id
// @access  Private
exports.updateUser = asyncHandler(async (req, res, next) => {
  const { id: userId } = req.params;
  const { body } = req;
  const { urlsOfUserImages } = body;

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
          email: body.email,
          emailVerification: body.emailVerification,
          phoneNumber: body.phoneNumber,
          profileImage: body.profileImage,
          profileCoverImage: body.profileCoverImage,
          role: body.role,
          userBlock: body.userBlock,
        }
      },
      { new: true, session } // Return updated document and use session
    );

    // Prepare URLs of old images to delete (if new ones were provided)
    let URLs = [
      body.profileImage ? urlsOfUserImages.profileImage : "",
      body.profileCoverImage ? urlsOfUserImages.profileCoverImage : "",
    ];

    // Delete old images from S3
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

// @desc    Delete user by ID
// @route   DELETE /api/v1/users/:id
// @access  Private
exports.deleteUser = asyncHandler(async (req, res, next) => {
  const { id: userId } = req.params;

  // Start a database transaction session
  const session = await mongoose.startSession();
  session.startTransaction();

  let user;
  try {
    // Find the user by ID within the transaction
    user = await userModel.findById(userId).session(session);

    // Check if user exists
    if (!user) {
      await session.abortTransaction(); // Abort transaction first
      await session.endSession();       // Then end session
      return next(new ApiError(`No user for this ID ${userId}.`, 404));
    }

    // Prevent deletion if user is an admin
    if (user.role === "admin") {
      await session.abortTransaction(); // Abort transaction first
      await session.endSession();       // Then end session
      return next(new ApiError(`This user cannot be deleted because is an admin.`, 403));
    }

    // Delete all related data in parallel (favorites, reviews, cart, orders)
    await Promise.all([
      favoriteModel.deleteMany({ userId: userId }).session(session),
      reviewModel.deleteMany({ user: userId }).session(session),
      cartModel.deleteMany({ user: userId }).session(session),
      orderModel.deleteMany({ user: userId }).session(session),
    ]);

    // Delete the user document itself
    await userModel.deleteOne({ _id: userId }).session(session);

    // Prepare URLs of user's images to delete from S3
    let URLs = [
      user.profileImage ? user.profileImage : "",
      user.profileCoverImage ? user.profileCoverImage : "",
    ];

    // Delete images from S3 storage
    const keys = extractFilePathsFromS3Urls(URLs);
    await deleteS3Objects(keys, awsBuckName, s3Client);

    // Commit the transaction if everything succeeded
    await session.commitTransaction();
  } catch (error) {
    // If any error occurs, roll back the transaction
    await session.abortTransaction();
    return next(new ApiError("Something went wrong. Please Try again.", 500));
  } finally {
    // End the session in all cases (success or error)
    session.endSession();
  }

  // Return the deleted user data (with private properties filtered)
  const privateUser = userPropertysPrivate(user);
  res.status(200).json({ data: privateUser });
});
