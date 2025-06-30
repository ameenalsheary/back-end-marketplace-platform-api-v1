const mongoose = require("mongoose");
const s3Client = require('../config/s3Client');
const sharp = require("sharp");
const asyncHandler = require("express-async-handler");
const { v4: uuidv4 } = require("uuid");

const ApiError = require("../utils/apiErrore");
const { uploadMultipleImages } = require("../middlewares/uploadImageMiddleware");
const ApiFeatures = require("../utils/apiFeatures");
const productModel = require("../models/productModel");
const { checkTheToken } = require('./authServises/protect&allowedTo');
const reviewModel = require("../models/reviewModel");
const favoriteModel = require("../models/favoriteModel");
const productsGroupModel = require("../models/productsGroupModel");
const {
  uploadFileToS3,
  extractFilePathsFromS3Urls,
  deleteS3Objects,
} = require("../utils/s3Utils");

const awsBuckName = process.env.AWS_BUCKET_NAME;

/**
 * Adds isFavorite field to each product based on user's favorites
 * @param {Array} products - Array of product objects
 * @param {String} userId - User ID to check favorites against
 * @returns {Array} - Products with isFavorite field added
 */
async function addFavoriteStatusToProducts(products, userId) {
  const userFavorites = await favoriteModel.find({ userId })
    .select("productId")
    .setOptions({ disableAutoPopulate: true });
  
  const favoriteProductIds = userFavorites.map((fav) => fav.productId.toString());

  return products.map((product) => ({
    ...product,
    isFavorite: favoriteProductIds.includes(product._id.toString()),
  }));
}

// Upload multiple images
exports.uploadProductImages = uploadMultipleImages([
  {
    name: "imageCover",
    maxCount: 1,
  },
  {
    name: "images",
    maxCount: 6,
  },
]);

// Images processing
// Middleware to resize and upload product images
exports.resizeProductImages = asyncHandler(async (req, _, next) => {
  const imageFormat = "webp"; // Set image format to webp

  // Check if image cover exists
  if (!req.files?.imageCover && req.method === "POST") {
    return next(new ApiError("Product image cover is required.", 400));
  }

  // === Process imageCover ===
  if (req.files?.imageCover) {
    // Resize, convert format, and optimize quality of cover image
    const buffer = await sharp(req.files.imageCover[0].buffer)
      .resize(500, 690)
      .toFormat(imageFormat, { quality: 65 })
      .toBuffer();

    // Generate unique filename for cover image
    const imageCoverName = `product-${uuidv4()}-${Date.now()}.${imageFormat}`;

    // Upload cover image to S3
    await uploadFileToS3(
      {
        awsBuckName,
        key: `products/${imageCoverName}`,
        body: buffer,
        contentType: `image/${imageFormat}`,
      },
      s3Client
    );

    // Add cover image filename to request body
    req.body.imageCover = imageCoverName;
  } else {
    delete req.body.imageCover; // Remove imageCover if not provided
  }

  // === Process multiple images ===
  // Check if there are additional images
  if (req.files?.images?.length > 0) {
    req.body.images = []; // Initialize images array

    // Process all images in parallel
    await Promise.all(
      req.files.images.map(async (img, index) => {
        // Resize, convert format, and optimize quality for each image
        const buffer = await sharp(img.buffer)
          .resize(500, 690)
          .toFormat(imageFormat, { quality: 65 })
          .toBuffer();

        // Generate unique filename for each image
        const imageName = `product-${uuidv4()}-${Date.now()}-${
          index + 1
        }.${imageFormat}`;

        // Upload each image to S3
        await uploadFileToS3(
          {
            awsBuckName,
            key: `products/${imageName}`,
            body: buffer,
            contentType: `image/${imageFormat}`,
          },
          s3Client
        );

        // Add image filename to request body
        req.body.images.push(imageName);
      })
    );
  } else {
    delete req.body.images; // Remove images if not provided
  }

  // Move to next middleware
  next();
});

// @desc    Get list of products
// @route   GET /api/v1/products
// @access  Public
exports.getProducts = asyncHandler(async (req, res) => {
  // Build query
  const apiFeatures = new ApiFeatures(productModel.find({}), req.query)
    .filter()
    .sort()
    .limitFields()
    .search("Product");

  // Clone the query before counting documents
  const queryForCount = apiFeatures.mongooseQuery.clone();
  const countDocuments = await queryForCount.countDocuments();

  // Apply pagination after getting the count
  apiFeatures.paginate(countDocuments);

  // Get query and pagination from API features  
  const { mongooseQuery, paginationResults } = apiFeatures;  
  let products;  

  // Check if user is logged in  
  const currentUser = await checkTheToken(req);

  if (currentUser._id) {
    // Get products and check favorites
    products = JSON.parse(JSON.stringify(await mongooseQuery));  
    products = await addFavoriteStatusToProducts(products, currentUser._id);
  } else {  
    // Get products without favorite check (guest user)  
    products = await mongooseQuery;  
  }

  res.status(200).json({
    result: products.length,
    paginationResults,
    data: products,
  });
});

// @desc    Get product by ID
// @route   GET /api/v1/products/:id
// @access  Public
exports.getProduct = asyncHandler(async (req, res, next) => {
  const { id } = req.params;  // Get product ID from URL params

  // Find product by ID
  let product = await productModel.findById(id);

  // Return error if product not found
  if (!product) {
    return next(new ApiError(`No product for this ID ${id}.`, 404));
  }

  // Check if user is logged in
  const currentUser = await checkTheToken(req);

  // Add favorite status to product if user is logged in
  if (currentUser._id) {
    product = JSON.parse(JSON.stringify(product));
    product = (await addFavoriteStatusToProducts([product], currentUser._id))[0];
  }

  // Return product data
  res.status(200).json({ data: product });
});

// @desc    Create product
// @route   POST /api/v1/products
// @access  Private
exports.createProduct = asyncHandler(async (req, res) => {
  const { body } = req;

  let product;
  if (Array.isArray(body.sizes) && body.sizes.length > 0) {
    product = await productModel.create({
      title: body.title,
      slug: body.slug,
      description: body.description,
      color: body.color,
      sizes: body.sizes,
      imageCover: body.imageCover,
      images: body.images,
      category: body.category,
      subCategories: body.subCategories,
      underSubCategories: body.underSubCategories,
      brand: body.brand,
      sold: body.sold,
      ratingsAverage: body.ratingsAverage,
      ratingsQuantity: body.ratingsQuantity,
    });
  } else {
    // Calculate discount percent if price and priceBeforeDiscount are provided
    if (body.price && body.priceBeforeDiscount) {
      body.discountPercent = Math.round(((body.priceBeforeDiscount - body.price) / body.priceBeforeDiscount) * 100);
    } else {
      delete body.discountPercent; // Remove discountPercent if not applicable
    }

    product = await productModel.create({
      title: body.title,
      slug: body.slug,
      description: body.description,
      color: body.color,
      quantity: body.quantity,
      price: body.price,
      priceBeforeDiscount: body.priceBeforeDiscount,
      discountPercent: body.discountPercent,
      imageCover: body.imageCover,
      images: body.images,
      category: body.category,
      subCategories: body.subCategories,
      underSubCategories: body.underSubCategories,
      brand: body.brand,
      sold: body.sold,
      ratingsAverage: body.ratingsAverage,
      ratingsQuantity: body.ratingsQuantity,
    });
  }

  res.status(201).json({
    data: product,
  });
})

// @desc    Update product by ID
// @route   PUT /api/v1/products/:id
// @access  Private
exports.updateProduct = asyncHandler(async (req, res, next) => {
  const { id: productId } = req.params;
  const { body } = req;
  const { urlsOfProductImages } = body;
  
  // Start a database transaction session
  const session = await mongoose.startSession();
  session.startTransaction();

  let product;
  try {

    // Find and update the product
    product = await productModel.findByIdAndUpdate(productId, body, { 
      new: true, // Return updated doc
      session // Include in transaction
    });

    // If product not found, return error
    if (!product) {
      await session.abortTransaction(); // Abort transaction first
      await session.endSession();       // Then end session
      return next(new ApiError(`No product for this ID ${productId}.`, 404));
    };

    // If updating images, delete old images from S3
    const URLs = [];
    if (body.imageCover) URLs.push(urlsOfProductImages.imageCover);
    if (body.images?.length > 0) URLs.push(...urlsOfProductImages.images);

    // Extract file paths from URLs and delete from S3
    const keys = extractFilePathsFromS3Urls(URLs);
    await deleteS3Objects(keys, awsBuckName, s3Client);

    // Commit transaction if everything succeeded
    await session.commitTransaction();
  } catch (error) {
    // Rollback transaction if any error occurs
    await session.abortTransaction();
    return next(new ApiError("Something went wrong. Please Try again.", 500));
  } finally {
    // End the session in all cases
    session.endSession();
  }

  // Return updated product data
  res.status(200).json({ data: product });
});

// @desc    Delete Product by ID
// @route   DELETE /api/v1/products/:id
// @access  Private
exports.deleteProduct = asyncHandler(async (req, res, next) => {
  const { id: productId } = req.params;

  // Start a database transaction session
  const session = await mongoose.startSession();
  session.startTransaction();

  let product;
  try {
    // Find and delete the product (inside the transaction)
    product = await productModel.findByIdAndDelete(productId).session(session);

    // If product not found, return error
    if (!product) {
      await session.abortTransaction(); // Abort transaction first
      await session.endSession();       // Then end session
      throw next(new ApiError(`No product for this ID ${productId}.`, 404));
    }

    // Delete related reviews and favorites (atomic operations)
    await reviewModel.deleteMany({ product: productId }).session(session);
    await favoriteModel.deleteMany({ productId }).session(session);

    // Remove product ID from all product groups
    await productsGroupModel.updateMany(
      { productsIDs: productId },
      { $pull: { productsIDs: productId } },
      { session }
    );

    // Delete associated images from S3 (non-database operation, but still in try-catch)
    const URLs = [
      ...(Array.isArray(product.images) ? product.images : []),
      ...(product.imageCover ? [product.imageCover] : [])
    ];

    const keys = extractFilePathsFromS3Urls(URLs);
    await deleteS3Objects(keys, awsBuckName, s3Client);

    // Commit the transaction if everything succeeds
    await session.commitTransaction();
  } catch (error) {
    // Abort transaction and pass error
    await session.abortTransaction();
     return next(new ApiError("Something went wrong. Please Try again.", 500));
  } finally {
    // End the session in all cases (success or error)
    session.endSession();
  }

  // Response
  res.status(200).json({ data: product });
});
