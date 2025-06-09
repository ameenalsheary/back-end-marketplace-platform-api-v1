const { check } = require("express-validator");
const validatorMiddleware = require("../../middlewares/validatorMiddleware");

exports.addProductToCustomerCartValidator = [
  check("productId")
    .notEmpty()
    .withMessage("Product ID is required.")
    .isMongoId()
    .withMessage("Invalid product ID format."),

  check("quantity")
    .notEmpty()
    .withMessage('Product quantity is required.')
    .isNumeric()
    .withMessage("Product quantity must be of type number.")
    .isInt({ min: 1 })
    .withMessage('Product quantity must be at least 1.'),

  check('size')
    .optional()
    .isString()
    .withMessage("Product size must be of type string.")
    .isLength({ min: 1 })
    .withMessage('Product size must be at least 1 character.')
    .isLength({ max: 8 })
    .withMessage('Product size cannot exceed 8 characters.'),

  validatorMiddleware,
];

exports.removeProductFromCustomerCartValidator = [
  check("productId")
    .notEmpty()
    .withMessage("Product ID is required.")
    .isMongoId()
    .withMessage("Invalid product ID format."),

  check('size')
    .optional()
    .isString()
    .withMessage("Product size must be of type string.")
    .isLength({ min: 1 })
    .withMessage('Product size must be at least 1 character.')
    .isLength({ max: 8 })
    .withMessage('Product size cannot exceed 8 characters.'),

  validatorMiddleware,
];

exports.applyCouponToCustomerCartValidator = [
  check("couponCode")
    .notEmpty()
    .withMessage("Coupon code is required.")
    .isString()
    .withMessage("Coupon code must be of type string.")
    .isLength({ min: 3 })
    .withMessage("Coupon code must be at least 3 characters.")
    .isLength({ max: 32 })
    .withMessage("Coupon code cannot exceed 32 characters."),

  validatorMiddleware,
];
