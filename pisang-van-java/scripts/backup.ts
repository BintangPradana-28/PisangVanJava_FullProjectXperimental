import { spawn } from 'node:child_process'
import { createCipheriv, randomBytes } from 'node:crypto'
import { createWriteStream, promises as fs } from 'node:fs'
import * as path from 'node:path'
import { pipeline } from 'node:stream/promises'

// dotenv removed in the Bun migration — Bun auto-loads .env.local natively
// (highest precedence of any .env file it reads), so no explicit loading
// call is needed here anymore. This script is invoked as `bun scripts/backup.ts`
// (see .github/workflows/backup.yml), so that auto-load applies.

// --- CONFIGURATION & VALIDATION ---
const DB_URL = process.env.DATABASE_URL
const ENCRYPTION_KEY = process.env.BACKUP_ENCRYPTION_KEY

if (!DB_URL) throw new Error('FATAL: DATABASE_URL is missing.')
if (!ENCRYPTION_KEY || Buffer.from(ENCRYPTION_KEY, 'hex').length !== 32) {
  throw new Error('FATAL: BACKUP_ENCRYPTION_KEY must be a valid 32-byte hex string.')
}

const ALGORITHM = 'aes-256-gcm'
const BACKUP_DIR = path.join(__dirname, '../backups')
const TIMESTAMP = new Date().toISOString().replace(/[:.]/g, '-')
const FILE_PATH = path.join(BACKUP_DIR, `pvj-backup-${TIMESTAMP}.sql.enc`)

async function executeBackup() {
  await fs.mkdir(BACKUP_DIR, { recursive: true })

  // Generate unique 16-byte IV for this backup
  const iv = randomBytes(16)
  const key = Buffer.from(ENCRYPTION_KEY as string, 'hex')
  const cipher = createCipheriv(ALGORITHM, key, iv) // Correct order: algorithm, key, iv

  console.info(`[INFO] Initiating Zero-Trust Backup: ${FILE_PATH}`)

  const pgDump = spawn('pg_dump', [DB_URL as string, '--clean', '--no-owner'], {
    stdio: ['ignore', 'pipe', 'pipe']
  })

  // Capture pg_dump errors
  pgDump.stderr.on('data', (data) => {
    console.warn(`[PG_DUMP WARN]: ${data.toString()}`)
  })

  const fileStream = createWriteStream(FILE_PATH)

  try {
    // Prepend IV to the file
    fileStream.write(iv)

    // Stream: pg_dump -> cipher -> file
    await pipeline(pgDump.stdout, cipher, fileStream)

    // Append GCM Auth Tag (16 bytes) to verify integrity during restore
    const authTag = cipher.getAuthTag()
    await fs.appendFile(FILE_PATH, authTag)

    console.info(`[SUCCESS] Encrypted backup completed safely.`)
  } catch (error) {
    console.error(`[ERROR] Backup pipeline failed. Cleaning up corrupted file...`, error)
    await fs.unlink(FILE_PATH).catch(() => {}) // Graceful deletion
    process.exit(1)
  }
}

executeBackup()
