import { createHash, randomBytes } from 'node:crypto'

const sessionLifetimeMs = 7 * 24 * 60 * 60 * 1000
const digest = token => createHash('sha256').update(token).digest('hex')

// Store only a digest, so a database read alone cannot replay a session cookie.
export async function createSession(db, userId) {
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + sessionLifetimeMs)
  await db.collection('sessions').insertOne({ _id: digest(token), userId, expiresAt })
  return { token, expiresAt }
}

export async function findSessionUser(db, token) {
  if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return null
  const session = await db.collection('sessions').findOne({
    _id: digest(token),
    expiresAt: { $gt: new Date() }
  })
  if (!session) return null
  return db.collection('users').findOne({ _id: session.userId })
}

export async function deleteSession(db, token) {
  if (typeof token === 'string' && /^[a-f0-9]{64}$/.test(token)) {
    await db.collection('sessions').deleteOne({ _id: digest(token) })
  }
}
