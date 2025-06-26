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

const sizesValidations = (sizes, req) => {
  if (sizes.length === 0) {
    throw new Error(`Size is required.`);
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

  req.body.price = undefined;
  req.body.priceBeforeDiscount = undefined;
  req.body.discountPercent = undefined;
  req.body.quantity = undefined;

  return true;
};

exports.createProductValidator = [

  body()
    .custom((_, { req }) => {
      if (req.body.sizes === undefined && Object.keys(req.body).length !== 0) {

        if (!req.body.price) {
          throw new Error('Product price is required.');
        };

        if (!req.body.quantity) {
          throw new Error('Product quantity is required.');
        };

      }

      return true;
    })
    // Properties that cannot be entered by the user
    .custom((_, { req }) => {
      req.body.group = undefined;
      req.body.size = undefined;
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

  check("price")
    .optional()
    .isNumeric()
    .withMessage("Product price must be of type number.")
    .isFloat({ min: 0, max: 10000 })
    .withMessage("Product price must be between 0 and 10000.")
    .customSanitizer(value => parseFloat(value).toFixed(2)),

  check("priceBeforeDiscount")
    .optional()
    .isNumeric()
    .withMessage("Product price before discount must be of type number.")
    .isFloat({ min: 0, max: 10000 })
    .withMessage('Product price before discount must be between 0 and 10000.')
    .custom((value, { req }) => {
      if (+req.body.price >= +value) {
        throw new Error("Product price before discount must be greater than price.");
      }
      const { priceBeforeDiscount, price } = req.body;
      if (priceBeforeDiscount > price) {
        const discount = (priceBeforeDiscount - price) / priceBeforeDiscount;
        req.body.discountPercent = Math.round(discount * 100);
      }
      return true;
    })
    .customSanitizer(value => parseFloat(value).toFixed(2)),

  check("color")
    .optional()
    .isString()
    .withMessage("Product color name must be of type string.")
    .isLength({ min: 3 })
    .withMessage("Product color name must be at least 3 characters.")
    .isLength({ max: 32 })
    .withMessage("Product color name cannot exceed 32 characters."),

  check("imageCover")
    .custom((_, { req }) => {
      if (!(req.body.imageCover === undefined)) {
        throw new Error('The field you entered for ImageCover is not an Image type.');
      };
      return true;
    }),

  check("images")
    .custom((_, { req }) => {
      if (!(req.body.images === undefined)) {
        throw new Error('The field you entered for Images is not an Image type.');
      };
      return true;
    }),

  check("quantity")
    .optional()
    .isNumeric()
    .withMessage("Product quantity must be of type number.")
    .isInt({ min: 1, max: 1000 })
    .withMessage("Product quantity must be an integer between 1 and 1000."),

  check('sizes')
    .optional()
    .isArray()
    .withMessage("Product sizes must be an array.")
    .custom((sizes, { req }) => sizesValidations(sizes, req)),

  check("category")
    .notEmpty()
    .withMessage("Product category is required.")
    .isMongoId()
    .withMessage("Invalid category id format.")
    .custom(async (_, { req }) => {
      const ObjectId = req.body.category;
      const category = await categoryModel.findById(ObjectId);
      if (category) {
        return true;
      } else {
        throw new Error(`No category for this id ${ObjectId}.`);
      };
    }),

  check("subCategories")
    .notEmpty()
    .withMessage('Sub categories is required.')
    .isArray()
    .withMessage("Product sub categories must be an array.")
    .custom((value) => {
      if (!( Array.isArray(value) && value.every(isValidObjectId) )) {
        if (value.length > 1) {
          throw new Error('Invalid sub categories ids format.');
        } else {
          throw new Error('Invalid sub category id format.')
        };
      };
      return true;
    })
    .custom(async (subCategoriesIds) => {
      if (subCategoriesIds.length > 0) {
        const subCategories = await subCategoryModel.find({
          _id: { $in: subCategoriesIds },
        });
        if (subCategories.length !== subCategoriesIds.length) {
          if (subCategoriesIds.length > 1) {
            throw new Error(`No sub categories for this ids ${subCategoriesIds}.`);
          } else {
            throw new Error(`No sub category for this id ${subCategoriesIds}.`);
          };
        } else {
          return true;
        };
      } else {
        return true;
      };
    })
    .custom(async (subCategoriesIds, { req }) => {
      // step 1
      const subCategories = await subCategoryModel.find({
        category: req.body.category,
      });
      // step 2
      const listSubCategoriesIds = [];
      for (let i = 0; i < subCategories.length; i++) {
        listSubCategoriesIds.push(subCategories[i]._id.toString());
      };
      // step 3
      const check = subCategoriesIds.every((el) => {
        return listSubCategoriesIds.includes(el);
      });
      // step 4
      if (!check) {
        if (subCategoriesIds.length > 1) {
          throw new Error('Sub categories not belong to category.');
        } else {
          throw new Error('Sub category not belong to category.');
        };
      };
      return true;
    }),

  check("underSubCategories")
    .optional()
    .isArray()
    .withMessage("Product under sub categories must be an array.")
    .custom((value) => {
      if (!( Array.isArray(value) && value.every(isValidObjectId) )) {
        if (value.length > 1) {
          throw new Error('Invalid under sub categories ids format.');
        } else {
          throw new Error('Invalid under sub category id format.');
        };
      };
      return true;
    })
    .custom(async (underSubCategoriesIds) => {
      if (underSubCategoriesIds.length > 0) {
        const underSubCategories = await underSubCategoryModel.find({
          _id: { $in: underSubCategoriesIds },
        });
        if (underSubCategories.length !== underSubCategoriesIds.length) {
          if (underSubCategoriesIds.length > 1) {
            throw new Error(`No under sub categories for this ids ${underSubCategoriesIds}.`);
          } else {
            throw new Error(`No under sub category for this id ${underSubCategoriesIds}.`);
          };
        } else {
          return true;
        };
      } else {
        return true;
      };
    })
    .custom(async (underSubCategoriesIds, { req }) => {
      // step 1
      const underSubcategories = await underSubCategoryModel.find({
        subCategory: { $in: req.body.subCategories },
      });
      // step 2
      const listUnderSubCategoriesIds = [];
      for (let i = 0; i < underSubcategories.length; i++) {
        listUnderSubCategoriesIds.push(underSubcategories[i]._id.toString());
      };
      // step 3
      const check = underSubCategoriesIds.every((el) => {
        return listUnderSubCategoriesIds.includes(el);
      });
      // step 4
      if (!check) {
        if (underSubCategoriesIds.length > 1) {
          throw new Error('Under sub categories not belong to sub categories.');
        } else {
          throw new Error('Under sub category not belong to sub categories.');
        };
      };
      return true;
    }),

  check("brand")
    .optional()
    .isMongoId()
    .withMessage("Invalid brand id format.")
    .custom(async (_, { req }) => {
      const ObjectId = req.body.brand;
      const brand = await brandModel.findById(ObjectId);
      if (brand) {
        return true;
      } else {
        throw new Error(`No brand for this id ${ObjectId}.`);
      }
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
    .customSanitizer(value => parseFloat(value).toFixed(2)),

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
    .withMessage("Invalid product id format."),
  validatorMiddleware,
];

exports.updateProductValidator = [

  body()
    // Properties that cannot be entered by the user
    .custom((_, { req }) => {
      req.body.group = undefined;
      req.body.size = undefined;
      return true;
    }),

  check("id")
    .isMongoId()
    .withMessage("Invalid product ID format.")
    .custom(async (id) => {
      const product = await productModel.findById(id);
      if (!product) {
        throw new Error(`No product for this ID ${id}.`);
      };
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

  check("price")
    .optional()
    .isNumeric()
    .withMessage("Product price must be of type number.")
    .isFloat({ min: 0, max: 10000 })
    .withMessage("Product price must be between 0 and 10000.")
    .customSanitizer(value => parseFloat(value).toFixed(2))
    .custom(async (value, { req }) => {
      const product = await productModel.findById(req.params.id);
      if (!product) {
        throw new Error(`No product for this id ${req.params.id}.`);
      };
      if (product.sizes.length > 0) {
        throw new Error(`You can update product price from sizes list.`);
      }
      if (!req.body.priceBeforeDiscount) {
        if (product.priceBeforeDiscount) {
          if (product.priceBeforeDiscount <= +value) {
            await productModel.updateOne(
              { _id: req.params.id },
              { $unset: { priceBeforeDiscount: 1, discountPercent: 1 } }
            );
            req.body.discountPercent = undefined;
          } else {
            const { price } = req.body;
            const { priceBeforeDiscount } = product;
            const discount = (priceBeforeDiscount - price) / priceBeforeDiscount;
            req.body.discountPercent = Math.round(discount * 100);
          }          
        }
      }
    }),

  check("priceBeforeDiscount")
    .optional()
    .isNumeric()
    .withMessage("Product price before discount must be of type number.")
    .isFloat({ min: 0, max: 10000 })
    .withMessage("Product price before discount must be between 0 and 10000.")
    .custom(async (value, { req }) => {
      const product = await productModel.findById(req.params.id);
      if (!product) {
        throw new Error(`No product for this id ${req.params.id}`);
      };
      if (product.sizes.length > 0) {
        throw new Error(`You can update product price before discount from sizes list.`);
      }
      if (req.body.price) {
        if (+req.body.price >= +value) {
          throw new Error("Product price before discount must be greater than price.");
        }
        const { price } = req.body;
        const { priceBeforeDiscount } = req.body;
        const discount = (priceBeforeDiscount - price) / priceBeforeDiscount;
        req.body.discountPercent = Math.round(discount * 100);
      } else {
        if (product.price >= +value) {
          throw new Error("Product price before discount must be greater than price.");
        }
        const { price } = product;
        const { priceBeforeDiscount } = req.body;
        const discount = (priceBeforeDiscount - price) / priceBeforeDiscount;
        req.body.discountPercent = Math.round(discount * 100);
      }
    })
    .customSanitizer(value => parseFloat(value).toFixed(2)),

  check("color")
    .optional()
    .isString()
    .withMessage("Product color name must be of type string.")
    .isLength({ min: 3 })
    .withMessage("Product color name must be at least 3 characters.")
    .isLength({ max: 32 })
    .withMessage("Product color name cannot exceed 32 characters."),

  check("imageCover")
    .custom((_, { req }) => {
      if (!(req.body.imageCover === undefined)) {
        throw new Error('The field you entered for ImageCover is not an Image type.');
      };
      return true;
    }),

  check("images")
    .custom((_, { req }) => {
      if (!(req.body.images === undefined)) {
        throw new Error('The field you entered for Images is not an Image type.');
      };
      return true;
    }),

  check("quantity")
    .optional()
    .custom(async (_, { req }) => {
      const product = await productModel.findById(req.params.id);
      if (!product) {
        throw new Error(`No product for this id ${req.params.id}`);
      };
      if (product.sizes.length > 0) {
        throw new Error(`You can update product quantity from sizes list.`);
      }
    })
    .isNumeric()
    .withMessage("Product quantity must be of type number.")
    .isInt({ min: 1, max: 1000 })
    .withMessage("Product quantity must be an integer between 1 and 1000."),

  check('sizes')
    .optional()
    .custom(async (_, { req }) => {
      const product = await productModel.findById(req.params.id);
      if (!product) {
        throw new Error(`No product for this id ${req.params.id}`);
      };
      if (product.sizes.length === 0) {
        throw new Error(`This product does not contain sizes field.`);
      }
    })
    .isArray()
    .withMessage("Product sizes must be an array.")
    .custom((sizes, { req }) => sizesValidations(sizes, req)),

  check("category")
    .optional()
    .isMongoId()
    .withMessage("Invalid category id format.")
    .custom((_, { req }) => {
      if (!req.body.subCategories) {
        throw new Error(`You must update sub categories.`);
      };
      return true;
    })
    .custom(async (_, { req }) => {
      const { id } = req.params;
      const product = await productModel.findById(id);
      if (product.underSubCategories.length > 0) {
        if (!req.body.underSubCategories) {
          throw new Error(`You must update under sub categories.`);
        };
      };
      return true;
    })
    .custom(async (_, { req }) => {
      const ObjectId = req.body.category;
      const category = await categoryModel.findById(ObjectId);
      if (category) {
        return true;
      } else {
        throw new Error(`No category for this id ${ObjectId}.`);
      }
    }),

  check("subCategories")
    .optional()
    .isArray()
    .withMessage("Product sub categories must be an array.")
    .withMessage("Invalid sub category id format.")
    .custom((_, { req }) => {
      if (!req.body.category) {
        throw new Error(`You must update category.`);
      };
      return true;
    })
    .custom(async (_, { req }) => {
      const { id } = req.params;
      const product = await productModel.findById(id);
      if (product.underSubCategories.length > 0) {
        if (!req.body.underSubCategories) {
          throw new Error(`You must update under sub categories.`);
        };        
      };
      return true;
    })
    .custom((value) => {
      if (!( Array.isArray(value) && value.every(isValidObjectId) )) {
        if (value.length > 1) {
          throw new Error('Invalid sub categories ids format.');
        } else {
          throw new Error('Invalid sub category id format.')
        };
      };
      return true;
    })
    .custom(async (subCategoriesIds) => {
      if (subCategoriesIds.length > 0) {
        const subCategories = await subCategoryModel.find({
          _id: { $in: subCategoriesIds },
        });
        if (subCategories.length !== subCategoriesIds.length) {
          if (subCategoriesIds.length > 1) {
            throw new Error(`No sub categories for this ids ${subCategoriesIds}.`);
          } else {
            throw new Error(`No sub category for this id ${subCategoriesIds}.`);
          };
        } else {
          return true;
        };
      } else {
        return true;
      };
    })
    .custom(async (subCategoriesIds, { req }) => {
      let product;
      if (!req.body.category) {
        product = await productModel.findById(req.params.id);
        if (!product) {
          throw new Error(`No product for this id ${req.params.id}`);
        };
      };
      // step 1
      const subCategories = await subCategoryModel.find({
        category: req.body.category || product.category._id,
      });
      // step 2
      const listSubCategoriesIds = [];
      for (let i = 0; i < subCategories.length; i++) {
        listSubCategoriesIds.push(subCategories[i]._id.toString());
      };
      // step 3
      const check = subCategoriesIds.every((el) => {
        return listSubCategoriesIds.includes(el);
      });
      // step 4
      if (!check) {
        if (subCategoriesIds.length > 1) {
          throw new Error('Sub categories not belong to category.');
        } else {
          throw new Error('Sub category not belong to category.');
        };
      };
      return true;
    }),

  check("underSubCategories")
    .optional()
    .isArray()
    .withMessage("Product under sub categories must be an array.")
    .custom((value) => {
      if (!( Array.isArray(value) && value.every(isValidObjectId) )) {
        if (value.length > 1) {
          throw new Error('Invalid under sub categories ids format.');
        } else {
          throw new Error('Invalid under sub category id format.');
        };
      };
      return true;
    })
    .custom(async (underSubCategoriesIds) => {
      if (underSubCategoriesIds.length > 0) {
        const underSubCategories = await underSubCategoryModel.find({
          _id: { $in: underSubCategoriesIds },
        });
        if (underSubCategories.length !== underSubCategoriesIds.length) {
          if (underSubCategoriesIds.length > 1) {
            throw new Error(`No under sub categories for this ids ${underSubCategoriesIds}.`);
          } else {
            throw new Error(`No under sub category for this id ${underSubCategoriesIds}.`);
          };
        } else {
          return true;
        };
      } else {
        return true;
      };
    })
    .custom(async (underSubCategoriesIds, { req }) => {
      let product;
      if (!req.body.subCategories) {
        product = await productModel.findById(req.params.id);
        if (!product) {
          throw new Error(`No product for this id ${req.params.id}.`);
        }
      };
      // step 1
      const underSubcategories = await underSubCategoryModel.find({
        subCategory: { $in: req.body.subCategories || product.subCategories },
      });
      // step 2
      const listUnderSubCategoriesIds = [];
      for (let i = 0; i < underSubcategories.length; i++) {
        listUnderSubCategoriesIds.push(underSubcategories[i]._id.toString());
      };
      // step 3
      const check = underSubCategoriesIds.every((el) => {
        return listUnderSubCategoriesIds.includes(el);
      });
      // step 4
      if (!check) {
        if (underSubCategoriesIds.length > 1) {
          throw new Error('Under sub categories not belong to sub categories.');
        } else {
          throw new Error('Under sub category not belong to sub categories.');
        };
      };
      return true;
    }),

  check("brand")
    .optional()
    .isMongoId()
    .withMessage("Invalid brand id format.")
    .custom(async (_, { req }) => {
      const ObjectId = req.body.brand;
      const brand = await brandModel.findById(ObjectId);
      if (brand) {
        return true;
      } else {
        throw new Error(`No brand for this id ${ObjectId}.`);
      }
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
    .customSanitizer(value => parseFloat(value).toFixed(2)),

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
    .withMessage("Invalid product id format."),

  validatorMiddleware,
];
