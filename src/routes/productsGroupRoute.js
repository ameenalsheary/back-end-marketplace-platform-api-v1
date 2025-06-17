const express = require(`express`);

const {
  getProductsGroupValidator,
  creteProductsGroupValidator,
  updateProductsGroupNameValidator,
  deleteProductsGroupValidator,
  addProductsToGroupValidator,
  removeProductsFromGroupValidator
} = require('../utils/validators/productsGroupValidator');

const {
  getProductsGroups,
  getProductsGroup,
  creteProductsGroup,
  updateProductsGroupName,
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
    updateProductsGroupNameValidator,
    updateProductsGroupName,
  ).delete(
    deleteProductsGroupValidator,
    deleteProductsGroup
  );

router
  .route("/add-products-to-group/:id")
  .put(
    addProductsToGroupValidator,
    addProductsToGroup
  );

router
  .route("/remove-products-from-group/:id")
  .delete(
    removeProductsFromGroupValidator,
    removeProductsFromGroup
  );

module.exports = router;
