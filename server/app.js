import express from 'express'
import { MongoNetworkError, MongoServerSelectionError, ObjectId } from 'mongodb'
import { fileURLToPath } from 'node:url'
import { RequestError, serializeOrder, validDate, validateOrder } from './work-orders.js'
import { mountAuth } from './auth.js'
import { requireCoordinator, requireAssignment } from './authorization.js'

const distPath = fileURLToPath(new URL('../dist/', import.meta.url))

function orderId(text) {
  if (!/^[a-f\d]{24}$/i.test(text)) throw new RequestError(400, 'Invalid work-order ID.')
  return new ObjectId(text)
}

export function createApp(db) {
  const app = express()
  const proxy = process.env.TRUST_PROXY
  if (proxy) {
    if (/^[1-9]\d?$/.test(proxy)) app.set('trust proxy', Number(proxy))
    else if (proxy === 'true' || proxy === 'false') throw new Error('Use a verified proxy hop count or trusted IP ranges for TRUST_PROXY.')
    else app.set('trust proxy', proxy.split(',').map(value => value.trim()))
  }
  const orders = db.collection('workOrders')
  app.disable('x-powered-by')
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store')
    next()
  })
  app.use('/api', express.json({ limit: '32kb' }))

  app.get('/api/health', async (req, res) => {
    await db.command({ ping: 1 })
    res.json({ status: 'ok' })
  })
  mountAuth(app, db)

  app.get('/api/work-orders', async (req, res) => {
    const { date } = req.query
    if (!validDate(date)) throw new RequestError(400, 'Provide a valid date in YYYY-MM-DD format.')
    const documents = await orders.find({ date, teamId: req.user.teamId }).sort({ area: 1, startTime: 1, _id: 1 }).toArray()
    res.json({ orders: documents.map(doc => ({ ...serializeOrder(doc), assignedUserId: doc.assignedUserId.toHexString() })) })
  })

  app.post('/api/work-orders', async (req, res) => {
    requireCoordinator(req.user)
    const { assignedUserId, ...fields } = req.body || {}
    if ('staff' in fields) delete fields.staff
    const assignee = await db.collection('users').findOne({ _id: orderId(assignedUserId || ''), teamId: req.user.teamId })
    if (!assignee) throw new RequestError(400, 'Select a team member.')
    const order = validateOrder({ ...fields, staff: assignee.name })
    const document = { ...order, assignedUserId: assignee._id, teamId: req.user.teamId, revision: 1 }
    const { insertedId } = await orders.insertOne(document)
    res.status(201).json({ order: { ...serializeOrder({ ...document, _id: insertedId }), assignedUserId } })
  })

  app.patch('/api/work-orders/:id', async (req, res) => {
    const _id = orderId(req.params.id)
    const previous = await orders.findOne({ _id, teamId: req.user.teamId })
    if (!previous) throw new RequestError(404, 'Work order was not found.')
    requireAssignment(req.user, previous)
    const { assignedUserId, ...fields } = req.body || {}
    if ('staff' in fields) throw new RequestError(400, 'Assign a team member instead of changing the staff name.')
    if (req.user.role === 'technician' && Object.keys(fields).some(key => !['status', 'notes'].includes(key))) throw new RequestError(403, 'Technicians may update only status and notes.')
    if (req.user.role === 'technician' && assignedUserId !== undefined) throw new RequestError(403, 'Technicians cannot reassign visits.')
    let assignee = previous.assignedUserId
    if (assignedUserId !== undefined) {
      const member = await db.collection('users').findOne({ _id: orderId(assignedUserId), teamId: req.user.teamId })
      if (!member) throw new RequestError(400, 'Select a team member.')
      assignee = member._id
      fields.staff = member.name
    }
    const order = validateOrder(fields, previous)
    // Match the validated revision so simultaneous partial updates cannot write
    // a document assembled from stale values. Seeded orders may lack a revision.
    const updated = await orders.findOneAndUpdate(
      { _id, teamId: req.user.teamId, revision: previous.revision ?? { $exists: false } },
      { $set: { ...order, assignedUserId: assignee }, $inc: { revision: 1 } },
      { returnDocument: 'after', includeResultMetadata: false }
    )
    if (!updated) throw new RequestError(409, 'The work order changed. Refresh the board and try again.')
    res.json({ order: { ...serializeOrder(updated), assignedUserId: updated.assignedUserId.toHexString() } })
  })

  app.delete('/api/work-orders/:id', async (req, res) => {
    requireCoordinator(req.user)
    const { deletedCount } = await orders.deleteOne({ _id: orderId(req.params.id), teamId: req.user.teamId })
    if (!deletedCount) throw new RequestError(404, 'Work order was not found.')
    res.status(204).end()
  })

  app.use('/api', (req, res) => res.status(404).json({ error: 'API endpoint was not found.' }))
  app.use(express.static(distPath))
  app.use((err, req, res, next) => {
    if (res.headersSent) return next(err)
    if (err instanceof RequestError) return res.status(err.status).json({ error: err.message })
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body contains invalid JSON.' })
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'Request body is too large.' })
    if (err.status === 415) return res.status(415).json({ error: 'Unsupported request encoding.' })
    if (err instanceof MongoServerSelectionError || err instanceof MongoNetworkError) {
      return res.status(503).json({ error: 'MongoDB is unavailable. Try again shortly.' })
    }
    console.error('Unexpected server error:', err.name)
    res.status(500).json({ error: 'The server could not complete this request.' })
  })
  return app
}
