import crypto from 'crypto'
import speakeasy from 'speakeasy'
import QRCode from 'qrcode'

const BACKUP_CODES_COUNT = 8
const BACKUP_CODE_BYTES = 4

export function generateTotpSecret(email, issuer = 'SheetInvoicer') {
  return speakeasy.generateSecret({
    name: `${issuer}:${email}`,
    issuer,
    length: 20,
  })
}

export async function generateQrCodeDataUrl(otpauthUrl) {
  return QRCode.toDataURL(otpauthUrl)
}

export function verifyTotpToken(token, base32Secret) {
  if (!token || !base32Secret) return false
  return speakeasy.totp.verify({
    secret: base32Secret,
    encoding: 'base32',
    token: String(token).replace(/\s+/g, ''),
    window: 1,
  })
}

function hashValue(value) {
  return crypto.createHash('sha256').update(value).digest('hex')
}

export function generateBackupCodes() {
  const codes = Array.from({ length: BACKUP_CODES_COUNT }, () =>
    crypto.randomBytes(BACKUP_CODE_BYTES).toString('hex').toUpperCase()
  )

  return {
    plainCodes: codes,
    hashedCodes: codes.map(hashValue),
  }
}

export function useBackupCode(inputCode, hashedCodes = []) {
  if (!inputCode || !Array.isArray(hashedCodes)) {
    return { valid: false, remainingHashedCodes: hashedCodes }
  }

  const normalized = String(inputCode).replace(/[^A-Za-z0-9]/g, '').toUpperCase()
  const hashedInput = hashValue(normalized)
  const index = hashedCodes.indexOf(hashedInput)

  if (index === -1) {
    return { valid: false, remainingHashedCodes: hashedCodes }
  }

  const remainingHashedCodes = [...hashedCodes]
  remainingHashedCodes.splice(index, 1)

  return { valid: true, remainingHashedCodes }
}

function getRememberSecret() {
  return process.env.TWO_FACTOR_REMEMBER_SECRET || process.env.NEXTAUTH_SECRET || 'dev-remember-secret'
}

export function createRememberDeviceToken(userId, ttlDays = 30) {
  const exp = Date.now() + ttlDays * 24 * 60 * 60 * 1000
  const payload = `${userId}.${exp}`
  const signature = crypto
    .createHmac('sha256', getRememberSecret())
    .update(payload)
    .digest('hex')

  return Buffer.from(`${payload}.${signature}`).toString('base64url')
}

export function verifyRememberDeviceToken(token, userId) {
  if (!token) return false

  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf8')
    const [tokenUserId, expRaw, signature] = decoded.split('.')
    if (!tokenUserId || !expRaw || !signature) return false
    if (tokenUserId !== userId) return false

    const payload = `${tokenUserId}.${expRaw}`
    const expectedSignature = crypto
      .createHmac('sha256', getRememberSecret())
      .update(payload)
      .digest('hex')

    if (signature !== expectedSignature) return false
    if (Number(expRaw) < Date.now()) return false

    return true
  } catch {
    return false
  }
}
