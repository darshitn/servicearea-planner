import assert from 'node:assert/strict'
import { test } from 'node:test'
import { ObjectId } from 'mongodb'
import { teamFilter, requireCoordinator, requireAssignment } from '../server/authorization.js'

test('authorization derives team from the authenticated user', () => {
  const teamId = new ObjectId()
  const coordinator = { _id: new ObjectId(), teamId, role: 'coordinator' }
  const technician = { _id: new ObjectId(), teamId, role: 'technician' }
  assert.deepEqual(teamFilter(coordinator), { teamId })
  assert.throws(() => teamFilter(null), { status: 401 })
  assert.doesNotThrow(() => requireCoordinator(coordinator))
  assert.throws(() => requireCoordinator(technician), { status: 403 })
  assert.doesNotThrow(() => requireAssignment(technician, { assignedUserId: technician._id }))
  assert.throws(() => requireAssignment(technician, { assignedUserId: new ObjectId() }), { status: 403 })
})
