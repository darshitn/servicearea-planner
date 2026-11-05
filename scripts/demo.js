import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { MongoClient } from 'mongodb';
import { MongoMemoryServer } from 'mongodb-memory-server-core';
import { startServer } from '../server/start.js';
import { localDate, seedDemo } from './seed.js';

// This local demo always uses its own disk-backed MongoDB, isolated from .env.
const dbPath = path.resolve('.local/demo-data');
await mkdir(dbPath, { recursive: true });
const mongo = await MongoMemoryServer.create({
  binary: { downloadDir: path.resolve('.local/mongodb-bin') },
  instance: { dbPath, ip: '127.0.0.1', storageEngine: 'wiredTiger' }
});

let server;
try {
  const uri = mongo.getUri('servicearea_demo');
  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db();
    const date = localDate();
    const seeds = db.collection('demoDays');
    if (!await seeds.findOne({ _id: date })) {
      await seedDemo(db, date);
      // Keep edits and deletions intact when restarting on the same day.
      await seeds.insertOne({ _id: date });
      console.log('Added six fictional visits for ' + date + '.');
    }
  } finally {
    await client.close();
  }
  server = await startServer({ uri, port: Number(process.env.PORT || 4000) });
  console.log('ServiceArea Planner is ready at ' + server.url + ' (Ctrl+C to stop).');
  await new Promise(resolve => {
    process.once('SIGINT', resolve);
    process.once('SIGTERM', resolve);
  });
} finally {
  try {
    await server?.close();
  } finally {
    await mongo.stop({ doCleanup: false });
  }
}
