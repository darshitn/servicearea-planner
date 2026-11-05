import { createHash, randomBytes } from 'node:crypto'
import { ObjectId } from 'mongodb'
import { hashPassword, verifyPassword } from './passwords.js'
import { createSession, findSessionUser, deleteSession } from './sessions.js'
import { RequestError } from './work-orders.js'

const hash = value => createHash('sha256').update(value).digest('hex')
const cookieName = 'planner_session'
const cookieOptions = { httpOnly: true, sameSite: 'strict', secure: process.env.NODE_ENV === 'production', path: '/' }
const getToken = req => (req.headers.cookie || '').split(';').map(part => part.trim()).find(part => part.startsWith(cookieName + '='))?.slice(cookieName.length + 1)
const safeUser = user => ({ id: user._id.toHexString(), name: user.name, email: user.email, role: user.role, teamName: user.teamName })
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function invitationToken(value) {
  let token = typeof value === 'string' ? value.trim() : ''
  if (/^https?:\/\//i.test(token) && URL.canParse(token)) {
    const codes = new URL(token).searchParams.getAll('invite')
    token = codes.length === 1 ? codes[0].trim() : ''
  }
  if (!/^[a-f0-9]{64}$/i.test(token)) {
    throw new RequestError(400, 'Enter the full invitation link or the 64-character invitation code.')
  }
  return token.toLowerCase()
}

function credentials(body) {
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = body?.password
  if (!name || name.length > 120 || !emailPattern.test(email) || email.length > 254 ||
      typeof password !== 'string' || password.length < 12 || password.length > 256) {
    throw new RequestError(400, 'Enter a name, valid email, and a password of 12 to 256 characters.')
  }
  return { name, email, password }
}
async function loginSession(db, res, user) {
  const { token, expiresAt } = await createSession(db, user._id)
  res.cookie(cookieName, token, { ...cookieOptions, expires: expiresAt })
  return safeUser(user)
}
export async function initializeAuth(db) {
  await db.collection('users').createIndex({ email: 1 }, { unique: true })
  await db.collection('users').createIndex({ invitationId: 1 }, { unique: true, sparse: true })
  await db.collection('authAttempts').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
  await db.collection('sessions').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
  await db.collection('invitations').createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
}
export function mountAuth(app, db) {
  const users = db.collection('users')
  const invitations = db.collection('invitations')
  async function limitAttempts(req, res, next) {
    const now = Date.now()
    const windowMs = 15 * 60 * 1000
    const window = Math.floor(now / windowMs)
    const expiresAt = new Date((window + 1) * windowMs)
    const key = hash(req.ip + '/' + window)
    const collection = db.collection('authAttempts')
    let entry
    try {
      entry = await collection.findOneAndUpdate(
        { _id: key }, { $inc: { count: 1 }, $setOnInsert: { expiresAt } },
        { upsert: true, returnDocument: 'after' }
      )
    } catch (error) {
      if (error.code !== 11000) throw error
      entry = await collection.findOneAndUpdate({ _id: key }, { $inc: { count: 1 } }, { returnDocument: 'after' })
    }
    if (!entry || entry.count > 30) {
      res.set('Retry-After', String(Math.max(1, Math.ceil((expiresAt.getTime() - now) / 1000))))
      throw new RequestError(429, 'Too many attempts. Try again later.')
    }
    next()
  }
  // Cross-origin form submissions must not be able to mutate a signed-in session.
  app.use('/api', (req, res, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next()
    const origin = req.get('origin')
    if (origin && origin !== process.env.APP_ORIGIN && origin !== req.protocol + '://' + req.get('host')) {
      throw new RequestError(403, 'Request origin is not allowed.')
    }
    next()
  })
  app.post('/api/auth/register', limitAttempts, async (req, res) => {
    const { name, email, password } = credentials(req.body)
    const teamName = typeof req.body.teamName === 'string' ? req.body.teamName.trim() : ''
    if (!teamName || teamName.length > 120) throw new RequestError(400, 'Enter a team name.')
    const user = { _id: new ObjectId(), name, email, passwordHash: await hashPassword(password), teamId: new ObjectId(), teamName, role: 'coordinator' }
    try { await users.insertOne(user) } catch (err) {
      if (err.code === 11000) throw new RequestError(409, 'An account with this email already exists.')
      throw err
    }
    res.status(201).json({ user: await loginSession(db, res, user) })
  })
  app.post('/api/auth/join', limitAttempts, async (req, res) => {
    const { name, email, password } = credentials(req.body)
    const token = invitationToken(req.body.invitation)
    const passwordHash = await hashPassword(password)
    const invitationId = hash(token)
    const invitation = await invitations.findOne({ _id: invitationId, expiresAt: { $gt: new Date() }, used: false })
    if (!invitation) throw new RequestError(400, 'Invitation is invalid, expired, or already used.')
    // Account creation is the atomic invitation claim. A unique index prevents
    // two accounts claiming the same invitation, including after a process crash.
    const user = { _id: new ObjectId(), name, email, passwordHash, invitationId, teamId: invitation.teamId, teamName: invitation.teamName, role: 'technician' }
    try { await users.insertOne(user) } catch (err) {
      if (err.code === 11000) throw new RequestError(409, 'The email is registered or this invitation has already been used.')
      throw err
    }
    res.status(201).json({ user: await loginSession(db, res, user) })
  })
  app.post('/api/auth/login', limitAttempts, async (req, res) => {
    const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : ''
    const user = await users.findOne({ email })
    if (!user || !(await verifyPassword(req.body?.password, user.passwordHash))) throw new RequestError(401, 'Invalid email or password.')
    res.json({ user: await loginSession(db, res, user) })
  })
  app.post('/api/auth/logout', async (req, res) => {
    await deleteSession(db, getToken(req))
    res.clearCookie(cookieName, cookieOptions)
    res.status(204).end()
  })
  app.get('/api/auth/me', async (req, res) => {
    const user = await findSessionUser(db, getToken(req))
    res.json({ user: user ? safeUser(user) : null })
  })
  app.use('/api', async (req, res, next) => {
    const user = await findSessionUser(db, getToken(req))
    if (!user) throw new RequestError(401, 'Sign in to continue.')
    req.user = user
    next()
  })
  app.get('/api/team/members', async (req, res) => {
    const members = await users.find({ teamId: req.user.teamId }).project({ name: 1, role: 1 }).toArray()
    res.json({ members: members.map(member => ({ id: member._id.toHexString(), name: member.name, role: member.role })) })
  })
  app.post('/api/team/invitations', async (req, res) => {
    if (req.user.role !== 'coordinator') throw new RequestError(403, 'Only a coordinator can invite members.')
    const token = randomBytes(32).toString('hex')
    await invitations.insertOne({ _id: hash(token), teamId: req.user.teamId, teamName: req.user.teamName, used: false, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) })
    res.status(201).json({ invitation: token })
  })
}
