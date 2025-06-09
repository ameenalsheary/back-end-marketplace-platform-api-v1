const categoryRoutes = require(`./categoryRoute`);
const subCategoryRoutes = require("./subCategoryRoute");
const underSubCategoryRoutes = require("./underSubCategoryRoute");
const brandRoutes = require("./brandRoute");
const productRoutes = require("./productRoute");
const productsGroupRoute = require("./productsGroupRoute");
const userRoutes = require("./userRoute");
const couponRoutes = require("./couponRoute");
const appSettingsRoutes = require("./appSettingsRoute");
const authRoutes = require("./authRoute");
const customerRoute = require("./customerRoute");
// const reviewRoutes = require("./reviewRoute");

const mountRoutes = (app) => {
  app.use(`/api/v1/categories`, categoryRoutes);
  app.use(`/api/v1/subcategories`, subCategoryRoutes);
  app.use(`/api/v1/undersubcategories`, underSubCategoryRoutes);
  app.use(`/api/v1/brands`, brandRoutes);
  app.use(`/api/v1/products`, productRoutes);
  app.use(`/api/v1/productsgroups`, productsGroupRoute);
  app.use(`/api/v1/users`, userRoutes);
  app.use(`/api/v1/coupons`, couponRoutes);
  app.use(`/api/v1/appsettings`, appSettingsRoutes);
  app.use(`/api/v1/auth`, authRoutes);
  app.use(`/api/v1/customer`, customerRoute);
  // app.use(`/api/v1/reviews`, reviewRoutes);
};

module.exports = mountRoutes;
