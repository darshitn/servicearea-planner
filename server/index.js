import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { startServer } from './start.js'
import { startupDiagnostic } from './startup-errors.js'

const envPath = fileURLToPath(new URL('../.env', import.meta.url))
if (existsSync(envPath)) process.loadEnvFile(envPath)

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/servicearea_planner'
const host = process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1')
const port = Number(process.env.PORT || 4000)

async function start() {
  if (process.env.NODE_ENV === 'production' && !process.env.MONGODB_URI?.trim()) {
    const error = new Error('Database configuration is missing.')
    error.code = 'MISSING_MONGODB_URI'
    throw error
  }
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
  console.error(startupDiagnostic(error))
  process.exitCode = 1
})
