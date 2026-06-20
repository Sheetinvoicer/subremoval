import speakeasy from 'speakeasy'
import {
  createRememberDeviceToken,
  generateBackupCodes,
  generateTotpSecret,
  useBackupCode,
  verifyRememberDeviceToken,
  verifyTotpToken,
} from '@/lib/auth/2fa'

describe('2FA utilities', () => {
  it('generates and verifies a valid TOTP token', () => {
    const secret = generateTotpSecret('test@example.com')
    const token = speakeasy.totp({ secret: secret.base32, encoding: 'base32' })

    expect(verifyTotpToken(token, secret.base32)).toBe(true)
    expect(verifyTotpToken('000000', secret.base32)).toBe(false)
  })

  it('generates backup codes and consumes them once', () => {
    const { plainCodes, hashedCodes } = generateBackupCodes()

    expect(plainCodes).toHaveLength(8)
    expect(hashedCodes).toHaveLength(8)

    const first = useBackupCode(plainCodes[0], hashedCodes)
    expect(first.valid).toBe(true)
    expect(first.remainingHashedCodes).toHaveLength(7)

    const reused = useBackupCode(plainCodes[0], first.remainingHashedCodes)
    expect(reused.valid).toBe(false)
    expect(reused.remainingHashedCodes).toHaveLength(7)
  })

  it('creates and validates remember-device token', () => {
    const token = createRememberDeviceToken('user-123', 1)

    expect(verifyRememberDeviceToken(token, 'user-123')).toBe(true)
    expect(verifyRememberDeviceToken(token, 'user-456')).toBe(false)
    expect(verifyRememberDeviceToken('invalid', 'user-123')).toBe(false)
  })
})
