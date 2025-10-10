const { check } = require("express-validator");

const validatorMiddleware = require("../../../middlewares/validatorMiddleware");
const slugify = require("slugify");

const userModel = require("../../../models/userModel");

exports.signUpValidator = [
  check("firstName")
    .notEmpty()
    .withMessage("First name is required.")
    .isString()
    .withMessage("Frist name must be of type string.")
    .isLength({ min: 3, max: 16 })
    .withMessage("First name should be between 3 and 16 characters."),

  check("lastName")
    .notEmpty()
    .withMessage("Last name is required.")
    .isString()
    .withMessage("Last name must be of type string.")
    .isLength({ min: 2, max: 16 })
    .withMessage("Last name should be between 2 and 16 characters.")
    .custom((_, { req }) => {
      const frisrName = req.body.firstName;
      const lastName = req.body.lastName;
      req.body.slug = slugify(`${frisrName} ${lastName}`);
      return true;
    }),

  check("email")
    .notEmpty()
    .withMessage("Email is required.")
    .isString()
    .withMessage("Email must be of type string.")
    .isEmail()
    .withMessage("Please provide a valid email address.")
    .custom(async (val) => {
      const user = await userModel.findOne({ email: val });
      if (user) {
        throw new Error(`Email ${val} is already in use. Please use another email.`);
      };
      return true;
    }),

  check("password")
    .notEmpty()
    .withMessage("Password is required.")
    .isString()
    .withMessage("Password must be of type string.")
    .isLength({ min: 8 })
    .withMessage("Password should be at least 8 characters long."),

  check("confirmPassword")
    .notEmpty()
    .withMessage("Confirm password is required.")
    .isString()
    .withMessage("Confirm password must be of type string.")
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error("Confirm password does not match password.");
      }
      return true;
    }),

  validatorMiddleware,
];

exports.logInValidator = [
  check("email")
    .notEmpty()
    .withMessage("Email is required.")
    .isString()
    .withMessage("Email must be of type string.")
    .isEmail()
    .withMessage("Please provide a valid email address."),

  check("password")
    .notEmpty()
    .withMessage("Password is required.")
    .isString()
    .withMessage("Password must be of type string."),

  validatorMiddleware,
];

exports.signInValidator = [
  check("email")
    .notEmpty()
    .withMessage("Email is required.")
    .isString()
    .withMessage("Email must be of type string.")
    .isEmail()
    .withMessage("Please provide a valid email address."),

  validatorMiddleware,
];

exports.verifySignInValidator = [
  check("email")
    .notEmpty()
    .withMessage("Email is required.")
    .isString()
    .withMessage("Email must be of type string.")
    .isEmail()
    .withMessage("Please provide a valid email address."),

  check("verificationCode")
    .notEmpty()
    .withMessage("Verification code is required.")
    .isString()
    .withMessage("Verification code must be of type string.")
    .isLength({ min: 4, max: 6 })
    .withMessage("Verification code must be 4–6 digits"),

  validatorMiddleware,
];
