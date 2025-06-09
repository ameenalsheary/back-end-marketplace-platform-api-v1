const express = require(`express`);

const {
  getBrandValidator,
  createBrandValidator,
  updateBrandValidator,
  deleteBrandValidator,
  imageValidator,
} = require("../utils/validators/brandValidator");
const {
  getBrands,
  getBrand,
  createBrand,
  updateBrand,
  deleteBrand,
  uploadBrandImage,
  resizeImage,
} = require("../services/brandService");
const protect_allowedTo = require("../services/authServises/protect&allowedTo");

const router = express.Router();

router
  .route("/")
  .get(
    getBrands
  ).post(
    protect_allowedTo.protect(),
    protect_allowedTo.allowedTo("admin"),
    uploadBrandImage,
    createBrandValidator,    
    resizeImage,
    imageValidator,
    createBrand
  );

router
  .route("/:id")
  .get(
    getBrandValidator,
    getBrand
  ).put(
    protect_allowedTo.protect(),
    protect_allowedTo.allowedTo("admin"),
    uploadBrandImage,
    updateBrandValidator,
    resizeImage,
    updateBrand
  ).delete(
    protect_allowedTo.protect(),
    protect_allowedTo.allowedTo("admin"),
    deleteBrandValidator,
    deleteBrand
  );

module.exports = router;
