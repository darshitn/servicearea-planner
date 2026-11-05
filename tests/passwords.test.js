import assert from 'node:assert/strict'
import { test } from 'node:test'
import { hashPassword, verifyPassword } from '../server/passwords.js'

test('password hashes use unique salts and verify only the original password', async () => {
  const first = await hashPassword('example password 123')
  const second = await hashPassword('example password 123')
  assert.notEqual(first, second)
  assert.equal(await verifyPassword('example password 123', first), true)
  assert.equal(await verifyPassword('incorrect password', first), false)
  assert.equal(await verifyPassword('example password 123', 'invalid'), false)
  await assert.rejects(hashPassword('too short'))
})
