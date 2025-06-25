const mongoose = require("mongoose");
const s3Client = require("../config/s3Client");
const sharp = require("sharp");
const { v4: uuidv4 } = require("uuid");
const asyncHandler = require("express-async-handler");
const ApiError = require("../utils/apiErrore");
const ApiFeatures = require("../utils/apiFeatures");
const {
  uploadFileToS3,
  extractFilePathsFromS3Urls,
  deleteS3Objects,
} = require("../utils/s3Utils");

const awsBuckName = process.env.AWS_BUCKET_NAME;

// Export a function that takes image names, width, and height parameters
exports.resizeImage = (names, width, height) =>
  // Return an async middleware function
  asyncHandler(async (req, _, next) => {    
    // Check if no file was uploaded for POST requests
    if (!req.file && req.method === "POST") {
      // Return error if image is missing
      return next(new ApiError(`${names[1][0].toUpperCase()}${names[1].slice(1)} image is required.`, 404));
    }

    // If a file was uploaded
    if (req.file) {
      const imageFormat = "jpeg"; // Set image format to JPEG

      // Process the image using sharp:
      // 1. Resize to specified dimensions
      // 2. Convert to JPEG format
      // 3. Set JPEG quality to 80%
      const buffer = await sharp(req.file.buffer)
        .resize(width, height)
        .toFormat(imageFormat)
        .jpeg({ quality: 80 })
        .toBuffer();

      // Generate unique filename using UUID and timestamp
      const imageName = `${names[1]}-${uuidv4()}-${Date.now()}.${imageFormat}`;

      // Upload the processed image to AWS S3
      await uploadFileToS3({
        awsBuckName: awsBuckName,
        key: `${names[0]}/${imageName}`, // Path where image will be stored
        body: buffer, // Image data
        contentType: `image/${imageFormat}`,
      }, s3Client);

      // Add image name to request body
      req.body.image = imageName;
    } else {
      // If no file, remove any existing image reference
      delete req.body.image;
    }

    // Continue to next middleware
    next();
  });

exports.getAll = (model, modelName) =>
  asyncHandler(async (req, res) => {
    let filter = {};

    if (req.filterObj) {
      filter = req.filterObj;
    }

    // Build query
    const apiFeatures = new ApiFeatures(model.find(filter), req.query)
      .filter()
      .sort()
      .limitFields(modelName)
      .search(modelName);

    // Clone the query before counting documents
    const queryForCount = apiFeatures.mongooseQuery.clone();
    const countDocuments = await queryForCount.countDocuments();

    // Apply pagination after getting the count
    apiFeatures.paginate(countDocuments);

    // Execute the query with pagination
    const { mongooseQuery, paginationResults } = apiFeatures;
    const document = await mongooseQuery;

    res.status(200).json({
      result: document.length,
      paginationResults,
      data: document,
    });
  });

// Export a function that takes a Model and optional population options
exports.getOne = (Model, populationOpt) =>
  asyncHandler(async (req, res, next) => {
    // Extract ID from request parameters
    const { id } = req.params;

    // Start building the query to find document by ID
    let query = Model.findById(id);

    // If population options are provided, populate the specified fields
    if (populationOpt) {
      query = query.populate(populationOpt);
    }

    // Execute the query to get the document
    const document = await query;

    // If no document found, return 404 error
    if (!document) {
      return next(new ApiError(`No document for this ID ${id}.`, 404));
    }

    // If document found, send it in the response
    res.status(200).json({ data: document });
  });

exports.createOne = (model) =>
  asyncHandler(async (req, res) => {
    const document = await model.create(req.body);

    res.status(201).json({
      data: document,
    });
  });

// Export an updateOne function that takes models as parameter
exports.updateOne = (models) =>
  asyncHandler(async (req, res, next) => {
    // Get ID from request params and body/urlOfDocImage from request body
    const { id } = req.params;
    const { body } = req;
    const { urlOfDocImage } = body;

    // Start a MongoDB session and transaction
    const session = await mongoose.startSession();
    session.startTransaction();

    let document;
    try {
      // Find and update the document by ID with the request body
      document = await models.findByIdAndUpdate(
        id, 
        body, 
        { 
          new: true,  // Return the updated document
          session     // Use the current session
        }
      );

      // If no document found, abort transaction and return error
      if (!document) {
        await session.abortTransaction();
        await session.endSession();
        return next(new ApiError(`No document for this ID ${id}.`, 404));
      }

      // If image is being updated, delete old image from S3
      if (body.image) {
        const keys = extractFilePathsFromS3Urls([urlOfDocImage]);
        await deleteS3Objects(keys, awsBuckName, s3Client);
      }

      // Commit the transaction if everything succeeded
      await session.commitTransaction();
    } catch (error) {
      // Abort transaction on error and return error response
      await session.abortTransaction();
      return next(new ApiError("Something went wrong. Please Try again.", 500));
    } finally {
      // Always end the session
      session.endSession();
    }

    // Return success response with updated document
    res.status(200).json({ data: document });
  });

// Export a delete handler function that takes a model and optional hasImage flag
exports.deleteOne = (models, hasImage = false) =>
  asyncHandler(async (req, res, next) => {
    // Get ID from request parameters
    const { id } = req.params;

    // Find and delete the document by ID
    const document = await models.findByIdAndDelete(id);
    
    // If document doesn't exist, return 404 error
    if (!document) {
      return next(new ApiError(`No document for this ID ${id}.`, 404));
    }

    // If document has an associated image and hasImage flag is true
    if (hasImage && document.image) {
      // Extract S3 file path from image URL
      const keys = extractFilePathsFromS3Urls([[document.image]]);
      // Delete the image file from S3
      await deleteS3Objects(keys, awsBuckName, s3Client);
    }

    // Return success response with deleted document
    res.status(200).json({ data: document });
  });
