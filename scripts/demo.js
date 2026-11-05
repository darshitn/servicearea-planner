import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { MongoMemoryServer } from 'mongodb-memory-server-core';
import { startServer } from '../server/start.js';

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
