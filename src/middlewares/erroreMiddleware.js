const ApiError = require("../utils/apiErrore");

const sendErroreForDev = (err, res) => {
  return res.status(err.statusCode).json({
    status: err.status,
    err: err,
    message: err.message,
    stack: err.stack,
  });
};

const sendErroreForProd = (err, res) => {
  return res.status(err.statusCode).json({
    status: err.status,
    message: err.message,
  });
};

const handleJwtInvalidSignature = () => {
  return new ApiError(`Invalid token. Please log in again.`, 401);
};

const handleJwtExpired = () => {
  return new ApiError(`Expired token. Please log in again.`, 401);
};

const globalErrore = (err, req, res, next) => {
  err.statusCode = err.statusCode || 500;
  err.status = err.status || `error`;
  if (process.env.MODE_ENV === `development`) {
    sendErroreForDev(err, res);
  } else {
    if (err.name === "JsonWebTokenError") {
      err = handleJwtInvalidSignature();
    }
    if (err.name === "TokenExpiredError") {
      err = handleJwtExpired();
    }
    sendErroreForProd(err, res);
  }
};

module.exports = globalErrore;
