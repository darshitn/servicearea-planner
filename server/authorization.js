import { ObjectId } from 'mongodb'
import { RequestError } from './work-orders.js'

// The authenticated user's team always determines the database filter.
export function teamFilter(user) {
  if (!user || !(user.teamId instanceof ObjectId)) {
    throw new RequestError(401, 'Sign in to continue.')
  }
  return { teamId: user.teamId }
}

export function requireCoordinator(user) {
  teamFilter(user)
  if (user.role !== 'coordinator') {
    throw new RequestError(403, 'Only a coordinator can perform this action.')
  }
}

export function requireAssignment(user, order) {
  teamFilter(user)
  if (user.role === 'coordinator') return
  if (user.role !== 'technician' || !order.assignedUserId?.equals(user._id)) {
    throw new RequestError(403, 'Only the assigned technician can update this visit.')
  }
}
