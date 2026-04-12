/**
 * Bumps the build tag in build.json before each production build.
 * Format: YYYY-MM-DD.X  (X resets to 1 each new day)
 */
import { readFileSync, writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const buildFile = resolve(__dirname, '..', 'build.json')

const now = new Date()
const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}` // YYYY-MM-DD local time
const prev = JSON.parse(readFileSync(buildFile, 'utf-8'))
const seq = prev.date === today ? prev.seq + 1 : 1

writeFileSync(buildFile, JSON.stringify({ date: today, seq }, null, 2) + '\n')
console.log(`Build tag: ${today}.${seq}`)
