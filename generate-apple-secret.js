import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

const DEFAULTS = {
  teamId: '89VL28S48Y',
  clientId: 'com.seeday.app.auth',
  keyId: 'Q46FCT9Y3J',
  keyPath: 'C:/Users/yangy/Downloads/AuthKey_Q46FCT9Y3J.p8',
  lifetimeSeconds: 15777000
}

function parseArgs(argv) {
  const args = { ...DEFAULTS }
  for (let i = 2; i < argv.length; i += 1) {
    const arg = argv[i]
    const next = argv[i + 1]
    if (arg === '--team-id' && next) {
      args.teamId = next
      i += 1
      continue
    }
    if (arg === '--client-id' && next) {
      args.clientId = next
      i += 1
      continue
    }
    if (arg === '--key-id' && next) {
      args.keyId = next
      i += 1
      continue
    }
    if (arg === '--key-path' && next) {
      args.keyPath = next
      i += 1
      continue
    }
    if (arg === '--lifetime' && next) {
      args.lifetimeSeconds = Number(next)
      i += 1
      continue
    }
  }
  return args
}

function toBase64Url(input) {
  const buffer = Buffer.isBuffer(input)
    ? input
    : Buffer.from(typeof input === 'string' ? input : JSON.stringify(input))
  return buffer
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function buildAppleClientSecret({ teamId, clientId, keyId, keyPath, lifetimeSeconds }) {
  const now = Math.floor(Date.now() / 1000)
  const header = {
    alg: 'ES256',
    kid: keyId,
    typ: 'JWT'
  }
  const payload = {
    iss: teamId,
    iat: now,
    exp: now + lifetimeSeconds,
    aud: 'https://appleid.apple.com',
    sub: clientId
  }

  const privateKey = fs.readFileSync(path.resolve(keyPath), 'utf8')
  const encodedHeader = toBase64Url(header)
  const encodedPayload = toBase64Url(payload)
  const unsignedToken = `${encodedHeader}.${encodedPayload}`

  const signer = crypto.createSign('SHA256')
  signer.update(unsignedToken)
  signer.end()

  const signature = signer.sign({ key: privateKey, dsaEncoding: 'ieee-p1363' })
  const encodedSignature = toBase64Url(signature)
  return `${unsignedToken}.${encodedSignature}`
}

function main() {
  try {
    const args = parseArgs(process.argv)
    const token = buildAppleClientSecret(args)
    console.log(token)
  } catch (error) {
    console.error('Failed to generate Apple client secret JWT.')
    console.error(error.message)
    process.exit(1)
  }
}

main()
