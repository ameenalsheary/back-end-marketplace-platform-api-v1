const mongoose = require("mongoose");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { GetObjectCommand } = require("@aws-sdk/client-s3");
const s3Client = require("../config/s3Client");

const { findTheSmallestPriceInSize } = require("../utils/findTheSmallestPriceInSize");

const awsBuckName = process.env.AWS_BUCKET_NAME;
const expiresIn = process.env.EXPIRE_IN;

const productSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, "Product title is required."],
      trim: true,
      minlength: [3, "Product title must be at least 3 characters."],
      maxlength: [200, "Product title cannot exceed 200 characters."],
    },
    slug: {
      type: String,
      required: [true, "Product slug is required."],
      trim: true,
      lowercase: true,
    },
    description: {
      type: String,
      required: [true, "Product description is required."],
      trim: true,
      minlength: [32, "Product description must be at least 32 characters."],
      maxlength: [1000, "Product description cannot exceed 1000 characters."],
    },
    price: {
      type: Number,
      min: [0, "Product price must be between 0 and 10000."],
      max: [10000, "Product price must be between 0 and 10000."],
    },
    priceBeforeDiscount: {
      type: Number,
      min: [0, "Product price before discount must be between 0 and 10000."],
      max: [
        10000,
        "Product price before discount must be between 0 and 10000.",
      ],
    },
    discountPercent: {
      type: Number,
      min: [0, "Product discount percent must be between 0 and 100."],
      max: [100, "Product discount percent must be between 0 and 100."],
    },
    color: {
      type: String,
      trim: true,
      minlength: [3, "Product color name must be at least 3 characters."],
      maxlength: [32, "Product color name cannot exceed 32 characters."],
      lowercase: true,
    },
    imageCover: {
      type: String,
      required: [true, "Product image cover is required."],
      trim: true,
    },
    images: [
      {
        type: String,
        trim: true,
      },
    ],
    size: {
      type: String,
      trim: true,
      lowercase: true,
      min: [1, "Size product size must be at least 1 characters."],
      max: [8, "Size product size cannot exceed 8 characters."],
    },
    quantity: {
      type: Number,
      min: [1, "Product quantity must be between 1 and 1000."],
      max: [1000, "Product quantity must be between 1 and 1000."],
    },
    sizes: [
      {
        size: {
          type: String,
          trim: true,
          lowercase: true,
          min: [1, "Sizes: product size must be at least 1 characters."],
          max: [8, "Sizes: product size cannot exceed 8 characters."],
        },
        quantity: {
          type: Number,
          min: [1, "Sizes: product quantity must be between 1 and 1000."],
          max: [1000, "Sizes: product quantity must be between 1 and 1000."],
        },
        price: {
          type: Number,
          min: [0, "Sizes: product price must be between 0 and 10000."],
          max: [10000, "Sizes: product price must be between 0 and 10000."],
        },
        priceBeforeDiscount: {
          type: Number,
          min: [
            0,
            "Sizes: product price before discount must be between 0 and 10000.",
          ],
          max: [
            10000,
            "Sizes: product price before discount must be between 0 and 10000.",
          ],
        },
        discountPercent: {
          type: Number,
          min: [0, "Product discount percent must be between 0 and 100."],
          max: [100, "Product discount percent must be between 0 and 100."],
        },
      },
    ],
    category: {
      type: mongoose.Schema.ObjectId,
      ref: "Category",
      required: [true, "Product must belong to category."],
    },
    subCategories: [
      {
        type: mongoose.Schema.ObjectId,
        ref: "subCategory",
      },
    ],
    underSubCategories: [
      {
        type: mongoose.Schema.ObjectId,
        ref: "underSubCategory",
      },
    ],
    brand: {
      type: mongoose.Schema.ObjectId,
      ref: "Brand",
    },
    group: {
      type: mongoose.Schema.ObjectId,
      ref: "productsGroup",
    },
    sold: {
      type: Number,
      min: [0, "Product sold must be between 0 and 1000."],
      max: [1000, "Product sold must be between 0 and 1000."],
      default: 0,
    },
    ratingsAverage: {
      type: Number,
      min: [1, "Product ratings average must be between 1 and 5."],
      max: [5, "Product ratings average must be between 1 and 5."],
    },
    ratingsQuantity: {
      type: Number,
      default: 0,
      min: [0, "Product ratings quantity must be 0 or greater."],
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// mongoose query middleware
productSchema.pre("findOne", function (next) {
  this.populate({
    path: "category brand",
    select: "name",
  }).populate({
    path: "group",
    select: "productsIDs",
  });
  next();
});

// Show the properties of the smallest price among sizes.
const showSmallestPriceSize = function (update) {
  if (update?.sizes) {
    const theSmallestPriceSize = findTheSmallestPriceInSize(update.sizes);
    update.price = theSmallestPriceSize.price ?? "";
    update.priceBeforeDiscount = theSmallestPriceSize.priceBeforeDiscount ?? "";
    update.discountPercent = theSmallestPriceSize.discountPercent ?? "";
    update.size = theSmallestPriceSize.size ?? "";
    update.quantity = theSmallestPriceSize.quantity ?? "";
  }
};

productSchema.pre("findOneAndUpdate", function (next) {
  const update = this.getUpdate();
  showSmallestPriceSize(update);
  next();
});

productSchema.pre("updateOne", function (next) {
  const update = this.getUpdate()?.$set;
  showSmallestPriceSize(update);
  next();
});

productSchema.pre("save", function (next) {
  if (this.sizes?.length > 0) showSmallestPriceSize(this);
  next();
});

const setImageUrl = async (doc) => {
  if (doc.imageCover) {
    const getObjectParams = {
      Bucket: awsBuckName,
      Key: `products/${doc.imageCover}`,
    };

    const command = new GetObjectCommand(getObjectParams);
    const imageUrl = await getSignedUrl(s3Client, command, { expiresIn });

    doc.imageCover = imageUrl;
  }

  if (doc.images) {
    let imageList = [];

    await Promise.all(
      doc.images.map(async (image) => {
        const getObjectParams = {
          Bucket: awsBuckName,
          Key: `products/${image}`,
        };

        const command = new GetObjectCommand(getObjectParams);
        const imageUrl = await getSignedUrl(s3Client, command, { expiresIn });

        imageList.push(imageUrl);
      })
    );

    doc.images = imageList;
  }
};

// findOne, findAll, update, delete
productSchema.post("init", async function (doc) {
  await setImageUrl(doc);
});

// create
productSchema.post("save", async function (doc) {
  await setImageUrl(doc);
});

module.exports = mongoose.model("Product", productSchema);
