const express = require(`express`);

const {
  createProductValidator,
  getProductValidator,
  updateProductValidator,
  deleteProductValidator ,
} = require('../utils/validators/productValidator');

const {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  uploadProductImages,
  resizeProductImages,
} = require('../services/productService');
const protect_allowedTo = require("../services/authServises/protect&allowedTo");
const productsRoute = require("./reviewRoute");

const router = express.Router();

// POST   /products/:productId/reviews
// GET    /products/:productId/reviews
// GET    /products/:productId/reviews/reviewId
router.use(
    "/:productId/reviews",
    productsRoute
  );

router
  .route("/")
  .get(
    getProducts
  ).post(
    protect_allowedTo.protect(),
    protect_allowedTo.allowedTo("admin"),
    uploadProductImages,
    createProductValidator,
    resizeProductImages,
    createProduct
  );

router
  .route("/:id")
  .get(
    getProductValidator,
    getProduct
  ).put(
    protect_allowedTo.protect(),
    protect_allowedTo.allowedTo("admin"),
    uploadProductImages,
    updateProductValidator,
    resizeProductImages,
    updateProduct
  )
  .delete(
    protect_allowedTo.protect(),
    protect_allowedTo.allowedTo("admin"),
    deleteProductValidator,
    deleteProduct
  );

module.exports = router;
