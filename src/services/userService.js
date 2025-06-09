const { PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const s3Client = require('../config/s3Client');
const sharp = require("sharp");
const asyncHandler = require("express-async-handler");
const { v4: uuidv4 } = require("uuid");

const userModel = require("../models/userModel");
const ApiError = require("../utils/apiErrore");
const {getAll, createOne } = require("./handlersFactory");
const { uploadMultipleImages } = require("../middlewares/uploadImageMiddleware");
const { userPropertysPrivate } = require("../utils/propertysPrivate");

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

  // 1 - Image processing for profileImage
  if (req.files.profileImage) {

    const imageFormat = 'jpeg';

    const buffer = await sharp(req.files.profileImage[0].buffer)
    .resize(400, 400)
    .toFormat(imageFormat)
    .jpeg({ quality: 100 })
    .toBuffer();

    const profileImageName = `user-${uuidv4()}-${Date.now()}.${imageFormat}`;

    const params = {
      Bucket: awsBuckName,
      Key: `users/${profileImageName}`,
      Body: buffer,
      ContentType: `image/${imageFormat}`,
    };

    const command = new PutObjectCommand(params);
    await s3Client.send(command);

    // Save image name to Into Your db
    req.body.profileImage = profileImageName;

  };

  // 2 - Image processing for profileCoverImage
  if (req.files.profileCoverImage) {

    const imageFormat = 'jpeg';

    const buffer = await sharp(req.files.profileCoverImage[0].buffer)
    .toFormat(imageFormat)
    .jpeg({ quality: 100 })
    .toBuffer();

    const profileCoverImageName = `user-${uuidv4()}-${Date.now()}.${imageFormat}`;

    const params = {
      Bucket: awsBuckName,
      Key: `users/${profileCoverImageName}`,
      Body: buffer,
      ContentType: `image/${imageFormat}`,
    };

    const command = new PutObjectCommand(params);
    await s3Client.send(command);

    // Save image name to Into Your db
    req.body.profileCoverImage = profileCoverImageName;

  };

  next();
});

// @desc    Get list of users
// @route   GET /api/v1/users
// @access  Private admine
exports.getUsers = getAll(userModel, `User`);

// @desc    Get user by id
// @route   GET /api/v1/users/:id
// @access  Private admine
exports.getUser = asyncHandler(async (req, res, next) => {
  const id = req.params.id;
  const document = await userModel.findById(id);

  if (!document) {
    return next(new ApiError(`No user for this id ${id}.`, 404));
  };

  const user = userPropertysPrivate(document);

  res.status(200).json({
    data: user,
  });
});

// @desc    Create user
// @route   POST /api/v1/users
// @access  Private admine
exports.createUser = createOne(userModel);

// @desc    Update user by id
// @route   PUT /api/v1/users/:id
// @access  Private admine
exports.updateUser = asyncHandler(async (req, res, next) => {

  const { id } = req.params;
  const body = req.body;

  const userCheck = await userModel.findById(id);
  // Check user exist
  if (!userCheck) {
    return next(new ApiError(`No user for this id ${id}.`, 404));
  };

  // Check if the user is an admin
  if (userCheck.role === "admin") {
    return next(
      new ApiError(`This user cannot be updated data because is an admin.`, 403)
    );
  };

  if (body.profileImage || body.profileCoverImage) {

    let user = await userModel.findByIdAndUpdate(
      id,
      {
        firstName: body.firstName,
        lastName: body.lastName,
        slug: body.slug,
        email: body.email,
        emailVerification: body.emailVerification,
        phoneNumber: body.phoneNumber,
        profileImage: body.profileImage,
        profileCoverImage: body.profileCoverImage,
        role: body.role,
      }
    );

    let allUrlsImages = [];
    if (body.profileImage) {
      allUrlsImages.push(user.profileImage);
    };
    if (body.profileCoverImage) {
      allUrlsImages.push(user.profileCoverImage);
    };

    const keys = allUrlsImages.map((item) => {
      const imageUrl = `${item}`;
      const baseUrl = `${process.env.AWS_BASE_URL}/`;
      const restOfUrl = imageUrl.replace(baseUrl, '');
      const key = restOfUrl.slice(0, restOfUrl.indexOf('?'));
      return key;
    });
  
    await Promise.all(
  
      keys.map(async (key) => {
  
        const params = {
          Bucket: awsBuckName,
          Key: key,
        };
  
        const command = new DeleteObjectCommand(params);
        await s3Client.send(command);
  
      })
  
    );

    user = await userModel.find({ _id: id });

    user = userPropertysPrivate(user[0]);

    res.status(200).json({ data: user });

  } else {

    let user = await userModel.findByIdAndUpdate(
      id,
      {
        firstName: body.firstName,
        lastName: body.lastName,
        slug: body.slug,
        email: body.email,
        emailVerification: body.emailVerification,
        phoneNumber: body.phoneNumber,
        role: body.role,
      },
      {
        new: true,
      }
    );

    user = userPropertysPrivate(user);
    res.status(200).json({ data: user });

  };

});

// @desc    Block specific user
// @route   PUT /api/v1/users/userblock/:id
// @access  Private admine
exports.userBlock = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const userCheck = await userModel.findById(id);

  // Check user exist
  if (!userCheck) {
    return next(new ApiError(`No user for this id ${id}.`, 404));
  };

  // Check if the user is an admin
  if (userCheck.role === "admin") {
    return next(
      new ApiError(`This user cannot be blocked because is an admin.`, 403)
    );
  };

  const document = await userModel.findByIdAndUpdate(
    id,
    {
      userBlock: req.body.userBlock,
    },
    {
      new: true,
    }
  );

  const user = userPropertysPrivate(document);

  res.status(200).json({ data: user });
});

// @desc    Delete user by id
// @route   DELETE /api/v1/users/:id
// @access  Private admine
exports.deleteUser = asyncHandler(async (req, res, next) => {

  const { id } = req.params;
  const userCheck = await userModel.findById(id);

  // Check user exist
  if (!userCheck) {
    return next(new ApiError(`No user for this id ${id}.`, 404));
  };

  // Check if the user is an admin
  if (userCheck.role === "admin") {
    return next(
      new ApiError(`This user cannot be deleted because is an admin.`, 403)
    );
  };

  // Delete user
  let user = await userModel.findByIdAndDelete({ _id: id });

  // Delete images
  if (user.profileImage || user.profileCoverImage) {

    let allUrlsImages = [];
    if (user.profileImage) {
      allUrlsImages.push(user.profileImage);
    };
    if (user.profileCoverImage) {
      allUrlsImages.push(user.profileCoverImage);
    };

    const keys = allUrlsImages.map((item) => {
      const imageUrl = `${item}`;
      const baseUrl = `${process.env.AWS_BASE_URL}/`;
      const restOfUrl = imageUrl.replace(baseUrl, '');
      const key = restOfUrl.slice(0, restOfUrl.indexOf('?'));
      return key;
    });
  
    await Promise.all(
  
      keys.map(async (key) => {
  
        const params = {
          Bucket: awsBuckName,
          Key: key,
        };
  
        const command = new DeleteObjectCommand(params);
        await s3Client.send(command);
  
      })
  
    );

    user = userPropertysPrivate(user);

    res.status(200).json({ data: user }); 

  } else {

    user = userPropertysPrivate(user);

    res.status(200).json({ data: user });

  };

});