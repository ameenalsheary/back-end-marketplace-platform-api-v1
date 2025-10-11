const { check } = require("express-validator");
const validatorMiddleware = require("../../../middlewares/validatorMiddleware");

exports.forgotPasswordValidator = [
  check("email")
    .notEmpty()
    .withMessage("Email is required.")
    .isString()
    .withMessage("Email must be of type string.")
    .isEmail()
    .withMessage("Please provide a valid email address."),

  validatorMiddleware,
];

exports.passwordResetCodeValidator = [
  check("passwordResetCode")
    .notEmpty()
    .withMessage("Password reset code is required.")
    .isString()
    .withMessage("Password reset code must be of type string."),

    check("newPassword")
    .notEmpty()
    .withMessage("New password is required")
    .isString()
    .withMessage("New password must be of type string.")
    .isLength({ min: 8 })
    .withMessage("New password should be at least 8 characters long"),

  check("confirmNewPassword")
    .notEmpty()
    .withMessage("Confirm new password is required.")
    .isString()
    .withMessage("Confirm new password must be of type string.")
    .custom((value, { req }) => {
      if (value !== req.body.newPassword) {
        throw new Error("Confirm new password dose not match new password.");
      }
      return true;
    }),

  validatorMiddleware,
];
