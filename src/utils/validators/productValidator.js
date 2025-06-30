const { check, body } = require("express-validator");
const validatorMiddleware = require("../../middlewares/validatorMiddleware");
const slugify = require("slugify");
const mongoose = require('mongoose');

const categoryModel = require(`../../models/categoryModel`);
const subCategoryModel = require("../../models/subCategoryModel");
const underSubCategoryModel = require('../../models/underSubCategoryModel');
const brandModel = require("../../models/brandModel");
const productModel = require("../../models/productModel");

// Custom validation function for MongoDB ObjectID
const isValidObjectId = value => mongoose.Types.ObjectId.isValid(value);

const sizesValidations = (sizes) => {
  if (sizes.length === 0) {
    throw new Error("Product sizes cannot be an empty array.");
  };

  for (let i = 0; i < sizes.length; i++) {

    // Validate type itemes
    if ( !(typeof sizes[i] === 'object') || Array.isArray(sizes[i])) {
      throw new Error(`Sizes items must be of type object.`);
    };

    // Validate size
    if (sizes[i].size === undefined) {

      throw new Error(`Product size (index ${i}) is required.`);

    } else if (!( typeof sizes[i].size === 'string' )) {

      throw new Error(`Product size (index ${i}) must be of type string.`);

    } else if (sizes[i].size.length < 1) {

      throw new Error(`Product size (index ${i}) must be at least 1 characters.`);

    } else if (sizes[i].size.length > 8) {

      throw new Error(`Product size (index ${i}) cannot exceed 8 characters.`);

    };

    // Validate quantity
    if (sizes[i].quantity === undefined) {

      throw new Error(`Product quantity (index ${i}) is required.`);

    } else if (isNaN(sizes[i].quantity)) {

      throw new Error(`Product quantity (index ${i}) must be of type number.`);

    } else if (!Number.isInteger(+sizes[i].quantity)) {

      throw new Error(`Product quantity (index ${i}) must be of type integer.`);

    } else if (sizes[i].quantity < 1) {

      throw new Error(`Product quantity (index ${i}) must be between 1 and 1000.`);

    } else if (sizes[i].quantity > 1000) {

      throw new Error(`Product quantity (index ${i}) must be between 1 and 1000.`);

    };

    // Validate price
    if (sizes[i].price === undefined) {

      throw new Error(`Product price (index ${i}) is required.`);

    } else if (isNaN(sizes[i].price)) {

      throw new Error(`Product price (index ${i}) must be of type number.`);

    } else if (sizes[i].price < 0) {

      throw new Error(`Product price (index ${i}) must be between 0 and 10000.`);

    } else if (sizes[i].price > 10000) {

      throw new Error(`Product price (index ${i}) must be between 0 and 10000.`);

    } else {

      sizes[i].price = parseFloat(sizes[i].price).toFixed(2);

    };

    // Validate price before discount
    if (!(sizes[i].priceBeforeDiscount === undefined)) {

      if (isNaN(sizes[i].priceBeforeDiscount)) {

        throw new Error(`Product price before discount (index ${i}) must be of type number.`);

      } else if (sizes[i].priceBeforeDiscount < 0) {

        throw new Error(`Product price before discount (index ${i}) must 0 and 10000.`);

      } else if (sizes[i].priceBeforeDiscount > 10000) {

        throw new Error(`Product price before discount (index ${i}) must 0 and 10000.`);

      } else if (sizes[i].price >= +sizes[i].priceBeforeDiscount) {

        throw new Error(`Product price before discount (index ${i}) must be greater than price.`);

      } else {

        sizes[i].priceBeforeDiscount = parseFloat(sizes[i].priceBeforeDiscount).toFixed(2);

      };

    };

  };

  // Check if duplicate size
  const uniqueSizes = new Set(sizes.map((size) => `${size.size}`.toUpperCase()));
  const uniqueSizeCount = uniqueSizes.size;
  if (uniqueSizeCount !== sizes.length) {
    throw new Error('There are duplicate sizes.');
  }

  // Calculate discount percent.
  sizes = sizes.map((item) => {
    const price = +item.price;
    const priceBeforeDiscount = +item.priceBeforeDiscount;
    if (price < priceBeforeDiscount) {
      const discount = (priceBeforeDiscount - price) / priceBeforeDiscount;
      item.discountPercent = Math.round(discount * 100);
    }
    return item;
  })

  return true;
};

exports.createProductValidator = [
  body().custom((_, { req }) => {
    if (!req.body.sizes && Object.keys(req.body).length !== 0) {
      if (!req.body.price) {
        throw new Error("Product price is required when sizes are not provided.");
      }
      if (!req.body.quantity) {
        throw new Error("Product puantity is required when sizes are not provided.");
      }
    }
    return true;
  }),

  check("title")
    .notEmpty()
    .withMessage("Product title is required.")
    .isString()
    .withMessage("Product title must be of type string.")
    .isLength({ min: 3 })
    .withMessage("Product title must be at least 3 characters.")
    .isLength({ max: 200 })
    .withMessage("Product title cannot exceed 200 characters.")
    .custom((value, { req }) => {
      req.body.slug = `${slugify(value)}`.toLowerCase();
      return true;
    }),

  check("description")
    .notEmpty()
    .withMessage("Product description is required.")
    .isString()
    .withMessage("Product description must be of type string.")
    .isLength({ min: 32 })
    .withMessage("Product description must be at least 32 characters.")
    .isLength({ max: 1000 })
    .withMessage("Product description cannot exceed 1000 characters."),

  check("color")
    .optional()
    .isString()
    .withMessage("Product color name must be of type string.")
    .isLength({ min: 3 })
    .withMessage("Product color name must be at least 3 characters.")
    .isLength({ max: 32 })
    .withMessage("Product color name cannot exceed 32 characters."),

  check("quantity")
    .optional()
    .isNumeric()
    .withMessage("Product quantity must be of type number.")
    .isInt({ min: 1, max: 1000 })
    .withMessage("Product quantity must be an integer between 1 and 1000."),

  check("price")
    .optional()
    .isNumeric()
    .withMessage("Product price must be of type number.")
    .isFloat({ min: 0, max: 10000 })
    .withMessage("Product price must be between 0 and 10000.")
    .customSanitizer((value) => parseFloat(value).toFixed(2)),

  check("priceBeforeDiscount")
    .optional()
    .isNumeric()
    .withMessage("Product price before discount must be of type number.")
    .isFloat({ min: 0, max: 10000 })
    .withMessage("Product price before discount must be between 0 and 10000.")
    .customSanitizer((value) => parseFloat(value).toFixed(2))
    .custom((value, { req }) => {
      if (+req.body.price >= +value) {
        throw new Error("Product price before discount must be greater than price.");
      }
      return true;
    }),

  check("sizes")
    .optional()
    .isArray()
    .withMessage("Product sizes must be an array.")
    .custom((sizes) => sizesValidations(sizes)),

  check("category")
    .notEmpty()
    .withMessage("Product category is required.")
    .isMongoId()
    .withMessage("Invalid category ID format.")
    .custom(async (_, { req }) => {
      const ObjectId = req.body.category;
      const category = await categoryModel.findById(ObjectId);
      if (category) {
        return true;
      } else {
        throw new Error(`No category for this ID: ${ObjectId}.`);
      }
    }),

  check("subCategories")
    .notEmpty()
    .withMessage("Product sub categories is required.")
    .isArray()
    .withMessage("Product sub categories must be an array.")
    .custom(async (IDs, { req }) => {
      // Check if sub categories array is empty
      if (IDs.length === 0) {
        throw new Error("Product sub categories cannot be an empty array.");
      }

      // Check if all iDs are valid MongoDB ObjectIds
      const allValid = IDs.every(isValidObjectId);
      if (!allValid) {
        throw new Error(
          IDs.length > 1 
            ? "Invalid sub categories IDs format."
            : "Invalid sub category ID format."
        );
      }

      // Check if all IDs exist in the database
      const existingCount = await subCategoryModel.countDocuments({ _id: { $in: IDs } });
      if (existingCount !== IDs.length) {
        throw new Error(
          IDs.length > 1
            ? `No sub categories for these IDs: ${IDs}.`
            : `No sub category for this ID: ${IDs}.`
        );
      }

      // Check if subcategories belong to the provided category
      const categoryId = req.body.category;
      const subCategories = await subCategoryModel.find({ category: categoryId }).select('_id');
      const listSubCategoriesIDs = subCategories.map(doc => doc._id.toString());
      const allBelong = IDs.every(id => listSubCategoriesIDs.includes(id));
      if (!allBelong) {
        throw new Error(
          IDs.length > 1
            ? "Sub categories do not belong to the specified category."
            : "Sub category does not belong to the specified category."
        );
      }

      return true;
    }),

  check("underSubCategories")
    .optional()
    .isArray()
    .withMessage("Product under sub categories must be an array.")
    .custom(async (IDs, { req }) => {
      if (IDs?.length > 0) {
        // Check if all IDs are valid MongoDB ObjectIds
        const allValid = IDs.every(isValidObjectId);
        if (!allValid) {
          throw new Error(
            IDs.length > 1
              ? "Invalid under sub categories IDs format."
              : "Invalid under sub category ID format."
          );
        }

        // Check if all IDs exist in the database
        const existingCount = await underSubCategoryModel.countDocuments({ _id: { $in: IDs } });
        if (existingCount !== IDs.length) {
          throw new Error(
            IDs.length > 1
              ? `No under sub categories for these IDs: ${IDs}.`
              : `No under sub category for this ID: ${IDs}.`
          );
        }

        // Check if under sub categories belong to the provided sub categories
        const subCategoriesIDs = req.body.subCategories;   
        const underSubCategories = await underSubCategoryModel.find({ subCategory: { $in: subCategoriesIDs } }).select("_id");
        const listUnderSubCategoriesIDs = underSubCategories.map(doc => doc._id.toString());
        const allBelong = IDs.every(id => listUnderSubCategoriesIDs.includes(id));
        if (!allBelong) {
          throw new Error(
            IDs.length > 1
              ? `Under sub categories do not belong to the specified sub ${subCategoriesIDs.length > 1 ? "categories" : "category"}.`
              : `Under sub category does not belong to the specified sub ${subCategoriesIDs.length > 1 ? "categories" : "category"}.`
          );
        }
      }
      return true;
    }),

  check("brand")
    .optional()
    .isMongoId()
    .withMessage("Invalid brand ID format.")
    .custom(async (brandId) => {
      const brand = await brandModel.findById(brandId);
      if (!brand) {
        throw new Error(`No brand for this ID: ${brandId}.`);
      }
      return true;
    }),

  check("sold")
    .optional()
    .isNumeric()
    .withMessage("Product sold must be of type number.")
    .isInt({ min: 0, max: 1000 })
    .withMessage("Product sold must be an integer between 0 and 1000."),

  check("ratingsAverage")
    .optional()
    .isNumeric()
    .withMessage("Product ratings average must be of type number.")
    .isFloat({ min: 1, max: 5 })
    .withMessage("Product ratings average must be between 1 and 5.")
    .customSanitizer((value) => parseFloat(value).toFixed(2)),

  check("ratingsQuantity")
    .optional()
    .isNumeric()
    .withMessage("Product ratings quantity must be of type number.")
    .isInt({ min: 0 })
    .withMessage("Product ratings quantity must be an integer 0 or greater."),

  validatorMiddleware,
];

exports.getProductValidator = [
  check("id")
    .isMongoId()
    .withMessage("Invalid product ID format."),
  validatorMiddleware,
];

exports.updateProductValidator = [
  check("id")
    .isMongoId()
    .withMessage("Invalid product ID format.")
    .custom(async (productId, { req }) => {
      const product = await productModel.findById(productId);
      if (!product) {
        throw new Error(`No product for this ID: ${productId}.`);
      };

      const productSizes = product.sizes;
      if (Array.isArray(productSizes) && productSizes.length > 0) {
        delete req.body.size;
        delete req.body.quantity;
        delete req.body.price;
        delete req.body.priceBeforeDiscount;
        delete req.body.group;
      } else {
        delete req.body.sizes;
      }

      const productPrice = req.body.price;
      const productPriceBeforeDiscount = req.body.priceBeforeDiscount;
      if (productPrice && !productPriceBeforeDiscount) {
        req.body.priceBeforeDiscount = product.priceBeforeDiscount;
      } else if (!productPrice && productPriceBeforeDiscount) {
        req.body.price = product.price;
      }

      if (req.body.price && req.body.priceBeforeDiscount) {
        req.body.discountPercent = Math.round((req.body.priceBeforeDiscount - req.body.price) / req.body.priceBeforeDiscount * 100);
      }
      
      if (req.body.category || req.body.subCategories || req.body.underSubCategories) {
        if (!req.body.category) req.body.category = `${product.category._id}`.toString();        
        if (!req.body.subCategories) req.body.subCategories = product.subCategories.map(subCategory => `${subCategory}`.toString());
        if (!req.body.underSubCategories) req.body.underSubCategories = [];
      }

      // Prepare URLs of old images to delete (if new ones were provided)
      req.body.urlsOfProductImages = {
        imageCover: product.imageCover,
        images: product.images || [],
      };

      return true;
    }),

  check("title")
    .optional()
    .isString()
    .withMessage("Product title must be of type string.")
    .isLength({ min: 3 })
    .withMessage("Product title must be at least 3 characters.")
    .isLength({ max: 200 })
    .withMessage("Product title cannot exceed 200 characters.")
    .custom((value, { req }) => {
      req.body.slug = `${slugify(value)}`.toLowerCase();
      return true;
    }),

  check("description")
    .optional()
    .isString()
    .withMessage("Product description must be of type string.")
    .isLength({ min: 32 })
    .withMessage("Product description must be at least 32 characters.")
    .isLength({ max: 1000 })
    .withMessage("Product description cannot exceed 1000 characters."),

  check("color")
    .optional()
    .isString()
    .withMessage("Product color name must be of type string.")
    .isLength({ min: 3 })
    .withMessage("Product color name must be at least 3 characters.")
    .isLength({ max: 32 })
    .withMessage("Product color name cannot exceed 32 characters."),

  check("quantity")
    .optional()
    .isNumeric()
    .withMessage("Product quantity must be of type number.")
    .isInt({ min: 1, max: 1000 })
    .withMessage("Product quantity must be an integer between 1 and 1000."),

  check("price")
    .optional()
    .isNumeric()
    .withMessage("Product price must be of type number.")
    .isFloat({ min: 0, max: 10000 })
    .withMessage("Product price must be between 0 and 10000.")
    .customSanitizer((value) => parseFloat(value).toFixed(2)),

  check("priceBeforeDiscount")
    .optional()
    .isNumeric()
    .withMessage("Product price before discount must be of type number.")
    .isFloat({ min: 0, max: 10000 })
    .withMessage("Product price before discount must be between 0 and 10000.")
    .customSanitizer((value) => parseFloat(value).toFixed(2))
    .custom((value, { req }) => {
      if (+req.body.price >= +value) {
        throw new Error("Product price before discount must be greater than price.");
      }
      return true;
    }),

  check("sizes")
    .optional()
    .isArray()
    .withMessage("Product sizes must be an array.")
    .custom((sizes) => sizesValidations(sizes)),

  check("category")
    .optional()
    .isMongoId()
    .withMessage("Invalid category ID format.")
    .custom(async (_, { req }) => {
      const ObjectId = req.body.category;
      const category = await categoryModel.findById(ObjectId);
      if (category) {
        return true;
      } else {
        throw new Error(`No category for this ID: ${ObjectId}.`);
      }
    }),

  check("subCategories")
    .optional()
    .isArray()
    .withMessage("Product sub categories must be an array.")
    .custom(async (IDs, { req }) => {
      // Check if sub categories array is empty
      if (IDs.length === 0) {
        throw new Error("Product sub categories cannot be an empty array.");
      }

      // Check if all iDs are valid MongoDB ObjectIds
      const allValid = IDs.every(isValidObjectId);
      if (!allValid) {
        throw new Error(
          IDs.length > 1 
            ? "Invalid sub categories IDs format."
            : "Invalid sub category ID format."
        );
      }

      // Check if all IDs exist in the database
      const existingCount = await subCategoryModel.countDocuments({ _id: { $in: IDs } });
      if (existingCount !== IDs.length) {
        throw new Error(
          IDs.length > 1
            ? `No sub categories for these IDs: ${IDs}.`
            : `No sub category for this ID: ${IDs}.`
        );
      }

      // Check if subcategories belong to the provided category
      const categoryId = req.body.category;
      const subCategories = await subCategoryModel.find({ category: categoryId }).select('_id');
      const listSubCategoriesIDs = subCategories.map(doc => doc._id.toString());
      const allBelong = IDs.every(id => listSubCategoriesIDs.includes(id));
      if (!allBelong) {
        throw new Error(
          IDs.length > 1
            ? "Sub categories do not belong to the specified category."
            : "Sub category does not belong to the specified category."
        );
      }

      return true;
    }),

  check("underSubCategories")
    .optional()
    .isArray()
    .withMessage("Product under sub categories must be an array.")
    .custom(async (IDs, { req }) => {
      if (IDs?.length > 0) {
        // Check if all IDs are valid MongoDB ObjectIds
        const allValid = IDs.every(isValidObjectId);
        if (!allValid) {
          throw new Error(
            IDs.length > 1
              ? "Invalid under sub categories IDs format."
              : "Invalid under sub category ID format."
          );
        }

        // Check if all IDs exist in the database
        const existingCount = await underSubCategoryModel.countDocuments({ _id: { $in: IDs } });
        if (existingCount !== IDs.length) {
          throw new Error(
            IDs.length > 1
              ? `No under sub categories for these IDs: ${IDs}.`
              : `No under sub category for this ID: ${IDs}.`
          );
        }

        // Check if under sub categories belong to the provided sub categories
        const subCategoriesIDs = req.body.subCategories;   
        const underSubCategories = await underSubCategoryModel.find({ subCategory: { $in: subCategoriesIDs } }).select("_id");
        const listUnderSubCategoriesIDs = underSubCategories.map(doc => doc._id.toString());
        const allBelong = IDs.every(id => listUnderSubCategoriesIDs.includes(id));
        if (!allBelong) {
          throw new Error(
            IDs.length > 1
              ? `Under sub categories do not belong to the specified sub ${subCategoriesIDs.length > 1 ? "categories" : "category"}.`
              : `Under sub category does not belong to the specified sub ${subCategoriesIDs.length > 1 ? "categories" : "category"}.`
          );
        }
      }
      return true;
    }),

  check("brand")
    .optional()
    .isMongoId()
    .withMessage("Invalid brand ID format.")
    .custom(async (brandId) => {
      const brand = await brandModel.findById(brandId);
      if (!brand) {
        throw new Error(`No brand for this ID: ${brandId}.`);
      }
      return true;
    }),

  check("sold")
    .optional()
    .isNumeric()
    .withMessage("Product sold must be of type number.")
    .isInt({ min: 0, max: 1000 })
    .withMessage("Product sold must be an integer between 0 and 1000."),

  check("ratingsAverage")
    .optional()
    .isNumeric()
    .withMessage("Product ratings average must be of type number.")
    .isFloat({ min: 1, max: 5 })
    .withMessage("Product ratings average must be between 1 and 5.")
    .customSanitizer((value) => parseFloat(value).toFixed(2)),

  check("ratingsQuantity")
    .optional()
    .isNumeric()
    .withMessage("Product ratings quantity must be of type number.")
    .isInt({ min: 0 })
    .withMessage("Product ratings quantity must be an integer 0 or greater."),

  validatorMiddleware,
];

exports.deleteProductValidator = [
  check("id")
    .isMongoId()
    .withMessage("Invalid product ID format."),

  validatorMiddleware,
];
