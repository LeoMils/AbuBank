#!/usr/bin/env node
/**
 * Generate a self-signed TLS cert for local HTTPS dev.
 * Uses openssl (available via Git for Windows).
 * Output: tmp/dev-cert/key.pem + tmp/dev-cert/cert.pem
 *
 * Why this matters: iOS Safari only exposes navigator.mediaDevices (the
 * microphone) on a SECURE context — https://, localhost, or 127.0.0.1. Over
 * plain http on a LAN IP the mic API is undefined and AbuAI voice cannot start.
 * This cert + `npm run dev:https` lets the iPhone load the app over https so the
 * microphone works.
 *
 * The cert's subjectAltName auto-includes EVERY non-internal IPv4 address of
 * this machine, so whichever LAN IP the iPhone connects to (10.0.0.10, etc.) is
 * covered — no more hardcoded-IP mismatch. Extra IPs can be added via
 * DEV_CERT_IPS=a,b,c.
 *
 * Usage: node scripts/generate-dev-cert.cjs
 * Then:  npm run dev:https
 */
const { execSync } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')

const DIR = path.resolve(__dirname, '..', 'tmp', 'dev-cert')
const KEY = path.join(DIR, 'key.pem')
const CERT = path.join(DIR, 'cert.pem')
const CONF = path.join(DIR, '_openssl.cnf')

// Collect this machine's LAN IPv4 addresses so the cert is valid for whichever
// one the phone uses. Always include loopback.
function localIPv4s() {
  const ips = new Set(['127.0.0.1'])
  const ifaces = os.networkInterfaces()
  for (const name of Object.keys(ifaces)) {
    for (const net of ifaces[name] || []) {
      if (net.family === 'IPv4' && !net.internal) ips.add(net.address)
    }
  }
  for (const extra of (process.env.DEV_CERT_IPS || '').split(',')) {
    const t = extra.trim()
    if (t) ips.add(t)
  }
  return [...ips]
}

const ips = localIPv4s()
const sanIPs = ips.map((ip, i) => `IP.${i + 1} = ${ip}`).join('\n')
const sanList = `DNS.1 = localhost\n${sanIPs}`

// Reuse if < 30 days old AND it already covers every current IP. A new LAN IP
// (e.g. the phone moved networks) forces a regenerate so the cert stays valid.
if (fs.existsSync(KEY) && fs.existsSync(CERT)) {
  const age = Date.now() - fs.statSync(CERT).mtimeMs
  let coversAll = true
  try {
    const txt = execSync(`openssl x509 -in "${CERT}" -noout -text`, { encoding: 'utf8' })
    coversAll = ips.every(ip => txt.includes(`IP Address:${ip}`))
  } catch { coversAll = false }
  if (age < 30 * 86400000 && coversAll) {
    console.log(`Cert exists (${Math.round(age / 86400000)}d old), covers ${ips.join(', ')}. Reusing.`)
    process.exit(0)
  }
  console.log('Regenerating cert (age or IP coverage changed)...')
}

fs.mkdirSync(DIR, { recursive: true })

fs.writeFileSync(CONF, `[req]
distinguished_name = dn
x509_extensions = ext
prompt = no
[dn]
CN = AbuBank Dev
[ext]
subjectAltName = @alt_names
keyUsage = digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth
[alt_names]
${sanList}
`)

execSync(
  `openssl req -x509 -newkey rsa:2048 -keyout "${KEY}" -out "${CERT}" -days 365 -nodes -config "${CONF}"`,
  { stdio: 'inherit' }
)

fs.unlinkSync(CONF)
console.log(`\nDone. Cert valid for: ${ips.join(', ')}\n  Key:  ${KEY}\n  Cert: ${CERT}\n`)
console.log('Next: npm run dev:https')
console.log(`iPhone: open https://<one-of-the-IPs-above>:5173 → Accept the certificate warning once → mic works`)
