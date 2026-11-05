import { spawn } from 'node:child_process';
import { once } from 'node:events';
import path from 'node:path';
import { MongoMemoryServer } from 'mongodb-memory-server-core';

// Use a separate temporary database server. Project .env credentials are unnecessary.
const mongo = await MongoMemoryServer.create({
  binary: { downloadDir: path.resolve('.local/mongodb-bin') },
  instance: { ip: '127.0.0.1', storageEngine: 'wiredTiger' }
});
try {
  const test = spawn(process.execPath, ['--test', 'tests/work-orders.test.js', 'tests/passwords.test.js', 'tests/authorization.test.js'], {
    stdio: 'inherit',
    env: { ...process.env, MONGODB_URI: mongo.getUri() }
  });
  const [code] = await once(test, 'exit');
  process.exitCode = code ?? 1;
} finally {
  await mongo.stop();
}
