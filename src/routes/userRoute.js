const express = require(`express`);

const {
  getUserValidator,
  createUserValidator,
  updateUserValidator,
  userBlockValidator,
  deleteUserValidator,
} = require("../utils/validators/userValidator");

const {
  uploadUserImages,
  resizeUserImages,
  getUsers,
  getUser,
  createUser,
  updateUser,
  userBlock,
  deleteUser,
} = require("../services/userService");

const protect_allowedTo = require("../services/authServises/protect&allowedTo");

const router = express.Router();

router.use(
  protect_allowedTo.protect(),
  protect_allowedTo.allowedTo("admin"),
);

router
  .route("/")
  .get(
    getUsers
  ).post(
    uploadUserImages,
    createUserValidator,
    resizeUserImages,
    createUser
  );

router
  .route("/:id")
  .get(
    getUserValidator,
    getUser
  )
  .put(
    uploadUserImages,
    updateUserValidator,
    resizeUserImages,
    updateUser
  )
  .delete(
    deleteUserValidator,
    deleteUser
  );

router.put(
  "/userblock/:id",
  userBlockValidator,
  userBlock,
);

module.exports = router;
