import { readFileSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'
import sql from './client.js'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function migrate() {
  const schema = readFileSync(join(__dirname, 'schema.sql'), 'utf8')
  console.log('Running migrations...')
  await sql.unsafe(schema)
  console.log('Migrations complete.')
  await sql.end()
}

migrate().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
