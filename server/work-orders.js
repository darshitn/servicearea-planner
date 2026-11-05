export const statuses = ['Scheduled', 'In progress', 'Completed']

const limits = {
  customer: 120,
  service: 160,
  area: 80,
  address: 240,
  staff: 120,
  notes: 2000
}
const fields = new Set([...Object.keys(limits), 'date', 'startTime', 'endTime', 'status'])
const labels = {
  customer: 'Customer', service: 'Service', area: 'Area', address: 'Address',
  staff: 'Assigned staff', date: 'Visit date', startTime: 'Start time',
  endTime: 'End time', status: 'Status', notes: 'Notes'
}
const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/

export class RequestError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

export function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(value + 'T00:00:00.000Z')
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}

// Validate the complete resulting document so a partial update cannot invalidate
// an existing time window or remove the notes from a completed visit.
export function validateOrder(body, previous) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || !Object.keys(body).length) {
    throw new RequestError(400, 'Provide work-order fields in a JSON object.')
  }
  for (const key of Object.keys(body)) {
    if (!fields.has(key)) throw new RequestError(400, 'Unknown work-order field: ' + key)
  }
  const order = {}
  for (const key of fields) {
    let value
    if (Object.hasOwn(body, key)) value = body[key]
    else if (previous && Object.hasOwn(previous, key)) value = previous[key]
    else if (key === 'status') value = 'Scheduled'
    else if (key === 'notes') value = ''
    if (typeof value !== 'string') throw new RequestError(400, labels[key] + ' must be text.')
    value = value.trim()
    if (key !== 'notes' && !value) throw new RequestError(400, labels[key] + ' is required.')
    if (limits[key] && value.length > limits[key]) {
      throw new RequestError(400, labels[key] + ' must be ' + limits[key] + ' characters or fewer.')
    }
    order[key] = value
  }
  if (!validDate(order.date)) throw new RequestError(400, 'Use a valid visit date in YYYY-MM-DD format.')
  if (!timePattern.test(order.startTime) || !timePattern.test(order.endTime)) {
    throw new RequestError(400, 'Use 24-hour times in HH:MM format.')
  }
  if (order.endTime <= order.startTime) throw new RequestError(400, 'End time must be later than start time.')
  if (!statuses.includes(order.status)) throw new RequestError(400, 'Choose a valid work-order status.')
  if (order.status === 'Completed' && !order.notes) throw new RequestError(400, 'Add completion notes before marking a visit completed.')
  return order
}

export function serializeOrder(document) {
  const result = { id: document._id.toHexString() }
  for (const key of fields) result[key] = document[key]
  return result
}
