const express = require(`express`);

const {
  getProductsGroupValidator,
  creteProductsGroupValidator,
  updateProductsGroupValidator,
  deleteProductsGroupValidator,
  addProductsToGroupValidator,
  removeProductsFromGroupValidator
} = require('../utils/validators/productsGroupValidator');

const {
  getProductsGroups,
  getProductsGroup,
  creteProductsGroup,
  updateProductsGroup,
  deleteProductsGroup,
  addProductsToGroup,
  removeProductsFromGroup,
} = require('../services/productsGroupServise');
const protect_allowedTo = require("../services/authServises/protect&allowedTo");

const router = express.Router();

router.use(
  protect_allowedTo.protect(),
  protect_allowedTo.allowedTo("admin"),
);

router
  .route("/")
  .get(
    getProductsGroups
  ).post(
    creteProductsGroupValidator,
    creteProductsGroup
  );

router
  .route("/:id")
  .get(
    getProductsGroupValidator,
    getProductsGroup
  ).put(
    updateProductsGroupValidator,
    updateProductsGroup,
  ).delete(
    deleteProductsGroupValidator,
    deleteProductsGroup
  );

router
  .route("/:id/productsids")
  .put(
    addProductsToGroupValidator,
    addProductsToGroup
  ).delete(
    removeProductsFromGroupValidator,
    removeProductsFromGroup
  );

module.exports = router;
