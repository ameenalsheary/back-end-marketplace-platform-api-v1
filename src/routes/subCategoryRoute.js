const express = require('express');

const {
  getSubCategoryValidator,
  getSubCategoriesValidator,
  createSubCategoryValidator,
  updateSubCategoryValidator,
  deleteSubCategoryValidator,
  imageValidator
} = require("../utils/validators/subCategoryValidator");
const {
  getSubCategories,
  getSubCategory,
  setCategoryIdToBody,
  createSubCategory,
  createFilterObj,
  updateSubCategory,
  deleteSubCategory,
  uploadSubCategoryImage,
  resizeImage,
} = require("../services/subCategoryService");
const protect_allowedTo = require("../services/authServises/protect&allowedTo");
const underSubCategoryRoute = require('./underSubCategoryRoute')

const router = express.Router({ mergeParams: true });

router.use(
  "/:subCategoryId/undersubcategories",
  underSubCategoryRoute
);

router
  .route("/")
  .get(
    getSubCategoriesValidator,
    createFilterObj,
    getSubCategories
  ).post(
    protect_allowedTo.protect(),
    protect_allowedTo.allowedTo("admin"),
    uploadSubCategoryImage,
    setCategoryIdToBody,
    createSubCategoryValidator,
    resizeImage,
    imageValidator,
    createSubCategory
  );

router
  .route("/:id")
  .get(
    getSubCategoryValidator,
    getSubCategory
  ).put(
    protect_allowedTo.protect(),
    protect_allowedTo.allowedTo("admin"),
    uploadSubCategoryImage,
    updateSubCategoryValidator,
    resizeImage,
    updateSubCategory
  )
  .delete(
    protect_allowedTo.protect(),
    protect_allowedTo.allowedTo("admin"),
    deleteSubCategoryValidator,
    deleteSubCategory
  );

module.exports = router;
