import { execSync } from 'node:child_process'
import { PrismaClient } from '@prisma/client'

// Shared PostgreSQL harness for integration tests. Points at a disposable
// `academy_test` database on the local embedded-postgres server (see
// scripts/pg.mjs). Tests seed their own rows with unique identifiers and clean
// up after themselves, so the database is safe to reuse across runs.
//
// TEST_DATABASE_URL overrides the default (used by CI, which may run PostgreSQL
// on a different host/port).
export function testDatabaseUrl() {
  return (
    process.env.TEST_DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5433/academy_test'
  )
}

// Returns a client if the test database is reachable and has the schema,
// otherwise null so the suite can skip honestly instead of failing the whole
// (unit) run when no PostgreSQL is available.
export async function connectTestDb(): Promise<PrismaClient | null> {
  const url = testDatabaseUrl()
  const prisma = new PrismaClient({ datasources: { db: { url } } })
  try {
    await prisma.$queryRawUnsafe('SELECT 1')
    // Make sure the schema is present (idempotent, cheap when already synced).
    try {
      await prisma.academy.count()
    } catch {
      execSync('npx prisma db push --skip-generate --accept-data-loss', {
        env: { ...process.env, DATABASE_URL: url },
        stdio: 'ignore',
      })
    }
    return prisma
  } catch {
    await prisma.$disconnect().catch(() => {})
    return null
  }
}
