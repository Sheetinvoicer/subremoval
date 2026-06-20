/**
 * Email validation utilities for the SheetInvoicer app
 * @module validation
 */

/**
 * Validates an email address format
 * @param {string} email - Email address to validate
 * @returns {boolean} True if email format is valid
 */
export const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Validates phone number (US format)
 * @param {string} phone - Phone number to validate
 * @returns {boolean} True if phone format is valid
 */
export const isValidPhone = (phone) => {
  const phoneRegex = /^[\+]?[(]?[0-9]{3}[)]?[-\s\.]?[0-9]{3}[-\s\.]?[0-9]{4,6}$/
  return phoneRegex.test(phone)
}

/**
 * Validates monetary amount
 * @param {number|string} amount - Amount to validate
 * @returns {boolean} True if amount is valid (1 - 10,000,000)
 */
export const isValidAmount = (amount) => {
  const num = parseFloat(amount)
  return !isNaN(num) && num > 0 && num < 10000000
}

/**
 * Validates invoice number format
 * @param {string} number - Invoice number to validate
 * @returns {boolean} True if format is valid
 */
export const isValidInvoiceNumber = (number) => {
  return /^[A-Za-z0-9\-_]{3,50}$/.test(number)
}

/**
 * Sanitizes input by removing dangerous characters
 * @param {string} input - Input string to sanitize
 * @returns {string} Sanitized string
 */
export const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input
  return input.replace(/[<>]/g, '').trim()
}

/**
 * Validates client data for creation/update
 * @param {Object} data - Client data object
 * @param {string} data.name - Client name
 * @param {string} data.email - Client email
 * @param {string} [data.phone] - Optional phone number
 * @returns {Object} Validation result with errors if any
 */
export const validateClient = (data) => {
  const errors = {}
  
  if (!data.name || data.name.length < 2) {
    errors.name = 'Name must be at least 2 characters'
  }
  
  if (!data.email || !isValidEmail(data.email)) {
    errors.email = 'Valid email is required'
  }
  
  if (data.phone && !isValidPhone(data.phone)) {
    errors.phone = 'Invalid phone number'
  }
  
  return { isValid: Object.keys(errors).length === 0, errors }
}

/**
 * Validates invoice data before creation
 * @param {Object} data - Invoice data
 * @returns {Object} Validation result
 */
export const validateInvoice = (data) => {
  const errors = {}
  
  if (!data.client_id) {
    errors.client_id = 'Client is required'
  }
  
  if (!data.total || !isValidAmount(data.total)) {
    errors.total = 'Valid amount is required (1 - 10,000,000)'
  }
  
  if (data.invoice_number && !isValidInvoiceNumber(data.invoice_number)) {
    errors.invoice_number = 'Invalid invoice number format'
  }
  
  return { isValid: Object.keys(errors).length === 0, errors }
}

/**
 * Validates user signup data
 * @param {Object} data - Signup data
 * @param {string} data.email - User email
 * @param {string} data.password - User password
 * @param {string} data.confirmPassword - Password confirmation
 * @returns {Object} Validation result
 */
export const validateSignup = (data) => {
  const errors = {}
  
  if (!data.email || !isValidEmail(data.email)) {
    errors.email = 'Valid email is required'
  }
  
  if (!data.password || data.password.length < 6) {
    errors.password = 'Password must be at least 6 characters'
  }
  
  if (data.password !== data.confirmPassword) {
    errors.confirmPassword = 'Passwords do not match'
  }
  
  return { isValid: Object.keys(errors).length === 0, errors }
}

/**
 * Validates user login data
 * @param {Object} data - Login data
 * @returns {Object} Validation result
 */
export const validateLogin = (data) => {
  const errors = {}
  
  if (!data.email || !isValidEmail(data.email)) {
    errors.email = 'Valid email is required'
  }
  
  if (!data.password || data.password.length < 1) {
    errors.password = 'Password is required'
  }
  
  return { isValid: Object.keys(errors).length === 0, errors }
}
