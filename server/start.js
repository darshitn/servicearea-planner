import { once } from 'node:events'
import { MongoClient } from 'mongodb'
import { createApp } from './app.js'
import { initializeAuth } from './auth.js'

export async function startServer({ uri, dbName, host = '127.0.0.1', port = 4000 }) {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 })
  try {
    await client.connect()
    const db = client.db(dbName || undefined)
    await initializeAuth(db)
    await db.collection('workOrders').createIndex({ teamId: 1, date: 1, area: 1, startTime: 1, _id: 1 })
    const server = createApp(db).listen(port, host)
    await once(server, 'listening')
    const urlHost = host.includes(':') ? '[' + host + ']' : host
    return {
      url: 'http://' + urlHost + ':' + server.address().port,
      async close() {
        try {
          await new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve()))
        } finally {
          await client.close()
        }
      }
    }
  } catch (error) {
    await client.close()
    throw error
  }
}
