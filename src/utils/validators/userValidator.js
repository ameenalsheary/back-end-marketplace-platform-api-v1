const { check } = require("express-validator");
const validatorMiddleware = require("../../middlewares/validatorMiddleware");
const slugify = require("slugify");

const userModel = require("../../models/userModel");

exports.getUserValidator = [
  check("id")
    .isMongoId()
    .withMessage("Invalid user id format."),

  validatorMiddleware,
];

exports.createUserValidator = [
  check("firstName")
    .notEmpty()
    .withMessage("First name is required.")
    .isString()
    .withMessage("First name must be of type string.")
    .isLength({ min: 3, max: 16 })
    .withMessage("First name should be between 3 and 16 characters"),

  check("lastName")
    .notEmpty()
    .withMessage("Last name is required")
    .isString()
    .withMessage("Last name must be of type string.")
    .isLength({ min: 2, max: 16 })
    .withMessage("Last name should be between 2 and 16 characters")
    .custom((value, { req }) => {
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
        throw new Error("E-mail already in user.");
      }
      return true;
    }),

  check("emailVerification")
    .notEmpty()
    .withMessage("Email verification is required.")
    .isBoolean()
    .withMessage("Email verification must be of type boolean."),

  check("phoneNumber")
    .notEmpty()
    .withMessage("Phone number is required.")
    .isString()
    .withMessage("Phone number must be of type string.")
    .isMobilePhone(["ar-MA"])
    .withMessage("Invalid phone number only accepted Morocco Phone numbers."),

  check("profileImage")
    .custom((_, { req }) => {
      if (!(req.body.profileImage === undefined)) {
        throw new Error('The field you entered for profileImage is not an Image type.');
      };
      return true;
    }),

  check("profileCoverImage")
    .custom((_, { req }) => {
      if (!(req.body.profileCoverImage === undefined)) {
        throw new Error('The field you entered for profileCoverImage is not an Image type.');
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

  check("passwordConfirm")
    .notEmpty()
    .withMessage("Password confirm is required.")
    .isString()
    .withMessage("Password confirm must be of type string.")
    .custom((value, { req }) => {
      if (value !== req.body.password) {
        throw new Error("Password confirm dose not match password.");
      }
      return true;
    }),

  check("role")
    .optional({ checkFalsy: true }) // This field is optional
    .isIn(["user", "manager"])
    .withMessage("Role must be of manager or user."),

  validatorMiddleware,
];

exports.updateUserValidator = [
  check("id")
    .isMongoId()
    .withMessage("Invalid user id format.")
    .custom(async (value, { req }) => {
      const user = await userModel.findById(value);
      if (!user) {
        throw new Error(`No user for this id ${value}.`);
      };
    }),

  check("firstName")
    .optional()
    .isString()
    .withMessage("First name must be of type string.")
    .isLength({ min: 3, max: 16 })
    .withMessage("First name should be between 3 and 16 characters")
    .custom((value, { req }) => {
      const lastName = req.body.lastName;
      if (!lastName) {
        throw new Error("Please write last name");
      }
      return true;
    }),

  check("lastName")
    .optional()
    .isString()
    .withMessage("Last name must be of type string.")
    .isLength({ min: 2, max: 16 })
    .withMessage("Last name should be between 2 and 16 characters.")
    .custom((value, { req }) => {
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

  check("email")
    .optional()
    .isString()
    .withMessage("Email must be of type string.")
    .isEmail()
    .withMessage("Please provide a valid email address.")
    .custom(async (val) => {
      const user = await userModel.findOne({ email: val });
      if (user) {
        throw new Error("E-mail already in user.");
      }
      return true;
    }),

  check("emailVerification")
    .optional()
    .isBoolean()
    .withMessage("Email verification must be of type boolean."),

  check("phoneNumber")
    .optional()
    .isString()
    .withMessage("Phone number must be of type string.")
    .isMobilePhone(["ar-MA"])
    .withMessage("Invalid phone number only accepted Morocco Phone numbers."),

  check("profileImage")
    .custom((_, { req }) => {
      if (!(req.body.profileImage === undefined)) {
        throw new Error('The field you entered for profileImage is not an Image type.');
      };
      return true;
    }),

  check("profileCoverImage")
    .custom((_, { req }) => {
      if (!(req.body.profileCoverImage === undefined)) {
        throw new Error('The field you entered for profileCoverImage is not an Image type.');
      };
      return true;
    }),

  check("role")
    .optional({ checkFalsy: true }) // This field is optional
    .isIn(["user", "manager"])
    .withMessage("Role must be of manager or user."),

  validatorMiddleware,
];

exports.userBlockValidator = [
  check("id")
    .isMongoId()
    .withMessage("Invalid user id format."),

  check("userBlock")
    .notEmpty()
    .withMessage("User block is required.")
    .isBoolean()
    .withMessage("User block must be of type boolean."),

  validatorMiddleware,
];

exports.deleteUserValidator = [
  check("id")
    .isMongoId()
    .withMessage("Invalid user id format"),

  validatorMiddleware,
];