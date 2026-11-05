import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Icon, RouteMap } from './icons'
import OrderDialog, { statuses } from './OrderDialog'
import Account from './Account'
import { authenticatedFetch as fetch } from './api'
import './styles.css'

function localDate(day = new Date()) {
  return [
    day.getFullYear(),
    String(day.getMonth() + 1).padStart(2, '0'),
    String(day.getDate()).padStart(2, '0'),
  ].join('-')
}
const dayObject = (date) => new Date(date + 'T12:00:00')
const formatDay = (date, options) => dayObject(date).toLocaleDateString('en-GB', options)
const plural = (count, noun) => count + ' ' + noun + (count === 1 ? '' : 's')
const normalize = (value) => value.trim().toLowerCase()
function groupByArea(orders) {
  const groups = new Map()
  for (const order of orders) {
    const key = normalize(order.area)
    if (!groups.has(key)) groups.set(key, { area: order.area, orders: [] })
    groups.get(key).orders.push(order)
  }
  return [...groups.values()]
    .sort((a, b) => a.area.localeCompare(b.area))
    .map((group) => ({
      ...group,
      orders: group.orders.sort(
        (a, b) =>
          a.startTime.localeCompare(b.startTime) ||
          a.endTime.localeCompare(b.endTime) ||
          a.customer.localeCompare(b.customer),
      ),
    }))
}
function WorkOrder({ order, onEdit, user }) {
  return (
    <li className="visit">
      <div className="visit-time">
        <strong>{order.startTime}</strong>
        <span>to {order.endTime}</span>
      </div>
      <div className="visit-main">
        <h4>{order.service}</h4>
        <div className="customer">{order.customer}</div>
        <div className="address">
          <Icon name="pin" size={13} />
          {order.address}
        </div>
        {order.notes && (
          <p className="visit-note">
            <Icon name="note" size={14} />
            {order.notes}
          </p>
        )}
      </div>
      <div className="visit-assignment">
        <div className={'status status-' + statuses.indexOf(order.status)}>
          <i />
          {order.status}
        </div>
        <span className="staff">
          <Icon name="person" size={14} />
          {order.staff}
        </span>
      </div>
      {(user.role === 'coordinator' || order.assignedUserId === user.id) && <button
        className="edit-button"
        aria-label={'Edit ' + order.service + ' for ' + order.customer}
        onClick={() => onEdit(order)}
        title="Edit work order"
      >
        <Icon name="edit" size={16} />
      </button>}
    </li>
  )
}
function Planner({ user, onLogout, logoutError }) {
  const [date, setDate] = useState(() => localDate())
  const [filter, setFilter] = useState('All statuses')
  const [result, setResult] = useState({ date: '', version: -1, orders: [], error: '' })
  const [version, setVersion] = useState(0)
  const [editor, setEditor] = useState(null)
  const [notice, setNotice] = useState('')
  const [members, setMembers] = useState([])
  const [invite, setInvite] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/team/members', { signal: controller.signal })
      .then(response => {
        if (!response.ok) throw new Error('Could not refresh team members.')
        return response.json()
      })
      .then(data => setMembers(data.members || []))
      .catch(error => { if (!controller.signal.aborted) setNotice(error.message) })
    return () => controller.abort()
  }, [editor])
  async function createInvite() {
    try {
      const response = await fetch('/api/team/invitations', { method: 'POST' })
      const data = await response.json()
      if (response.ok) setInvite(window.location.origin + '/?invite=' + data.invitation)
      else setNotice(data.error || 'Could not create invitation.')
    } catch { setNotice('Could not reach the server. Please try again.') }
  }
  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      try {
        const response = await fetch('/api/work-orders?date=' + encodeURIComponent(date), {
          signal: controller.signal,
        })
        if (!response.ok) throw new Error()
        const data = await response.json()
        if (!Array.isArray(data.orders)) throw new Error()
        if (!controller.signal.aborted) setResult({ date, version, orders: data.orders, error: '' })
      } catch {
        if (!controller.signal.aborted)
          setResult({
            date,
            version,
            orders: [],
            error:
              'The schedule could not be loaded. Check that the API and database are running, then try again.',
          })
      }
    }
    load()
    return () => controller.abort()
  }, [date, version])
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(() => setNotice(''), 4000)
    return () => window.clearTimeout(timer)
  }, [notice, version])
  const loading = result.date !== date || result.version !== version
  const orders = loading ? [] : result.orders
  const available = !loading && !result.error
  const allGroups = groupByArea(orders)
  const groups =
    filter === 'All statuses' ? allGroups : groupByArea(orders.filter((o) => o.status === filter))
  const staff = new Set(orders.map((o) => normalize(o.staff))).size
  const done = orders.filter((o) => o.status === 'Completed').length
  const metrics = [
    ['clipboard', 'Work orders', orders.length],
    ['pin', 'Service areas', allGroups.length],
    ['people', 'Assigned staff', staff],
    ['check', 'Completed', done],
  ]
  function stepDay(direction) {
    const next = dayObject(date)
    next.setDate(next.getDate() + direction)
    setDate(localDate(next))
  }
  function add() {
    setEditor({ order: null })
  }
  return (
    <>
      <header className="masthead">
        <div className="shell masthead-inner">
          <div className="brand">
            <span className="brand-mark">
              <Icon name="route" size={25} />
            </span>
            <span>
              ServiceArea <b>Planner</b>
            </span>
          </div>
          <span className="workspace-label">
            <span className="tiny-square" /> {user.teamName} · {user.name} · {user.role}
          </span>
          <button className="secondary" onClick={onLogout}>Log out</button>
        </div>
      </header>
      <main className="shell workspace">
        {logoutError && <p className="form-error" role="alert">{logoutError}</p>}
        <section className="hero" aria-labelledby="page-title">
          <RouteMap />
          <div className="hero-copy">
            <div className="eyebrow hero-overline">
              <span />
              Dispatch workspace
            </div>
            <h1 id="page-title">Daily visit planner</h1>
            <p>Coordinate work orders, people and places in one view.</p>
          </div>
        </section>
        <section className="metrics" aria-label="Selected day totals">
          {metrics.map(([icon, label, value]) => (
            <div className="metric" key={label}>
              <span className="metric-icon">
                <Icon name={icon} size={21} />
              </span>
              <div>
                <div className="metric-value">
                  {available ? String(value).padStart(2, '0') : '—'}
                </div>
                <span className="metric-name">{label}</span>
              </div>
            </div>
          ))}
        </section>
        <section className="schedule" aria-labelledby="schedule-title">
          <div className="schedule-head">
            <div>
              <div className="eyebrow section-index">
                <span />
                Route planning
              </div>
              <h2 id="schedule-title">Area itinerary</h2>
              <p>Visits grouped by service area, in appointment order.</p>
            </div>
            {user.role === 'coordinator' && <button className="primary new-order" onClick={add}>
              <Icon name="plus" size={18} />
              New work order
            </button>}
          </div>
          {user.role === 'coordinator' && <div className="account-switch"><button className="secondary" onClick={createInvite}>Create technician invitation</button>{invite && <label>Invitation link (expires in 24 hours)<input readOnly value={invite} onFocus={event => event.target.select()} /></label>}</div>}
          <div className="toolbar">
            <div className="day-controls">
              <button className="arrow" aria-label="Previous day" onClick={() => stepDay(-1)}>
                <Icon name="left" size={15} />
              </button>
              <label className="date-control">
                <Icon name="calendar" size={16} />
                <span>
                  {formatDay(date, {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                  })}
                </span>
                <input
                  aria-label="Select schedule date"
                  type="date"
                  value={date}
                  onChange={(e) => {
                    if (e.target.value) setDate(e.target.value)
                  }}
                />
              </label>
              <button className="arrow" aria-label="Next day" onClick={() => stepDay(1)}>
                <Icon name="right" size={15} />
              </button>
              {date !== localDate() && (
                <button className="today" onClick={() => setDate(localDate())}>
                  Today
                </button>
              )}
            </div>
            <label className="filter-control">
              <span>Status</span>
              <select
                aria-label="Filter by status"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                {['All statuses', ...statuses].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="itinerary" aria-busy={loading}>
            {loading ? (
              <div className="panel-state" role="status">
                <span className="state-icon">
                  <Icon name="clock" size={26} />
                </span>
                <h3>Loading the schedule…</h3>
              </div>
            ) : result.error ? (
              <div className="panel-state" role="alert">
                <span className="state-icon">
                  <Icon name="route" size={26} />
                </span>
                <h3>Schedule unavailable</h3>
                <p>{result.error}</p>
                <button className="secondary" onClick={() => setVersion((v) => v + 1)}>
                  Try again
                </button>
              </div>
            ) : groups.length === 0 ? (
              <div className="panel-state">
                <span className="state-icon">
                  <Icon name="route" size={26} />
                </span>
                <h3>{orders.length ? 'No matching visits' : 'No visits scheduled'}</h3>
                <p>
                  {orders.length
                    ? 'Choose another status to see visits for this day.'
                    : 'Create a work order to start planning this day’s visits.'}
                </p>
                {(orders.length || user.role === 'coordinator') && <button
                  className="secondary"
                  onClick={orders.length ? () => setFilter('All statuses') : add}
                >
                  {orders.length ? 'Show all statuses' : 'Add first visit'}
                </button>}
              </div>
            ) : (
              groups.map(({ area, orders: areaOrders }, i) => (
                <article className="area" key={normalize(area)}>
                  <div className="area-head">
                    <span className="area-icon">
                      <Icon name="pin" size={18} />
                    </span>
                    <div className="area-title">
                      <div className="eyebrow">Area {String(i + 1).padStart(2, '0')}</div>
                      <h3>{area}</h3>
                    </div>
                    <span className="visit-count">{plural(areaOrders.length, 'visit')}</span>
                  </div>
                  <ol>
                    {areaOrders.map((order) => (
                      <WorkOrder
                        key={order.id}
                        order={order}
                        user={user}
                        onEdit={(o) => setEditor({ order: o })}
                      />
                    ))}
                  </ol>
                </article>
              ))
            )}
          </div>
        </section>
        <footer>
          <Icon name="route" size={15} />
          <span>ServiceArea Planner</span>
          <span className="footer-right">Field operations workspace</span>
        </footer>
      </main>
      {notice && (
        <div className="toast" role="status">
          <Icon name="check" size={17} />
          {notice}
        </div>
      )}
      {editor && (
        <OrderDialog
          order={editor.order}
          user={user}
          members={members}
          date={date}
          onClose={() => setEditor(null)}
          onSaved={(newDate, message) => {
            setEditor(null)
            setDate(newDate)
            setFilter('All statuses')
            setNotice(message)
            setVersion((v) => v + 1)
          }}
        />
      )}
    </>
  )
}

function App() {
  const [user, setUser] = useState(undefined)
  const [logoutError, setLogoutError] = useState('')
  useEffect(() => {
    const expire = () => setUser(null)
    window.addEventListener('planner-session-expired', expire)
    return () => window.removeEventListener('planner-session-expired', expire)
  }, [])
  useEffect(() => { fetch('/api/auth/me').then(response => response.json()).then(data => setUser(data.user)).catch(() => setUser(null)) }, [])
  async function logout() {
    setLogoutError('')
    try {
      const response = await fetch('/api/auth/logout', { method: 'POST' })
      if (!response.ok) throw new Error('Logout failed. Your session may still be active. Try again.')
      setUser(null)
    } catch (error) { setLogoutError(error.message) }
  }
  if (user === undefined) return <main className="shell workspace">Loading…</main>
  return user ? <Planner user={user} onLogout={logout} logoutError={logoutError} /> : <Account onLogin={setUser} />
}
createRoot(document.getElementById('root')).render(<App />)
