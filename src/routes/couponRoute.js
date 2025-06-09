const express = require(`express`);

const {
  getCouponValidator,
  createCouponValidator,
  updateCouponValidator,
  deleteCouponValidator
} = require("../utils/validators/couponValidator");
const {
  getCoupons,
  getCoupon,
  createCoupon,
  updateCoupon,
  deleteCoupon,
} = require("../services/couponService");
const protect_allowedTo = require("../services/authServises/protect&allowedTo");

const router = express.Router();

router.use(
  protect_allowedTo.protect(),
  protect_allowedTo.allowedTo("admin"),
);

router
  .route("/")
  .get(
    getCoupons
  ).post(
    createCouponValidator,
    createCoupon
  );

router
  .route("/:id")
  .get(
    getCouponValidator,
    getCoupon
  ).put(
    updateCouponValidator,
    updateCoupon
  ).delete(
    deleteCouponValidator,
    deleteCoupon
  );

module.exports = router;
