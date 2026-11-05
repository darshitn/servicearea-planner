import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback)
const saltBytes = 16
const keyBytes = 64

// Passwords are stored as a versioned salt and derived key, never as plaintext.
export async function hashPassword(password) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 256) {
    throw new Error('Password must be between 12 and 256 characters.')
  }
  const salt = randomBytes(saltBytes)
  const key = await scrypt(password, salt, keyBytes)
  return `scrypt-v1:${salt.toString('hex')}:${key.toString('hex')}`
}

export async function verifyPassword(password, stored) {
  if (typeof password !== 'string' || password.length > 256 || typeof stored !== 'string') return false
  const [version, saltHex, keyHex, extra] = stored.split(':')
  if (version !== 'scrypt-v1' || extra !== undefined ||
      !/^[a-f0-9]{32}$/.test(saltHex || '') || !/^[a-f0-9]{128}$/.test(keyHex || '')) {
    return false
  }
  const expected = Buffer.from(keyHex, 'hex')
  const actual = await scrypt(password, Buffer.from(saltHex, 'hex'), keyBytes)
  return timingSafeEqual(actual, expected)
}
