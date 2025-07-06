const { check } = require("express-validator");
const validatorMiddleware = require("../../middlewares/validatorMiddleware");
const slugify = require("slugify");

const userModel = require("../../models/userModel");
const productModel = require("../../models/productModel");
const favoriteModel = require("../../models/favoriteModel");

exports.updateCustomerDetailsValidator = [
  check("firstName")
    .optional()
    .isString()
    .withMessage("First name must be of type string.")
    .isLength({ min: 3, max: 16 })
    .withMessage("First name should be between 3 and 16 characters.")
    .custom((_, { req }) => {
      const lastName = req.body.lastName;
      if (!lastName) {
        throw new Error("Please write last name.");
      }
      return true;
    }),

  check("lastName")
    .optional()
    .isString()
    .withMessage("Last name must be of type string.")
    .isLength({ min: 2, max: 16 })
    .withMessage("Last name should be between 2 and 16 characters.")
    .custom((_, { req }) => {
      const frisrName = req.body.firstName;
      if (!frisrName) {
        throw new Error("Please write frist name.");
      }
      return true;
    })
    .custom((_, { req }) => {
      const frisrName = req.body.firstName;
      const lastName = req.body.lastName;
      req.body.slug = slugify(`${frisrName} ${lastName}`);
      return true;
    }),

  validatorMiddleware,
];

exports.verifyEmailValidator = [
  check("emailVerificationCode")
    .notEmpty()
    .withMessage("Email verification code is required.")
    .isString()
    .withMessage("Email verification code must be of type string."),

  validatorMiddleware,
];

exports.addPhoneNumberValidator = [
  check("idToken")
    .notEmpty()
    .withMessage("ID token is required.")
    .isString()
    .withMessage("ID token must be of type string."),

  validatorMiddleware,
];

exports.deletePhoneNumberValidator = [
  check("phoneNumberId")
    .isMongoId()
    .withMessage(`Invalid phone number ID format.`),

  validatorMiddleware,
];

exports.addProductToCustomerFavoritesValidator = [
  check("productId")
    .isMongoId()
    .withMessage(`Invalid product ID format.`)
    .custom(async (val, { req }) => {
      const product = await productModel.findById(val);
      if (!product) {
        throw new Error(`No product for this ID ${val}.`);
      };
      const wishList = await favoriteModel.findOne({
        userId: req.user._id,
        productId: val,
      });
      if (wishList) {
        throw new Error(`This product is already in favorites.`);
      };
      return true;
    }),
  validatorMiddleware,
];

exports.removeProductFromCustomerFavoritesValidator = [
  check("productId")
    .isMongoId()
    .withMessage(`Invalid product ID format.`),

  validatorMiddleware,
];

exports.addAddressToCustomerAddressesListValidator = [
  check('country')
    .notEmpty()
    .withMessage('Country is required.')
    .isString()
    .withMessage("Country must be of type string.")
    .isLength({ min: 2 })
    .withMessage('Country name must be at least 2 characters.')
    .isLength({ max: 50 })
    .withMessage('Country name cannot exceed 50 characters.'),
  
  check('state')
    .notEmpty()
    .withMessage('State is required.')
    .isString()
    .withMessage("State must be of type string.")
    .isLength({ min: 2 })
    .withMessage('State name must be at least 2 characters.')
    .isLength({ max: 50 })
    .withMessage('State name cannot exceed 50 characters.'),
  
  check('city')
    .notEmpty()
    .withMessage('City is required.')
    .isString()
    .withMessage("City must be of type string.")
    .isLength({ min: 2 })
    .withMessage('City name must be at least 2 characters.')
    .isLength({ max: 50 })
    .withMessage('City name cannot exceed 50 characters.'),
  
  check('street')
    .notEmpty()
    .withMessage('Street address is required.')
    .isString()
    .withMessage("Street address must be of type string.")
    .isLength({ min: 5 })
    .withMessage('Street address must be at least 5 characters.')
    .isLength({ max: 100 })
    .withMessage('Street address cannot exceed 100 characters.'),
  
  check('postalCode')
    .notEmpty()
    .withMessage('Postal code is required.')
    .isString()
    .withMessage("Postal code must be of type string.")
    .matches(/^\d{4,10}$/)
    .withMessage('Postal code must be between 4 and 10 digits.'),

  validatorMiddleware,
];

exports.deleteAddressFromCustomerAddressesListValidator = [
    check("addressId")
    .isMongoId()
    .withMessage("Invalid address ID format."),

  validatorMiddleware,
];

exports.changeCustomerPasswordValidator = [
  check("currentPassword")
    .notEmpty()
    .withMessage("Current password is required.")
    .isString()
    .withMessage("Current password must be of type string."),

  check("newPassword")
    .notEmpty()
    .withMessage("New password is required.")
    .isString()
    .withMessage("New password must be of type string.")
    .isLength({ min: 8 })
    .withMessage("New password should be at least 8 characters long."),

  check("confirmNewPassword")
    .notEmpty()
    .withMessage("Confirm new password is required.")
    .isString()
    .withMessage("Confirm new password must be of type string.")
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error("Confirm new password doesn't match new password.");
      }
      return true;
    }),

  validatorMiddleware,
];

exports.changeCustomerEmailValidator = [
  check("newEmail")
    .notEmpty()
    .withMessage("New email is required.")
    .isString()
    .withMessage("New email must be of type string.")
    .isEmail()
    .withMessage("Please provide a valid new email address.")
    .custom(async (val) => {
      const user = await userModel.findOne({ email: val });
      if (user) {
        throw new Error("Email already exists, please provide a different email address.");
      }
      return true;
    }),

  check("confirmNewEmail")
    .notEmpty()
    .withMessage("Confirm new email is required.")
    .isString()
    .withMessage("Confirm new email must be of type string.")
    .isEmail()
    .withMessage("Please provide a valid confirm new email address.")
    .custom((value, { req }) => {
      if (value !== req.body.newEmail) {
        throw new Error("Confirm new email does not match new email.");
      }
      return true;
    }),

  check("password")
    .notEmpty()
    .withMessage("Password is required.")
    .isString()
    .withMessage("Password must be of type string."),

  validatorMiddleware,
];
