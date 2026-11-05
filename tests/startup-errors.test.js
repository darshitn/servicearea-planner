import { test } from 'node:test'
import assert from 'node:assert/strict'
import { startupDiagnostic } from '../server/startup-errors.js'

test('nested database failures have actionable diagnostics without leaking credentials', () => {
  const secret = 'mongodb+srv://private-user:private-password@private-host/'
  const cases = [
    [{ code: 'MISSING_MONGODB_URI' }, 'MISSING_MONGODB_URI'],
    [{ name: 'MongoServerSelectionError', reason: { servers: new Map([['secret-host', { error: { cause: { code: 'ENOTFOUND' } } }]]) } }, 'DNS_OR_CONNECTION_REFUSED'],
    [{ name: 'MongoServerSelectionError' }, 'DATABASE_UNREACHABLE'],
    [{ code: 18 }, 'AUTH_FAILED'],
    [{ code: 13 }, 'DATABASE_PERMISSION'],
    [{ name: 'MongoParseError' }, 'URI_FORMAT'],
    [{ cause: { code: 'CERT_HAS_EXPIRED' } }, 'TLS_FAILED'],
    [{ cause: { code: 'ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR' } }, 'Atlas Network Access'],
  ]
  for (const [error, expected] of cases) {
    error.message = secret
    const result = startupDiagnostic(error)
    assert.ok(result.includes(expected))
    assert.ok(!result.includes('private-'))
    assert.ok(!result.includes('secret-host'))
  }
})
