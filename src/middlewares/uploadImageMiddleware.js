const multer = require("multer");
const ApiError = require("../utils/apiErrore");

const multerOptions = () => {
  const multeStorage = multer.memoryStorage();
  const multerFilter = (_, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new ApiError("Only image files are allowed.", 400), false);
    }
  };
  const upload = multer({ storage: multeStorage, fileFilter: multerFilter });
  return upload;
}

exports.uploadSingleImage = (fieldName) => 
  multerOptions().single(fieldName);

exports.uploadMultipleImages = (arrayOfFields) =>  
  multerOptions().fields(arrayOfFields);