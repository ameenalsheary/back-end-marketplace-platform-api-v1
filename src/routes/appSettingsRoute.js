const express = require(`express`);

const {
  createAppSettingsValidator,
  updateAppSettingsValidator,
  deleteAppSettingsValidator
} = require("../utils/validators/appSettingsValidator");
const {
  getAppSettings,
  createAppSettings,
  updateAppSettings,
  deleteAppSettings
} = require(`../services/appSettingsService`);
const protect_allowedTo = require("../services/authServises/protect&allowedTo");

const router = express.Router();

router.use(
  protect_allowedTo.protect(),
  protect_allowedTo.allowedTo("admin"),
);

router.route("/")
  .get(
    getAppSettings
  ).post(
    createAppSettingsValidator,
    createAppSettings
  );

router
  .route("/:id")
  .put(
    updateAppSettingsValidator,
    updateAppSettings
  ).delete(
    deleteAppSettingsValidator,
    deleteAppSettings
  );

module.exports = router;
