#!/usr/bin/env node
/**
 * Local/CI PostgreSQL control using the real PostgreSQL binaries bundled by
 * `embedded-postgres` (no Docker required). This is what makes the PostgreSQL
 * path genuinely runnable in this repo — `npm run db:pg:start` boots a real
 * server, `stop` shuts it down, `status` reports.
 *
 *   node scripts/pg.mjs start|stop|status|reset [--port 5433] [--data .pgdata]
 *
 * DATABASE_URL for the booted server (default):
 *   postgresql://postgres:postgres@localhost:5433/academy
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function binDir() {
  // Resolve the platform package embedded-postgres installed for this OS/arch.
  const plat = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'darwin' : 'linux'
  const arch = process.arch === 'arm64' ? 'arm64' : 'x64'
  const pkg = `@embedded-postgres/${plat}-${arch}`
  const dir = path.join(root, 'node_modules', pkg, 'native', 'bin')
  if (!existsSync(dir)) throw new Error(`PostgreSQL binaries not found at ${dir}. Run: npm install`)
  return dir
}

const args = process.argv.slice(2)
const cmd = args[0]
const getFlag = (name, def) => {
  const i = args.indexOf(`--${name}`)
  return i >= 0 && args[i + 1] ? args[i + 1] : def
}
const port = getFlag('port', process.env.PGPORT || '5433')
const dataDir = path.resolve(root, getFlag('data', '.pgdata'))
const pwFile = path.join(root, '.pgpassword')
const bin = binDir()
const exe = (name) => path.join(bin, process.platform === 'win32' ? `${name}.exe` : name)
const run = (name, a, opts = {}) => execFileSync(exe(name), a, { stdio: 'inherit', ...opts })

function ensureInit() {
  if (existsSync(path.join(dataDir, 'PG_VERSION'))) return
  mkdirSync(dataDir, { recursive: true })
  writeFileSync(pwFile, 'postgres')
  run('initdb', ['-D', dataDir, '-U', 'postgres', '-A', 'password', `--pwfile=${pwFile}`, '-E', 'UTF8'])
  rmSync(pwFile, { force: true })
}

function isRunning() {
  try {
    run('pg_ctl', ['-D', dataDir, 'status'], { stdio: 'pipe' })
    return true
  } catch {
    return false
  }
}

function start() {
  ensureInit()
  if (isRunning()) return console.log(`postgres already running (data=${dataDir})`)
  run('pg_ctl', ['-D', dataDir, '-o', `-p ${port}`, '-l', path.join(dataDir, 'server.log'), '-w', 'start'])
  // Ensure the application database exists (idempotent).
  try {
    run('createdb', ['-h', 'localhost', '-p', port, '-U', 'postgres', 'academy'], {
      stdio: 'pipe',
      env: { ...process.env, PGPASSWORD: 'postgres' },
    })
  } catch {
    /* already exists */
  }
  console.log(`postgres up on :${port} — DATABASE_URL=postgresql://postgres:postgres@localhost:${port}/academy`)
}

function stop() {
  if (!existsSync(path.join(dataDir, 'PG_VERSION'))) return console.log('no data dir')
  try {
    run('pg_ctl', ['-D', dataDir, '-m', 'fast', 'stop'])
  } catch {
    console.log('not running')
  }
}

switch (cmd) {
  case 'start':
    start()
    break
  case 'stop':
    stop()
    break
  case 'status':
    console.log(isRunning() ? 'running' : 'stopped')
    break
  case 'reset':
    stop()
    rmSync(dataDir, { recursive: true, force: true })
    console.log('data dir removed:', dataDir)
    break
  default:
    console.log('usage: node scripts/pg.mjs start|stop|status|reset [--port N] [--data DIR]')
    process.exit(1)
}
