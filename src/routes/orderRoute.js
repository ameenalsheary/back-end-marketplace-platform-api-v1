const express = require(`express`);

const {
  createCashOrderValidator,
} = require("../utils/validators/orderValidator");

const {
  createCashOrder,
  filterOrders,
  getMyOrders,
} = require("../services/orderServise");
const protect_allowedTo = require("../services/authServises/protect&allowedTo");

const router = express.Router();

router.use(
  protect_allowedTo.protect(),
  protect_allowedTo.allowedTo("admin", "manager", "user"),
);

router
  .route("/createcashorder")
  .post(
    createCashOrderValidator,
    createCashOrder
  );

router
  .route("/")
  .get(
    filterOrders,
    getMyOrders
  );

module.exports = router;
