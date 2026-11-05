// Print fixed diagnostic text only. Driver messages can contain connection data.
export function startupDiagnostic(error) {
  const codes = new Set()
  const names = new Set()
  const seen = new Set()
  function visit(value) {
    if (!value || typeof value !== 'object' || seen.has(value)) return
    seen.add(value)
    codes.add(value.code)
    names.add(value.name)
    visit(value.cause)
    visit(value.reason)
    visit(value.error)
    if (value.servers instanceof Map) {
      for (const server of value.servers.values()) visit(server)
    }
  }
  visit(error)
  const stage = ['database-connect', 'database-indexes', 'http-listen'].includes(error?.startupStage)
    ? error.startupStage : 'startup'
  let detail = 'UNCLASSIFIED: Check the database connection and deployment configuration.'
  if (codes.has('MISSING_MONGODB_URI')) detail = 'MISSING_MONGODB_URI: Set MONGODB_URI in this service environment and redeploy.'
  else if (codes.has('EADDRINUSE')) detail = 'PORT_IN_USE: The configured HTTP port is already in use.'
  else if (codes.has(18)) detail = 'AUTH_FAILED: Verify the Atlas database username, password encoding and authentication database.'
  else if (codes.has(13)) detail = 'DATABASE_PERMISSION: Grant the database user read/write and index permissions on the application database.'
  else if (codes.has('ENOTFOUND') || codes.has('EAI_AGAIN') || codes.has('ENODATA') || codes.has('ECONNREFUSED') && stage !== 'http-listen') {
    detail = 'DNS_OR_CONNECTION_REFUSED: Verify the Atlas hostname, active cluster and network access; also check for an accidental localhost URI.'
  } else if (codes.has('CERT_HAS_EXPIRED') || codes.has('UNABLE_TO_VERIFY_LEAF_SIGNATURE') || codes.has('ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR') || codes.has('ERR_TLS_CERT_ALTNAME_INVALID')) {
    const tlsCodes = ['CERT_HAS_EXPIRED', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR', 'ERR_TLS_CERT_ALTNAME_INVALID'].filter(code => codes.has(code))
    detail = 'TLS_FAILED [' + tlsCodes.join(', ') + ']: ' +
      (codes.has('ERR_SSL_TLSV1_ALERT_INTERNAL_ERROR')
        ? 'The peer rejected the TLS handshake. Verify all Render outbound ranges in Atlas Network Access and use the pinned Node runtime. This alert alone does not prove a certificate problem.'
        : 'Verify the certificate chain, cluster hostname and runtime trust store.') +
      ' Keep TLS verification enabled.'
  } else if (names.has('MongoParseError') || names.has('MongoInvalidArgumentError')) {
    detail = 'URI_FORMAT: Use the Atlas driver URI with actual values and URI-encoded credentials.'
  } else if (names.has('MongoServerSelectionError') || names.has('MongoNetworkTimeoutError') || codes.has('ETIMEDOUT')) {
    detail = 'DATABASE_UNREACHABLE: No usable MongoDB server was reached. Check every Render outbound range in Atlas Network Access, the cluster state and the configured URI.'
  }
  return 'API startup failed [' + stage + '] ' + detail
}
