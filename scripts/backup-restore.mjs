#!/usr/bin/env node
/**
 * Logical backup / restore for PostgreSQL, usable where the OS `pg_dump`
 * client tools are not installed (production should still prefer
 * `pg_dump -Fc` / `pg_restore` — see PRODUCTION.md). This exports every model
 * to a single JSON snapshot and restores it into a target database in
 * FK-dependency order, so the round-trip preserves all tenant data.
 *
 *   node scripts/backup-restore.mjs backup  <sourceUrl> <file>
 *   node scripts/backup-restore.mjs restore <targetUrl> <file>   (target schema must already be migrated)
 *   node scripts/backup-restore.mjs verify  <urlA> <urlB>        (compare row counts)
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { PrismaClient } from '@prisma/client'

// Parent-before-child so restores satisfy foreign keys.
const ORDER = [
  'academy', 'superAdmin', 'user', 'class', 'student', 'feeInvoice', 'feePayment',
  'attendanceRecord', 'academySite', 'siteInquiry', 'sitePost', 'planUpgradeRequest',
  'impersonationSession', 'auditLog',
]

const [cmd, urlA, arg2] = process.argv.slice(2)
const client = (url) => new PrismaClient({ datasources: { db: { url } } })

async function backup(url, file) {
  const p = client(url)
  const snapshot = {}
  for (const m of ORDER) snapshot[m] = await p[m].findMany()
  writeFileSync(file, JSON.stringify(snapshot))
  const counts = Object.fromEntries(ORDER.map((m) => [m, snapshot[m].length]))
  console.log('backup counts:', JSON.stringify(counts))
  await p.$disconnect()
  return counts
}

async function restore(url, file) {
  const p = client(url)
  const snapshot = JSON.parse(readFileSync(file, 'utf8'))
  // Clear target in reverse order, then insert forward.
  for (const m of [...ORDER].reverse()) await p[m].deleteMany({})
  for (const m of ORDER) {
    const rows = snapshot[m] ?? []
    if (rows.length) await p[m].createMany({ data: rows })
  }
  console.log('restore complete')
  await p.$disconnect()
}

async function verify(a, b) {
  const pa = client(a), pb = client(b)
  const out = {}
  let ok = true
  for (const m of ORDER) {
    const ca = await pa[m].count(), cb = await pb[m].count()
    out[m] = `${ca}=${cb}${ca === cb ? '' : ' MISMATCH'}`
    if (ca !== cb) ok = false
  }
  console.log('verify (source=target):', JSON.stringify(out))
  console.log(ok ? 'VERIFY OK — all row counts match' : 'VERIFY FAILED')
  await pa.$disconnect(); await pb.$disconnect()
  if (!ok) process.exit(1)
}

if (cmd === 'backup') await backup(urlA, arg2)
else if (cmd === 'restore') await restore(urlA, arg2)
else if (cmd === 'verify') await verify(urlA, arg2)
else { console.log('usage: backup|restore|verify'); process.exit(1) }
