const { check } = require("express-validator");
const validatorMiddleware = require("../../middlewares/validatorMiddleware");

exports.createOrderValidator = [
  check('phoneNumber')
    .notEmpty()
    .withMessage('Phone number is required.')
    .isString()
    .withMessage('Phone number must be of type string.')
    .matches(/^\+?\d{8,15}$/) // Allows optional + and 8-15 digits
    .withMessage('Phone number must be between 8 and 15 digits and may include a country code (e.g., +123456789).'),

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
