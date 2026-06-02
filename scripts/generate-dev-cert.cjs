#!/usr/bin/env node
/**
 * Generate a self-signed TLS cert for local HTTPS dev.
 * Uses openssl (available via Git for Windows).
 * Output: tmp/dev-cert/key.pem + tmp/dev-cert/cert.pem
 *
 * Usage: node scripts/generate-dev-cert.js
 * Then:  npm run dev:https
 */
const { execSync } = require('child_process')
const fs = require('fs')
const path = require('path')

const DIR = path.resolve(__dirname, '..', 'tmp', 'dev-cert')
const KEY = path.join(DIR, 'key.pem')
const CERT = path.join(DIR, 'cert.pem')
const CONF = path.join(DIR, '_openssl.cnf')

// Reuse if < 30 days old
if (fs.existsSync(KEY) && fs.existsSync(CERT)) {
  const age = Date.now() - fs.statSync(CERT).mtimeMs
  if (age < 30 * 86400000) {
    console.log(`Cert exists (${Math.round(age / 86400000)}d old). Reusing.`)
    process.exit(0)
  }
}

fs.mkdirSync(DIR, { recursive: true })

fs.writeFileSync(CONF, `[req]
distinguished_name = dn
x509_extensions = ext
prompt = no
[dn]
CN = AbuBank Dev
[ext]
subjectAltName = DNS:localhost, IP:127.0.0.1, IP:10.0.0.17
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
`)

execSync(
  `openssl req -x509 -newkey rsa:2048 -keyout "${KEY}" -out "${CERT}" -days 365 -nodes -config "${CONF}"`,
  { stdio: 'inherit' }
)

fs.unlinkSync(CONF)
console.log(`\nDone.\n  Key:  ${KEY}\n  Cert: ${CERT}\n`)
console.log('Next: npm run dev:https')
console.log('iPhone: https://10.0.0.17:5173 → Accept cert → mic works')
