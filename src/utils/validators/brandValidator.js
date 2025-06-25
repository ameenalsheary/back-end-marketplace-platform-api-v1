const { check } = require("express-validator");
const validatorMiddleware = require("../../middlewares/validatorMiddleware");
const slugify = require("slugify");

const brandModel = require("../../models/brandModel");

exports.getBrandValidator = [
  check("id")
    .isMongoId()
    .withMessage("Invalid brand ID format."),

  validatorMiddleware,
];

exports.createBrandValidator = [
  check("name")
    .notEmpty()
    .withMessage("Brand name is required.")
    .isString()
    .withMessage("Brand name must be of type string.")
    .isLength({ min: 2 })
    .withMessage("Brand name must be at least 2 characters.")
    .isLength({ max: 32 })
    .withMessage("Brand name cannot exceed 32 characters.")
    .custom(async (value, { req }) => {
      req.body.slug = slugify(value);
      const brand = await brandModel.findOne({ name: value });
      if (brand) {
        throw new Error(`This brand name already used.`);
      };
      return true;
    }),

  validatorMiddleware,
];

exports.updateBrandValidator = [
  check("id")
    .isMongoId()
    .withMessage("Invalid brand ID format.")
    .custom(async (id, { req }) => {
      const brand = await brandModel.findById(id);
      if (!brand) throw new Error(`No brand for this ID ${id}.`);
      // Prepare URL of old image to delete (if new one is provided)
      req.body.urlOfDocImage = brand.image;
      return true;
    }),

  check("name")
    .optional()
    .isString()
    .withMessage("Brand name must be of type string.")
    .isLength({ min: 2 })
    .withMessage("Brand name must be at least 2 characters.")
    .isLength({ max: 32 })
    .withMessage("Brand name cannot exceed 32 characters.")
    .custom(async (value, { req }) => {
      req.body.slug = slugify(value);
      const brand = await brandModel.findOne({ name: value });
      if (brand) {
        throw new Error(`This brand name already used.`);
      };
      return true;
    }),

  validatorMiddleware,
];

exports.deleteBrandValidator = [
  check("id")
    .isMongoId()
    .withMessage("Invalid brand ID format."),

  validatorMiddleware,
];
