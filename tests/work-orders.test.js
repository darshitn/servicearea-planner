import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { existsSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { MongoClient, ObjectId } from 'mongodb';
import { seedDemo } from '../scripts/seed.js';
import { createApp } from '../server/app.js';

if (existsSync('.env')) process.loadEnvFile('.env');
const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/servicearea_planner';
// Always select a new database explicitly, including when the URI names a real assignment database.
const dbName = `servicearea_test_${randomUUID().replaceAll('-', '')}`;
const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
const db = client.db(dbName);
let server;
let base;

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
  const app = await serve(db);
  server = app.listener;
  base = app.url;
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
  for (const [key, value] of Object.entries(sample)) assert.equal(order[key], value);

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
    { endTime: sample.startTime }, { staff: '  ' }, { customer: 123 }, { area: '' },
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
