import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { MongoClient, ObjectId } from 'mongodb';
import { seedDemo } from '../scripts/seed.js';
import { createApp } from '../server/app.js';
import { initializeAuth } from '../server/auth.js';
import { createSession, findSessionUser, deleteSession } from '../server/sessions.js';

if (existsSync('.env')) process.loadEnvFile('.env');
const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/servicearea_planner';
// Always select a new database explicitly, including when the URI names a real assignment database.
const dbName = `servicearea_test_${randomUUID().replaceAll('-', '')}`;
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
const db = client.db(dbName);
let server;
let base;
let cookie;
let userId;
let teamId;
async function fetch(url, options = {}) {
  return globalThis.fetch(url, { ...options, headers: { ...options.headers, ...(cookie ? { Cookie: cookie } : {}) } });
}

async function serve(database) {
  const listener = createApp(database).listen(0, '127.0.0.1');
  await once(listener, 'listening');
  return { listener, url: `http://127.0.0.1:${listener.address().port}/api/work-orders` };
}

function stop(listener) {
  return new Promise((resolve, reject) => listener.close(error => error ? reject(error) : resolve()));
}

before(async () => {
  await client.connect();
  await initializeAuth(db);
  const app = await serve(db);
  server = app.listener;
  base = app.url;
  const register = await fetch(base.replace('/work-orders', '/auth/register'), json('POST', {
    name: 'Coordinator', email: 'coordinator@example.com', password: 'a sufficiently long password', teamName: 'Test team',
  }));
  const account = await register.json();
  userId = account.user.id;
  teamId = (await db.collection('users').findOne({ _id: new ObjectId(userId) })).teamId;
  cookie = register.headers.get('set-cookie').split(';')[0];
});

after(async () => {
  try {
    if (server) {
      await stop(server);
      await db.dropDatabase();
    }
  } finally {
    await client.close();
  }
});

const sample = {
  customer: 'Test Workshop',
  service: 'Service exhaust fan',
  area: 'Domlur',
  address: '12 Example Road',
  staff: 'Test Technician',
  date: '2031-04-12',
  startTime: '09:30',
  endTime: '10:30',
};

function json(method, body) {
  if (method === 'POST' && body?.service) body = { ...body, assignedUserId: userId };
  return { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
}

async function expectError(response, status) {
  assert.equal(response.status, status);
  const body = await response.json();
  assert.equal(typeof body.error, 'string');
  assert.ok(body.error.trim());
}

test('create, list for one day, complete, reopen from a separate DB client, and delete', async () => {
  const created = await fetch(base, json('POST', sample));
  assert.equal(created.status, 201);
  const { order } = await created.json();
  assert.match(order.id, /^[0-9a-f]{24}$/);
  assert.equal(order.status, 'Scheduled');
  assert.equal(order.notes, '');
  for (const [key, value] of Object.entries(sample)) if (key !== 'staff') assert.equal(order[key], value);

  const url = `${base}/${order.id}`;
  const otherDay = await fetch(base, json('POST', { ...sample, date: '2031-04-13' }));
  assert.equal(otherDay.status, 201);
  const list = await fetch(`${base}?date=${sample.date}`);
  assert.equal(list.status, 200);
  assert.deepEqual((await list.json()).orders.map(item => item.id), [order.id]);

  await expectError(await fetch(url, json('PATCH', { status: 'Completed' })), 400);
  const revised = await fetch(url, json('PATCH', { endTime: '08:00' }));
  await expectError(revised, 400);
  const completed = await fetch(url, json('PATCH', { status: 'Completed', notes: 'Cleaned fan and tested airflow.' }));
  assert.equal(completed.status, 200);
  const saved = (await completed.json()).order;
  assert.equal(saved.status, 'Completed');
  assert.equal(saved.endTime, sample.endTime);

  const freshClient = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
  let second;
  try {
    await freshClient.connect();
    second = await serve(freshClient.db(dbName));
    const reloaded = await fetch(`${second.url}?date=${sample.date}`);
    assert.equal(reloaded.status, 200);
    const [persisted] = (await reloaded.json()).orders;
    assert.equal(persisted.id, order.id);
    assert.equal(persisted.status, 'Completed');
    assert.equal(persisted.notes, 'Cleaned fan and tested airflow.');
  } finally {
    if (second) await stop(second.listener);
    await freshClient.close();
  }

  const deleted = await fetch(url, { method: 'DELETE' });
  assert.equal(deleted.status, 204);
  assert.deepEqual((await (await fetch(`${base}?date=${sample.date}`)).json()).orders, []);
  await expectError(await fetch(url, { method: 'DELETE' }), 404);
});

test('reject invalid dates, time windows, status, blank fields, and missing completion notes', async () => {
  for (const changes of [
    { date: '2031-02-29' }, { date: '2031-13-01' }, { startTime: '25:00' },
    { endTime: sample.startTime }, { customer: 123 }, { area: '' },
    { status: 'Cancelled' }, { status: 'Completed', notes: '   ' },
  ]) {
    await expectError(await fetch(base, json('POST', { ...sample, ...changes })), 400);
  }
  await expectError(await fetch(base), 400);
  await expectError(await fetch(`${base}?date=2031-02-30`), 400);
});

test('malformed JSON, malformed IDs, and absent records return meaningful errors', async () => {
  await expectError(await fetch(base, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"customer":',
  }), 400);
  await expectError(await fetch(`${base}/not-an-id`, { method: 'DELETE' }), 400);
  const missing = new ObjectId().toHexString();
  await expectError(await fetch(`${base}/${missing}`, json('PATCH', { notes: 'Inspection planned' })), 404);
});

test('demo visits span areas, sort by appointment, and retain edits when the seed is repeated', async () => {
  const date = '2031-07-10';
  assert.equal((await seedDemo(db, date)).upsertedCount, 6);
  await db.collection('workOrders').updateMany({ date }, { $set: { teamId, assignedUserId: new ObjectId(userId) } });
  const daily = () => fetch(`${base}?date=${date}`).then(response => response.json());
  const { orders } = await daily();
  assert.equal(orders.length, 6);
  assert.equal(new Set(orders.map(item => item.area)).size, 3);
  assert.equal(new Set(orders.map(item => item.status)).size, 3);
  const routeKeys = orders.map(item => `${item.area}/${item.startTime}`);
  assert.deepEqual(routeKeys, [...routeKeys].sort());
  const edited = await fetch(`${base}/${orders[0].id}`, json('PATCH', { notes: 'Coordinator verified the repair.' }));
  assert.equal(edited.status, 200);
  assert.equal((await seedDemo(db, date)).upsertedCount, 0);
  const { orders: repeated } = await daily();
  assert.deepEqual(repeated.map(item => item.id), orders.map(item => item.id));
  assert.equal(repeated[0].notes, 'Coordinator verified the repair.');
});

test('session tokens are hashed in storage, expire, and can be revoked', async () => {
  const userId = new ObjectId();
  await db.collection('users').insertOne({ _id: userId, name: 'Session test' });
  const { token } = await createSession(db, userId);
  assert.equal((await findSessionUser(db, token)).name, 'Session test');
  assert.equal(await db.collection('sessions').findOne({ _id: token }), null);
  assert.equal(await findSessionUser(db, 'invalid'), null);
  await deleteSession(db, token);
  assert.equal(await findSessionUser(db, token), null);
  const expired = await createSession(db, userId);
  await db.collection('sessions').updateOne({ userId }, { $set: { expiresAt: new Date(0) } });
  assert.equal(await findSessionUser(db, expired.token), null);
});

test('team isolation and technician permissions are enforced over HTTP', async () => {
  const coordinatorCookie = cookie;
  const coordinatorId = userId;
  const original = await fetch(base, json('POST', sample));
  const order = (await original.json()).order;
  const inviteResponse = await fetch(base.replace('/work-orders', '/team/invitations'), { method: 'POST' });
  assert.equal(inviteResponse.status, 201);
  const { invitation } = await inviteResponse.json();
  cookie = undefined;
  const invitationUrl = new URL('/', base);
  invitationUrl.searchParams.set('invite', invitation);
  const join = await fetch(base.replace('/work-orders', '/auth/join'), json('POST', {
    name: 'Technician', email: 'tech@example.com', password: 'a sufficiently long password',
    invitation: `  ${invitationUrl.href}  `,
  }));
  assert.equal(join.status, 201);
  const technician = (await join.json()).user;
  const technicianCookie = join.headers.get('set-cookie').split(';')[0];
  cookie = technicianCookie;
  await expectError(await fetch(base, json('POST', sample)), 403);
  await expectError(await fetch(`${base}/${order.id}`, json('PATCH', { status: 'In progress' })), 403);
  cookie = coordinatorCookie;
  assert.equal((await fetch(`${base}/${order.id}`, json('PATCH', { assignedUserId: technician.id }))).status, 200);
  cookie = technicianCookie;
  assert.equal((await fetch(`${base}/${order.id}`, json('PATCH', { status: 'In progress' }))).status, 200);
  await expectError(await fetch(`${base}/${order.id}`, { method: 'DELETE' }), 403);
  cookie = undefined;
  const other = await fetch(base.replace('/work-orders', '/auth/register'), json('POST', {
    name: 'Other', email: 'other@example.com', password: 'a sufficiently long password', teamName: 'Other team',
  }));
  cookie = other.headers.get('set-cookie').split(';')[0];
  assert.deepEqual((await (await fetch(`${base}?date=${sample.date}`)).json()).orders, []);
  await expectError(await fetch(`${base}/${order.id}`, { method: 'DELETE' }), 404);
  cookie = undefined;
  await expectError(await fetch(`${base}?date=${sample.date}`), 401);
  cookie = coordinatorCookie;
  userId = coordinatorId;
});

test('login, logout, duplicate registration and origin checks work through HTTP', async () => {
  const savedCookie = cookie;
  const auth = base.replace('/work-orders', '/auth');
  const account = { name: 'Coordinator', email: 'coordinator@example.com', password: 'a sufficiently long password', teamName: 'Test team' };
  await expectError(await fetch(auth + '/register', json('POST', account)), 409);
  await expectError(await fetch(auth + '/login', json('POST', { ...account, password: 'incorrect password' })), 401);
  const blocked = json('POST', account);
  blocked.headers.Origin = 'https://untrusted.example';
  await expectError(await fetch(auth + '/login', blocked), 403);
  cookie = undefined;
  const login = await fetch(auth + '/login', json('POST', account));
  assert.equal(login.status, 200);
  assert.match(login.headers.get('set-cookie'), /HttpOnly/i);
  assert.match(login.headers.get('set-cookie'), /SameSite=Strict/i);
  cookie = login.headers.get('set-cookie').split(';')[0];
  assert.equal((await (await fetch(auth + '/me')).json()).user.email, account.email);
  assert.equal((await fetch(auth + '/logout', { method: 'POST' })).status, 204);
  assert.equal((await (await fetch(auth + '/me')).json()).user, null);
  await expectError(await fetch(base + '?date=' + sample.date), 401);
  cookie = savedCookie;
});

test('invitation claims survive duplicate email failures and concurrent acceptance', async () => {
  const auth = base.replace('/work-orders', '/auth');
  const invite = async () => (await (await fetch(base.replace('/work-orders', '/team/invitations'), { method: 'POST' })).json()).invitation;
  const invitation = await invite();
  const account = { name: 'Invite user', email: 'coordinator@example.com', password: 'a sufficiently long password', invitation };
  await expectError(await fetch(auth + '/join', json('POST', account)), 409);
  const results = await Promise.all(['invite-a@example.com', 'invite-b@example.com'].map(email =>
    fetch(auth + '/join', json('POST', { ...account, email }))
  ));
  assert.deepEqual(results.map(response => response.status).sort(), [201, 409]);
  await expectError(await fetch(auth + '/join', json('POST', { ...account, email: 'invite-c@example.com' })), 409);
  const expired = await invite();
  const { createHash } = await import('node:crypto');
  await db.collection('invitations').updateOne({ _id: createHash('sha256').update(expired).digest('hex') }, { $set: { expiresAt: new Date(0) } });
  await expectError(await fetch(auth + '/join', json('POST', { ...account, email: 'expired@example.com', invitation: expired })), 400);
});

test('login rate limit persists across separate app instances', async () => {
  await db.collection('authAttempts').deleteMany({});
  const auth = base.replace('/work-orders', '/auth');
  for (let index = 0; index < 30; index++) {
    await expectError(await fetch(auth + '/login', json('POST', { email: 'absent@example.com', password: 'incorrect password' })), 401);
  }
  const second = await serve(db);
  try {
    const limited = await fetch(second.url.replace('/work-orders', '/auth/login'), json('POST', {}));
    await expectError(limited, 429);
    assert.ok(Number(limited.headers.get('retry-after')) > 0);
  } finally { await stop(second.listener); }
  await db.collection('authAttempts').deleteMany({});
});

test('explicit trusted proxy configuration separates forwarded client limits', async () => {
  const previousProxy = process.env.TRUST_PROXY;
  process.env.TRUST_PROXY = 'loopback';
  let proxied;
  try {
    proxied = await serve(db);
    const endpoint = proxied.url.replace('/work-orders', '/auth/login');
    const request = address => {
      const options = json('POST', {});
      options.headers['X-Forwarded-For'] = address;
      return fetch(endpoint, options);
    };
    for (let index = 0; index < 30; index++) await expectError(await request('192.0.2.10'), 401);
    await expectError(await request('192.0.2.10'), 429);
    await expectError(await request('192.0.2.11'), 401);
  } finally {
    if (proxied) await stop(proxied.listener);
    if (previousProxy === undefined) delete process.env.TRUST_PROXY;
    else process.env.TRUST_PROXY = previousProxy;
    await db.collection('authAttempts').deleteMany({});
  }
});
