const { check } = require("express-validator");
const validatorMiddleware = require("../../middlewares/validatorMiddleware");
const slugify = require("slugify");

const userModel = require("../../models/userModel");

const allowedRoles = ["customer"];

exports.getUserValidator = [
  check("id")
    .isMongoId()
    .withMessage("Invalid user ID format."),

  validatorMiddleware,
];

exports.createUserValidator = [
  check("firstName")
    .notEmpty()
    .withMessage("First name is required.")
    .isString()
    .withMessage("First name must be of type string.")
    .isLength({ min: 3 })
    .withMessage("First name must be at least 3 characters.")
    .isLength({ max: 32 })
    .withMessage("First name cannot exceed 32 characters."),

  check("lastName")
    .notEmpty()
    .withMessage("Last name is required.")
    .isString()
    .withMessage("Last name must be of type string.")
    .isLength({ min: 2 })
    .withMessage("Last name must be at least 2 characters.")
    .isLength({ max: 32 })
    .withMessage("Last name cannot exceed 32 characters.")
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
        throw new Error("Email already exists, please provide a different email address.");
      }
      return true;
    }),

  check("emailVerification")
    .notEmpty()
    .withMessage("Email verification is required.")
    .isBoolean()
    .withMessage("Email verification must be of type boolean."),

  check("phoneNumber")
    .optional()
    .isString()
    .withMessage("Phone number must be of type string."),
    // .isMobilePhone(["ar-MA"])
    // .withMessage("Invalid phone number only accepted Morocco Phone numbers."),
    
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

  check("role")
    .optional({ checkFalsy: true }) // This field is optional
    .isIn(["customer"])
    .withMessage(`Invalid role. Allowed roles: ${allowedRoles.join(", ")}.`),

  check("userBlock")
    .optional()
    .isBoolean()
    .withMessage("User block must be of type boolean."),

  validatorMiddleware,
];

exports.updateUserValidator = [
  check("id")
    .isMongoId()
    .withMessage("Invalid user ID format.")
    .custom(async (userId, { req }) => {
      const user = await userModel.findById(userId);
      // Check if user exists
      if (!user) {
        throw new Error(`No user for this ID ${userId}.`);
      }

      // Check if user is admin (admins can't be updated)
      if (user.role === "admin") {
        throw new Error(`This user cannot be updated data because is an admin.`);
      }

      // Prepare URLs of old images to delete (if new ones were provided)
      req.body.urlsOfUserImages = {
        profileImage: user.profileImage,
        profileCoverImage: user.profileCoverImage,
      };

      return true;
    }),

  check("firstName")
    .optional()
    .isString()
    .withMessage("First name must be of type string.")
    .isLength({ min: 3 })
    .withMessage("First name must be at least 3 characters.")
    .isLength({ max: 32 })
    .withMessage("First name cannot exceed 32 characters.")
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
    .isLength({ min: 2 })
    .withMessage("Last name must be at least 2 characters.")
    .isLength({ max: 32 })
    .withMessage("Last name cannot exceed 32 characters.")
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

  check("email")
    .optional()
    .isString()
    .withMessage("Email must be of type string.")
    .isEmail()
    .withMessage("Please provide a valid email address.")
    .custom(async (val) => {
      const user = await userModel.findOne({ email: val });
      if (user) {
        throw new Error("Email already exists, please provide a different email address.");
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
    .withMessage("Phone number must be of type string."),
  // .isMobilePhone(["ar-MA"])
  // .withMessage("Invalid phone number only accepted Morocco Phone numbers."),

  check("role")
    .optional({ checkFalsy: true }) // This field is optional
    .isIn(["customer"])
    .withMessage(`Invalid role. Allowed roles: ${allowedRoles.join(", ")}.`),

  check("userBlock")
    .optional()
    .isBoolean()
    .withMessage("User block must be of type boolean."),

  validatorMiddleware,
];

exports.deleteUserValidator = [
  check("id")
    .isMongoId()
    .withMessage("Invalid user ID format."),

  validatorMiddleware,
];
