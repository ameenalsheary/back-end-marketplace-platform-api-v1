const express = require(`express`);

const {
  getCategoryValidator,
  createCategoryValidator,
  updateCategoryValidator,
  deleteCategoryValidator,
} = require("../utils/validators/categoryValidator");
const {
  getCategories,
  getCategory,
  createCategories,
  updateCategory,
  deleteCategory,
  uploadCategoryImage,
  resizeImage,
} = require(`../services/categoryService`);
const protect_allowedTo = require("../services/authServises/protect&allowedTo");
const subCategoriesRoute = require("./subCategoryRoute");

const router = express.Router();

router.use(
    "/:categoryId/subcategories",
    subCategoriesRoute
  );

router.route("/")
  .get(
    getCategories
  ).post(
    protect_allowedTo.protect(),
    protect_allowedTo.allowedTo("admin"),
    uploadCategoryImage,
    createCategoryValidator,
    resizeImage,
    createCategories
  );

router
  .route("/:id")
  .get(
    getCategoryValidator, 
    getCategory
  ).put(
    protect_allowedTo.protect(),
    protect_allowedTo.allowedTo("admin"),
    uploadCategoryImage,
    updateCategoryValidator,
    resizeImage,
    updateCategory
  ).delete(
    protect_allowedTo.protect(),
    protect_allowedTo.allowedTo("admin"),
    deleteCategoryValidator,
    deleteCategory
  );

module.exports = router;
