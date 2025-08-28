const express = require(`express`);

const {
  updateCustomerDetailsValidator,
  verifyEmailValidator,
  addPhoneNumberValidator,
  deletePhoneNumberValidator,
  addProductToCustomerFavoritesValidator,
  removeProductFromCustomerFavoritesValidator,
  addAddressToCustomerAddressesListValidator,
  deleteAddressFromCustomerAddressesListValidator,
  changeCustomerPasswordValidator,
  changeCustomerEmailValidator,
} = require("../utils/validators/customerValidator");

const {
  addProductToCustomerCartValidator,
  removeProductFromCustomerCartValidator,
  applyCouponToCustomerCartValidator
} = require("../utils/validators/cartValidator");

const {
  getCustomerOrderValidator,
  createOrderValidator,
} = require("../utils/validators/orderValidator");

const {
  uploadUserImages,
  resizeUserImages,
} = require("../services/userService");

const {
  getCustomerDetails,
  updateCustomerDetails,
  emailVerification,
  verifyEmail,
  getPhoneNumbers,
  addPhoneNumber,
  deletePhoneNumber,
  createFilterObj,
  getCustomerFavorites,
  addProductToCustomerFavorites,
  removeProductFromCustomerFavorites,
  getCustomerAddressesList,
  addAddressToCustomerAddressesList,
  deleteAddressFromCustomerAddressesList,
  changeCustomerPassword,
  changeCustomerEmail,
} = require(`../services/customerService`);

const {
  addProductToCustomerCart,
  getCustomerCart,
  updateProductQuantityInCustomerCart,
  removeProductFromCustomerCart,
  clearCustomerCart,
  applyCouponToCustomerCart
} = require("../services/shoppingCartService");

const {
  filterOrders,
  getCustomerOrders,
  getCustomerOrder,
  customerCreateCashOrder,
  customerCreateStripeCheckoutSession,
} = require("../services/orderServise");

const protect_allowedTo = require("../services/authServises/protect&allowedTo");

const router = express.Router();

// Customer details routes
router
  .route("/")
  .get(
    protect_allowedTo.protect(),
    protect_allowedTo.allowedTo("admin", "customer"),
    getCustomerDetails
  )
  .put(
    protect_allowedTo.protect(),
    protect_allowedTo.allowedTo("admin", "customer"),
    uploadUserImages,
    updateCustomerDetailsValidator,
    resizeUserImages,
    updateCustomerDetails
  );



// Email verification routes
router
  .route("/verify-email")
  .get(
    protect_allowedTo.protect(true),
    protect_allowedTo.allowedTo("admin", "customer"),
    emailVerification
  )
  .post(
    protect_allowedTo.protect(true),
    protect_allowedTo.allowedTo("admin", "customer"),
    verifyEmailValidator,
    verifyEmail
  );



// Customer phone numbers routes
router
  .route("/phone-numbers")
  .get(
    protect_allowedTo.protect(),
    protect_allowedTo.allowedTo("admin", "customer"),
    getPhoneNumbers
  ).post(
    protect_allowedTo.protect(true),
    protect_allowedTo.allowedTo("admin", "customer"),
    addPhoneNumberValidator,
    addPhoneNumber
  );

router.
  route("/phone-numbers/:phoneNumberId")
  .delete(
    protect_allowedTo.protect(true),
    protect_allowedTo.allowedTo("admin", "customer"),
    deletePhoneNumberValidator,
    deletePhoneNumber
  );



// Customer favorites routes
router
  .route("/favorites")
  .get(
    protect_allowedTo.protect(),
    protect_allowedTo.allowedTo("admin", "customer"),
    createFilterObj,
    getCustomerFavorites
  )
  .post(
    protect_allowedTo.protect(),
    protect_allowedTo.allowedTo("admin", "customer"),
    addProductToCustomerFavoritesValidator,
    addProductToCustomerFavorites
  );

router
  .route("/favorites/:productId")
  .delete(
    protect_allowedTo.protect(),
    protect_allowedTo.allowedTo("admin", "customer"),
    removeProductFromCustomerFavoritesValidator,
    removeProductFromCustomerFavorites
  );



// Customer addresses routes
router
  .route("/addresses")
  .get(
    protect_allowedTo.protect(),
    protect_allowedTo.allowedTo("admin", "customer"),
    getCustomerAddressesList
  )
  .post(
    protect_allowedTo.protect(),
    protect_allowedTo.allowedTo("admin", "customer"),
    addAddressToCustomerAddressesListValidator,
    addAddressToCustomerAddressesList
  );

router
  .route("/addresses/:addressId")
  .delete(
    protect_allowedTo.protect(),
    protect_allowedTo.allowedTo("admin", "customer"),
    deleteAddressFromCustomerAddressesListValidator,
    deleteAddressFromCustomerAddressesList
  );



// Shopping cart routes
router
  .route("/shopping-cart")
  .get(
    protect_allowedTo.protect(),
    protect_allowedTo.allowedTo("admin", "customer"),
    getCustomerCart
  ).post(
    protect_allowedTo.protect(),
    protect_allowedTo.allowedTo("admin", "customer"),
    addProductToCustomerCartValidator,
    addProductToCustomerCart
  ).put(
    protect_allowedTo.protect(),
    protect_allowedTo.allowedTo("admin", "customer"),
    addProductToCustomerCartValidator, // Because they have the same validations
    updateProductQuantityInCustomerCart
  ).delete(
    protect_allowedTo.protect(),
    protect_allowedTo.allowedTo("admin", "customer"),
    removeProductFromCustomerCartValidator,
    removeProductFromCustomerCart
  )

router
  .route("/shopping-cart/clear-shopping-cart")
  .delete(
    protect_allowedTo.protect(),
    protect_allowedTo.allowedTo("admin", "customer"),
    clearCustomerCart
  )

router
  .route("/shopping-cart/apply-coupon")
  .put(
    protect_allowedTo.protect(),
    protect_allowedTo.allowedTo("admin", "customer"),
    applyCouponToCustomerCartValidator,
    applyCouponToCustomerCart
  );



  // Orders routes
router
  .route("/orders")
  .get(
    protect_allowedTo.protect(),
    protect_allowedTo.allowedTo("admin", "customer"),
    filterOrders,
    getCustomerOrders
  );

router
  .route("/orders/:id")
  .get(
    protect_allowedTo.protect(),
    protect_allowedTo.allowedTo("admin", "customer"),
    getCustomerOrderValidator,
    getCustomerOrder
  );



router
  .route("/orders/cash-on-delivery")
  .post(
    protect_allowedTo.protect(),
    protect_allowedTo.allowedTo("admin", "customer"),
    createOrderValidator,
    customerCreateCashOrder
  );

router
  .route("/orders/stripe-checkout-session")
  .post(
    protect_allowedTo.protect(),
    protect_allowedTo.allowedTo("admin", "customer"),
    createOrderValidator,
    customerCreateStripeCheckoutSession
  );



// Change password route
router
  .route("/change-password")
  .put(
    protect_allowedTo.protect(),
    protect_allowedTo.allowedTo("admin", "customer"),
    changeCustomerPasswordValidator,
    changeCustomerPassword
  );



// Change email route
router
  .route("/change-email")
  .put(
    protect_allowedTo.protect(true),
    protect_allowedTo.allowedTo("admin", "customer"),
    changeCustomerEmailValidator,
    changeCustomerEmail
  );

module.exports = router;
