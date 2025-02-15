const express = require(`express`);

const {
  createOrderValidator,
} = require("../utils/validators/orderValidator");

const {
  createCashOrder,
  filterOrders,
  getMyOrders,
  createCheckoutSession
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
    createOrderValidator,
    createCashOrder
  );

router
  .route("/")
  .get(
    filterOrders,
    getMyOrders
  );

router
  .route("/createcheckoutsession")
  .post(
    createOrderValidator,
    createCheckoutSession
  );

module.exports = router;
