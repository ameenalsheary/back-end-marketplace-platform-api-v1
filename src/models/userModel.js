const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { GetObjectCommand } = require("@aws-sdk/client-s3");
const s3Client = require("../config/s3Client");

const awsBuckName = process.env.AWS_BUCKET_NAME;
const expiresIn = process.env.EXPIRE_IN;

const userSchema = new mongoose.Schema(
  {
    firstName: {
      type: String,
      required: [true, "First name is required."],
      trim: true,
      minlength: [3, "First name must be at least 3 characters."],
      maxlength: [16, "First name cannot exceed 16 characters."],
    },
    lastName: {
      type: String,
      required: [true, "Last name is required."],
      trim: true,
      minlength: [2, "Last name must be at least 2 characters."],
      maxlength: [16, "Last name cannot exceed 16 characters."]
    },
    slug: {
      type: String,
      required: [true, "Slug is required."],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required."],
      unique: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address."],
    },
    emailVerification: {
      type: Boolean,
      default: false,
    },
    emailVerificationCode: String,
    emailVerificationCodeExpires: Date,
    phoneNumber: {
      type: String,
      trim: true,
    },
    profileImage: {
      type: String,
      trim: true,
    },
    profileCoverImage: {
      type: String,
      trim: true,
    },
    password: {
      type: String,
      required: [true, "Password is required."],
      minlength: [8, "Password should be at least 8 characters long."],
    },
    passwordChangedAt: Date,
    passwordResetCode: String,
    passwordResetExpires: Date,
    role: {
      type: String,
      enum: ["customer", "admin"],
      default: "customer",
    },
    active: {
      type: Boolean,
      default: true,
    },
    userBlock: {
      type: Boolean,
      default: false,
    },
    addressesList: [
      {
        id: mongoose.Schema.Types.ObjectId,
        country: {
          type: String,
          trim: true,
          required: [true, "Country is required."],
          minlength: [2, "Country name must be at least 2 characters."],
          maxlength: [50, "Country name cannot exceed 50 characters."],
        },
        state: {
          type: String,
          trim: true,
          required: [true, "State is required."],
          minlength: [2, "State name must be at least 2 characters."],
          maxlength: [50, "State name cannot exceed 50 characters."],
        },
        city: {
          type: String,
          trim: true,
          required: [true, "City is required."],
          minlength: [2, "City name must be at least 2 characters."],
          maxlength: [50, "City name cannot exceed 50 characters."],
        },
        street: {
          type: String,
          trim: true,
          required: [true, "Street address is required."],
          minlength: [5, "Street address must be at least 5 characters."],
          maxlength: [100, "Street address cannot exceed 100 characters."],
        },
        postalCode: {
          type: String,
          trim: true,
          required: [true, "Postal code is required."],
          match: [/^\d{4,10}$/, "Postal code must be between 4 and 10 digits."],
        },
      },
    ],
  },
  { timestamps: true }
);

const setImageUrl = async (doc) => {
  if (doc.profileImage) {
    const getObjectParams = {
      Bucket: awsBuckName,
      Key: `users/${doc.profileImage}`,
    };

    const command = new GetObjectCommand(getObjectParams);
    const imageUrl = await getSignedUrl(s3Client, command, { expiresIn });

    doc.profileImage = imageUrl;
  }

  if (doc.profileCoverImage) {
    const getObjectParams = {
      Bucket: awsBuckName,
      Key: `users/${doc.profileCoverImage}`,
    };

    const command = new GetObjectCommand(getObjectParams);
    const imageUrl = await getSignedUrl(s3Client, command, { expiresIn });

    doc.profileCoverImage = imageUrl;
  }
};

// findOne, findAll, update, delete
userSchema.post("init", async function (doc) {
  await setImageUrl(doc);
});

// create
userSchema.post("save", async function (doc) {
  await setImageUrl(doc);
});

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  // Hashing user password
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

module.exports = mongoose.model("User", userSchema);
