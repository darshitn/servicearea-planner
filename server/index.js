import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { startServer } from './start.js'

const envPath = fileURLToPath(new URL('../.env', import.meta.url))
if (existsSync(envPath)) process.loadEnvFile(envPath)

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/servicearea_planner'
const host = process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1')
const port = Number(process.env.PORT || 4000)

async function start() {
  const server = await startServer({ uri, dbName: process.env.MONGODB_DB, host, port })
  console.log('ServiceArea Planner listening on ' + server.url)
  const stop = () => {
    process.off('SIGINT', stop)
    process.off('SIGTERM', stop)
    server.close().catch(() => { process.exitCode = 1 })
  }
  process.once('SIGINT', stop)
  process.once('SIGTERM', stop)
}

start().catch(error => {
  // Connection strings may contain credentials. Keep startup output actionable
  // without printing driver errors that could expose connection details.
  if (error.code === 'EADDRINUSE') console.error('API port is in use. Choose a different PORT.')
  else console.error('API startup failed (' + error.name + '). Check MongoDB, MONGODB_URI, HOST and PORT.')
  process.exitCode = 1
})
