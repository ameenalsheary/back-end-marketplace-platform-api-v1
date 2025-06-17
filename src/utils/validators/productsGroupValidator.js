const { check } = require("express-validator");
const validatorMiddleware = require("../../middlewares/validatorMiddleware");
const mongoose = require("mongoose");

const productModel = require("../../models/productModel");

// Custom validation function for MongoDB ObjectID
const isValidObjectId = (value) => {
  return mongoose.Types.ObjectId.isValid(value);
};

exports.creteProductsGroupValidator = [
  check("groupName")
    .notEmpty()
    .withMessage("Group name is required.")
    .isString()
    .withMessage("Group name must be of type string.")
    .isLength({ min: 2 })
    .withMessage("Group name must be at least 2 characters.")
    .isLength({ max: 32 })
    .withMessage("Group name cannot exceed 32 characters."),

  check("productsIDs")
    .notEmpty()
    .withMessage("Products IDs is required.")
    .isArray()
    .withMessage("Products IDs must be an array.")
    .custom(async (IDs) => {
      // Check products IDs format
      if (!IDs.every((ID) => isValidObjectId(ID))) {
        if (IDs.length === 1) {
          throw new Error("Invalid product ID format.");
        } else if (IDs.length > 1) {
          throw new Error("Invalid products IDs format.");
        }
      }

      const products = await productModel.find({ _id: IDs }).lean().select("_id, group");
  
      if (products.length !== IDs.length) {
        if (IDs.length === 1) {
          throw new Error(`No product for this ID ${IDs}.`);
        } else if (IDs.length > 1) {
          throw new Error(`No products for these IDs ${IDs}.`);
        }
      }

      if (products.some((product) => isValidObjectId(product.group))) {
        throw new Error("Product cannot belong to more than one group.");
      }
    }),

  validatorMiddleware,
];

exports.getProductsGroupValidator = [
  check("id")
    .isMongoId()
    .withMessage("Invalid products group ID format."),

  validatorMiddleware,
];

exports.updateProductsGroupNameValidator = [
  check("id")
    .isMongoId()
    .withMessage("Invalid products group ID format."),

  check("groupName")
    .optional()
    .isString()
    .withMessage("Group name must be of type string.")
    .isLength({ min: 2 })
    .withMessage("Group name must be at least 2 characters.")
    .isLength({ max: 32 })
    .withMessage("Group name cannot exceed 32 characters."),

  validatorMiddleware,
];

exports.deleteProductsGroupValidator = [
  check("id")
    .isMongoId()
    .withMessage("Invalid products group ID format."),

  validatorMiddleware,
];

exports.addProductsToGroupValidator = [
  check("id")
    .isMongoId()
    .withMessage("Invalid products group ID format."),

  check("productsIDs")
    .notEmpty()
    .withMessage("Products IDs is required.")
    .isArray()
    .withMessage("Products IDs must be an array.")
    .custom(async (IDs) => {
      // Check products IDs format
      if (!IDs.every((ID) => isValidObjectId(ID))) {
        if (IDs.length === 1) {
          throw new Error("Invalid product ID format.");
        } else if (IDs.length > 1) {
          throw new Error("Invalid products IDs format.");
        }
      }

      const products = await productModel.find({ _id: IDs }).lean().select("_id, group");
  
      if (products.length !== IDs.length) {
        if (IDs.length === 1) {
          throw new Error(`No product for this ID ${IDs}.`);
        } else if (IDs.length > 1) {
          throw new Error(`No products for these IDs ${IDs}.`);
        }
      }

      if (products.some((product) => isValidObjectId(product.group))) {
        throw new Error("Product cannot belong to more than one group.");
      }
    }),

  validatorMiddleware,
];

exports.removeProductsFromGroupValidator = [
  check("id")
    .isMongoId()
    .withMessage("Invalid products group ID format."),

  check("productsIDs")
    .notEmpty()
    .withMessage("Products IDs is required.")
    .isArray()
    .withMessage("Products IDs must be an array.")
    .custom(async (IDs) => {
      // Check products IDs format
      if (!IDs.every((ID) => isValidObjectId(ID))) {
        if (IDs.length === 1) {
          throw new Error("Invalid product ID format.");
        } else if (IDs.length > 1) {
          throw new Error("Invalid products IDs format.");
        }
      }
    }),

  validatorMiddleware,
];
