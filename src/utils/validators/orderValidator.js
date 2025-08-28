const { check } = require("express-validator");
const validatorMiddleware = require("../../middlewares/validatorMiddleware");

const isValidPhoneNumber = (phone, { req }) => {
  // Check if phone number exist in customer's phone numbers
  // Because phone numbers that in the customer's phone numbers are valid
  const user = req.user; // Assuming req.user contains the authenticated user
  if (user && user.phoneNumbers) {
    const phoneNumbers = user.phoneNumbers.map((num) => num.phoneNumber);
    if (!phoneNumbers.includes(phone)) {
      throw new Error("Phone is not valid or does not exist in user's phone numbers.");
    }
  }
  return true;
};

exports.getCustomerOrderValidator = [
  check('id')
    .isMongoId()
    .withMessage('Invalid order ID format.'),

  validatorMiddleware,
];

exports.createOrderValidator = [
  check('phone')
    .notEmpty()
    .withMessage('Phone is required.')
    .isString()
    .withMessage('Phone must be of type string.')
    .isLength({ min: 5 })
    .withMessage('Phone number must be at least 5 characters.')
    .isLength({ max: 15 })
    .withMessage('Phone number cannot exceed 15 characters.')
    .custom(isValidPhoneNumber),

  check('country')
    .notEmpty()
    .withMessage('Country is required.')
    .isString()
    .withMessage("Country must be of type string.")
    .isLength({ min: 2 })
    .withMessage('Country name must be at least 2 characters.')
    .isLength({ max: 50 })
    .withMessage('Country name cannot exceed 50 characters.'),
  
  check('state')
    .notEmpty()
    .withMessage('State is required.')
    .isString()
    .withMessage("State must be of type string.")
    .isLength({ min: 2 })
    .withMessage('State name must be at least 2 characters.')
    .isLength({ max: 50 })
    .withMessage('State name cannot exceed 50 characters.'),
  
  check('city')
    .notEmpty()
    .withMessage('City is required.')
    .isString()
    .withMessage("City must be of type string.")
    .isLength({ min: 2 })
    .withMessage('City name must be at least 2 characters.')
    .isLength({ max: 50 })
    .withMessage('City name cannot exceed 50 characters.'),
  
  check('street')
    .notEmpty()
    .withMessage('Street address is required.')
    .isString()
    .withMessage("Street address must be of type string.")
    .isLength({ min: 5 })
    .withMessage('Street address must be at least 5 characters.')
    .isLength({ max: 100 })
    .withMessage('Street address cannot exceed 100 characters.'),
  
  check('postalCode')
    .notEmpty()
    .withMessage('Postal code is required.')
    .isString()
    .withMessage("Postal code must be of type string.")
    .matches(/^\d{4,10}$/)
    .withMessage('Postal code must be between 4 and 10 digits.'),

  validatorMiddleware,
];
