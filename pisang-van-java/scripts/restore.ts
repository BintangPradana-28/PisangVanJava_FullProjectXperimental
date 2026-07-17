import { spawn } from 'node:child_process'
import { createDecipheriv } from 'node:crypto'
import { createReadStream, promises as fs } from 'node:fs'
import { pipeline } from 'node:stream/promises'

// dotenv removed in the Bun migration — Bun auto-loads .env.local natively,
// so no explicit loading call is needed here anymore (see backup.ts for the
// same fix). node:path is no longer used elsewhere in this file, so it's
// removed along with it rather than left as a dead import.

const DB_URL = process.env.DATABASE_URL
const ENCRYPTION_KEY = process.env.BACKUP_ENCRYPTION_KEY
const TARGET_FILE = process.argv[2] // Pass file path via CLI args

if (!DB_URL || !ENCRYPTION_KEY || !TARGET_FILE) {
  throw new Error('FATAL: Missing DB_URL, ENCRYPTION_KEY, or target file argument.')
}

const ALGORITHM = 'aes-256-gcm'

async function executeRestore() {
  console.info(`[INFO] Initiating Restoration from: ${TARGET_FILE}`)

  const fileStats = await fs.stat(TARGET_FILE)
  const fileSize = fileStats.size

  // A valid AES-256-GCM file must have at least 16 bytes IV + 16 bytes Auth Tag
  if (fileSize <= 32) throw new Error('FATAL: Backup file is too small or corrupted.')

  // Extract IV (first 16 bytes) and Auth Tag (last 16 bytes)
  const fileHandle = await fs.open(TARGET_FILE, 'r')

  const iv = Buffer.alloc(16)
  await fileHandle.read(iv, 0, 16, 0)

  const authTag = Buffer.alloc(16)
  await fileHandle.read(authTag, 0, 16, fileSize - 16)

  await fileHandle.close()

  const key = Buffer.from(ENCRYPTION_KEY as string, 'hex')
  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: 16 }) // Correct order: algorithm, key, iv
  decipher.setAuthTag(authTag)

  // Read the ciphertext only (skipping IV at start and AuthTag at end)
  const readStream = createReadStream(TARGET_FILE, {
    start: 16,
    end: fileSize - 17
  })

  const psql = spawn('psql', [DB_URL as string], {
    stdio: ['pipe', 'inherit', 'inherit']
  })

  try {
    // Stream: Encrypted File -> Decipher -> psql
    await pipeline(readStream, decipher, psql.stdin)
    console.info(`[SUCCESS] Database restoration completed successfully.`)
  } catch (error) {
    console.error(
      `[ERROR] Restoration failed. Possible causes: Invalid key, tampered file, or DB connection issue.`,
      error
    )
    process.exit(1)
  }
}

executeRestore()
