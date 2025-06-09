const express = require("express");

const {
  getReviewsValidator,
  getReviewValidator,
  createReviewValidator,
  updateReviewValidator,
  deleteReviewValidator,
} = require("../utils/validators/reviewValidator");

const {
  createFilterObj,
  getReviews,
  getReview,
  setProductIdAndUserIdToBody,
  createReview,
  updateReview,
  deleteReview,
} = require("../services/reviewService");
const protect_allowedTo = require("../services/authServises/protect&allowedTo");

const router = express.Router( { mergeParams: true } );

router
  .route("/")
  .get(
    getReviewsValidator,
    createFilterObj,
    getReviews
  ).post(
    protect_allowedTo.protect(),
    protect_allowedTo.allowedTo("admin", "customer"),
    setProductIdAndUserIdToBody,
    createReviewValidator,
    createReview
  );

router
  .route("/:id")
  .get(
    getReviewValidator,
    getReview
  )
  .put(
    protect_allowedTo.protect(),
    protect_allowedTo.allowedTo("admin", "customer"),
    updateReviewValidator,
    updateReview
  )
  .delete(
    protect_allowedTo.protect(),
    protect_allowedTo.allowedTo("admin", "customer"),
    deleteReviewValidator,
    deleteReview
  );

module.exports = router;
