import React, { useEffect, useRef, useState } from 'react'
import { Icon } from './icons'
import { authenticatedFetch as fetch } from './api'

export const statuses = ['Scheduled', 'In progress', 'Completed']
const blank = {
  customer: '',
  service: '',
  area: '',
  address: '',
  staff: '',
  startTime: '09:00',
  endTime: '10:00',
  status: 'Scheduled',
  notes: '',
}
const limits = { customer: 120, service: 160, area: 80, address: 240, staff: 120, notes: 2000 }

export default function OrderDialog({ order, date, onClose, onSaved, user, members }) {
  const editing = Boolean(order)
  const [values, setValues] = useState(() =>
    Object.fromEntries(
      Object.keys({ ...blank, date }).map((key) => [
        key,
        order?.[key] ?? (key === 'date' ? date : blank[key]),
      ]),
    ),
  )
  const [assignedUserId, setAssignedUserId] = useState(order?.assignedUserId || '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const dialog = useRef(null)
  useEffect(() => {
    const element = dialog.current
    element.showModal()
    const before = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      element.close()
      document.body.style.overflow = before
    }
  }, [])
  function field(key) {
    return {
      name: key,
      value: values[key],
      maxLength: limits[key],
      onChange: (e) => {
        setValues({ ...values, [key]: e.target.value })
        setError('')
      },
    }
  }
  async function save(remove = false) {
    if (busy) return
    if (!remove && values.endTime <= values.startTime) {
      setError('Choose an end time after the start time.')
      return
    }
    setError('')
    setBusy(true)
    try {
      const path = '/api/work-orders' + (editing ? '/' + encodeURIComponent(order.id) : '')
      const changes = editing
        ? Object.fromEntries(Object.entries(values).filter(([key, value]) => value !== order[key]))
        : { ...values }
      delete changes.staff
      if (!editing || assignedUserId !== order.assignedUserId) changes.assignedUserId = assignedUserId
      if (!remove && !Object.keys(changes).length) {
        onClose()
        return
      }
      const response = await fetch(
        path,
        remove
          ? { method: 'DELETE' }
          : {
              method: editing ? 'PATCH' : 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(changes),
            },
      )
      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(
          typeof data.error === 'string'
            ? data.error
            : 'The change could not be saved. Please try again.',
        )
      }
      onSaved(
        remove ? date : values.date,
        remove ? 'Work order deleted.' : editing ? 'Work order updated.' : 'Work order created.',
      )
    } catch (err) {
      setError(
        err instanceof TypeError
          ? 'Unable to reach the planner. Check your connection and try again.'
          : err.message,
      )
      setBusy(false)
    }
  }
  return (
    <dialog
      ref={dialog}
      aria-labelledby="dialog-title"
      onCancel={(e) => {
        e.preventDefault()
        if (!busy) onClose()
      }}
    >
      <div className="dialog-head">
        <div>
          <div className="eyebrow">{confirmDelete ? 'Confirm action' : 'Work order details'}</div>
          <h2 id="dialog-title">
            {confirmDelete ? 'Delete this visit?' : editing ? 'Edit work order' : 'New work order'}
          </h2>
        </div>
        <button
          type="button"
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
          disabled={busy}
        >
          <Icon name="close" />
        </button>
      </div>
      {confirmDelete ? (
        <div className="delete-body">
          <p>
            The visit to <strong>{order.customer}</strong> for {order.service} will be removed from
            the schedule.
          </p>
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <div className="dialog-actions">
            <button
              className="secondary"
              disabled={busy}
              onClick={() => {
                setConfirmDelete(false)
                setError('')
              }}
            >
              Keep visit
            </button>
            <button className="danger" disabled={busy} onClick={() => save(true)}>
              {busy ? 'Deleting…' : 'Delete visit'}
            </button>
          </div>
        </div>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault()
            save()
          }}
        >
          <fieldset disabled={busy || user.role === 'technician'}>
            <div className="field-grid">
              <label>
                Service / job title
                <input {...field('service')} placeholder="e.g. Water pump inspection" required />
              </label>
              <label>
                Customer
                <input {...field('customer')} placeholder="Customer or business name" required />
              </label>
              <label>
                Service area
                <input {...field('area')} placeholder="e.g. North district" required />
              </label>
              <label>
                Assigned staff
                <select value={assignedUserId} onChange={event => setAssignedUserId(event.target.value)} required>
                  <option value="">Select a team member</option>
                  {members.map(member => <option key={member.id} value={member.id}>{member.name} ({member.role})</option>)}
                </select>
              </label>
              <label className="wide">
                Visit address
                <input
                  {...field('address')}
                  placeholder="Street address or site location"
                  required
                />
              </label>
              <label>
                Visit date
                <input {...field('date')} type="date" required />
              </label>
              <label>
                Status
                <select {...field('status')}>
                  {statuses.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                Window start
                <input {...field('startTime')} type="time" required />
              </label>
              <label>
                Window end
                <input {...field('endTime')} type="time" required />
              </label>
              <label className="wide">
                <span>
                  Completion notes{' '}
                  <span className="hint">
                    {values.status === 'Completed' ? '(required)' : '(optional)'}
                  </span>
                </span>
                <textarea
                  {...field('notes')}
                  rows="3"
                  required={values.status === 'Completed'}
                  placeholder="Record the outcome or any follow-up work."
                />
              </label>
            </div>
          </fieldset>
          {user.role === 'technician' && <div className="field-grid"><label>Status<select {...field('status')}>{statuses.map(s => <option key={s}>{s}</option>)}</select></label><label>Completion notes<textarea {...field('notes')} required={values.status === 'Completed'} /></label></div>}
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <div className="dialog-actions">
            {editing && user.role === 'coordinator' && (
              <button
                type="button"
                className="text-danger"
                disabled={busy}
                onClick={() => {
                  setConfirmDelete(true)
                  setError('')
                }}
              >
                Delete visit
              </button>
            )}
            <button type="button" className="secondary" disabled={busy} onClick={onClose}>
              Cancel
            </button>
            <button className="primary" disabled={busy}>
              {busy ? 'Saving…' : editing ? 'Save changes' : 'Create work order'}
            </button>
          </div>
        </form>
      )}
    </dialog>
  )
}
