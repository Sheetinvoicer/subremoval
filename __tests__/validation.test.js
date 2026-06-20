// Simple validation tests

// Email validation function
const isValidEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return re.test(email)
}

// Password validation
const isValidPassword = (password) => {
  if (!password) return false
  return password.length >= 6
}

// Amount validation
const isValidAmount = (amount) => {
  if (!amount && amount !== 0) return false
  const num = parseFloat(amount)
  return !isNaN(num) && num > 0 && num <= 10000000
}

describe('Validation', () => {
  describe('isValidEmail', () => {
    it('should accept valid email', () => {
      expect(isValidEmail('test@example.com')).toBe(true)
    })

    it('should reject invalid email', () => {
      expect(isValidEmail('test@')).toBe(false)
      expect(isValidEmail('test')).toBe(false)
      expect(isValidEmail('@example.com')).toBe(false)
    })
  })

  describe('isValidPassword', () => {
    it('should accept password with 6+ chars', () => {
      expect(isValidPassword('123456')).toBe(true)
      expect(isValidPassword('password123')).toBe(true)
    })

    it('should reject password less than 6 chars', () => {
      expect(isValidPassword('12345')).toBe(false)
      expect(isValidPassword('')).toBe(false)
      expect(isValidPassword(null)).toBe(false)
    })
  })

  describe('isValidAmount', () => {
    it('should accept positive numbers', () => {
      expect(isValidAmount('100')).toBe(true)
      expect(isValidAmount('99.99')).toBe(true)
      expect(isValidAmount(100)).toBe(true)
    })

    it('should reject zero or negative', () => {
      expect(isValidAmount('0')).toBe(false)
      expect(isValidAmount('-10')).toBe(false)
    })

    it('should reject non-numbers', () => {
      expect(isValidAmount('abc')).toBe(false)
      expect(isValidAmount('')).toBe(false)
      expect(isValidAmount(null)).toBe(false)
    })
  })
})
