const app = require("./app");

const port = process.env.PORT || 5000;
const baseUrl = process.env.BASE_URL || "http://localhost";

// Start the server
const server = app.listen(port, (_) => {
  console.log(`App is runnig on ${baseUrl}:${port}.`);
});

// handle rejection outside express
process.on("unhandledRejection", (err) => {
  console.error(`UnhandledRejection Erorr: ${err.name} | ${err.message}.`);

  server.close(() => {
    console.log("Shutting down...");
    process.exit(1);
  });
});
