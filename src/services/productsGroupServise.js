const asyncHandler = require("express-async-handler");

const { 
  getAll,
  getOne
} = require('../services/handlersFactory');
const productsGroupModel = require('../models/productsGroupModel');
const productModel = require('../models/productModel');
const ApiError = require("../utils/apiErrore");

// @desc    Get list of products groups
// @route   GET /api/v1/products-groups
// @access  Private
exports.getProductsGroups = getAll(productsGroupModel);

// @desc    Create products group
// @route   POST /api/v1/products-groups
// @access  Private
exports.creteProductsGroup = asyncHandler(async (req, res) => {
  const groupName = req.body.groupName;
  const productsIDs = req.body.productsIDs;

  const productsGroup = await productsGroupModel.create({
    groupName,
    productsIDs,
  });

  const bulkOption = productsIDs.map((item) => ({
    updateOne: {
      filter: { _id: item },
      update: { $set: { group: productsGroup._id } },
    },
  }));

  await productModel.bulkWrite(bulkOption, {});

  res.status(200).json({ data: productsGroup });
});

// @desc    Get products group by id
// @route   GET /api/v1/products-groups/:id
// @access  Private
exports.getProductsGroup = getOne(productsGroupModel, {
  path: "productsIDs",
  select: "imageCover"
});

// @desc    Update products group name by id
// @route   PUT /api/v1/products-groups/:id
// @access  Private
exports.updateProductsGroupName = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const groupName = req.body.groupName;

  const productsGroup = await productsGroupModel.findByIdAndUpdate(
    id,
    {
      groupName,
    },
    { new: true }
  );

  if (!productsGroup) {
    return next(new ApiError(`No products group for this ID ${id}.`, 404));
  }

  res.status(200).json({ data: productsGroup });
});

// @desc    Delete products group by id
// @route   DELETE /api/v1/products-groups/:id
// @access  Private
exports.deleteProductsGroup = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const productsGroup = await productsGroupModel.findByIdAndDelete(id);
  if (!productsGroup) {
    return next(new ApiError(`No products group for this ID ${id}.`, 404));
  }

  const productsIDs = productsGroup.productsIDs;

  const bulkOption = productsIDs.map((item) => ({
    updateOne: {
      filter: { _id: item },
      update: { $unset: { group: productsGroup._id } },
    },
  }));

  await productModel.bulkWrite(bulkOption, {});

  res.status(200).json({ data: productsGroup });
});

// @desc    Add product to group
// @route   PUT /api/v1/products-groups/add-products-to-group/:id
// @access  Pravite
exports.addProductsToGroup = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const productsIDs = req.body.productsIDs;

  const productsGroup = await productsGroupModel.findByIdAndUpdate(
    id,
    {
      $addToSet: { productsIDs: productsIDs },
    },
    { new: true }
  );

  if (!productsGroup) {
    return next(new ApiError(`No products group for this ID ${id}.`, 404));
  }

  const bulkOption = productsIDs.map((item) => ({
    updateOne: {
      filter: { _id: item },
      update: { $set: { group: productsGroup._id } },
    },
  }));

  await productModel.bulkWrite(bulkOption, {});

  res.status(200).json({ data: productsGroup });
});

// @desc    Remove products from group
// @route   DELETE /api/v1/products-groups/remove-products-from-group/:id
// @access  Private
exports.removeProductsFromGroup = asyncHandler(async (req, res, next) => {
  const { id } = req.params;
  const productsIDs = req.body.productsIDs;

  const productsGroup = await productsGroupModel.findByIdAndUpdate(
    id,
    {
      $pull: { productsIDs: { $in: productsIDs } },
    },
    { new: true }
  );

  if (!productsGroup) {
    return next(new ApiError(`No products group for this ID ${id}.`, 404));
  }

  const bulkOption = productsIDs.map((item) => ({
    updateOne: {
      filter: { _id: item },
      update: { $unset: { group: productsGroup._id } },
    },
  }));

  await productModel.bulkWrite(bulkOption, {});

  res.status(200).json({ data: productsGroup });
});
