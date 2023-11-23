const mongoose = require("mongoose");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { GetObjectCommand } = require("@aws-sdk/client-s3");
const s3Client = require('../config/s3Client');

const underSubCategorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Under sub category name is required."],
      trim: true,
      lowercase: true,
      minlength: [3, "Too short under sub category name."],
      maxlength: [32, "Too long under sub category name."],
    },
    slug: {
      type: String,
      required: [true, "Under sub category slug is required."],
      trim: true,
      lowercase: true,
    },
    subCategory: {
      type: mongoose.Schema.ObjectId,
      ref: `subCategory`,
      required: [true, "Under Sub category must be belong to sub category."],
      immutable: true,
    },
    image: {
      type: String,
      required: [true, "Under sub category image is required."],
      trim: true,
    },
  },
  { timestamps: true }
);

// mongoose query middleware
underSubCategorySchema.pre("findOne", function(next) {
  this.populate({
    path: "subCategory",
    select: "name image",
  });
  next();
});

const setImageUrl = async (doc) => {

  if (doc.image) {

    const awsBuckName = process.env.AWS_BUCKET_NAME;
    const expiresIn = process.env.EXPIRE_IN;

    const getObjectParams = {
      Bucket: awsBuckName,
      Key: `underSubCategories/${doc.image}`,
    };

    const command = new GetObjectCommand(getObjectParams);
    const imageUrl = await getSignedUrl(s3Client, command, { expiresIn });

    doc.image = imageUrl;

  };

};

// findOne, findAll, update, delete
underSubCategorySchema.post("init", async function (doc) {
  await setImageUrl(doc);
});

// create
underSubCategorySchema.post("save", async function (doc) {
  await setImageUrl(doc);
});

module.exports = mongoose.model(`underSubCategory`, underSubCategorySchema);