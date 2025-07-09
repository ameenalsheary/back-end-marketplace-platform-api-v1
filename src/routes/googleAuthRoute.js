const express = require(`express`);
const passport = require("passport");

const {
  googleAuthCallback,
} = require("../services/authServises/googleAuthService");

const router = express.Router();

router.route("/").get(
  passport.authenticate("google", {
    scope: ["profile", "email"],
    session: false,
  })
);

router.route("/callback").get(
  passport.authenticate("google", {
    failureRedirect: `${process.env.FRONT_END_BASE_URL}/auth/log-in`,
    session: false,
  }),
  googleAuthCallback
);

module.exports = router;
