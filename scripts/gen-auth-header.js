import * as Jwt from '@hapi/jwt'

const argv = process.argv.slice(2)
let source, sbi, jwtSecret

for (let i = 0; i < argv.length; i++) {
  const arg = argv[i]
  const [key, val] = arg.split('=')

  switch (key) {
    case '--source':
      source =
        val !== undefined
          ? val.trim().toLowerCase()
          : (argv[++i] || '').trim().toLowerCase()
      break
    case '--sbi':
      sbi = val ?? argv[++i]
      break
    case '--secret':
      jwtSecret = val ?? argv[++i]
      break
    default:
      // unknown arg — ignore
      break
  }
}

// try env var before prompting
if (!jwtSecret && process.env.AGREEMENTS_JWT_SECRET) {
  jwtSecret = process.env.AGREEMENTS_JWT_SECRET
}

const validSources = new Set(['defra', 'entra'])

if (!source || !validSources.has(source) || !jwtSecret) {
  throw new Error("source must be 'defra' or 'entra' and jwtSecret is required")
}

// eslint-disable-next-line no-console
console.log('UI/API header', {
  'x-encrypted-auth': Jwt.token.generate(
    { source, ...(sbi ? { sbi } : {}) },
    jwtSecret,
    {
      algorithm: 'HS256'
    }
  )
})
