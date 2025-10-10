const express = require(`express`);

const {
  signUpValidator,
  logInValidator,
  signInValidator,
  verifySignInValidator
} = require("../utils/validators/authValidators/authValidator");

const {
  forgotPasswordValidator,
  passwordResetCodeValidator,
} = require("../utils/validators/authValidators/forgotPassword");

const {
  signUp,
  logIn,
  signIn,
  verifySignIn,
  logOut
} = require("../services/authServises/authService");

const {
  forgotPassword,
  passwordResetCode,
} = require("../services/authServises/forgotPassword");

const router = express.Router();

router
  .route("/signup")
  .post(
    signUpValidator,
    signUp,
  );

router
  .route("/login")
  .post(
    logInValidator,
    logIn
  );

router
  .route("/signin")
  .post(
    signInValidator,
    signIn
  );

router
  .route("/verifysignin")
  .post(
    verifySignInValidator,
    verifySignIn
  );

router
  .route("/logout")
  .post(
    logOut
  );

router
  .route("/forgotPassword")
  .post(
    forgotPasswordValidator,
    forgotPassword
  );

router
  .route("/passwordResetCode")
  .put(
    passwordResetCodeValidator,
    passwordResetCode
  );

module.exports = router;
