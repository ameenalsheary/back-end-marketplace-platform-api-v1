const { PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const s3Client = require('../config/s3Client');
const sharp = require("sharp");
const asyncHandler = require("express-async-handler");
const { v4: uuidv4 } = require("uuid");

const ApiError = require("../utils/apiErrore");
const { createOne } = require("./handlersFactory");
const { uploadMultipleImages } = require("../middlewares/uploadImageMiddleware");
const ApiFeatures = require("../utils/apiFeatures");
const productModel = require("../models/productModel");
const { checkTheToken } = require('./authServises/protect&allowedTo');
const reviewModel = require("../models/reviewModel");
const favoriteModel = require("../models/favoriteModel");

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
exports.resizeProductImages = asyncHandler(async (req, _, next) => {

  // 1 - Image processing for imageCover
  if (req.files?.imageCover) {

    const imageFormat = 'webp';

    const buffer = await sharp(req.files.imageCover[0].buffer)
    .resize(500, 690)
    .toFormat(imageFormat)
    .jpeg({ quality: 65 })
    .toBuffer();

    const imageCoverName = `product-${uuidv4()}-${Date.now()}.${imageFormat}`;

    const params = {
      Bucket: awsBuckName,
      Key: `products/${imageCoverName}`,
      Body: buffer,
      ContentType: `image/${imageFormat}`,
    };

    const command = new PutObjectCommand(params);
    await s3Client.send(command);

    // Save image name to Into Your db
    req.body.imageCover = imageCoverName;

  };

  // 2 - Image processing for images
  if (req.files?.images) {

    req.body.images = [];

    await Promise.all(

      req.files.images.map(async (img, index) => {

        const imageFormat = 'webp';

        const buffer = await sharp(img.buffer)
        .resize(500, 690)
        .toFormat(imageFormat)
        .jpeg({ quality: 65 })
        .toBuffer();

        const imageName = `product-${uuidv4()}-${Date.now()}-${index + 1}.${imageFormat}`;
    
        const params = {
          Bucket: awsBuckName,
          Key: `products/${imageName}`,
          Body: buffer,
          ContentType: `image/${imageFormat}`,
        };
    
        const command = new PutObjectCommand(params);
        await s3Client.send(command);
    
        // Save image name to Into Your db
        req.body.images.push(`${imageName}`);

      })

    );

  };

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

// @desc    Get product by id
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
exports.createProduct = createOne(productModel);

// @desc    Update product by id
// @route   PUT /api/v1/products/:id
// @access  Private
exports.updateProduct = asyncHandler(async (req, res, next) => {

  const { id } = req.params;
  const body = req.body;

  if (body.imageCover || body.images) {

    let product = await productModel.findByIdAndUpdate(
      id,
      body,
    );

    if (!product) {
      return next(new ApiError(`No product for this id ${id}`, 404));
    };

    let allUrlsImages = [];
    if (body.imageCover) {
      allUrlsImages.push(product.imageCover);
    };
    if (body.images) {
      allUrlsImages.push(...product.images);
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

    product = await productModel.find({ _id: id });

    res.status(200).json({ data: product[0] });

  } else {

    const product = await productModel.findByIdAndUpdate(
      id,
      body,
      { new: true }
    );

    if (!product) {
      return next(new ApiError(`No product for this id ${id}`, 404));
    };
  
    res.status(200).json({ data: product });

  };

});

// @desc    Delete Product by id
// @route   DELETE /api/v1/products/:id
// @access  Private
exports.deleteProduct =   asyncHandler(async (req, res, next) => {

  const { id } = req.params;

  const product = await productModel.findByIdAndDelete({ _id: id });
  if (!product) {
    return next(new ApiError(`No product for this id ${id}`, 404));
  };

  let allUrlsImages = [];
  if (product.images) {
    allUrlsImages.push(...product.images);
  };
  if (product.imageCover) {
    allUrlsImages.push(product.imageCover);
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

  await reviewModel.deleteMany({ product: id });
  await favoriteModel.deleteMany({ productId: id });

  res.status(200).json({ data: product });

});
