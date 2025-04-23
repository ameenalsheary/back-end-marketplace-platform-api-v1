const crypto = require("crypto");

const { DeleteObjectCommand } = require("@aws-sdk/client-s3");
const s3Client = require("../../config/s3Client");
const asyncHandler = require("express-async-handler");
const bcrypt = require("bcryptjs");

const userModel = require("../../models/userModel");
const createToken = require("../../utils/createToken");
const sendEmail = require("../../utils/sendEmail");
const ApiError = require("../../utils/apiErrore");
const { userPropertysPrivate } = require("../../utils/propertysPrivate");

// @desc    Email verify
// @route   POST /api/v1/auth/emailverify
// @access  User logged in
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
  const message = `
    <div style="text-align: center;font-family: Arial, Helvetica, sans-serif;color: rgb(56, 56, 56);padding: 20px 0px;">
      <h1 style="margin: 0;padding: 0;font-size: 28px;font-weight: 600;margin-bottom: 4px">
        Hi ${user.firstName} ${user.lastName}
      </h1>
      <p style="margin: 0;padding: 0;font-size: 16px;margin-bottom: 4px">
        Enter this code to confirm your email.
      </p>
      <h2 style="margin: 0;padding: 0;font-size: 24px;font-weight: 600;margin-bottom: 4px">
        ${emailVerificationCode}
      </h2>
    </div>
  `;

  try {
    await sendEmail({
      email: user.email,
      subject: "Your email verification code (valid for 10 min)",
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

// @desc    Email verify code
// @route   POST /api/v1/auth/emailverifycode
// @access  User logged in
exports.emailVerificationCode = asyncHandler(async (req, res, next) => {
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

// @desc    Get my data
// @route   GET /api/v1/users/mydata
// @access  user logged in
exports.getMyData = asyncHandler(async (req, res) => {
  const id = req.user._id;
  const document = await userModel.findById(id);
  const user = userPropertysPrivate(document);
  res.status(200).json({ data: user });
});

// @desc    Update my data
// @route   PUT /api/v1/users/updatemydata
// @access  user logged in
exports.updateMyData = asyncHandler(async (req, res) => {
  const id = req.user._id;
  const body = req.body;

  if (body.profileImage || body.profileCoverImage) {
    let user = await userModel.findByIdAndUpdate(id, {
      firstName: body.firstName,
      lastName: body.lastName,
      slug: body.slug,
      phoneNumber: body.phoneNumber,
      profileImage: body.profileImage,
      profileCoverImage: body.profileCoverImage,
    });

    let allUrlsImages = [];
    if (body.profileImage) {
      allUrlsImages.push(user.profileImage);
    }
    if (body.profileCoverImage) {
      allUrlsImages.push(user.profileCoverImage);
    }

    const keys = allUrlsImages.map((item) => {
      const imageUrl = `${item}`;
      const baseUrl = `${process.env.AWS_BASE_URL}/`;
      const restOfUrl = imageUrl.replace(baseUrl, "");
      const key = restOfUrl.slice(0, restOfUrl.indexOf("?"));
      return key;
    });

    const awsBuckName = process.env.AWS_BUCKET_NAME;

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
        phoneNumber: body.phoneNumber,
      },
      {
        new: true,
      }
    );

    user = userPropertysPrivate(user);
    res.status(200).json({ data: user });
  }
});

// @desc    Get my addresses.
// @route   GET /api/v1/users/addresses
// @access  Private
exports.getMyAddresses = asyncHandler(async (req, res) => {
  const userId = req.user._id;
  const user = await userModel.findById(userId);

  const addressesList = user.addressesList.reverse();
  res.status(200).json({
    status: "Success",
    message: "List addresses retrieved successfully.",
    data: addressesList,
  });
});

// @desc    Add address to my addresses list.
// @route   POST /api/v1/users/addresses
// @access  Private
exports.addMyAddress = asyncHandler(async (req, res) => {
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

// @desc    Remove address from my addresses list.
// @route   DELETE /api/v1/users/addresses/:addressId
// @access  Private
exports.removeMyAddress = asyncHandler(async (req, res) => {
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
    message: "Address removed successfully from your addresses list.",
    data: newAddressesList,
  });
});

// @desc    Change my password
// @route   PUT /api/v1/users/changemypassword
// @access  user logged in
exports.changeMyPassword = asyncHandler(async (req, res, next) => {
  const id = req.user._id;
  const userCheck = await userModel.findById(id);
  // Check user exist
  if (!userCheck) {
    return next(new ApiError(`No user for this id ${id}.`, 404));
  }
  const isCorrectPassword = await bcrypt.compare(
    req.body.currentPassword,
    userCheck.password
  );
  if (!isCorrectPassword) {
    return next(new ApiError("Incorrect current password.", 401));
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

// @desc    Change my email
// @route   PUT /api/v1/users/changemyemail
// @access  user logged in
exports.changeMyEmail = asyncHandler(async (req, res, next) => {
  const id = req.user._id;
  const userCheck = await userModel.findById(id);
  if (!(await bcrypt.compare(req.body.password, userCheck.password))) {
    return next(new ApiError("The password is not incorrect.", 401));
  }
  const document = await userModel.findByIdAndUpdate(
    id,
    {
      email: req.body.newEmail,
      emailVerify: false,
    },
    {
      new: true,
    }
  );
  const user = userPropertysPrivate(document);
  res.status(200).json({ date: user });
});
